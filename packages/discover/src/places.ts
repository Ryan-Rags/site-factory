import { readFileSync } from "node:fs";

import { emptyLead, type LeadRow } from "./types.js";

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

async function postSearchText(
  body: Record<string, unknown>,
  apiKey: string,
  budget: CallBudget,
  fetchImpl: FetchLike,
): Promise<PlacesResponse> {
  budget.consume();
  const res = await fetchImpl(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Places searchText failed: HTTP ${res.status} ${res.statusText}. ` +
        redact(detail, apiKey).slice(0, 300),
    );
  }
  return (await res.json()) as PlacesResponse;
}

export interface SearchOptions {
  niche: string;
  near?: { lat: number; lng: number } | undefined;
  radius?: number | undefined;
  max: number;
  apiKey: string;
  budget: CallBudget;
  fetchImpl?: FetchLike | undefined;
}

/** Live Text Search. Never called without an API key. */
export async function searchText(opts: SearchOptions): Promise<PlacesPlace[]> {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const max = Math.min(opts.max, MAX_RESULTS);
  const out: PlacesPlace[] = [];
  let pageToken: string | undefined;

  while (out.length < max) {
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

    const res = await postSearchText(body, opts.apiKey, opts.budget, fetchImpl);
    for (const place of res.places ?? []) {
      if (out.length >= max) break;
      out.push(place);
    }
    if (!res.nextPageToken) break;
    pageToken = res.nextPageToken;
    await sleep(PAGE_DELAY_MS);
  }
  return out;
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
