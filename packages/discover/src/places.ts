import { readFileSync } from "node:fs";

import { emptyLead, type LeadRow } from "./types.js";
import type { UsageMeter } from "./usage.js";

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

/**
 * Exactly the seven requested fields, plus the page token needed to walk
 * results. `addressComponents` is deliberately absent (Q3): it would give a
 * parsed locality but moves the request into a more expensive Places SKU, so
 * `city` comes from the `--city` label instead.
 */
export const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.rating",
  "places.userRatingCount",
  "places.formattedAddress",
  "nextPageToken",
].join(",");

/**
 * The mask the county-wide discovery sweep sends. **Fixed. Nothing else, ever.**
 *
 * One Text Search per (niche, town), and this is everything that run needs to
 * score a lead. There is no second pass.
 *
 * ## Why this is one Enterprise call rather than a cheap sweep plus a top-up
 *
 * The original design was a Pro-tier sweep, then Place Details on a filtered
 * set of survivors, so that `rating` and `userRatingCount` — Enterprise
 * fields — were bought only for businesses worth calling.
 *
 * That design cannot work, because `websiteUri` and `nationalPhoneNumber` are
 * *also* Enterprise. A Pro sweep returns neither, and the survivor filter is
 * defined on exactly those two: website status decides how badly a business
 * needs us, and a lead with no phone cannot go on a call list. So the filter
 * would have had nothing to filter on, and Details would have had to run
 * against every deduplicated business in the county — hundreds of Enterprise
 * calls — to learn who has no website.
 *
 * Once the call is Enterprise for `websiteUri`, `rating` and `userRatingCount`
 * ride along at **no marginal cost**: same tier, same price, same request.
 * One sweep at ~210 Enterprise calls is decisively cheaper than a Pro sweep
 * plus hundreds of Enterprise top-ups, and it is simpler.
 *
 * The gate in `test/sku.test.mjs` asserts this constant byte-for-byte and
 * bans the Enterprise + Atmosphere class outright.
 */
export const DISCOVERY_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.types",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.rating",
  "places.userRatingCount",
  "nextPageToken",
].join(",");

/** Text Search (New) returns 20 per page and allows two token follow-ups. */
export const PAGE_SIZE = 20;
export const MAX_RESULTS = 60;
/** Hard ceiling across a whole run, enforced in the HTTP wrapper. */
export const MAX_CALLS_PER_RUN = 200;
const DEFAULT_RADIUS_M = 5000;
const PAGE_DELAY_MS = 1000;

export interface PlacesPlace {
  id?: string;
  displayName?: { text?: string };
  /** Places category strings, e.g. `car_repair`. Pro tier. */
  types?: string[];
  websiteUri?: string;
  nationalPhoneNumber?: string;
  rating?: number;
  userRatingCount?: number;
  formattedAddress?: string;
}

export interface PlacesResponse {
  places?: PlacesPlace[];
  nextPageToken?: string;
}

/**
 * Run-scoped call counter. It lives in the HTTP wrapper rather than the paging
 * loop so that the cap binds across every query in a run, not per query.
 */
export class CallBudget {
  #spent = 0;
  readonly limit: number;

  constructor(limit: number = MAX_CALLS_PER_RUN) {
    this.limit = limit;
  }

  get spent(): number {
    return this.#spent;
  }

  get remaining(): number {
    return this.limit - this.#spent;
  }

  consume(): void {
    if (this.#spent >= this.limit) {
      throw new Error(
        `Places call budget exhausted: ${this.limit} calls/run. Nothing further was requested.`,
      );
    }
    this.#spent += 1;
  }
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Keep the key out of error text, which gets logged. */
function redact(text: string, apiKey: string): string {
  return apiKey ? text.split(apiKey).join("[REDACTED]") : text;
}

export type FetchLike = typeof globalThis.fetch;

interface PostOptions {
  body: Record<string, unknown>;
  apiKey: string;
  budget: CallBudget;
  fetchImpl: FetchLike;
  mask: string;
  meter?: UsageMeter | undefined;
  niche?: string | undefined;
  town?: string | undefined;
}

/**
 * One Text Search request.
 *
 * The mask travels with the call rather than being read off a module constant,
 * so the string the meter prices is provably the string sent in the header —
 * there is no second copy for the two to drift apart. `emittedFieldMask` on
 * the result is what the sweep gate compares against the declared mask.
 */
async function postSearchText(opts: PostOptions): Promise<PlacesResponse> {
  // Price and reserve BEFORE spending. A call that would breach a ceiling, or
  // that asks for a banned or unpriced field, is never issued.
  const settle = opts.meter?.reserve({
    endpoint: "searchText",
    mask: opts.mask,
    niche: opts.niche,
    town: opts.town,
  });
  opts.budget.consume();

  const res = await opts.fetchImpl(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": opts.apiKey,
      "X-Goog-FieldMask": opts.mask,
    },
    body: JSON.stringify(opts.body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Places searchText failed: HTTP ${res.status} ${res.statusText}. ` +
        redact(detail, opts.apiKey).slice(0, 300),
    );
  }
  const json = (await res.json()) as PlacesResponse;
  settle?.(json.places?.length ?? 0);
  return json;
}

export interface SearchOptions {
  niche: string;
  near?: { lat: number; lng: number } | undefined;
  radius?: number | undefined;
  max: number;
  apiKey: string;
  budget: CallBudget;
  fetchImpl?: FetchLike | undefined;
  /**
   * Field mask to send. Defaults to {@link FIELD_MASK}, which is what
   * `pnpm discover` and `packages/prospect`'s `resolvePlaceId` have always
   * sent. The county sweep passes {@link DISCOVERY_FIELD_MASK}.
   */
  mask?: string | undefined;
  /** Prices and caps each call, and records it for reconciliation. */
  meter?: UsageMeter | undefined;
  /** Sweep context, recorded on each usage record. */
  town?: string | undefined;
  /**
   * Hard ceiling on HTTP calls this search may make. **This is the runaway
   * guard**, and it binds regardless of what the API keeps offering.
   *
   * Defaults to the pages it would take to reach `max` at {@link PAGE_SIZE} a
   * page, which is the number a caller asking for `max` results is implicitly
   * budgeting for. Before this existed the loop's only exits were "enough
   * results" and "no `nextPageToken`", so a query answering with a thin page
   * and a fresh token every time paged until some other ceiling killed it: on
   * 2026-08-14 a single live cell spent 730 of an 800-call budget that way
   * while every other cell cost exactly one.
   */
  maxCalls?: number | undefined;
}

/** The mask a search actually sent, alongside its results. */
export interface SearchOutcome {
  places: PlacesPlace[];
  emittedFieldMask: string;
  calls: number;
}

/**
 * Live Text Search, walking pages up to `max`. Never called without an API key.
 *
 * Note that every paging follow-up is a *fresh billable call at the same tier*
 * as the first — a second page of Bergen machine shops costs exactly what the
 * first did. That is why the sweep defaults to one page and why the meter
 * records each page separately rather than collapsing a query into one row.
 */
export async function searchText(opts: SearchOptions): Promise<PlacesPlace[]> {
  return (await searchTextDetailed(opts)).places;
}

/** As {@link searchText}, but also reporting the mask actually emitted. */
export async function searchTextDetailed(opts: SearchOptions): Promise<SearchOutcome> {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const mask = opts.mask ?? FIELD_MASK;
  const max = Math.min(opts.max, MAX_RESULTS);
  const maxCalls = Math.max(1, opts.maxCalls ?? Math.ceil(max / PAGE_SIZE));
  const out: PlacesPlace[] = [];
  let pageToken: string | undefined;
  let calls = 0;

  while (out.length < max && calls < maxCalls) {
    const body: Record<string, unknown> = {
      textQuery: opts.niche,
      pageSize: Math.min(PAGE_SIZE, max - out.length),
    };
    if (opts.near) {
      body["locationBias"] = {
        circle: {
          center: { latitude: opts.near.lat, longitude: opts.near.lng },
          radius: opts.radius ?? DEFAULT_RADIUS_M,
        },
      };
    }
    if (pageToken) body["pageToken"] = pageToken;

    const res = await postSearchText({
      body,
      apiKey: opts.apiKey,
      budget: opts.budget,
      fetchImpl,
      mask,
      meter: opts.meter,
      niche: opts.niche,
      town: opts.town,
    });
    calls += 1;
    for (const place of res.places ?? []) {
      if (out.length >= max) break;
      out.push(place);
    }
    if (!res.nextPageToken) break;
    pageToken = res.nextPageToken;
    await sleep(PAGE_DELAY_MS);
  }
  return { places: out, emittedFieldMask: mask, calls };
}

/**
 * The checked-in dry-run fixture. Synthetic: place ids are `fixture-*`, not
 * real Places ids, and rows carry `source=places-fixture` so a fixture row can
 * never be mistaken for a live API result.
 */
export function loadFixture(): PlacesResponse {
  const url = new URL("../fixtures/places-response.json", import.meta.url);
  return JSON.parse(readFileSync(url, "utf8")) as PlacesResponse;
}

export interface ToLeadOptions {
  niche: string;
  city: string;
  source: string;
  discoveredAt: string;
}

/**
 * Project a Places result onto a lead row. Absent fields stay empty — nothing
 * is inferred, and in particular a business with no rating gets an empty
 * `rating`, not a zero, because the audit score treats those differently.
 */
export function placeToLead(place: PlacesPlace, opts: ToLeadOptions): LeadRow {
  const row = emptyLead();
  row.name = place.displayName?.text ?? "";
  row.url = place.websiteUri ?? "";
  row.niche = opts.niche;
  row.city = opts.city;
  row.phone = place.nationalPhoneNumber ?? "";
  row.source = opts.source;
  row.place_id = place.id ?? "";
  row.rating = place.rating === undefined ? "" : String(place.rating);
  row.review_count =
    place.userRatingCount === undefined ? "" : String(place.userRatingCount);
  row.address = place.formattedAddress ?? "";
  row.discovered_at = opts.discoveredAt;
  return row;
}
