import type { FetchLike, PlacesPlace } from "@site-factory/discover";

import type { Niche } from "./niches.js";

/**
 * The dry-run fixture: a synthetic Places backend.
 *
 * Every id is `fixture-*`, never a real Places id, and every website points at
 * `*.example.com`, which is reserved by RFC 2606 and resolves nowhere. A
 * fixture row can therefore never be mistaken for a live result, and a dry run
 * can never navigate to a real business's server.
 *
 * This exists so the whole pipeline — sweep, dedupe, scoring, CSV merge,
 * summary — can be exercised across all 70 towns and three niches with **zero
 * network calls and zero cost**, which is what proves the shape before any
 * real quota is spent.
 */

/** Deterministic. The same town and niche always yield the same businesses. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const SUFFIXES = ["Works", "& Sons", "Inc", "LLC", "Company", "Brothers", "Industries"];

/**
 * A synthetic result set for one query. Deliberately varied across the four
 * website states so a dry run exercises every scoring branch:
 * no website, a dead domain, a parked domain and a live site.
 */
export function fixturePlaces(niche: Niche, town: string, count: number): PlacesPlace[] {
  const seed = hash(`${niche.slug}|${town}`);
  const n = 3 + (seed % Math.max(1, count - 2));
  const out: PlacesPlace[] = [];

  for (let i = 0; i < Math.min(n, count); i += 1) {
    const s = hash(`${niche.slug}|${town}|${i}`);
    const suffix = SUFFIXES[s % SUFFIXES.length] ?? "Inc";
    const name = `${town} ${niche.label} ${suffix}`;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    const place: PlacesPlace = {
      id: `fixture-${slug}-${s % 9973}`,
      displayName: { text: name },
      formattedAddress: `${100 + (s % 900)} Main St, ${town}, NJ 07${String(s % 1000).padStart(3, "0")}`,
    };

    // A quarter have no website at all; the rest get one that will not resolve.
    if (s % 4 !== 0) place.websiteUri = `https://${slug}.example.com`;
    // A fifth have no phone, so the "cannot be called" branch is exercised.
    if (s % 5 !== 0) {
      place.nationalPhoneNumber = `(201) ${String(200 + (s % 700))}-${String(1000 + (s % 9000))}`;
    }
    // A sixth have no rating, so the neutral path is exercised.
    if (s % 6 !== 0) {
      place.rating = Math.round((3 + (s % 20) / 10) * 10) / 10;
      place.userRatingCount = s % 240;
    }
    out.push(place);
  }
  return out;
}

/**
 * A `fetch` that answers Text Search from the fixture and never touches the
 * network. Passed to the sweep as `fetchImpl`, so the sweep code under test is
 * the same code that runs live — only the transport is swapped.
 */
export function fixtureFetch(niches: readonly Niche[]): FetchLike {
  const byQuery = new Map<string, PlacesPlace[]>();
  return (async (_url: string, init?: { body?: string }) => {
    const body = JSON.parse(init?.body ?? "{}") as { textQuery?: string; pageSize?: number };
    const query = body.textQuery ?? "";
    const match = /^(.*) in (.*), NJ$/.exec(query);

    let places: PlacesPlace[] = [];
    if (match) {
      const [, queryText, town] = match;
      const niche = niches.find((n) => n.query === queryText);
      if (niche && town) {
        const key = `${niche.slug}|${town}`;
        places = byQuery.get(key) ?? fixturePlaces(niche, town, body.pageSize ?? 20);
        byQuery.set(key, places);
      }
    }

    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ places }),
      text: async () => "",
    };
  }) as unknown as FetchLike;
}
