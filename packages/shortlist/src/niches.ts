import { nicheIdFor } from "@site-factory/prospect";

/**
 * The niches the sweep can search for.
 *
 * `query` is what goes to Places; `slug` is what `--niche` accepts and what
 * lands in the CSV. Whether a niche has a copy pack is **not** recorded here —
 * it is resolved through `packages/prospect`'s `nicheIdFor()`, which reads the
 * real registry in `packages/copy`. A hand-copied list would drift the moment
 * someone adds a pack, and the drift would be silent: leads would score as
 * "no demo possible today" for a niche that had gained one.
 */
export interface Niche {
  slug: string;
  /** Text sent to Places, before the town is appended. */
  query: string;
  label: string;
}

export const NICHES: readonly Niche[] = [
  { slug: "machine-shop", query: "machine shop", label: "machine shop" },
  { slug: "welding-fabrication", query: "welding and fabrication", label: "welding/fabrication" },
  { slug: "general-contractor", query: "general contractor", label: "general contractor" },
  { slug: "hvac", query: "HVAC contractor", label: "HVAC" },
  { slug: "electrician", query: "electrician", label: "electrician" },
  { slug: "plumber", query: "plumber", label: "plumber" },
  { slug: "roofer", query: "roofing contractor", label: "roofer" },
  { slug: "auto-repair", query: "auto repair shop", label: "auto repair" },
];

/**
 * The three the acceptance run sweeps. The other five are reachable with
 * `--niche` but are not part of the county run — they have no copy pack, so a
 * demo cannot be built for them today.
 */
export const COPY_PACK_NICHE_SLUGS = [
  "machine-shop",
  "welding-fabrication",
  "general-contractor",
] as const;

export function nicheBySlug(slug: string): Niche | undefined {
  return NICHES.find((n) => n.slug === slug);
}

/**
 * The copy pack id for a niche, or `""` when there is none.
 *
 * Delegates to the real registry rather than asserting an answer. A niche this
 * sweep calls `hvac` gets a pack the day someone writes one, with no edit here.
 */
export function copyPackFor(niche: Niche): string {
  return nicheIdFor(niche.query) ?? "";
}

export function hasCopyPack(niche: Niche): boolean {
  return copyPackFor(niche) !== "";
}
