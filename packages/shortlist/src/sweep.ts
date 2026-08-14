import { BERGEN_MUNICIPALITIES, checkBergenList } from "@site-factory/copy";
import {
  CallBudget,
  DISCOVERY_FIELD_MASK,
  searchTextDetailed,
  type FetchLike,
  type PlacesPlace,
  type UsageMeter,
} from "@site-factory/discover";

import { copyPackFor, type Niche } from "./niches.js";
import type { SweepResult } from "./types.js";

/**
 * The county sweep.
 *
 * One Text Search per (niche, municipality). 70 towns x 3 copy-pack niches is
 * 210 queries, and with `--pages 1` that is 210 billable calls — every one of
 * them Enterprise, knowingly, because the sweep mask needs `websiteUri` and
 * `nationalPhoneNumber` and those are Enterprise fields. See
 * `DISCOVERY_FIELD_MASK` for why there is no cheaper shape.
 *
 * There is no second pass. Nothing here calls Place Details.
 */

export const REGION = "NJ";

export interface SweepOptions {
  niches: readonly Niche[];
  towns?: readonly string[] | undefined;
  apiKey: string;
  meter: UsageMeter;
  budget: CallBudget;
  /** Pages per (niche, town). Each follow-up is another Enterprise call. */
  pages?: number | undefined;
  fetchImpl?: FetchLike | undefined;
  /** Progress line per query. */
  onQuery?: ((info: QueryProgress) => void) | undefined;
  /**
   * Every distinct business found so far, handed over after each cell —
   * including the cell that exhausts the budget, before this throws.
   *
   * Places calls are metered and already paid for by the time they are in this
   * array. A caller that persists them here cannot lose them to a ceiling, a
   * Ctrl-C or a power cut, which is the whole reason this hook exists rather
   * than the caller waiting for the return value. Awaited, so a slow write
   * cannot be overtaken by the next cell.
   */
  onCell?: ((results: readonly SweepResult[]) => void | Promise<void>) | undefined;
}

export interface QueryProgress {
  niche: Niche;
  town: string;
  index: number;
  total: number;
  found: number;
  /** New after dedupe. */
  fresh: number;
}

/**
 * The stop, carrying everything the run bought before it.
 *
 * Thrown rather than returned because a ceiling really is exceptional — the
 * caller must not be able to mistake a partial county for a whole one by
 * ignoring a return value. The message is the budget's own, so anything
 * matching on it still matches; what is added is the outcome, so the caller can
 * write, assert and summarise a partial run exactly as it would a complete one.
 */
export class SweepStopped extends Error {
  readonly outcome: SweepOutcome;

  constructor(cause: Error, outcome: SweepOutcome) {
    super(cause.message, { cause });
    this.name = "SweepStopped";
    this.outcome = outcome;
  }
}

export interface SweepOutcome {
  results: SweepResult[];
  /** Distinct masks the sweep actually emitted. Must be exactly one. */
  emittedMasks: string[];
  queries: number;
  /** Queries that threw, with the reason. The sweep continues past them. */
  failures: { niche: string; town: string; reason: string }[];
}

const PAGE_SIZE = 20;

export interface Projection {
  /** Exact ceiling, and now genuinely exact. */
  high: number;
  label: string;
}

/**
 * What the run will cost, exactly.
 *
 * This used to be a range built on a measured ~3.6 calls per cell. That number
 * was an artifact: on the 2026-08-14 run, 69 cells cost one call each and a
 * single cell — `welding and fabrication in Allendale, NJ` — spent 730 of the
 * 800-call budget in an uncapped paging loop. Averaging the runaway across the
 * healthy cells produced a plausible constant describing nothing that ever
 * happened, which is worse than no constant at all, so it is gone.
 *
 * With `maxCalls` capping each cell at `pages` requests, `cells × pages` is a
 * hard ceiling rather than an estimate, and the run cannot exceed it.
 */
export function projectCalls(cells: number, pages: number, dryRun: boolean): Projection {
  const high = cells * pages;
  const each = pages === 1 ? "one call per cell" : `at most ${pages} calls per cell`;
  return {
    high,
    label: dryRun
      ? `${high} (${each} — dry run, zero network)`
      : `${high} at most (${each}, capped; a cell that runs out of results costs less)`,
  };
}

/** The text query for one cell of the grid. */
export function queryFor(niche: Niche, town: string): string {
  return `${niche.query} in ${town}, ${REGION}`;
}

function toResult(place: PlacesPlace, niche: Niche, town: string, copyPack: string): SweepResult | null {
  const placeId = place.id?.trim() ?? "";
  // A result with no place id has no identity, and identity is the primary key
  // of everything downstream. Dropped rather than keyed on something weaker.
  if (!placeId) return null;

  return {
    placeId,
    name: place.displayName?.text?.trim() ?? "",
    nicheSlug: niche.slug,
    nicheLabel: niche.label,
    town,
    address: place.formattedAddress?.trim() ?? "",
    phone: place.nationalPhoneNumber?.trim() ?? "",
    website: place.websiteUri?.trim() ?? "",
    types: place.types ?? [],
    // Absent stays empty. A business with no rating gets "", never a zero —
    // unmeasured is unavailable, and the scorer treats the two differently.
    rating: place.rating === undefined ? "" : String(place.rating),
    reviewCount: place.userRatingCount === undefined ? "" : String(place.userRatingCount),
    copyPack,
    seenIn: [`${niche.slug}/${town}`],
  };
}

/**
 * Sweep every (niche, town) cell, deduplicating by place id.
 *
 * A shop near a municipal boundary surfaces in several towns' queries; it is
 * one lead, and `seenIn` keeps the full list so the summary can say where it
 * came from. First sighting wins for the `town` column, because that is the
 * query whose result set it ranked in.
 */
export async function sweep(opts: SweepOptions): Promise<SweepOutcome> {
  // Guard the transcribed municipality list before spending anything. A
  // truncated list would silently sweep less than the county.
  checkBergenList();

  const towns = opts.towns ?? BERGEN_MUNICIPALITIES;
  const pages = Math.max(1, opts.pages ?? 1);
  const max = PAGE_SIZE * pages;

  const byPlaceId = new Map<string, SweepResult>();
  const emittedMasks = new Set<string>();
  const failures: SweepOutcome["failures"] = [];
  let queries = 0;

  const total = opts.niches.length * towns.length;
  let index = 0;

  for (const niche of opts.niches) {
    const copyPack = copyPackFor(niche);
    for (const town of towns) {
      index += 1;
      let found = 0;
      let fresh = 0;
      try {
        const outcome = await searchTextDetailed({
          niche: queryFor(niche, town),
          max,
          // `--pages N` means at most N calls for this cell. Hard, and stated
          // here rather than inferred from `max`, because the cost of getting
          // it wrong is measured in money.
          maxCalls: pages,
          apiKey: opts.apiKey,
          budget: opts.budget,
          mask: DISCOVERY_FIELD_MASK,
          meter: opts.meter,
          town,
          fetchImpl: opts.fetchImpl,
        });
        queries += outcome.calls;
        emittedMasks.add(outcome.emittedFieldMask);
        found = outcome.places.length;

        for (const place of outcome.places) {
          const row = toResult(place, niche, town, copyPack);
          if (row === null) continue;
          const existing = byPlaceId.get(row.placeId);
          if (existing) {
            existing.seenIn.push(...row.seenIn);
            continue;
          }
          byPlaceId.set(row.placeId, row);
          fresh += 1;
        }
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        failures.push({ niche: niche.slug, town, reason });
        // A budget ceiling is a stop, not a skip: continuing would issue calls
        // that are guaranteed to throw, one per remaining cell.
        if (/budget exhausted/i.test(reason)) {
          opts.onQuery?.({ niche, town, index, total, found, fresh });
          // Hand over what the run already bought before the stop propagates.
          // A ceiling exists to stop spending, not to erase what was spent.
          await opts.onCell?.([...byPlaceId.values()]);
          throw new SweepStopped(err instanceof Error ? err : new Error(reason), {
            results: [...byPlaceId.values()],
            emittedMasks: [...emittedMasks],
            queries,
            failures,
          });
        }
      }
      opts.onQuery?.({ niche, town, index, total, found, fresh });
      await opts.onCell?.([...byPlaceId.values()]);
    }
  }

  return {
    results: [...byPlaceId.values()],
    emittedMasks: [...emittedMasks],
    queries,
    failures,
  };
}
