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
