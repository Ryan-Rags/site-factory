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
 *
 * ## The preset column was wrong, and is now corrected
 *
 * `packages/template/src/types/design.ts` defines what each design family is
 * *for*, and it is the authority — the families were designed against those
 * descriptions:
 *
 *   forge     — "Machine shops, welding, fabrication."
 *   precision — "Contractors, HVAC, electrical."
 *   heritage  — "Legacy shops, 'family owned since' trades."
 *
 * This table used to map machine shops to `precision` and contractors to
 * `heritage` — the template's assignment for a *different* trade in both
 * cases. Every generated demo since has been dressed in the wrong family. The
 * column below now follows the template.
 *
 * The `colors` column is unchanged. Preset and palette are separate axes in
 * `DesignConfig` (the preset owns the page's own palette; these two colours
 * drive the legacy `BaseLayout` pages and are offered to the design layer as a
 * brand accent), each pairing was chosen on its own merits, and each clears
 * WCAG AA. Correcting one axis is not a reason to disturb the other.
 *
 * `heritage` is deliberately absent from this table. It is not a trade — it is
 * a property of a particular business, and it is chosen by
 * {@link legacySignal} from sourced evidence rather than guessed from a niche
 * string. A machine shop trading since 1918 is a legacy shop; a machine shop
 * that opened last year is not, and the niche cannot tell them apart.
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
    preset: "forge",
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
    preset: "precision",
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
    preset: "precision",
    colors: { primary: "#166534", accent: "#a16207" },
    rationale: "Foliage green with an earth accent.",
  },
  {
    match: ["groom", "pet", "veterin", "kennel"],
    preset: "precision",
    colors: { primary: "#6d28d9", accent: "#b45309" },
    rationale: "Friendlier than a trade palette without going pastel, which fails AA.",
  },
  {
    match: ["bakery", "restaurant", "cafe", "catering", "butcher", "deli"],
    preset: "precision",
    colors: { primary: "#7c2d12", accent: "#166534" },
    rationale: "Oven brown with a fresh-produce green.",
  },
];

/**
 * Used when the niche matches nothing above — or when there is no niche.
 *
 * `precision` is the neutral default rather than `heritage`: it is the family
 * the template describes in the least trade-specific terms (white/graphite,
 * clean sans), and heritage now means something specific that an unknown niche
 * is no evidence for.
 */
export const DEFAULT_STYLE: NicheStyle = {
  match: [],
  preset: "precision",
  colors: { primary: "#334155", accent: "#b45309" },
  rationale: "Neutral slate with a warm accent: safe for any trade, committed to none.",
};

export function styleForNiche(niche: string | undefined): NicheStyle {
  if (!niche) return DEFAULT_STYLE;
  const haystack = niche.toLowerCase();
  return NICHE_STYLES.find((s) => s.match.some((m) => haystack.includes(m))) ?? DEFAULT_STYLE;
}

/**
 * How old a business has to be before "legacy" is a description rather than a
 * flattery. Forty years puts the founding beyond most owners' own careers,
 * which is the point at which a shop's age is genuinely part of what it sells.
 */
export const LEGACY_YEARS = 40;

/** Names that state family ownership outright. Their words, not our inference. */
const FAMILY_NAME = /\b(&|and)\s*sons?\b|\bbrothers\b|\bbros\.?\b|\b&\s*daughters?\b/i;

export interface PresetChoice {
  preset: ThemePreset;
  /** Why, in plain words. Lands in `preset.note` and the run report. */
  rationale: string;
}

/**
 * Evidence that this is a legacy or family shop, or `null`.
 *
 * Every branch here reads a *sourced* value. An unavailable `foundedYear` is
 * not a signal, a business we simply know nothing about is not a legacy shop,
 * and there is no path by which "it feels old" selects a design family. That
 * matters more than it looks: `heritage` renders "family owned since" framing,
 * and framing a business that way when nobody told us it is true is the same
 * class of mistake as writing the sentence.
 */
export function legacySignal(input: {
  foundedYear?: number | undefined;
  legalName?: string | undefined;
  businessName?: string | undefined;
  /** A sourced `family-run` claim, where one exists. */
  familyRun?: string | undefined;
  /** Injectable so a test does not drift with the calendar. */
  thisYear?: number;
}): string | null {
  const year = input.thisYear ?? new Date().getFullYear();

  if (input.familyRun !== undefined && input.familyRun.trim() !== "") {
    return `family ownership is stated and sourced ("${input.familyRun}")`;
  }
  if (input.foundedYear !== undefined && year - input.foundedYear >= LEGACY_YEARS) {
    return `trading since ${input.foundedYear}, which a source gave us — ${year - input.foundedYear} years`;
  }
  for (const name of [input.legalName, input.businessName]) {
    if (name !== undefined && FAMILY_NAME.test(name)) {
      return `the business's own name says family ownership ("${name}")`;
    }
  }
  return null;
}

/**
 * The design family for a prospect, from the niche and what we know of them.
 *
 * Precedence, highest first:
 *
 *  1. an explicit `--preset` (handled by the caller — it never reaches here);
 *  2. a sourced legacy/family signal → `heritage`;
 *  3. the niche table above;
 *  4. {@link DEFAULT_STYLE}.
 */
export function presetFor(
  niche: string | undefined,
  legacy: Parameters<typeof legacySignal>[0] = {},
): PresetChoice {
  const signal = legacySignal(legacy);
  if (signal !== null) {
    return { preset: "heritage", rationale: `a legacy shop: ${signal}` };
  }
  const style = styleForNiche(niche);
  return { preset: style.preset, rationale: `chosen from the niche: ${style.rationale}` };
}

/** Stable small integer from a slug. djb2 — no randomness, so runs repeat. */
function hashSlug(slug: string): number {
  let h = 5381;
  for (let i = 0; i < slug.length; i += 1) h = (h * 33) ^ slug.charCodeAt(i);
  return Math.abs(h);
}

/**
 * Colours only. The design family is {@link presetFor}'s decision and nothing
 * else's — this used to carry a `preset` too, which meant two functions could
 * answer the same question differently and one of them would be ignored.
 */
export interface GeneratedPalette {
  colors: BrandColors;
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
    return { colors: rotated, rationale: style.rationale, hueShift };
  }

  const repaired = repairPalette(rotated.primary, rotated.accent);
  if (repaired.pairings.every((p) => p.ok)) {
    return {
      colors: { primary: repaired.primary, accent: repaired.accent },
      rationale: `${style.rationale} Darkened to clear WCAG AA after the per-prospect hue shift.`,
      hueShift,
    };
  }

  return {
    colors: style.colors,
    rationale: `${style.rationale} Hue shift dropped the pair below WCAG AA, so the base pairing was kept.`,
    hueShift: 0,
  };
}
