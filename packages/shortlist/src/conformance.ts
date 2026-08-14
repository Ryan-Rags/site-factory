import type { Niche } from "./niches.js";

/**
 * Does a Places result actually belong to the niche that found it?
 *
 * ## Why this exists
 *
 * Text Search is relevance-ranked, not category-filtered. `"machine shop in
 * Park Ridge, NJ"` cheerfully returns a bakery, and until 2026-08-14 the sweep
 * stamped `nicheLabel` from the **query string** — so the bakery was written to
 * the call list as a machine shop, and the scorer, which rewards "no website +
 * many reviews", ranked it first. Not one of that run's top 25 was a machine
 * shop; three were a bakery, a coffee shop and a smoke shop.
 *
 * `places.types` was in the field mask the whole time. It was fetched, billed
 * at Enterprise, stored on `SweepResult` — and read by nothing. This module is
 * what reads it.
 *
 * ## The rule
 *
 * Two tiers, and **nothing is ever dropped**. A row the classifier rejects is
 * still written to the CSV, marked `mismatch`, and merely withheld from the
 * shortlist by default (`--include-mismatches` shows it). A paid-for row is
 * evidence: the no-website bakery is a real prospect for a different pitch, and
 * even the junk records what the query actually returned.
 */

export type NicheMatch = "match" | "mismatch" | "unknown";

export interface Conformance {
  match: NicheMatch;
  /** The allowlisted types this row actually carried, for the reason string. */
  matched: string[];
  /** Why it was rejected, when it was. */
  reason: string;
}

/**
 * Types every establishment carries. They say a place exists, not what it does,
 * so they are never evidence for or against a niche. Listed to be excluded
 * deliberately rather than by accident.
 */
export const UNIVERSAL_TYPES: readonly string[] = ["point_of_interest", "establishment"];

/**
 * Per-niche accept signals, taken from a live probe of 117 results across the
 * three copy-pack niches on 2026-08-14 (6 calls, one page each).
 *
 * What the probe showed:
 *
 *   - Every genuine machine shop carried `manufacturer` — Progressive Machine,
 *     Harout Tool & Machine, KTS, D&D Machine, Industrial Machine. The
 *     impostors did not: `Humdingers` (bowling_alley, restaurant) and
 *     `GV enGraVing` (gift_shop, home_goods_store) carry no manufacturing type
 *     at all. `manufacturer` alone is therefore a strong, cheap signal.
 *   - `general_contractor` is near-universal for the contractor niche.
 *   - Welding is the weak one. Google gives most welders a bare `service` —
 *     `K & S Welding`, `Pearce Welding`, `KJ Welding` — and `service` is also
 *     what a car repair shop carries. `service` is admitted for welding anyway,
 *     because excluding it would flag Ryan's own client `ks-welding`, and the
 *     denylist below is what keeps the breadth honest.
 *
 * The five non-copy-pack niches are **not probed**. Their lists are plausible
 * rather than evidence-based, and are marked as such: they are never swept by
 * the county run, so nothing rests on them until someone probes them.
 */
export const NICHE_ACCEPT_TYPES: Readonly<Record<string, readonly string[]>> = {
  // Probed.
  "machine-shop": ["manufacturer"],
  "welding-fabrication": ["manufacturer", "general_contractor", "service"],
  "general-contractor": [
    "general_contractor",
    "roofing_contractor",
    "painter",
    "building_materials_store",
  ],
  // Unprobed — plausible only. See the note above.
  hvac: ["hvac_contractor", "general_contractor", "service"],
  electrician: ["electrician", "general_contractor", "service"],
  plumber: ["plumber", "general_contractor", "service"],
  roofer: ["roofing_contractor", "general_contractor", "service"],
  "auto-repair": ["car_repair", "car_dealer", "tire_shop", "auto_parts_store"],
};

/**
 * Types that contradict every trade this repo sells to, whatever else a row
 * carries. A denylist is needed because `service` — the only signal Places
 * gives a welder — is also carried by restaurants, clinics and arcades. Deny
 * beats accept: a row holding both is a mismatch.
 *
 * Drawn from the types actually seen on the 2026-08-14 sweep's false positives.
 */
export const DENY_TYPES: readonly string[] = [
  // Food and drink — the bakery, the coffee shop, the restaurant.
  "restaurant",
  "food",
  "food_store",
  "bakery",
  "cafe",
  "coffee_shop",
  "ice_cream_shop",
  "dessert_shop",
  "confectionery",
  "bar",
  "meal_takeaway",
  "meal_delivery",
  "grocery_store",
  "supermarket",
  "convenience_store",
  "liquor_store",
  // Leisure — `Humdingers` carried five of these.
  "bowling_alley",
  "video_arcade",
  "sports_complex",
  "sports_activity_location",
  "amusement_center",
  "night_club",
  "movie_theater",
  "tourist_attraction",
  // Consumer retail and personal services.
  "gift_shop",
  "clothing_store",
  "book_store",
  "pet_store",
  "beauty_salon",
  "hair_care",
  "spa",
  "gym",
  // Care, civic, lodging.
  "medical_clinic",
  "health",
  "hospital",
  "pharmacy",
  "dentist",
  "school",
  "lodging",
  "hotel",
  "bank",
  "church",
  "place_of_worship",
  "gas_station",
];

const intersect = (a: readonly string[], b: readonly string[]): string[] =>
  a.filter((x) => b.includes(x));

/**
 * Classify one result against the niche whose query returned it.
 *
 * `unknown` is its own answer, kept apart from `mismatch`: a row with no types
 * at all was not judged and must not be reported as judged. It is withheld from
 * the shortlist for the same reason a mismatch is — unverified is not verified
 * — but it says why.
 */
export function classify(types: readonly string[], niche: Niche): Conformance {
  const meaningful = types.filter((t) => !UNIVERSAL_TYPES.includes(t));
  if (meaningful.length === 0) {
    return {
      match: "unknown",
      matched: [],
      reason: types.length === 0 ? "no types returned" : "only universal types returned",
    };
  }

  const denied = intersect(meaningful, DENY_TYPES);
  if (denied.length > 0) {
    return { match: "mismatch", matched: [], reason: `not this trade: ${denied.join(", ")}` };
  }

  const accept = NICHE_ACCEPT_TYPES[niche.slug] ?? [];
  const matched = intersect(meaningful, accept);
  if (matched.length > 0) return { match: "match", matched, reason: "" };

  return {
    match: "mismatch",
    matched: [],
    reason: `no ${niche.slug} type among: ${meaningful.join(", ")}`,
  };
}
