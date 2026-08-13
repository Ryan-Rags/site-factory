/**
 * Asserts that no text a prospect is shown is ever clipped, truncated, or
 * wrapped somewhere it should not wrap.
 *
 * `check-overflow.mjs` already proves the *page* cannot be scrolled sideways.
 * That is a different question, and passing it is compatible with the header
 * ellipsising a business name into "K-H Machine Wo…" — which is what the
 * template did before this gate existed. Hiding the overflow is how the page
 * stayed 320px wide; this gate is what stops hiding it from being the answer.
 *
 * Seven assertions, in a real browser, on the built artifact:
 *
 *   1. the header business name is not truncated — neither by an ellipsis
 *      (`scrollWidth`) nor by a line clamp (`scrollHeight`);
 *   2. it renders on at most two lines, and its box stays inside the bar;
 *   3. every desktop nav item is a single line — no label wraps mid-word;
 *   4. the nav does not collide with the lockup, and does not leave the
 *      viewport;
 *   5. the hero H1 is unclipped in both axes and inside the viewport;
 *   6. every button's label is unclipped by its own padding box;
 *   7. `color-scheme` is declared on every route, not just the home page.
 *
 * COVERAGE. Viewports 320 / 390 / 768 / 1024 / 1440.
 *
 *   - Every offered cell × every viewport, on `/`. The header is one component
 *     shared by every route, so the cell sweep belongs on the one route that
 *     also carries the hero. A pitch build offers 112 cells; a delivered build
 *     offers exactly one, its own, and the sweep collapses to it.
 *   - Every route × every viewport, on two cells: the client's shipped cell and
 *     the widest display type in the matrix (uppercase Georgia at +0.05em).
 *     That is what proves each page's own headings and buttons.
 *
 * Those two bounds are the only bounds, they are printed in the run header,
 * and neither is a silent sample.
 *
 * A cell is selected by URL parameter and then VERIFIED: the gate asserts the
 * computed `--d-font-display` is the one that cell names in presets.json before
 * it measures anything. Otherwise a parameter that failed to resolve would
 * quietly measure the shipped cell 112 times and report a pass.
 *
 * Usage:
 *   SITE_CLIENT=kh-machine-works pnpm exec astro build
 *   SITE_CLIENT=kh-machine-works pnpm preview --port 4321   # in one terminal
 *   SITE_CLIENT=kh-machine-works pnpm check:textfit         # in another
 *
 * Set CHROME_PATH if Chrome is not at the Windows/macOS/Linux default.
 * Exits non-zero on any clipped, truncated or badly-wrapped text.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { clearsGate } from '../src/design/contrast.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, '..');

const BASE = process.env['PREVIEW_URL'] ?? 'http://localhost:4321';
const SLUG = process.env['SITE_CLIENT'] ?? 'ks-welding';

const VIEWPORTS = [320, 390, 768, 1024, 1440];
const ROUTES = ['/', '/services', '/about', '/contact', '/gallery', '/404'];

/** Below this the nav is a `<details>` menu — see `design.css`'s 900px query. */
const NAV_BREAKPOINT = 900;

/* ------------------------------------------------------------------- inputs */

const presetFile = JSON.parse(readFileSync(join(pkgRoot, 'src', 'design', 'presets.json'), 'utf8'));

/** Mirrors `SCHEMES` in `src/design/presets.ts`. */
const SCHEMES = ['light', 'dark'];

/**
 * The client's own theme block. Two things come out of it: the `brandAccent`,
 * which is offered without being in presets.json, and the shipped selection,
 * which is the cell a delivered build has and the only cell it has.
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

/**
 * Every cell the customizer offers, as data.
 *
 * Computed from presets.json rather than read out of the panel, for the reason
 * `check-switching.mjs` gives: a sweep that asks the page which cells exist
 * passes trivially on a page that offers none.
 */
function cells() {
  const out = [];
  for (const preset of presetFile.presets) {
    for (const scheme of SCHEMES) {
      const tone = preset.schemes[scheme];
      const swatches =
        brand && clearsGate(tone.palette, brand) ? [...tone.accents, brand] : tone.accents;
      for (const swatch of swatches) {
        for (const font of preset.fonts) {
          out.push({ preset: preset.id, scheme, accent: swatch.id, font: font.id, display: font.display });
        }
      }
    }
  }
  return out;
}

const query = (cell) =>
  `theme=${cell.preset}&scheme=${cell.scheme}&accent=${cell.accent}&font=${cell.font}`;

/* -------------------------------------------------------------------- chrome */

/*
 * The same candidate list the other browser gates carry, duplicated for the
 * same reason: a gate that runs from a bare checkout is worth six lines.
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
/** One line per distinct failure kind, so 560 identical failures print once. */
const seen = new Map();

function fail(where, message) {
  failures++;
  const key = message.replace(/\d+(\.\d+)?px/g, 'Npx');
  const first = !seen.has(key);
  seen.set(key, (seen.get(key) ?? 0) + 1);
  if (first) console.error(`  ✗ ${where}: ${message}`);
}

function assert(where, ok, message) {
  checks++;
  if (!ok) fail(where, message);
}

/* --------------------------------------------------------------- measurement */

/**
 * Everything measured in one pass in the page, so a single evaluate answers
 * every assertion for a (route, cell, viewport).
 *
 * Truncation is two questions, not one. `scrollWidth > clientWidth` catches an
 * ellipsis on a `nowrap` line; `scrollHeight > clientHeight` catches a
 * `-webkit-line-clamp` or a fixed height eating a wrapped line. An element can
 * pass either one alone while losing characters, so both are asked.
 */
const measure = (page) =>
  page.evaluate((navBreakpoint) => {
    const round = (n) => Math.round(n * 100) / 100;
    const box = (el) => {
      const r = el.getBoundingClientRect();
      return { top: round(r.top), right: round(r.right), bottom: round(r.bottom), left: round(r.left) };
    };
    /*
     * `clipsY` is load-bearing, and it was learned the hard way.
     *
     * A display face's glyph box is routinely taller than its line box — Forge's
     * hero H1 lays out five 38.88px lines and reports 48px of ink per line, so
     * `scrollHeight` (199) exceeds `clientHeight` (194) on an element with
     * `overflow: visible` that is losing nothing at all. Asserting on that pair
     * unconditionally reported 294 vertical "clips" in this gate's first run,
     * none of them real. A gate that cries wolf gets ignored, and then it is
     * worth less than no gate.
     *
     * So the vertical assertion is asked only where the box actually clips.
     * Horizontal stays unconditional: text wider than its own content box
     * collides with whatever is beside it whether or not it is also cut off.
     */
    const fit = (el) => {
      const s = getComputedStyle(el);
      return {
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        clipsY: s.overflowY !== 'visible',
        clipsX: s.overflowX !== 'visible',
        text: (el.textContent ?? '').trim().slice(0, 60),
        rect: box(el),
      };
    };

    const styles = getComputedStyle(document.documentElement);
    const name = document.querySelector('.d-header__name');
    const bar = document.querySelector('.d-header__bar');
    const brandLink = document.querySelector('.d-header__brand');
    const nav = document.querySelector('.d-header__nav');
    const h1 = document.querySelector('h1');

    /*
     * Line count for a wrapped inline-level box. `getClientRects()` on a block
     * returns one rect whatever it holds, so the lines are counted from the
     * text itself with a Range — which is what the browser actually laid out,
     * not what the line-height arithmetic predicts.
     */
    const lineCount = (el) => {
      if (!el) return 0;
      const range = document.createRange();
      range.selectNodeContents(el);
      const rects = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
      if (rects.length === 0) return 0;
      const tops = new Set(rects.map((r) => Math.round(r.top)));
      return tops.size;
    };

    return {
      colorScheme: styles.colorScheme,
      fontDisplay: styles.getPropertyValue('--d-font-display').trim(),
      name: name ? { ...fit(name), lines: lineCount(name) } : null,
      bar: bar ? box(bar) : null,
      brand: brandLink ? box(brandLink) : null,
      nav:
        nav && innerWidth >= navBreakpoint && getComputedStyle(nav).display !== 'none'
          ? {
              rect: box(nav),
              items: [...nav.querySelectorAll('a')].map((a) => ({
                ...fit(a),
                lines: lineCount(a),
              })),
            }
          : null,
      h1: h1 ? { ...fit(h1), lines: lineCount(h1) } : null,
      /*
       * Buttons, with the sticky call bar included: it is fixed to the bottom
       * of a phone viewport and carries the single most important label on the
       * page, so a clipped one there is the worst version of this bug.
       */
      buttons: [...document.querySelectorAll('.d-btn, .d-callbar__call, .d-callbar__secondary')]
        .filter((el) => {
          const s = getComputedStyle(el);
          return s.display !== 'none' && s.visibility !== 'hidden';
        })
        .map((el) => ({ ...fit(el), cls: el.getAttribute('class') ?? '' })),
      viewportWidth: innerWidth,
    };
  }, NAV_BREAKPOINT);

/**
 * The assertions themselves, against one measurement.
 *
 * `scheme` is the tone the cell asked for; `display` is the font stack it
 * names in presets.json. Both are asserted before anything is measured for
 * fit, because a page that did not resolve the cell is not evidence about
 * that cell.
 */
function assertFit(where, m, cell) {
  // 7 — the seam item 1 closes. Every route declares its tone.
  assert(where, m.colorScheme === cell.scheme, `color-scheme is "${m.colorScheme}", expected "${cell.scheme}"`);

  // 1 & 2 — the header lockup.
  if (m.name === null) {
    fail(where, 'no .d-header__name on the page — the design header did not render');
    return;
  }
  assert(
    where,
    m.name.scrollWidth <= m.name.clientWidth + 1,
    `header name "${m.name.text}" is truncated horizontally: ` +
      `scrollWidth ${m.name.scrollWidth}px > clientWidth ${m.name.clientWidth}px`,
  );
  assert(
    where,
    !m.name.clipsY || m.name.scrollHeight <= m.name.clientHeight + 1,
    `header name "${m.name.text}" is clipped vertically: ` +
      `scrollHeight ${m.name.scrollHeight}px > clientHeight ${m.name.clientHeight}px ` +
      `on a box that clips — a line of the name is being eaten`,
  );
  assert(
    where,
    m.name.lines <= 2,
    `header name "${m.name.text}" wrapped onto ${m.name.lines} lines — the lockup is a ` +
      `one- or two-line block, and a third line means the name needs a smaller step, not a taller bar`,
  );
  if (m.bar) {
    assert(
      where,
      m.name.rect.right <= m.bar.right + 1 && m.name.rect.left >= m.bar.left - 1,
      `header name "${m.name.text}" (${m.name.rect.left}–${m.name.rect.right}px) escapes the ` +
        `header bar (${m.bar.left}–${m.bar.right}px)`,
    );
  }

  // 3 & 4 — the desktop nav.
  if (m.nav) {
    for (const item of m.nav.items) {
      assert(
        where,
        item.lines <= 1,
        `nav item "${item.text}" wrapped onto ${item.lines} lines`,
      );
      assert(
        where,
        item.scrollWidth <= item.clientWidth + 1,
        `nav item "${item.text}" is clipped: scrollWidth ${item.scrollWidth}px > ` +
          `clientWidth ${item.clientWidth}px`,
      );
      assert(
        where,
        item.rect.right <= m.viewportWidth + 1,
        `nav item "${item.text}" extends to ${item.rect.right}px, past the ${m.viewportWidth}px viewport`,
      );
    }
    if (m.brand) {
      assert(
        where,
        m.nav.rect.left >= m.brand.right - 1,
        `nav starts at ${m.nav.rect.left}px but the lockup runs to ${m.brand.right}px — they collide`,
      );
    }
  }

  // 5 — the hero H1 (and, on the other routes, the page heading).
  if (m.h1) {
    assert(
      where,
      m.h1.scrollWidth <= m.h1.clientWidth + 1,
      `h1 "${m.h1.text}" is clipped horizontally: ${m.h1.scrollWidth}px > ${m.h1.clientWidth}px`,
    );
    assert(
      where,
      !m.h1.clipsY || m.h1.scrollHeight <= m.h1.clientHeight + 1,
      `h1 "${m.h1.text}" is clipped vertically: ${m.h1.scrollHeight}px > ${m.h1.clientHeight}px on a box that clips`,
    );
    assert(
      where,
      m.h1.rect.right <= m.viewportWidth + 1,
      `h1 "${m.h1.text}" extends to ${m.h1.rect.right}px, past the ${m.viewportWidth}px viewport`,
    );
  }

  // 6 — every visible button label.
  for (const button of m.buttons) {
    assert(
      where,
      button.scrollWidth <= button.clientWidth + 1,
      `button "${button.text}" is clipped: scrollWidth ${button.scrollWidth}px > ` +
        `clientWidth ${button.clientWidth}px`,
    );
    assert(
      where,
      !button.clipsY || button.scrollHeight <= button.clientHeight + 1,
      `button "${button.text}" is clipped vertically: ${button.scrollHeight}px > ${button.clientHeight}px on a box that clips`,
    );
  }
}

/* ---------------------------------------------------------------------- run */

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ['--no-sandbox', '--hide-scrollbars'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

  const response = await page.goto(BASE, { waitUntil: 'networkidle0' });
  if (!response || response.status() >= 400) {
    console.error(`Cannot reach ${BASE} — HTTP ${response?.status() ?? 'no response'}.`);
    process.exit(1);
  }

  /*
   * Prove the server is serving the client this run is about to make claims
   * about. `astro preview` walks to the next free port silently, this repo is
   * worked on in a dozen worktrees at once, and a gate that can report green on
   * another stream's build is worse than no gate. `check-switching.mjs` learned
   * this the expensive way; the check is copied deliberately.
   */
  const servedSlug = await page.evaluate(() => {
    const manifest = document.querySelector('link[rel="manifest"]')?.getAttribute('href') ?? '';
    return /\/icons\/([^/]+)\//.exec(manifest)?.[1] ?? null;
  });
  if (servedSlug !== SLUG) {
    console.error(
      `${BASE} is serving "${servedSlug ?? 'an unrecognised build'}", not "${SLUG}".\n` +
        `Start your preview on a known port and set PREVIEW_URL.`,
    );
    process.exit(1);
  }

  const isPitch = (await page.$('#d-cust-toggle')) !== null;

  /**
   * What to sweep.
   *
   * A pitch build can be switched into every cell, so every cell is checked. A
   * delivered build has exactly one and cannot be switched at all, so the sweep
   * is that one cell — which is not a reduced check, it is the whole population.
   */
  /*
   * Not every client's theme is readable from `clients/design/`.
   *
   * `ks-welding-forge`, `-precision` and `-heritage` are one client's payload
   * spread three ways by `inFamily()` in their `.config.ts`, so they have no
   * `.design.json` and no `.brief.json` of their own. `clientTheme()` returns
   * `{}` for them, and the shipped cell then resolved to `undefined` on every
   * field — so this gate asserted `color-scheme` should be `"undefined"` and
   * reported 25 failures against three builds that were perfectly correct.
   *
   * A gate that invents an expectation it cannot derive is the reveal gate's
   * mistake again, so it does not invent one. Where the config is silent, the
   * tone is read from the HOME PAGE of the build under test and every other
   * route is then required to agree with it. That is not circular and it is not
   * weaker: "every route declares the same tone as `/`" is precisely the seam
   * this stream closes — before it, `/` was the only route that declared one at
   * all. What is lost is only the ability to catch `/` itself shipping the
   * wrong tone, which is `check:parity`'s job and is covered there.
   */
  const fromPage = await page.evaluate(() => ({
    scheme: getComputedStyle(document.documentElement).colorScheme,
    preset: document.documentElement.getAttribute('data-theme'),
    accent: document.documentElement.getAttribute('data-accent'),
    font: document.documentElement.getAttribute('data-font'),
  }));

  const shipped = {
    preset: theme.preset ?? fromPage.preset,
    scheme:
      theme.scheme ??
      presetFile.presets.find((p) => p.id === theme.preset)?.defaultScheme ??
      fromPage.scheme,
    accent: theme.accent ?? fromPage.accent,
    font: theme.fontPairing ?? fromPage.font,
  };
  if (theme.preset === undefined) {
    console.log(
      `  no design payload for "${SLUG}" — it is a spread of another client's, so the ` +
        `shipped cell is read from its own home page: ` +
        `${shipped.preset}/${shipped.scheme}/${shipped.accent}/${shipped.font}\n`,
    );
  }
  const ALL = isPitch ? cells() : [shipped];

  /**
   * The two cells the route sweep runs in: what the client ships, and the
   * widest display type the matrix can be switched into. Anything wider than
   * the second one does not exist, so a route that fits both fits all of them.
   */
  const widest = isPitch
    ? cells().find((c) => c.preset === 'heritage' && c.scheme === 'light' && c.font === 'signwriter') ??
      cells()[0]
    : shipped;
  const ROUTE_CELLS = isPitch ? [shipped, widest] : [shipped];

  console.log(
    `textfit: ${SLUG} at ${BASE} — ${isPitch ? 'pitch' : 'delivered'} build\n` +
      `  home sweep:  ${ALL.length} cell(s) × ${VIEWPORTS.length} viewports\n` +
      `  route sweep: ${ROUTES.length} routes × ${VIEWPORTS.length} viewports × ` +
      `${ROUTE_CELLS.length} cell(s) (shipped${isPitch ? ' + widest type in the matrix' : ''})\n` +
      `  viewports:   ${VIEWPORTS.join(', ')}\n`,
  );

  /** Routes that exist in this build. A route that 404s is check:links' problem. */
  const available = new Set(['/404']);
  for (const route of ROUTES) {
    if (route === '/404') continue;
    const probe = await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
    if ((probe?.status() ?? 404) < 400) available.add(route);
  }
  const missing = ROUTES.filter((r) => !available.has(r));
  if (missing.length > 0) {
    console.log(`  not emitted by this client, so not checked: ${missing.join(', ')}\n`);
  }

  const visit = async (route, cell) => {
    const url = `${BASE}${route}${route.includes('?') ? '&' : '?'}${query(cell)}`;
    await page.goto(url, { waitUntil: 'networkidle0' });
  };

  /* --- the cell sweep, on the home page ---------------------------------- */

  for (const width of VIEWPORTS) {
    await page.setViewport({ width, height: 900, deviceScaleFactor: 1, isMobile: width < 768 });
    for (const cell of ALL) {
      await visit('/', cell);
      const m = await measure(page);
      const where = `${width}px / ${cell.preset}/${cell.scheme}/${cell.accent}/${cell.font}`;

      /*
       * The cell has to have actually been applied before its measurements mean
       * anything. Without this, a parameter that silently fell back would have
       * this gate measure the shipped cell 112 times and call it a sweep.
       */
      if (cell.display !== undefined) {
        checks++;
        if (m.fontDisplay.replace(/\s+/g, ' ') !== cell.display.replace(/\s+/g, ' ')) {
          fail(
            where,
            `the cell did not apply: --d-font-display is ${JSON.stringify(m.fontDisplay)}, ` +
              `expected ${JSON.stringify(cell.display)}`,
          );
          continue;
        }
      }
      assertFit(where, m, cell);
    }
    process.stdout.write(`  swept ${ALL.length} cell(s) at ${width}px\n`);
  }

  /* --- the route sweep ---------------------------------------------------- */

  for (const width of VIEWPORTS) {
    await page.setViewport({ width, height: 900, deviceScaleFactor: 1, isMobile: width < 768 });
    for (const cell of ROUTE_CELLS) {
      for (const route of ROUTES) {
        if (!available.has(route)) continue;
        if (route === '/') continue; // covered by the cell sweep above
        await visit(route, cell);
        assertFit(
          `${width}px ${route} / ${cell.preset}/${cell.scheme}/${cell.accent}/${cell.font}`,
          await measure(page),
          cell,
        );
      }
    }
    process.stdout.write(`  swept ${available.size - 1} route(s) at ${width}px\n`);
  }

  /* --- the cell survives a page-to-page click ---------------------------- */

  /*
   * The prospect's actual journey: pick a look on the home page, then click the
   * header CTA. The query string does not survive a plain `<a>`, so what
   * carries the cell across the navigation is the panel's own localStorage
   * entry — and a contact page that arrives in a different family is exactly
   * the seam this stream exists to close.
   */
  if (isPitch && available.has('/contact')) {
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    const cell = widest;
    await visit('/', cell);
    const link = await page.$('.d-header__cta');
    if (!link) {
      fail('cross-page', 'no .d-header__cta in the header to follow');
    } else {
      await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), link.click()]);
      const m = await measure(page);
      checks++;
      const landed = await page.evaluate(() => ({
        theme: document.documentElement.getAttribute('data-theme'),
        scheme: document.documentElement.getAttribute('data-scheme'),
        path: location.pathname,
      }));
      if (landed.theme !== cell.preset || landed.scheme !== cell.scheme) {
        fail(
          'cross-page',
          `following the header CTA from a ${cell.preset}/${cell.scheme} home landed on ` +
            `${landed.path} in ${landed.theme}/${landed.scheme} — the chosen look did not survive the click`,
        );
      }
      assertFit(`cross-page ${landed.path}`, m, cell);
    }
  }
} finally {
  await browser.close();
}

console.log();
if (failures > 0) {
  const kinds = [...seen.entries()].sort((a, b) => b[1] - a[1]);
  console.error(`${kinds.length} distinct failure(s), ${failures} occurrence(s) of ${checks} checks:`);
  for (const [kind, count] of kinds) console.error(`  ${String(count).padStart(5)} ×  ${kind}`);
  console.error(
    `\n✗ Text is being clipped, truncated or wrapped where it must not be. A business\n` +
      `  name is not a string to be shortened to fit the furniture — the furniture\n` +
      `  gives way first. See the lockup rule in design.css.\n`,
  );
  process.exit(1);
}
console.log(`✓ ${checks} textfit checks passed — nothing clipped, truncated or mis-wrapped.`);
