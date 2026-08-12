/**
 * WCAG AA contrast gate.
 *
 * Two modes, because there are now two colour models in this package and both
 * can ship a site:
 *
 * - **legacy** — the two brand colours in each `clients/*.config.ts`. These
 *   drive `BaseLayout`'s `color-mix()` shades on the pages that still render
 *   through it (`/about`, `/services`, `/contact` for every client).
 *
 * - **matrix** — every preset × every accent × every font pairing in
 *   `src/design/presets.json`, plus any per-client `paletteOverride` and any
 *   prospect's extracted `brandAccent`.
 *
 * Matrix mode exists because of the customizer. A prospect can switch preset,
 * accent and lettering in the browser, which means the site we are answerable
 * for is not one combination but all of them. Checking only the combination we
 * happened to ship would gate the one page nobody ends up looking at.
 *
 * That is also the reason accents are a curated list rather than a colour
 * picker: a finite set of combinations is a set that can be *enumerated and
 * proved*. A free hex input would make this file impossible to write.
 *
 * The `color-mix()` derivations in `designTokens()` are modelled here by hand,
 * because they are where the failures actually happen — a legible accent whose
 * hover state drops to 3.5:1 is the bug this catches. `--d-accent-strong`
 * mixes toward `ink` on dark palettes and toward black on light ones, and this
 * script carries the same `isDarkPalette` rule the renderer uses. If you change
 * one, change the other; they are duplicated because a plain Node script
 * cannot import TypeScript.
 *
 * Usage:
 *   node scripts/check-contrast.mjs            # both modes
 *   node scripts/check-contrast.mjs --matrix   # presets only
 *   node scripts/check-contrast.mjs --legacy   # config brand colours only
 *
 * Exits non-zero on any failure, so it can gate a build.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, '..');

/* ------------------------------------------------------------------ colour */

const toRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

const toHex = (rgb) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/** Matches CSS `color-mix(in srgb, A p%, B)` for opaque colours. */
const mix = (a, pct, b) => {
  const x = toRgb(a);
  const y = toRgb(b);
  const w = pct / 100;
  return toHex(x.map((v, i) => v * w + y[i] * (1 - w)));
};

const luminance = (hex) => {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const ratio = (fg, bg) => {
  const a = luminance(fg);
  const b = luminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
};

/** The renderer's rule, duplicated. See the header note. */
const isDarkPalette = (palette) => luminance(palette.base) < 0.2;

/* ------------------------------------------------------------------ report */

let failures = 0;
let checks = 0;

function assertPair(label, fg, bg, min) {
  checks++;
  const value = ratio(fg, bg);
  if (value + 1e-9 >= min) return;
  failures++;
  console.error(
    `  ✗ ${label}: ${fg} on ${bg} = ${value.toFixed(2)}:1, needs ${min.toFixed(1)}:1`,
  );
}

/* ------------------------------------------------------------- matrix mode */

/**
 * Every pair that carries text, plus the boundaries of real controls.
 *
 * Text pairs are held to 4.5:1; control boundaries to WCAG 1.4.11's 3:1.
 * Purely decorative rules are not checked at all — see the note beside the
 * `line-strong` assertions for why that distinction had to be made.
 */
function checkPalette(label, palette) {
  const c = palette;
  const dark = isDarkPalette(c);

  // The derivations `designTokens()` emits, recomputed identically.
  const accentStrong = mix(c.accent, 80, dark ? c.ink : '#000000');
  const accentSoft = mix(c.accent, 12, c.surface);
  const primarySoft = mix(c.primary, 10, c.surface);
  const tint2 = mix(c.ink, 4, c.base);
  const tint6 = mix(c.ink, 8, c.base);
  const lineStrong = mix(c.ink, 55, c.base);

  assertPair(`${label} · ink on base`, c.ink, c.base, 4.5);
  assertPair(`${label} · ink on surface`, c.ink, c.surface, 4.5);
  assertPair(`${label} · ink on surfaceAlt`, c.ink, c.surfaceAlt, 4.5);
  assertPair(`${label} · inkMuted on base`, c.inkMuted, c.base, 4.5);
  assertPair(`${label} · inkMuted on surface`, c.inkMuted, c.surface, 4.5);
  assertPair(`${label} · onPrimary on primary`, c.onPrimary, c.primary, 4.5);
  assertPair(`${label} · onAccent on accent`, c.onAccent, c.accent, 4.5);
  // The accent is body-sized text in eyebrows, stat figures and card links.
  assertPair(`${label} · accent on base`, c.accent, c.base, 4.5);
  assertPair(`${label} · accent on surface`, c.accent, c.surface, 4.5);
  // Hover state: same text, different background.
  assertPair(`${label} · onAccent on accent-strong`, c.onAccent, accentStrong, 4.5);
  assertPair(`${label} · ink on accent-soft`, c.ink, accentSoft, 4.5);
  assertPair(`${label} · ink on primary-soft`, c.ink, primarySoft, 4.5);
  assertPair(`${label} · ink on tint-2`, c.ink, tint2, 4.5);
  assertPair(`${label} · inkMuted on tint-2`, c.inkMuted, tint2, 4.5);
  assertPair(`${label} · ink on tint-6`, c.ink, tint6, 4.5);
  /*
   * Non-text boundaries, at WCAG 1.4.11's 3:1.
   *
   * Only `line-strong` is checked, and the distinction is the point.
   * `--d-line` draws dividers, card edges and table rules — decoration beside
   * content that is already separated by background and spacing, which 1.4.11
   * exempts. `--d-line-strong` draws the boundary of an actual control: the
   * ghost button, the mobile menu button, the customizer's option chips.
   * Those carry the information "this is a thing you can press", so they are
   * held to the threshold.
   *
   * Running the whole matrix at 3:1 on `line` was what surfaced this: every
   * palette failed, and the honest reading was not that three good palettes
   * were wrong but that one token was doing two jobs.
   */
  assertPair(`${label} · line-strong on base`, lineStrong, c.base, 3.0);
  assertPair(`${label} · line-strong on surface`, lineStrong, c.surface, 3.0);
}

function runMatrix() {
  const presets = JSON.parse(
    readFileSync(join(pkgRoot, 'src', 'design', 'presets.json'), 'utf8'),
  );

  /*
   * Per-client extras: a `paletteOverride` and a prospect's own extracted
   * `brandAccent` are the two ways a colour can reach a page without being in
   * presets.json, so both are pulled in and checked against every preset they
   * could be shown in.
   *
   * A brand colour that fails is a build failure rather than a silent drop.
   * The plan resolved this as Q1(a) — the colour is *omitted* from the offered
   * set, never nudged until it passes — and omitting it is an edit to the
   * config, made deliberately, not something this script does behind you.
   */
  const designDir = join(pkgRoot, 'clients', 'design');
  const overrides = [];
  const brandAccents = [];
  for (const file of readdirSync(designDir).filter((f) => f.endsWith('.json'))) {
    const raw = JSON.parse(readFileSync(join(designDir, file), 'utf8'));
    const theme = raw.theme;
    if (!theme) continue;
    if (theme.paletteOverride)
      overrides.push({ file, preset: theme.preset, override: theme.paletteOverride });
    if (theme.brandAccent) brandAccents.push({ file, swatch: theme.brandAccent });
  }

  for (const preset of presets.presets) {
    const swatches = [
      ...preset.accents,
      ...brandAccents.map((b) => ({ ...b.swatch, id: `${b.swatch.id} (${b.file})` })),
    ];
    for (const swatch of swatches) {
      checkPalette(`${preset.id}/${swatch.id}`, {
        ...preset.palette,
        accent: swatch.accent,
        onAccent: swatch.onAccent,
      });
    }
  }

  for (const { file, preset, override } of overrides) {
    const base = presets.presets.find((p) => p.id === preset);
    if (!base) continue;
    const swatch = base.accents[0];
    checkPalette(`${file} · paletteOverride`, {
      ...base.palette,
      accent: swatch.accent,
      onAccent: swatch.onAccent,
      ...override,
    });
  }

  const combos = presets.presets.reduce(
    (sum, p) => sum + p.accents.length * Math.max(1, p.fonts.length),
    0,
  );
  console.log(
    `matrix: ${presets.presets.length} presets, ${combos} preset×accent×font combinations reachable from the customizer.`,
  );
}

/* ------------------------------------------------------------- legacy mode */

/**
 * The two brand colours per client config, and the `color-mix()` shades
 * `BaseLayout` derives from them.
 *
 * These used to be scraped out of `site.config.ts`. That stopped working the
 * day `site.config.ts` became a re-export and the colours moved into
 * `clients/*.config.ts` — the regex matched nothing and the script threw
 * rather than checking anything. It now reads each client config directly, so
 * adding a client adds a check.
 */
function runLegacy() {
  const clientsDir = join(pkgRoot, 'clients');
  const files = readdirSync(clientsDir).filter((f) => f.endsWith('.config.ts'));
  let checked = 0;

  for (const file of files) {
    const src = readFileSync(join(clientsDir, file), 'utf8');
    const grab = (key) => {
      const match = new RegExp(`${key}:\\s*'(#[0-9a-fA-F]{6})'`).exec(src);
      return match ? match[1] : null;
    };
    const primary = grab('primary');
    const accent = grab('accent');
    // A config that spreads another client's theme has no literals of its own;
    // the client it spreads is checked on its own account.
    if (!primary || !accent) continue;
    checked++;

    const label = file.replace(/\.config\.ts$/, '');
    const white = '#ffffff';
    assertPair(`${label} · primary on white`, primary, white, 4.5);
    assertPair(`${label} · accent on white`, accent, white, 4.5);
    assertPair(`${label} · white on primary`, white, primary, 4.5);
    assertPair(`${label} · white on accent`, white, accent, 4.5);
    assertPair(
      `${label} · primary on primary-wash`,
      primary,
      mix(primary, 7, white),
      4.5,
    );
    assertPair(
      `${label} · white on accent-dark`,
      white,
      mix(accent, 82, '#000000'),
      4.5,
    );
  }

  console.log(`legacy: ${checked} client config(s) with literal brand colours.`);
}

/* --------------------------------------------------------------------- run */

const arg = process.argv[2];
if (arg !== '--legacy') runMatrix();
if (arg !== '--matrix') runLegacy();

if (failures > 0) {
  console.error(
    `\n✗ ${failures} of ${checks} contrast checks failed. ` +
      `Fix the palette in src/design/presets.json — do not lower the threshold.\n`,
  );
  process.exit(1);
}

console.log(`✓ ${checks} contrast checks passed (WCAG AA).`);
