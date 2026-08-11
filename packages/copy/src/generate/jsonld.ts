/**
 * Structured data.
 *
 * Search engines treat JSON-LD as a factual claim made by the site owner, and
 * some of it is eligible for rich results — which is why unverified
 * structured data is worse than unverified prose. A visitor reading a vague
 * sentence discounts it; a crawler reading `"geo"` believes it.
 *
 * Two things are therefore true of everything below:
 *
 *   1. Every field is omitted rather than emitted empty or marked. There is
 *      no `"postalCode": "[verify with client]"` — the marker convention is
 *      for prose a human reads, and putting one in the graph would be
 *      publishing the string as a fact.
 *   2. `aggregateRating` and `review` are never emitted. We hold review data
 *      on the lead row, and it is exactly the thing that must not be printed:
 *      we cannot attribute it to a verifiable review, it moves without
 *      warning, and misrepresenting it is the fastest route to a manual
 *      action against the client's domain.
 *
 * `geo` is supported here and populated by nobody in this package — it
 * arrives on the prospect record from the pipeline's ingestion path or it
 * does not arrive at all.
 */
import type { CopyContext } from '../niches/types.js';
import type { FaqItem, Geo, Hours } from '../types.js';
import { isFact } from '../types.js';

/**
 * The parts of `LocalBusiness` this package is responsible for.
 *
 * Not the whole graph: the template already builds name, address, telephone,
 * logo and offers from its own config, and duplicating that here would give
 * two sources of truth for the same node. This is the *additions* — the
 * fields the copy engine is what makes possible.
 */
export interface JsonLdSeed {
  /** `Place` entries for `areaServed`, deduplicated and ordered. */
  areaServed: string[];
  /** Present only when the record carries sourced coordinates. */
  geo?: { latitude: number; longitude: number };
  /** Opening hours, already filtered to days that are actually open. */
  openingHours: { day: string; opens: string; closes: string }[];
  /** `FAQPage` entities, or an empty array when there is no FAQ. */
  faq: FaqItem[];
}

function openingHoursOf(hours: Hours[] | undefined): JsonLdSeed['openingHours'] {
  if (hours === undefined) return [];
  const out: JsonLdSeed['openingHours'] = [];
  for (const h of hours) {
    if (h.closed === true) continue;
    if (h.opens === undefined || h.closes === undefined) continue;
    out.push({ day: h.day, opens: h.opens, closes: h.closes });
  }
  return out;
}

/**
 * `areaServed`, from the towns we have committed to in prose.
 *
 * Kept identical to the service-area sections on purpose: the structured data
 * and the visible copy making different claims about where a business works
 * is precisely the inconsistency that gets a rich result withdrawn, and it is
 * trivially avoidable by deriving both from one list.
 */
function areaServedOf(ctx: CopyContext): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const place of [...ctx.record.serviceTowns, ...ctx.record.wider]) {
    if (place.trim() === '' || seen.has(place)) continue;
    seen.add(place);
    out.push(place);
  }
  return out;
}

export function jsonLd(ctx: CopyContext, faqItems: FaqItem[]): JsonLdSeed {
  const geo: Geo | undefined = isFact(ctx.record.geo) ? ctx.record.geo.value : undefined;

  return {
    areaServed: areaServedOf(ctx),
    ...(geo === undefined ? {} : { geo: { latitude: geo.latitude, longitude: geo.longitude } }),
    openingHours: openingHoursOf(ctx.hours),
    faq: faqItems,
  };
}
