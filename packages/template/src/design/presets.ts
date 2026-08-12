/**
 * Theme presets: the three families, as data.
 *
 * The original design plan made every client hand-author a ten-colour palette
 * and a full font block, with `family` selecting only decorative rules. That
 * inverts here: **the preset owns the palette**, and a client config *chooses*
 * from it rather than restating it. Three reasons that is the right way round:
 *
 * 1. A prospect config can no longer contradict its own family — there is no
 *    field in which to write a cream `base` under `family: "forge"`.
 * 2. The set of reachable colour combinations becomes finite and enumerable,
 *    which is the only reason `scripts/check-contrast.mjs` can gate *every*
 *    combination the customizer offers rather than only the one we shipped.
 * 3. The discovery pipeline can emit a design config by picking three ids,
 *    instead of inventing colours it has no basis for.
 *
 * There is deliberately no free colour input anywhere — not in the config, not
 * in the customizer UI. Accents are a curated list per preset. A prospect's own
 * extracted brand colour may be added to that list (`brandAccent`), but it is
 * offered only if it clears the contrast gate; see `check-contrast.mjs`.
 *
 * The data lives in `presets.json` rather than in this file because a plain
 * Node script has to read it too — the contrast gate runs outside Astro and
 * cannot import TypeScript. JSON in fact, typed in effect, exactly as
 * `lib/design.ts` already does for `DesignConfig`.
 */

import raw from './presets.json';
import type { HeroVariant } from '../types/design';
import type { FontFace } from '../types/site';

export type PresetId = 'forge' | 'precision' | 'heritage';
export type RadiusName = 'sharp' | 'soft';
export type DensityName = 'compact' | 'comfortable';

/**
 * Light or dark, as a token dimension in its own right.
 *
 * A scheme is a *tone*, not a second design system: it owns the palette and
 * the accents and nothing else. Radius, density, lettering and the layout
 * allow-list stay on the preset, so a dark Precision is still recognisably
 * Precision — same geometry, same type, same arrangements.
 *
 * Accents belong to the scheme because they have to. `onAccent`, and the 4.5:1
 * an accent must reach against `base` and `surface`, are different questions in
 * each tone: Forge's shipped ember reaches 3.49:1 on a light base and could not
 * honestly be offered there. The two tones therefore carry the same accent
 * *ids* with different values, which is also what lets a prospect flip the
 * scheme without losing the colour they picked.
 */
export type SchemeName = 'light' | 'dark';

export const SCHEMES: SchemeName[] = ['light', 'dark'];

/** The colours a preset owns. The accent is not among them — it is chosen. */
export interface PresetPalette {
  base: string;
  surface: string;
  surfaceAlt: string;
  ink: string;
  inkMuted: string;
  line: string;
  primary: string;
  onPrimary: string;
}

/**
 * One curated accent.
 *
 * `accent` and `onAccent` travel together and are checked together: an accent
 * is only ever offered with the text colour it was measured against, so there
 * is no combination in which a light accent inherits dark-theme text.
 */
export interface AccentSwatch {
  id: string;
  label: string;
  accent: string;
  onAccent: string;
}

export interface FontPairing {
  id: string;
  label: string;
  display: string;
  body: string;
  displayWeight: string;
  displayTransform: 'none' | 'uppercase';
  displayTracking: string;
  /**
   * Optional self-hosted `.woff2` faces. Every pairing shipped today is a
   * system stack, which is why these demos make zero font requests and a
   * large part of why they hold the mobile performance bar — but a client
   * with a licensed brand face can have one without a code change.
   */
  faces?: FontFace[];
}

/** One tone of one preset: the colours, and the accents measured against them. */
export interface PresetScheme {
  palette: PresetPalette;
  accents: AccentSwatch[];
}

export interface ThemePreset {
  id: PresetId;
  label: string;
  blurb: string;
  /** The tone this family is shown in when a config does not say. */
  defaultScheme: SchemeName;
  radius: RadiusName;
  density: DensityName;
  schemes: Record<SchemeName, PresetScheme>;
  fonts: FontPairing[];
  variants: { hero: HeroVariant[]; services: string[]; reviews: string[] };
}

interface PresetFile {
  presets: ThemePreset[];
  radiusScale: Record<RadiusName, { card: string; btn: string }>;
  densityScale: Record<DensityName, { section: string; sectionLg: string; gap: string }>;
}

const file = raw as unknown as PresetFile;

export const PRESETS: ThemePreset[] = file.presets;
export const RADIUS_SCALE = file.radiusScale;
export const DENSITY_SCALE = file.densityScale;
export const PRESET_IDS: PresetId[] = PRESETS.map((p) => p.id);

export function getPreset(id: string): ThemePreset {
  const preset = PRESETS.find((p) => p.id === id);
  if (!preset)
    throw new Error(
      `Unknown theme preset "${id}" — expected one of ${PRESET_IDS.join(', ')}. ` +
        `Presets are defined in src/design/presets.json.`,
    );
  return preset;
}

/**
 * A client's choice within a preset.
 *
 * Three ids and two optional overrides — that is the whole of a site's visual
 * identity. `brandAccent` is the one place a raw colour enters, and it is the
 * prospect's own extracted brand colour rather than a designer's pick.
 */
export interface ThemeSelection {
  preset: PresetId;
  /**
   * Light or dark. Optional, and defaults to the preset's `defaultScheme` —
   * which is the tone that family shipped in before schemes existed, so an
   * older config renders exactly as it did.
   */
  scheme?: SchemeName;
  /** An `AccentSwatch.id` from the preset, or `"brand"` for `brandAccent`. */
  accent: string;
  /** A `FontPairing.id` from the preset. */
  fontPairing: string;
  radius?: RadiusName;
  density?: DensityName;
  /**
   * The prospect's extracted brand colour, offered alongside the curated
   * swatches. Carries `sourceNote` for the same reason testimonials do: where
   * a colour came from is a fact about our research, and an unsourced brand
   * colour is a guess wearing a client's name.
   *
   * It is dropped from the offered set if it fails the contrast gate rather
   * than being nudged until it passes — a shifted colour is not their colour,
   * and presenting it as such would be the visual equivalent of fabricating a
   * fact. See `check-contrast.mjs` and the plan's Q1.
   */
  brandAccent?: AccentSwatch & { sourceNote: string };
  /** Escape hatch for a one-off. Still gated; see `check-contrast.mjs`. */
  paletteOverride?: Partial<PresetPalette & { accent: string; onAccent: string }>;
}

/** Everything the tokens need, with every choice already made. */
export interface ResolvedTheme {
  preset: ThemePreset;
  scheme: SchemeName;
  palette: PresetPalette & { accent: string; onAccent: string };
  fonts: FontPairing;
  radius: { card: string; btn: string };
  density: { section: string; sectionLg: string; gap: string };
}

/** The tone a selection is in: its own, or the family's default. */
export function schemeFor(theme: ThemeSelection): SchemeName {
  return theme.scheme ?? getPreset(theme.preset).defaultScheme;
}

/** One tone of one preset, by name. Fails loudly on an unknown tone. */
export function getScheme(preset: ThemePreset, scheme: SchemeName): PresetScheme {
  const found = preset.schemes[scheme];
  if (!found)
    throw new Error(
      `Preset "${preset.id}" has no "${scheme}" scheme — expected one of ` +
        `${Object.keys(preset.schemes).join(', ')}. Schemes live in src/design/presets.json.`,
    );
  return found;
}

/**
 * The swatches a preset offers for a given client, brand colour included.
 *
 * Scheme-aware: the same accent id names a different colour in each tone, and
 * this returns the one that was measured against the tone in play.
 */
export function accentsFor(theme: ThemeSelection): AccentSwatch[] {
  const scheme = getScheme(getPreset(theme.preset), schemeFor(theme));
  return theme.brandAccent ? [...scheme.accents, theme.brandAccent] : scheme.accents;
}

/** One tone of one preset, with the swatches it offers this client. */
export interface OfferedScheme {
  scheme: SchemeName;
  palette: PresetPalette;
  accents: AccentSwatch[];
}

/** One preset, with every tone it offers and the pairings they share. */
export interface OfferedPreset {
  preset: ThemePreset;
  schemes: OfferedScheme[];
  fonts: FontPairing[];
}

/**
 * Every cell the customizer may offer, for one client.
 *
 * This is the single source the panel's controls, the panel's resolver, the
 * pre-paint script and `themeMatrixCss()` all read. They used to work it out
 * separately, and the bug that cost the most was exactly that disagreement:
 * the panel went on offering Forge's swatches after a switch to Heritage,
 * while the matrix had only ever emitted a block for Forge+Molten — so a
 * prospect picking amber on cream got the other family's orange, served from
 * the shipped `:root` block as a fallback.
 *
 * Deriving all four from one function does not merely fix that instance, it
 * removes the shape of the bug: an offered cell with no CSS block, or a CSS
 * block nothing can reach, now requires a change here. Adding the scheme axis
 * was the test of that: it is one extra loop in this function, and the panel,
 * the pre-paint script and the emitted CSS all gained the dimension together.
 */
export function offeredPresets(theme: ThemeSelection): OfferedPreset[] {
  return PRESETS.map((preset) => ({
    preset,
    schemes: SCHEMES.map((scheme) => {
      const data = getScheme(preset, scheme);
      return {
        scheme,
        palette: data.palette,
        // The prospect's own extracted brand colour rides along inside every
        // cell it was cleared for, exactly as the matrix emits it.
        accents: theme.brandAccent ? [...data.accents, theme.brandAccent] : data.accents,
      };
    }),
    fonts: preset.fonts,
  }));
}

/**
 * Turn three ids into concrete colours, fonts and metrics.
 *
 * Fails loudly on an unknown id rather than falling back to the first entry:
 * a typo'd accent silently rendering the default would ship the wrong site
 * under the right client's name, which is the failure `resolveClient()` and
 * `parseDesign()` both already refuse to allow.
 */
export function resolveTheme(theme: ThemeSelection): ResolvedTheme {
  const preset = getPreset(theme.preset);
  const scheme = schemeFor(theme);
  const tone = getScheme(preset, scheme);

  const swatch = accentsFor(theme).find((a) => a.id === theme.accent);
  if (!swatch)
    throw new Error(
      `Unknown accent "${theme.accent}" for preset "${preset.id}" in its "${scheme}" scheme — ` +
        `expected one of ${accentsFor(theme).map((a) => a.id).join(', ')}.`,
    );

  const fonts = preset.fonts.find((f) => f.id === theme.fontPairing);
  if (!fonts)
    throw new Error(
      `Unknown font pairing "${theme.fontPairing}" for preset "${preset.id}" — expected one of ` +
        `${preset.fonts.map((f) => f.id).join(', ')}.`,
    );

  return {
    preset,
    scheme,
    palette: {
      ...tone.palette,
      accent: swatch.accent,
      onAccent: swatch.onAccent,
      ...(theme.paletteOverride ?? {}),
    },
    fonts,
    radius: RADIUS_SCALE[theme.radius ?? preset.radius],
    density: DENSITY_SCALE[theme.density ?? preset.density],
  };
}

/**
 * Whether a palette reads light-on-dark.
 *
 * Inferred from the base colour rather than declared, so a preset cannot claim
 * one tone and ship the other. It decides which way the "strong" accent moves
 * — see `designTokens` in `lib/design.ts`. `check-contrast.mjs` carries the
 * same two functions; they are small, and duplicating them is cheaper than
 * making a plain Node script able to import TypeScript.
 */
export function isDarkPalette(palette: { base: string }): boolean {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(palette.base.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.2;
}
