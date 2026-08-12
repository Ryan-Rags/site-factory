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
 * - **matrix** — every preset × every scheme × every accent × every font
 *   pairing in `src/design/presets.json`, plus any per-client
 *   `paletteOverride` and any prospect's extracted `brandAccent`.
 *
 * The scheme axis roughly triples the palette count rather than doubling it:
 * both tones of a family carry the same accent *ids* with different values,
 * and each tone's swatch is only ever measured against its own tone.
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

/*
 * The maths and the pair list used to live here and be duplicated into the
 * renderer. They now live in `src/design/contrast.mjs`, which both this script
 * and the Astro build import — because as soon as the renderer started
 * *dropping* cells on contrast grounds, two copies of the rule meant the panel
 * could offer a cell the gate had rejected.
 */
import { clearsGate, mix, pairsFor, paletteFailures, ratio } from '../src/design/contrast.mjs';

/** Mirrors `SCHEMES` in `src/design/presets.ts`, for the same reason. */
const SCHEMES = ['light', 'dark'];

/* ------------------------------------------------------------------ report */

let failures = 0;
let checks = 0;

/**
 * When set, failures are collected instead of counted and printed.
 *
 * Used for the one class of colour whose failure is not a build failure: a
 * prospect's own `brandAccent`, which is dropped from the cells it fails
 * rather than fixed. Everything else — every colour we chose — reports.
 */
let collecting = null;

function assertPair(label, fg, bg, min, failure) {
  const value = failure ? failure.value : ratio(fg, bg);
  const detail = `${fg} on ${bg} = ${value.toFixed(2)}:1, needs ${min.toFixed(1)}:1`;
  if (collecting) {
    if (failure) collecting.push(`${label}: ${detail}`);
    return;
  }
  checks++;
  if (!failure) return;
  failures++;
  console.error(`  ✗ ${label}: ${detail}`);
}

/** Run `checkPalette` without gating, and report what it would have failed. */
function trialPalette(label, palette) {
  collecting = [];
  try {
    checkPalette(label, palette);
    return collecting;
  } finally {
    collecting = null;
  }
}

/* ------------------------------------------------------------- matrix mode */

/**
 * Every pair that carries text, plus the boundaries of real controls.
 *
 * The pair list itself is `pairsFor()` in `src/design/contrast.mjs` — shared
 * with the renderer, which needs the same answer to decide what to offer.
 * What stays here is the *reporting*: which pairs were checked, which failed,
 * and by how much.
 */
function checkPalette(label, palette) {
  const failed = new Map(paletteFailures(palette).map((f) => [f.name, f]));
  for (const [name, fg, bg, min] of pairsFor(palette)) {
    assertPair(`${label} · ${name}`, fg, bg, min, failed.get(name));
  }
}

function runMatrix() {
  const presets = JSON.parse(
    readFileSync(join(pkgRoot, 'src', 'design', 'presets.json'), 'utf8'),
  );

  /*
   * Per-client extras: a `paletteOverride` and a prospect's own extracted
   * `brandAccent` are the two ways a colour can reach a page without being in
   * presets.json, so both are pulled in and checked against every cell they
   * could be shown in.
   *
   * The two are treated differently, deliberately. An override is something we
   * wrote and a failure is ours to fix, so it gates. A brand colour is the
   * prospect's, and the standing rule (plan Q1(a)) is that it is *offered only
   * where it is legal* and never nudged until it passes — so a failure drops
   * that cell and is reported by name below.
   */
  const designDir = join(pkgRoot, 'clients', 'design');
  const overrides = [];
  const brandAccents = [];
  for (const file of readdirSync(designDir).filter((f) => f.endsWith('.json'))) {
    const raw = JSON.parse(readFileSync(join(designDir, file), 'utf8'));
    const theme = raw.theme;
    if (!theme) continue;
    if (theme.paletteOverride)
      overrides.push({
        file,
        preset: theme.preset,
        scheme: theme.scheme,
        override: theme.paletteOverride,
      });
    if (theme.brandAccent) brandAccents.push({ file, swatch: theme.brandAccent });
  }

  /*
   * Every tone of every preset, because every one of them is reachable from
   * the panel. A swatch is checked against the tone it was authored for and
   * never against the other: the same accent id names a different colour in
   * each, which is the whole reason accents live inside the scheme.
   */
  const dropped = [];
  for (const preset of presets.presets) {
    for (const scheme of SCHEMES) {
      const tone = preset.schemes[scheme];
      for (const swatch of tone.accents) {
        checkPalette(`${preset.id}/${scheme}/${swatch.id}`, {
          ...tone.palette,
          accent: swatch.accent,
          onAccent: swatch.onAccent,
        });
      }

      for (const { file, swatch } of brandAccents) {
        const label = `${preset.id}/${scheme}/${swatch.id} (${file})`;
        const fails = trialPalette(label, {
          ...tone.palette,
          accent: swatch.accent,
          onAccent: swatch.onAccent,
        });
        if (fails.length > 0) dropped.push({ label, why: fails[0] });
        else
          checkPalette(label, {
            ...tone.palette,
            accent: swatch.accent,
            onAccent: swatch.onAccent,
          });
      }
    }
  }

  for (const { file, preset, scheme, override } of overrides) {
    const base = presets.presets.find((p) => p.id === preset);
    if (!base) continue;
    const tone = base.schemes[scheme ?? base.defaultScheme];
    if (!tone) continue;
    const swatch = tone.accents[0];
    checkPalette(`${file} · paletteOverride`, {
      ...tone.palette,
      accent: swatch.accent,
      onAccent: swatch.onAccent,
      ...override,
    });
  }

  const palettes = presets.presets.reduce(
    (sum, p) => sum + SCHEMES.reduce((s, k) => s + p.schemes[k].accents.length, 0),
    0,
  );
  const combos = presets.presets.reduce(
    (sum, p) =>
      sum +
      SCHEMES.reduce((s, k) => s + p.schemes[k].accents.length * Math.max(1, p.fonts.length), 0),
    0,
  );
  console.log(
    `matrix: ${presets.presets.length} presets × ${SCHEMES.length} schemes, ${palettes} palettes, ` +
      `${combos} preset×scheme×accent×font combinations reachable from the customizer.`,
  );
  if (dropped.length > 0) {
    console.log(`${dropped.length} brand-accent cell(s) dropped — not offered where they fail:`);
    for (const d of dropped) console.log(`  · ${d.label} — ${d.why}`);
  }
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

/* ---------------------------------------------------------------- selftest */

/**
 * Prove the drop rule can actually say no.
 *
 * No client config carries a `brandAccent` today, so the per-cell drop above
 * runs zero times and reports a serene "0 dropped" whatever it does. That is
 * exactly the state in which a broken predicate goes unnoticed until the first
 * prospect's colour is quietly offered on a background it cannot be read on.
 *
 * So: two controls with known answers, run every time. The failing one is a
 * real pairing — Forge's shipped ember on the light Forge base, which measures
 * 3.49:1 and is the reason each tone carries its own accent values.
 */
function runSelftest() {
  const presets = JSON.parse(
    readFileSync(join(pkgRoot, 'src', 'design', 'presets.json'), 'utf8'),
  );
  const forge = presets.presets.find((p) => p.id === 'forge');
  const controls = [
    {
      what: 'a dark-tone accent offered on the light tone',
      palette: forge.schemes.light.palette,
      swatch: forge.schemes.dark.accents[0],
      expect: false,
    },
    {
      what: 'that tone\'s own first accent',
      palette: forge.schemes.light.palette,
      swatch: forge.schemes.light.accents[0],
      expect: true,
    },
  ];

  for (const { what, palette, swatch, expect } of controls) {
    checks++;
    const got = clearsGate(palette, swatch);
    if (got === expect) continue;
    failures++;
    console.error(
      `  ✗ selftest: ${what} (${swatch.accent} on ${palette.base}) — the drop rule said ` +
        `${got ? 'offer it' : 'drop it'}, expected ${expect ? 'offer it' : 'drop it'}`,
    );
  }
  console.log('selftest: the per-cell drop rule accepts a legible pairing and rejects an illegible one.');
}

/* --------------------------------------------------------------------- run */

const arg = process.argv[2];
if (arg !== '--legacy') runMatrix();
if (arg !== '--legacy') runSelftest();
if (arg !== '--matrix') runLegacy();

if (failures > 0) {
  console.error(
    `\n✗ ${failures} of ${checks} contrast checks failed. ` +
      `Fix the palette in src/design/presets.json — do not lower the threshold.\n`,
  );
  process.exit(1);
}

console.log(`✓ ${checks} contrast checks passed (WCAG AA).`);
