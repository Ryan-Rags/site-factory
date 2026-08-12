import { type BrandColors, type ThemePreset } from "./types.js";
import { palettePasses, repairPalette, rotateHue } from "./color.js";

/**
 * The fallback palette and design family for a business whose own brand we do
 * not have.
 *
 * These colours are ours, not theirs. Anything generated from this table sets
 * `brand.createdByUs`, which the run report prints — a demo dressed in a
 * palette we invented must never be pitched as "your brand", and the operator
 * needs to know which of the two they are looking at before the meeting.
 */

export interface NicheStyle {
  /** Substrings matched case-insensitively against the prospect's niche. */
  match: string[];
  preset: ThemePreset;
  colors: BrandColors;
  /** Why this pairing, so a later reader can argue with it. */
  rationale: string;
}

/**
 * Ordered: the first entry whose `match` hits wins, so put specific trades
 * above general ones. Every pairing here clears the template's eight WCAG AA
 * pairings before any per-prospect hue rotation is applied.
 */
export const NICHE_STYLES: readonly NicheStyle[] = [
  {
    match: ["machine shop", "machining", "cnc", "tool and die", "toolroom"],
    preset: "precision",
    colors: { primary: "#0f4c81", accent: "#b45309" },
    rationale: "Engineering blue with a machined-copper accent: reads technical, not corporate.",
  },
  {
    match: ["weld", "fabricat", "metal", "forge", "iron", "steel"],
    preset: "forge",
    colors: { primary: "#1f3a5f", accent: "#c2410c" },
    rationale: "Steel blue with a hot-metal orange — the colours of the work itself.",
  },
  {
    match: ["auto", "mechanic", "tire", "collision", "body shop"],
    preset: "forge",
    colors: { primary: "#1e3a8a", accent: "#b91c1c" },
    rationale: "Workshop blue and a warning red: familiar to anyone who has stood in a service bay.",
  },
  {
    match: ["plumb", "hvac", "heating", "boiler", "drain"],
    preset: "precision",
    colors: { primary: "#075985", accent: "#b45309" },
    rationale: "Water blue with a warm accent so the palette is not entirely cold.",
  },
  {
    match: ["electric", "solar", "wiring"],
    preset: "precision",
    colors: { primary: "#1e3a8a", accent: "#a16207" },
    rationale: "Deep blue with a live-conductor amber.",
  },
  {
    match: ["roof", "siding", "contractor", "construction", "carpent", "builder"],
    preset: "heritage",
    colors: { primary: "#14532d", accent: "#b45309" },
    rationale: "Timber green and a saw-dust amber: outdoor trades, not tech.",
  },
  {
    match: ["dental", "dentist", "orthodont", "medical", "clinic", "physio", "chiro"],
    preset: "precision",
    colors: { primary: "#0e7490", accent: "#9d174d" },
    rationale: "Clinical teal with a soft accent — calm, and legible at body-text size.",
  },
  {
    match: ["landscap", "lawn", "garden", "tree", "nursery"],
    preset: "heritage",
    colors: { primary: "#166534", accent: "#a16207" },
    rationale: "Foliage green with an earth accent.",
  },
  {
    match: ["groom", "pet", "veterin", "kennel"],
    preset: "heritage",
    colors: { primary: "#6d28d9", accent: "#b45309" },
    rationale: "Friendlier than a trade palette without going pastel, which fails AA.",
  },
  {
    match: ["bakery", "restaurant", "cafe", "catering", "butcher", "deli"],
    preset: "heritage",
    colors: { primary: "#7c2d12", accent: "#166534" },
    rationale: "Oven brown with a fresh-produce green.",
  },
];

/** Used when the niche matches nothing above — or when there is no niche. */
export const DEFAULT_STYLE: NicheStyle = {
  match: [],
  preset: "heritage",
  colors: { primary: "#334155", accent: "#b45309" },
  rationale: "Neutral slate with a warm accent: safe for any trade, committed to none.",
};

export function styleForNiche(niche: string | undefined): NicheStyle {
  if (!niche) return DEFAULT_STYLE;
  const haystack = niche.toLowerCase();
  return NICHE_STYLES.find((s) => s.match.some((m) => haystack.includes(m))) ?? DEFAULT_STYLE;
}

/** Stable small integer from a slug. djb2 — no randomness, so runs repeat. */
function hashSlug(slug: string): number {
  let h = 5381;
  for (let i = 0; i < slug.length; i += 1) h = (h * 33) ^ slug.charCodeAt(i);
  return Math.abs(h);
}

export interface GeneratedPalette {
  colors: BrandColors;
  preset: ThemePreset;
  rationale: string;
  /** Degrees of hue rotation applied to separate same-niche neighbours. */
  hueShift: number;
}

/**
 * A palette for a prospect with no brand assets.
 *
 * The niche picks the pairing; the slug picks a small hue rotation on top, so
 * two machine shops in the same town do not get byte-identical demos. The
 * rotation is bounded (±14°) — enough to distinguish, not enough to turn a
 * considered pairing into a different one — and the result is re-checked
 * against WCAG AA, falling back to the unrotated pairing if the rotation
 * pushed it below the floor.
 */
export function generatePalette(slug: string, niche: string | undefined): GeneratedPalette {
  const style = styleForNiche(niche);
  const hueShift = (hashSlug(slug) % 29) - 14;

  const rotated: BrandColors = {
    primary: rotateHue(style.colors.primary, hueShift),
    accent: rotateHue(style.colors.accent, hueShift),
  };

  if (palettePasses(rotated.primary, rotated.accent)) {
    return { colors: rotated, preset: style.preset, rationale: style.rationale, hueShift };
  }

  const repaired = repairPalette(rotated.primary, rotated.accent);
  if (repaired.pairings.every((p) => p.ok)) {
    return {
      colors: { primary: repaired.primary, accent: repaired.accent },
      preset: style.preset,
      rationale: `${style.rationale} Darkened to clear WCAG AA after the per-prospect hue shift.`,
      hueShift,
    };
  }

  return {
    colors: style.colors,
    preset: style.preset,
    rationale: `${style.rationale} Hue shift dropped the pair below WCAG AA, so the base pairing was kept.`,
    hueShift: 0,
  };
}
