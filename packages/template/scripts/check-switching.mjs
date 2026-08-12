/**
 * Asserts the customizer applies exactly the cell it offers — every cell.
 *
 * The panel's promise is not "the page changes when you click"; it is "the
 * combination you are looking at is the combination named on the controls, and
 * the address bar carries it". A video of a page changing colour cannot support
 * that claim, and neither can a spot check: the bug this gate exists for was
 * invisible on the shipped preset and only appeared one preset-switch away.
 *
 * So it walks **every offered cell** in a real browser and, for each one,
 * checks four things that can disagree:
 *
 * 1. the document's `data-*` attributes,
 * 2. the *computed* custom properties on `<html>` — the values only exist if
 *    the matrix actually emitted a block for that cell,
 * 3. the painted result on real elements (`background` of the accent button,
 *    of the page), because a token can be right while nothing consumes it,
 * 4. the panel's own checked radios, because a control showing one colour
 *    while the page shows another is the failure a prospect actually sees.
 *
 * Then it reloads on the URL the panel wrote, with localStorage cleared so the
 * URL alone is doing the work, and asserts the whole cell comes back identical.
 *
 * The expected values come from `presets.json` — the same file the CSS is
 * emitted from — so this cannot pass by agreeing with a bug in the renderer.
 *
 * Usage:
 *   SITE_CLIENT=ks-welding pnpm exec astro build
 *   SITE_CLIENT=ks-welding pnpm preview --port 4321   # in one terminal
 *   pnpm check:switching                              # in another
 *
 * Set CHROME_PATH if Chrome is not at the Windows/macOS/Linux default.
 * Exits non-zero on any mismatch, so it can gate a build.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, '..');

const BASE = process.env['PREVIEW_URL'] ?? 'http://localhost:4321';
const SLUG = process.env['SITE_CLIENT'] ?? 'ks-welding';

/* ------------------------------------------------------------------- inputs */

const presetFile = JSON.parse(readFileSync(join(pkgRoot, 'src', 'design', 'presets.json'), 'utf8'));

/**
 * The client's own theme block, for its `brandAccent` — the one swatch that is
 * offered without being in presets.json. Full payload or brief; both carry it.
 */
function clientTheme(slug) {
  const dir = join(pkgRoot, 'clients', 'design');
  for (const name of [`${slug}.design.json`, `${slug}.brief.json`]) {
    const path = join(dir, name);
    if (existsSync(path)) return JSON.parse(readFileSync(path, 'utf8')).theme ?? {};
  }
  return {};
}

const theme = clientTheme(SLUG);
const brand = theme.brandAccent ?? null;

/** Mirrors `SCHEMES` in `src/design/presets.ts`. */
const SCHEMES = ['light', 'dark'];

/**
 * Every cell the customizer offers, as data.
 *
 * Deliberately computed here from presets.json rather than read out of the
 * page: if this walked the DOM's own option list it would test the panel
 * against itself and pass on a panel that offers nothing at all.
 */
function cells() {
  const out = [];
  for (const preset of presetFile.presets) {
    for (const scheme of SCHEMES) {
      const tone = preset.schemes[scheme];
      const swatches = brand ? [...tone.accents, brand] : tone.accents;
      for (const swatch of swatches) {
        for (const font of preset.fonts) {
          out.push({ preset, scheme, palette: tone.palette, swatch, font });
        }
      }
    }
  }
  return out;
}

const ALL = cells();

/* -------------------------------------------------------------------- chrome */

/*
 * The same candidate list `check-overflow.mjs` carries. Duplicated rather than
 * shared, for the reason `check-contrast.mjs` duplicates `isDarkPalette`: a
 * gate that can be run on its own, from a bare checkout, is worth six lines.
 */
const CHROME_CANDIDATES = [
  process.env['CHROME_PATH'],
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

const executablePath = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!executablePath) {
  console.error('No Chrome found. Set CHROME_PATH to your Chrome binary.');
  process.exit(1);
}

/* -------------------------------------------------------------------- report */

let failures = 0;
let checks = 0;

function assertEq(label, actual, expected) {
  checks++;
  if (norm(actual) === norm(expected)) return;
  failures++;
  console.error(`  ✗ ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}

/** Hex and `rgb()` say the same thing; compare them as the same thing. */
function norm(value) {
  const text = String(value ?? '').trim().toLowerCase();
  const hex = /^#([0-9a-f]{6})$/.exec(text);
  if (hex) {
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16));
    return `rgb(${r}, ${g}, ${b})`;
  }
  return text.replace(/\s+/g, ' ');
}

/* ---------------------------------------------------------------------- run */

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ['--no-sandbox', '--hide-scrollbars'],
});

/** What the page currently *is*, as opposed to what it was asked to be. */
const readState = (page) =>
  page.evaluate(() => {
    const doc = document.documentElement;
    const styles = getComputedStyle(doc);
    const prop = (name) => styles.getPropertyValue(name).trim();
    const checked = (group) => {
      const input = document.querySelector(`[name="${group}"]:checked`);
      return input ? input.value : null;
    };
    const paint = (selector, property) => {
      const el = document.querySelector(selector);
      return el ? getComputedStyle(el)[property] : null;
    };
    return {
      attrs: {
        theme: doc.getAttribute('data-theme'),
        scheme: doc.getAttribute('data-scheme'),
        accent: doc.getAttribute('data-accent'),
        font: doc.getAttribute('data-font'),
        family: document.body.getAttribute('data-family'),
      },
      colorScheme: styles.colorScheme,
      tokens: {
        accent: prop('--d-accent'),
        onAccent: prop('--d-on-accent'),
        base: prop('--d-base'),
        ink: prop('--d-ink'),
        display: prop('--d-font-display'),
      },
      painted: {
        buttonBg: paint('.d-btn--accent', 'backgroundColor'),
        buttonInk: paint('.d-btn--accent', 'color'),
        pageBg: paint('body', 'backgroundColor'),
      },
      checked: {
        theme: checked('d-theme'),
        scheme: checked('d-scheme'),
        accent: checked('d-accent'),
        font: checked('d-font'),
      },
      href: location.href,
    };
  });

/** Everything a cell must be true of, wherever it was arrived at from. */
function assertCell(where, cell, state) {
  const { preset, scheme, palette, swatch, font } = cell;
  const label = `${where} ${preset.id}/${scheme}/${swatch.id}/${font.id}`;

  assertEq(`${label} · data-theme`, state.attrs.theme, preset.id);
  assertEq(`${label} · data-scheme`, state.attrs.scheme, scheme);
  assertEq(`${label} · data-accent`, state.attrs.accent, swatch.id);
  assertEq(`${label} · data-font`, state.attrs.font, font.id);
  // The decorative rules key off the body attribute; if it lags, a Forge page
  // keeps its carbon texture under a Heritage palette.
  assertEq(`${label} · body data-family`, state.attrs.family, preset.id);
  // What the browser paints outside CSS's reach — scrollbars, form controls.
  // A dark page that forgot to say so gets a white scrollbar down its edge.
  assertEq(`${label} · color-scheme`, state.colorScheme, scheme);

  // The tokens. A missing matrix block shows up here first: the property
  // silently resolves to the shipped `:root` value instead of this cell's.
  assertEq(`${label} · --d-accent`, state.tokens.accent, swatch.accent);
  assertEq(`${label} · --d-on-accent`, state.tokens.onAccent, swatch.onAccent);
  assertEq(`${label} · --d-base`, state.tokens.base, palette.base);
  assertEq(`${label} · --d-ink`, state.tokens.ink, palette.ink);
  assertEq(`${label} · --d-font-display`, state.tokens.display, font.display);

  // What is actually on screen. A token can be correct while nothing paints it.
  assertEq(`${label} · accent button background`, state.painted.buttonBg, swatch.accent);
  assertEq(`${label} · accent button text`, state.painted.buttonInk, swatch.onAccent);
  assertEq(`${label} · page background`, state.painted.pageBg, palette.base);

  // And the panel itself. A control that shows one colour while the page shows
  // another is the failure a prospect sees, whatever the tokens say.
  assertEq(`${label} · panel style checked`, state.checked.theme, preset.id);
  assertEq(`${label} · panel tone checked`, state.checked.scheme, scheme);
  assertEq(`${label} · panel accent checked`, state.checked.accent, swatch.id);
  assertEq(`${label} · panel lettering checked`, state.checked.font, font.id);
}

/**
 * Click a control by the id the panel is contracted to give it.
 *
 * `page.click` refuses an element that is not visible, and that is load-bearing:
 * the accent and lettering options for other presets are hidden as the preset
 * changes, so a click that lands proves the filtering happened too.
 */
async function choose(page, id, what) {
  const selector = `label[for="${id}"]`;
  const handle = await page.$(selector);
  if (!handle) {
    failures++;
    checks++;
    console.error(`  ✗ ${what}: no control \`${selector}\` in the panel`);
    return false;
  }
  try {
    await handle.click();
  } catch (err) {
    failures++;
    checks++;
    console.error(`  ✗ ${what}: \`${selector}\` could not be clicked — ${err.message.split('\n')[0]}`);
    return false;
  }
  return true;
}

const openPanel = (page) =>
  page.evaluate(() => {
    const panel = document.getElementById('d-cust-panel');
    if (panel && panel.hidden) document.getElementById('d-cust-toggle')?.click();
  });

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 412, height: 860, deviceScaleFactor: 1 });

  const response = await page.goto(BASE, { waitUntil: 'networkidle0' });
  if (!response || response.status() >= 400) {
    console.error(`Cannot reach ${BASE} — HTTP ${response?.status() ?? 'no response'}.`);
    process.exit(1);
  }
  /*
   * Prove the server is serving the client we are about to make claims about.
   *
   * `astro preview` silently walks up to the next free port when 4321 is taken,
   * and this repo is worked on in several worktrees at once — so the default
   * URL can land on a *different stream's* build of a *different client*. That
   * happened while this gate was being written: every assertion below was
   * measured against another client's site for one run. A gate that can report
   * a green on the wrong build is worse than no gate.
   */
  const servedSlug = await page.evaluate(() => {
    const manifest = document.querySelector('link[rel="manifest"]')?.getAttribute('href') ?? '';
    return /\/icons\/([^/]+)\//.exec(manifest)?.[1] ?? null;
  });
  if (servedSlug !== SLUG) {
    console.error(
      `${BASE} is serving "${servedSlug ?? 'an unrecognised build'}", not "${SLUG}".\n` +
        `Another preview server is probably on that port — astro preview moves to the\n` +
        `next free one silently. Start yours on a known port and set PREVIEW_URL.`,
    );
    process.exit(1);
  }

  if ((await page.$('#d-cust-toggle')) === null) {
    console.error(
      `No customizer on this build. This gate drives the pitch build — check\n` +
        `\`features.customizer\` in the ${SLUG} config, and that SITE_DELIVERED is not set.`,
    );
    process.exit(1);
  }

  console.log(`switching: ${ALL.length} cells on ${SLUG} at ${BASE}\n`);

  for (const cell of ALL) {
    const { preset, scheme, swatch, font } = cell;
    const name = `${preset.id}/${scheme}/${swatch.id}/${font.id}`;

    await openPanel(page);
    // Preset first, then tone, deliberately: those are the two switches that
    // re-resolve the others, and the order a prospect uses the panel in.
    if (!(await choose(page, `d-theme-${preset.id}`, `${name} · style`))) continue;
    if (!(await choose(page, `d-scheme-${scheme}`, `${name} · tone`))) continue;
    if (!(await choose(page, `d-accent-${preset.id}-${scheme}-${swatch.id}`, `${name} · accent`)))
      continue;
    if (!(await choose(page, `d-font-${preset.id}-${font.id}`, `${name} · lettering`))) continue;

    const applied = await readState(page);
    assertCell('switch', cell, applied);

    /*
     * The restore half. localStorage is cleared first, so a pass here is the
     * URL doing the work and not the panel remembering — those are different
     * claims and only one of them is what a shared link carries.
     */
    await page.evaluate(() => {
      try {
        localStorage.clear();
      } catch (e) {
        /* private browsing: nothing to clear */
      }
    });
    await page.goto(applied.href, { waitUntil: 'networkidle0' });
    const restored = await readState(page);
    assertCell('restore', cell, restored);
    assertEq(`restore ${name} · url is stable`, restored.href, applied.href);
  }

  /*
   * An illegal combination must land somewhere legal.
   *
   * A shared link can outlive the swatch it names, and a hand-edited one can
   * name a swatch that never existed in that family. Either way the page must
   * resolve to a cell that has styles — stamping the attribute anyway is what
   * produced the stale-colour bug in the first place.
   */
  const heritage = presetFile.presets.find((p) => p.id === 'heritage');
  const foreign = presetFile.presets.find((p) => p.id !== 'heritage');
  const foreignScheme = foreign.defaultScheme;

  for (const [what, query] of [
    // An accent from another family, which shares no ids with this one.
    ['a foreign accent', `theme=heritage&scheme=light&accent=${foreign.schemes[foreignScheme].accents[0].id}`],
    // A tone that does not exist. Every family has both today, so this is the
    // shape a renamed or removed tone would arrive in.
    ['an unknown tone', 'theme=heritage&scheme=sepia&accent=brick'],
    // A swatch that never existed anywhere.
    ['an invented accent', 'theme=heritage&scheme=dark&accent=chartreuse'],
    // The whole family gone.
    ['an unknown preset', 'theme=brutalist&accent=brick'],
  ]) {
    await page.evaluate(() => {
      try {
        localStorage.clear();
      } catch (e) {
        /* nothing to clear */
      }
    });
    await page.goto(`${BASE}/?${query}`, { waitUntil: 'networkidle0' });
    const clamped = await readState(page);

    const preset = presetFile.presets.find((p) => p.id === clamped.attrs.theme);
    checks++;
    if (!preset) {
      failures++;
      console.error(`  ✗ illegal url (${what}): data-theme="${clamped.attrs.theme}" is not a preset`);
      continue;
    }
    const tone = preset.schemes[clamped.attrs.scheme];
    checks++;
    if (!tone) {
      failures++;
      console.error(`  ✗ illegal url (${what}): data-scheme="${clamped.attrs.scheme}" is not a scheme`);
      continue;
    }
    const landed = (brand ? [...tone.accents, brand] : tone.accents).find(
      (a) => a.id === clamped.attrs.accent,
    );
    checks++;
    if (!landed) {
      failures++;
      console.error(
        `  ✗ illegal url (${what}): ?${query} left data-accent="${clamped.attrs.accent}", ` +
          `which ${preset.id}/${clamped.attrs.scheme} does not offer`,
      );
      continue;
    }
    // Landing legally is not enough — it has to be *painted*, which is what
    // the original bug got wrong: a legal-looking attribute over a cell with
    // no CSS block, falling back to the shipped accent.
    assertEq(`illegal url (${what}) · --d-accent`, clamped.tokens.accent, landed.accent);
    assertEq(`illegal url (${what}) · painted accent`, clamped.painted.buttonBg, landed.accent);
    assertEq(`illegal url (${what}) · page background`, clamped.painted.pageBg, tone.palette.base);
    assertEq(`illegal url (${what}) · panel agrees`, clamped.checked.accent, landed.id);
  }
} finally {
  await browser.close();
}

console.log();
if (failures > 0) {
  console.error(
    `✗ ${failures} of ${checks} switching checks failed across ${ALL.length} cells.\n` +
      `A missing matrix block, a control the panel never re-rendered, or a URL\n` +
      `param stamped without being resolved — see the failures above.\n`,
  );
  process.exit(1);
}
console.log(`✓ ${checks} switching checks passed across ${ALL.length} cells (apply + url restore).`);
