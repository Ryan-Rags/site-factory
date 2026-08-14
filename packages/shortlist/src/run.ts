import type { Browser } from "playwright";

import { NavigationBudget, auditOne, scoreSite } from "@site-factory/audit";
import { emptyLead, slugify } from "@site-factory/discover";

import type { ExistingFile } from "./csv.js";
import { loadKnownRecords, resolveIdentity, type ClientPlaceIds } from "./identity.js";
import { rankForAudit } from "./rank.js";
import { scoreProspect } from "./score.js";
import { websiteStatus } from "./signals.js";
import type { Assessment, ScoredRow, SweepResult } from "./types.js";
import { SCORED_COLUMNS } from "./types.js";

/**
 * Everything after the sweep: what is at their web address, how bad it is, and
 * what that is worth.
 *
 * No Places calls happen here. The sweep bought everything this stage needs.
 */

export interface AssessOptions {
  results: readonly SweepResult[];
  browser: Browser;
  /** 0 means unlimited. */
  auditCap: number;
  clientPlaceIds?: ClientPlaceIds | undefined;
  dataDirOverride?: string | undefined;
  excludeFiles?: readonly string[] | undefined;
  /**
   * CDP port the browser was launched listening on, for Lighthouse to attach
   * to. Required, and deliberately has no default: a browser started without
   * `--remote-debugging-port` opens no port at all, so any default here is a
   * port nobody is listening on, and every Lighthouse-derived check then reads
   * `unavailable` without an error. `runAuditStage` exists so a caller never
   * has to supply this by hand.
   */
  debugPort: number;
  now?: Date | undefined;
  onStatus?: ((done: number, total: number, r: SweepResult) => void) | undefined;
  onAudit?: ((done: number, total: number, r: SweepResult) => void) | undefined;
}

export interface AssessOutcome {
  assessments: Assessment[];
  /** Live sites ranked but not audited because the cap ran out. */
  skippedByCap: number;
  degradedRanking: number;
  warnings: string[];
}

export async function assess(opts: AssessOptions): Promise<AssessOutcome> {
  const now = opts.now ?? new Date();
  const known = loadKnownRecords({
    dir: opts.dataDirOverride,
    clientPlaceIds: opts.clientPlaceIds,
    exclude: opts.excludeFiles ?? ["prospects-scored.csv"],
  });

  // --- website status: one navigation each, or zero when there is no URL ----
  const navBudget = new NavigationBudget();
  const staged: { result: SweepResult; status: Awaited<ReturnType<typeof websiteStatus>> }[] = [];

  let done = 0;
  for (const result of opts.results) {
    const status = await websiteStatus({
      browser: opts.browser,
      url: result.website,
      budget: navBudget,
    });
    staged.push({ result, status });
    done += 1;
    opts.onStatus?.(done, opts.results.length, result);
  }

  // --- audit: live sites only, in an explicit order, under the cap ---------
  const live = staged.filter((s) => s.status.status === "live");
  const ranked = rankForAudit(live);
  const degradedRanking = ranked.filter((r) => r.degraded).length;
  const cap = opts.auditCap === 0 ? ranked.length : Math.min(opts.auditCap, ranked.length);

  const neglectByPlaceId = new Map<string, number>();
  const auditedIds = new Set<string>();
  const warnings: string[] = [];

  for (let i = 0; i < cap; i += 1) {
    const candidate = ranked[i];
    if (!candidate) break;
    const { result } = candidate.item;
    opts.onAudit?.(i + 1, cap, result);

    const row = emptyLead();
    row.name = result.name;
    row.url = result.website;
    row.niche = result.nicheLabel;
    row.city = result.town;
    row.phone = result.phone;
    row.place_id = result.placeId;
    row.rating = result.rating;
    row.review_count = result.reviewCount;
    row.address = result.address;

    try {
      const audit = await auditOne({
        browser: opts.browser,
        debugPort: opts.debugPort,
        row,
        slug: slugify(result.name) || result.placeId,
        now,
      });
      // Recomputed rather than read off `audit.score`: that number folds in
      // audit's own value multiplier, and viability is scored here instead.
      // Only the neglect half is wanted.
      const score = scoreSite({
        checks: audit.checks,
        rating: result.rating,
        reviewCount: result.reviewCount,
      });
      if (score.neglect !== undefined) {
        neglectByPlaceId.set(result.placeId, score.neglect);
        auditedIds.add(result.placeId);
      } else {
        warnings.push(
          `audit of "${result.name}" decided no checks (${score.unavailableChecks} unavailable) — ` +
            "scored as not audited rather than as a clean site",
        );
      }
    } catch (err) {
      warnings.push(
        `audit of "${result.name}" failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // --- score ---------------------------------------------------------------
  const assessments: Assessment[] = staged.map(({ result, status }) => {
    const audited = auditedIds.has(result.placeId);
    const neglect = audited ? neglectByPlaceId.get(result.placeId) : undefined;
    const scored = scoreProspect({ result, websiteStatus: status.status, neglect });
    const identity = resolveIdentity(result, known);
    if (identity.warning) warnings.push(identity.warning);

    return {
      result,
      status,
      neglect,
      audited,
      notAuditedReason:
        status.status !== "live"
          ? ""
          : audited
            ? ""
            : "live site, not audited this run (audit cap)",
      opportunity: scored.opportunity,
      viability: scored.viability,
      score: scored.score,
      reasons: scored.reasons,
      identity,
    };
  });

  assessments.sort((a, b) => b.score - a.score);

  return {
    assessments,
    skippedByCap: live.length - auditedIds.size,
    degradedRanking,
    warnings,
  };
}

/** Project an assessment onto the machine-owned CSV columns. Nothing else. */
export function toScoredRow(a: Assessment): ScoredRow {
  const row = {} as ScoredRow;
  for (const column of SCORED_COLUMNS) row[column] = "";
  row.placeId = a.result.placeId;
  row.name = a.result.name;
  row.niche = a.result.nicheLabel;
  row.town = a.result.town;
  row.phone = a.result.phone;
  row.website = a.result.website;
  row.websiteStatus = a.status.status;
  row.score = String(a.score);
  row.reasons = a.reasons.join(" · ");
  row.copyPack = a.result.copyPack;
  row.status = "NEW";
  return row;
}

/**
 * Project a bare sweep result — discovery only, nothing assessed — onto the
 * same columns, so the checkpoint can go through the one writer this file has.
 *
 * `websiteStatus`, `score` and `reasons` are left **empty**, because they have
 * not been measured yet: the assess stage needs a browser and has not run. An
 * empty cell here means unmeasured, exactly as it does everywhere else in this
 * repo, and never a zero standing in for one.
 *
 * That emptiness is why `checkpointRows` in the CLI refuses to overwrite a row
 * that already carries a score. `mergeScored` refreshes every machine column it
 * is given, so handing it a blank row for an already-scored business would
 * erase a real measurement with a placeholder.
 */
/**
 * The sweep results that are safe to checkpoint over what is already on disk.
 *
 * This is the guard that lets a mid-run checkpoint share a writer with the
 * finished run. See `toCheckpointRow` for why a blank row is dangerous.
 */
export function checkpointRows(
  results: readonly SweepResult[],
  existing: ExistingFile,
): ScoredRow[] {
  return results
    .filter((r) => {
      const prior = existing.rows.get(r.placeId);
      // Already scored by some earlier run: leave it entirely alone. A blank
      // checkpoint row would refresh its score to "" and destroy the
      // measurement. Unscored, or absent, is safe to (re)write.
      return prior === undefined || (prior["score"] ?? "").trim() === "";
    })
    .map(toCheckpointRow);
}

export function toCheckpointRow(result: SweepResult): ScoredRow {
  const row = {} as ScoredRow;
  for (const column of SCORED_COLUMNS) row[column] = "";
  row.placeId = result.placeId;
  row.name = result.name;
  row.niche = result.nicheLabel;
  row.town = result.town;
  row.phone = result.phone;
  row.website = result.website;
  row.copyPack = result.copyPack;
  row.status = "NEW";
  return row;
}
