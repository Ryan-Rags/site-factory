/**
 * Colour maths for the generated palette.
 *
 * The pairing list and the `mix`/`luminance`/`ratio` functions are a port of
 * `packages/template/scripts/check-contrast.mjs`, deliberately kept identical
 * rather than approximated. That script reads the two colours back out of
 * `site.config.ts` with a regex, so it cannot see a generated config handed to
 * the build through `SITE_CONFIG_FILE`; porting the check is what keeps a
 * generated palette held to exactly the same WCAG AA bar as a hand-authored
 * one. If the template's pairings change, change these too.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function parseHex(hex: string): Rgb {
  const clean = hex.trim().replace(/^#/, "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`not a hex colour: ${hex}`);
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

const clamp255 = (v: number): number => Math.max(0, Math.min(255, Math.round(v)));

export function toHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((v) => clamp255(v).toString(16).padStart(2, "0")).join("")}`;
}

/** Matches the CSS `color-mix(in srgb, C p%, other)` the base layout uses. */
export function mix(hex: string, pct: number, other: string): string {
  const a = parseHex(hex);
  const b = parseHex(other);
  const w = pct / 100;
  return toHex({
    r: a.r * w + b.r * (1 - w),
    g: a.g * w + b.g * (1 - w),
    b: a.b * w + b.b * (1 - w),
  });
}

export function luminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  const [lr, lg, lb] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const WHITE = "#ffffff";
const BLACK = "#000000";

export interface Pairing {
  label: string;
  ratio: number;
  min: number;
  ok: boolean;
}

/** The eight pairings the template actually renders. */
export function contrastPairings(primary: string, accent: string): Pairing[] {
  const primaryDark = mix(primary, 78, BLACK);
  const primaryWash = mix(primary, 7, WHITE);
  const accentDark = mix(accent, 82, BLACK);

  const pairs: { label: string; fg: string; bg: string; min: number }[] = [
    { label: "primary text on white", fg: primary, bg: WHITE, min: 4.5 },
    { label: "white text on primary", fg: WHITE, bg: primary, min: 4.5 },
    { label: "white text on primary-dark", fg: WHITE, bg: primaryDark, min: 4.5 },
    { label: "primary text on primary-wash", fg: primary, bg: primaryWash, min: 4.5 },
    { label: "accent text on white", fg: accent, bg: WHITE, min: 4.5 },
    { label: "white text on accent", fg: WHITE, bg: accent, min: 4.5 },
    { label: "accent-dark on white", fg: accentDark, bg: WHITE, min: 4.5 },
    { label: "accent-dark on primary-wash", fg: accentDark, bg: primaryWash, min: 3.0 },
  ];

  return pairs.map((p) => {
    const ratio = contrast(p.fg, p.bg);
    return { label: p.label, ratio, min: p.min, ok: ratio >= p.min };
  });
}

export function palettePasses(primary: string, accent: string): boolean {
  return contrastPairings(primary, accent).every((p) => p.ok);
}

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h: h * 360, s, l };
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  const hn = ((h % 360) + 360) % 360 / 360;
  if (s === 0) {
    const v = l * 255;
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t0: number): number => {
    let t = t0;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return {
    r: channel(hn + 1 / 3) * 255,
    g: channel(hn) * 255,
    b: channel(hn - 1 / 3) * 255,
  };
}

export function hexToHsl(hex: string): Hsl {
  return rgbToHsl(parseHex(hex));
}

export function hslToHex(hsl: Hsl): string {
  return toHex(hslToRgb(hsl));
}

/** Rotate hue, keeping saturation and lightness. Used to vary niche palettes. */
export function rotateHue(hex: string, degrees: number): string {
  const hsl = hexToHsl(hex);
  return hslToHex({ ...hsl, h: hsl.h + degrees });
}

/**
 * Darken a colour until the palette it belongs to passes every pairing.
 *
 * Extracted brand colours are frequently a shade or two too light to carry
 * body text — a mid blue logo is not a WCAG-compliant text colour. Rather than
 * reject the brand and fall back to a generated palette, the hue and
 * saturation are kept and only lightness is walked down. The result still
 * reads as their colour; it just clears the floor the template renders at.
 *
 * Returns null when even black does not satisfy the pairings, which can only
 * happen if the *other* colour is the failing one.
 */
export function darkenUntilAA(
  hex: string,
  passes: (candidate: string) => boolean,
  step = 0.02,
): string | null {
  const hsl = hexToHsl(hex);
  for (let l = hsl.l; l >= 0; l -= step) {
    const candidate = hslToHex({ ...hsl, l });
    if (passes(candidate)) return candidate;
  }
  return null;
}

/* --------------------------------------------------- the design-layer gate */

/**
 * The design families' colour model, and the second half of the contrast
 * problem this file exists to solve.
 *
 * `contrastPairings` above covers the *legacy* two-colour model that
 * `BaseLayout` renders — still the model `/about`, `/services` and `/contact`
 * use for every client. A `DesignConfig`, though, renders from a preset
 * palette in `packages/template/src/design/presets.json` with one accent
 * swatch: either one of the preset's curated four, or the prospect's own
 * extracted `brandAccent`.
 *
 * `scripts/check-contrast.mjs --matrix` checks every preset × every accent,
 * and finds per-prospect brand accents by reading `clients/design/*.json`. A
 * generated config handed to the build through `SITE_CONFIG_FILE` is not in
 * that directory and never will be — ingested third-party data does not go in
 * the repo — so the gate structurally cannot see it. That leaves two options:
 * offer a brand accent nothing has checked, or check it here.
 *
 * The derivations below are copied from `checkPalette()` in that script, which
 * itself models `designTokens()`. Three implementations of one rule is one too
 * many, and it is worth saying plainly: if the tokens change, all three change
 * together, and a divergence shows up as a demo that passes here and fails the
 * real gate. Editing the gate script is outside this stream's grant; this is
 * the seam that leaves.
 */
export interface DesignPalette {
  base: string;
  surface: string;
  surfaceAlt: string;
  ink: string;
  inkMuted: string;
  line: string;
  primary: string;
  onPrimary: string;
}

const isDarkPalette = (palette: DesignPalette): boolean => luminance(palette.base) < 0.2;

/**
 * Every pair a design family renders text on, with one accent applied.
 *
 * Text pairs at 4.5:1; the one control boundary at WCAG 1.4.11's 3:1. The set
 * and the thresholds mirror `checkPalette()` exactly — including which pairs
 * are deliberately *not* checked. `--d-line` draws dividers beside content
 * that is already separated by background and spacing, which 1.4.11 exempts;
 * holding it to 3:1 fails every palette in the file.
 */
export function designPairings(palette: DesignPalette, accent: string, onAccent: string): Pairing[] {
  const dark = isDarkPalette(palette);
  const accentStrong = mix(accent, 80, dark ? palette.ink : BLACK);
  const accentSoft = mix(accent, 12, palette.surface);
  const primarySoft = mix(palette.primary, 10, palette.surface);
  const tint2 = mix(palette.ink, 4, palette.base);
  const tint6 = mix(palette.ink, 8, palette.base);
  const lineStrong = mix(palette.ink, 55, palette.base);

  const pairs: { label: string; fg: string; bg: string; min: number }[] = [
    { label: "ink on base", fg: palette.ink, bg: palette.base, min: 4.5 },
    { label: "ink on surface", fg: palette.ink, bg: palette.surface, min: 4.5 },
    { label: "ink on surfaceAlt", fg: palette.ink, bg: palette.surfaceAlt, min: 4.5 },
    { label: "inkMuted on base", fg: palette.inkMuted, bg: palette.base, min: 4.5 },
    { label: "inkMuted on surface", fg: palette.inkMuted, bg: palette.surface, min: 4.5 },
    { label: "onPrimary on primary", fg: palette.onPrimary, bg: palette.primary, min: 4.5 },
    { label: "onAccent on accent", fg: onAccent, bg: accent, min: 4.5 },
    { label: "accent on base", fg: accent, bg: palette.base, min: 4.5 },
    { label: "accent on surface", fg: accent, bg: palette.surface, min: 4.5 },
    { label: "onAccent on accent-strong", fg: onAccent, bg: accentStrong, min: 4.5 },
    { label: "ink on accent-soft", fg: palette.ink, bg: accentSoft, min: 4.5 },
    { label: "ink on primary-soft", fg: palette.ink, bg: primarySoft, min: 4.5 },
    { label: "ink on tint-2", fg: palette.ink, bg: tint2, min: 4.5 },
    { label: "inkMuted on tint-2", fg: palette.inkMuted, bg: tint2, min: 4.5 },
    { label: "ink on tint-6", fg: palette.ink, bg: tint6, min: 4.5 },
    { label: "line-strong on base", fg: lineStrong, bg: palette.base, min: 3.0 },
    { label: "line-strong on surface", fg: lineStrong, bg: palette.surface, min: 3.0 },
  ];

  return pairs.map((p) => {
    const ratio = contrast(p.fg, p.bg);
    // 1e-9 of slack, matching `assertPair`: a ratio landing exactly on the
    // threshold should not fail on a floating-point remainder.
    return { label: p.label, ratio, min: p.min, ok: ratio + 1e-9 >= p.min };
  });
}

/**
 * Would this accent be safe in this family?
 *
 * Called before a prospect's extracted brand colour is offered as
 * `theme.brandAccent`. A `false` means the colour is **dropped**, never
 * adjusted: `presets.ts` is explicit that a shifted colour is not their
 * colour, and offering a nudged version of somebody's brand as their brand is
 * the visual form of making a fact up.
 */
export function designAccentPasses(
  palette: DesignPalette,
  accent: string,
  onAccent: string,
): boolean {
  return designPairings(palette, accent, onAccent).every((p) => p.ok);
}

/**
 * Black or white on the given colour, whichever is more legible.
 *
 * A brand accent arrives as one hex value; `AccentSwatch` needs both halves of
 * the pair. The curated swatches pick their `onAccent` by hand; this picks the
 * better of the two extremes, and the pairing check then decides whether the
 * result is usable at all.
 */
export function onColorFor(accent: string): string {
  return contrast(BLACK, accent) >= contrast(WHITE, accent) ? BLACK : WHITE;
}

export interface RepairResult {
  primary: string;
  accent: string;
  /** True when either colour had to be darkened to clear WCAG AA. */
  adjusted: boolean;
  pairings: Pairing[];
}

/**
 * Bring a candidate pair up to AA, darkening as little as possible.
 *
 * Primary is repaired first because five of the eight pairings involve it,
 * then accent against the repaired primary. A pair that cannot be repaired is
 * returned with `pairings` still failing, and the caller falls back to the
 * niche palette rather than shipping an unreadable site.
 */
export function repairPalette(primary: string, accent: string): RepairResult {
  let p = primary;
  let a = accent;
  let adjusted = false;

  if (!contrastPairings(p, a).every((x) => (x.label.includes("primary") ? x.ok : true))) {
    const fixed = darkenUntilAA(p, (candidate) =>
      contrastPairings(candidate, a)
        .filter((x) => x.label.includes("primary"))
        .every((x) => x.ok),
    );
    if (fixed && fixed !== p) {
      p = fixed;
      adjusted = true;
    }
  }

  if (!contrastPairings(p, a).every((x) => x.ok)) {
    const fixed = darkenUntilAA(a, (candidate) => contrastPairings(p, candidate).every((x) => x.ok));
    if (fixed && fixed !== a) {
      a = fixed;
      adjusted = true;
    }
  }

  return { primary: p, accent: a, adjusted, pairings: contrastPairings(p, a) };
}
