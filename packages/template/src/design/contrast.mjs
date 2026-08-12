/**
 * The contrast rule, once.
 *
 * Three things need to agree about whether a colour pairing is legible: the
 * gate that fails the build, the renderer that decides which swatches to emit
 * CSS for, and the panel that decides which swatches to offer. When they
 * disagree, the panel offers a cell the gate rejected — which is the exact
 * shape of the bug this branch started with, one axis over.
 *
 * So the maths lives here and all three import it. Plain `.mjs` rather than
 * `.ts` for the same reason `presets.json` is JSON: `check-contrast.mjs` is a
 * bare Node script and cannot import TypeScript, while Astro imports `.mjs`
 * without complaint. Types are declared alongside in `contrast.d.ts`.
 *
 * The thresholds are WCAG AA: 4.5:1 for text, and 1.4.11's 3:1 for the
 * boundary of a real control. They are not adjustable, on purpose.
 */

const toRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

const toHex = (rgb) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/** Matches CSS `color-mix(in srgb, A p%, B)` for opaque colours. */
export const mix = (a, pct, b) => {
  const x = toRgb(a);
  const y = toRgb(b);
  const w = pct / 100;
  return toHex(x.map((v, i) => v * w + y[i] * (1 - w)));
};

export const luminance = (hex) => {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const ratio = (fg, bg) => {
  const a = luminance(fg);
  const b = luminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
};

/**
 * Whether a palette reads light-on-dark.
 *
 * Inferred from the base colour rather than declared, so a preset cannot claim
 * one tone and ship the other. It decides which way the "strong" accent moves:
 * mixing an ember orange toward black against a carbon background lands at
 * 3.5:1, while mixing it toward the ink lifts it clear.
 */
export const isDarkPalette = (palette) => luminance(palette.base) < 0.2;

/**
 * Every pair a palette must satisfy, with the value it must reach.
 *
 * The `color-mix()` derivations `designTokens()` emits are recomputed here by
 * hand, because they are where the failures actually happen — a legible accent
 * whose hover state drops to 3.5:1 is the bug this catches.
 *
 * Only `line-strong` is checked among the non-text boundaries, and the
 * distinction is the point. `--d-line` draws dividers and card edges, which
 * 1.4.11 exempts as decoration beside already-separated content;
 * `--d-line-strong` draws the boundary of an actual control — the ghost
 * button, the menu button, the panel's option chips — which carries the
 * information "this is a thing you can press".
 */
export function pairsFor(palette) {
  const c = palette;
  const dark = isDarkPalette(c);

  const accentStrong = mix(c.accent, 80, dark ? c.ink : '#000000');
  const accentSoft = mix(c.accent, 12, c.surface);
  const primarySoft = mix(c.primary, 10, c.surface);
  const tint2 = mix(c.ink, 4, c.base);
  const tint6 = mix(c.ink, 8, c.base);
  const lineStrong = mix(c.ink, 55, c.base);

  return [
    ['ink on base', c.ink, c.base, 4.5],
    ['ink on surface', c.ink, c.surface, 4.5],
    ['ink on surfaceAlt', c.ink, c.surfaceAlt, 4.5],
    ['inkMuted on base', c.inkMuted, c.base, 4.5],
    ['inkMuted on surface', c.inkMuted, c.surface, 4.5],
    ['onPrimary on primary', c.onPrimary, c.primary, 4.5],
    ['onAccent on accent', c.onAccent, c.accent, 4.5],
    // The accent is body-sized text in eyebrows, stat figures and card links.
    ['accent on base', c.accent, c.base, 4.5],
    ['accent on surface', c.accent, c.surface, 4.5],
    // Hover state: same text, different background.
    ['onAccent on accent-strong', c.onAccent, accentStrong, 4.5],
    ['ink on accent-soft', c.ink, accentSoft, 4.5],
    ['ink on primary-soft', c.ink, primarySoft, 4.5],
    ['ink on tint-2', c.ink, tint2, 4.5],
    ['inkMuted on tint-2', c.inkMuted, tint2, 4.5],
    ['ink on tint-6', c.ink, tint6, 4.5],
    ['line-strong on base', lineStrong, c.base, 3.0],
    ['line-strong on surface', lineStrong, c.surface, 3.0],
  ];
}

/** The pairs a palette fails, each with the number it actually reached. */
export function paletteFailures(palette) {
  const out = [];
  for (const [name, fg, bg, min] of pairsFor(palette)) {
    const value = ratio(fg, bg);
    if (value + 1e-9 < min) out.push({ name, fg, bg, value, min });
  }
  return out;
}

/**
 * Whether a swatch may be offered in a given tone.
 *
 * This is the predicate the renderer uses to drop a prospect's brand colour
 * from the cells it cannot carry — and the same one the gate uses to decide
 * what to report. One function, so the offered set and the checked set are the
 * same set by construction.
 */
export function clearsGate(palette, swatch) {
  return (
    paletteFailures({ ...palette, accent: swatch.accent, onAccent: swatch.onAccent }).length === 0
  );
}
