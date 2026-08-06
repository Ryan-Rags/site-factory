/**
 * Asserts WCAG AA contrast for the two brand colours in site.config.ts and
 * the shades derived from them.
 *
 * Run with: node scripts/check-contrast.mjs
 * Exits non-zero if any pair fails, so it can gate a deploy.
 *
 * The two colours are the only thing that changes per client, so this is the
 * one check worth re-running every time someone edits the theme.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const configSrc = readFileSync(join(here, '..', 'site.config.ts'), 'utf8');

const grab = (key) => {
  const match = new RegExp(`${key}:\\s*'(#[0-9a-fA-F]{6})'`).exec(configSrc);
  if (!match) throw new Error(`Could not find theme.colors.${key} in site.config.ts`);
  return match[1];
};

const primary = grab('primary');
const accent = grab('accent');

const toRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** Matches the CSS `color-mix(in srgb, C p%, other)` used in BaseLayout. */
const mix = (hex, pct, other) => {
  const a = toRgb(hex);
  const b = toRgb(other);
  const w = pct / 100;
  const out = a.map((v, i) => Math.round(v * w + b[i] * (1 - w)));
  return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};

const luminance = (hex) => {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const WHITE = '#ffffff';
const primaryDark = mix(primary, 78, '#000000');
const primaryWash = mix(primary, 7, WHITE);
const accentDark = mix(accent, 82, '#000000');

// `min` is the WCAG AA floor for that pairing: 4.5 for body text,
// 3.0 for large text (>=24px, or >=18.66px bold) and UI boundaries.
const pairs = [
  { label: 'primary text on white', fg: primary, bg: WHITE, min: 4.5 },
  { label: 'white text on primary', fg: WHITE, bg: primary, min: 4.5 },
  { label: 'white text on primary-dark (footer, CTA band)', fg: WHITE, bg: primaryDark, min: 4.5 },
  { label: 'primary text on primary-wash (active nav, chips)', fg: primary, bg: primaryWash, min: 4.5 },
  { label: 'accent text on white', fg: accent, bg: WHITE, min: 4.5 },
  { label: 'white text on accent (primary button)', fg: WHITE, bg: accent, min: 4.5 },
  { label: 'accent-dark on white (eyebrows, icons, focus ring)', fg: accentDark, bg: WHITE, min: 4.5 },
  { label: 'accent-dark on primary-wash (icons on trust strip)', fg: accentDark, bg: primaryWash, min: 3.0 },
];

let failed = 0;
console.log(`primary ${primary}   accent ${accent}\n`);
for (const pair of pairs) {
  const r = ratio(pair.fg, pair.bg);
  const ok = r >= pair.min;
  if (!ok) failed += 1;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${r.toFixed(2).padStart(5)}:1  (min ${pair.min.toFixed(1)})  ${pair.label}`,
  );
}

console.log();
if (failed > 0) {
  console.error(`${failed} pairing(s) below WCAG AA. Adjust the two colours in site.config.ts.`);
  process.exit(1);
}
console.log('All pairings meet WCAG AA.');
