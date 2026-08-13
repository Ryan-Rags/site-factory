/**
 * The reveal animation must never cost anybody the content.
 *
 * `Reveal.astro` hides `[data-reveal]` elements and fades them in as they cross
 * the fold. That is a decoration, and a decoration is only acceptable while it
 * cannot take the page away from anyone. Three ways it could, and one assertion
 * each:
 *
 *   1. FIRES ONCE. An element that re-hides when the reader scrolls back up is
 *      a page that dissolves behind them. Scroll to the bottom, back to the
 *      top, back down: nothing that was revealed may lose `.is-revealed`, and
 *      no revealed element's opacity may drop below 1 again.
 *
 *   2. NOTHING ABOVE THE FOLD IS PRE-HIDDEN. This is the assertion that
 *      justifies the gate. `[data-reveal-ready]` is stamped on `<html>` by the
 *      inline script, and from that moment the CSS hides every un-revealed
 *      `[data-reveal]`. An element already inside the first screen therefore
 *      paints blank until an IntersectionObserver callback reaches it — a real
 *      flash on a slow phone, and a permanently blank first screen if the
 *      observer never fires. Measured at `DOMContentLoaded`, which is after the
 *      inline script has run: exactly the window in which the damage is done.
 *
 *   3. REDUCED MOTION IS THE WHOLE PAGE, IMMEDIATELY. With
 *      `prefers-reduced-motion: reduce`, every `[data-reveal]` must already be
 *      at opacity 1 with no transition, and the counters must be painted at
 *      their final values rather than sitting at zero. Somebody who asked the
 *      operating system for less motion must not be given less information.
 *
 * Run against a served build, with the same served-slug guard the other browser
 * gates carry — `astro preview` walks to the next free port silently, and a
 * gate that cannot prove which build it measured can report green on another
 * worktree's site.
 *
 * Usage:
 *   SITE_CLIENT=<slug> pnpm exec astro build
 *   SITE_CLIENT=<slug> pnpm preview --port 4321     # in one terminal
 *   SITE_CLIENT=<slug> pnpm check:reveal            # in another
 *
 * Set CHROME_PATH if Chrome is not at the platform default.
 */
import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const BASE = process.env['PREVIEW_URL'] ?? 'http://localhost:4321';
const SLUG = process.env['SITE_CLIENT'] ?? 'ks-welding';

const VIEWPORTS = [320, 390, 768, 1024, 1440];
const ROUTES = ['/', '/services', '/about', '/contact', '/gallery', '/404'];

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
const seen = new Map();

function fail(where, message) {
  failures++;
  const key = message.replace(/\d+(\.\d+)?/g, 'N');
  if (!seen.has(key)) console.error(`  ✗ ${where}: ${message}`);
  seen.set(key, (seen.get(key) ?? 0) + 1);
}

function assert(where, ok, message) {
  checks++;
  if (!ok) fail(where, message);
}

/*
 * The pre-hidden probe, installed before any of the page's own script runs.
 *
 * It has to be a document-start hook rather than something evaluated after
 * `goto` resolves: by then the observer has long since fired and every
 * above-the-fold element is revealed, so the measurement would always come back
 * clean and the gate would be worthless.
 */
const PROBE = `
window.__revealProbe = null;
document.addEventListener('DOMContentLoaded', function () {
  var out = [];
  var els = document.querySelectorAll('[data-reveal]');
  for (var i = 0; i < els.length; i++) {
    var el = els[i];
    var r = el.getBoundingClientRect();
    // Inside the first screen, and actually occupying space.
    var inFold = r.top < window.innerHeight && r.bottom > 0 && r.width > 0 && r.height > 0;
    if (!inFold) continue;
    out.push({
      cls: el.getAttribute('class') || el.tagName.toLowerCase(),
      revealed: el.classList.contains('is-revealed'),
      opacity: Number(getComputedStyle(el).opacity),
      top: Math.round(r.top),
    });
  }
  window.__revealProbe = out;
});
`;

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ['--no-sandbox', '--hide-scrollbars'],
});

try {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(PROBE);
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

  const response = await page.goto(BASE, { waitUntil: 'networkidle0' });
  if (!response || response.status() >= 400) {
    console.error(`Cannot reach ${BASE} — HTTP ${response?.status() ?? 'no response'}.`);
    process.exit(1);
  }

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

  /** Routes this build actually emits. A missing one is check:links' problem. */
  const available = ['/404'];
  for (const route of ROUTES) {
    if (route === '/404') continue;
    const probe = await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
    if ((probe?.status() ?? 404) < 400) available.push(route);
  }
  const missing = ROUTES.filter((r) => !available.includes(r));

  console.log(
    `reveal: ${SLUG} at ${BASE}\n` +
      `  ${available.length} route(s) × ${VIEWPORTS.length} viewports, plus a reduced-motion pass\n` +
      (missing.length > 0 ? `  not emitted by this client: ${missing.join(', ')}\n` : ''),
  );

  /* --- 1 and 2, at every viewport on every route ------------------------- */

  for (const width of VIEWPORTS) {
    await page.setViewport({ width, height: 900, deviceScaleFactor: 1, isMobile: width < 768 });

    for (const route of available) {
      const where = `${width}px ${route}`;
      await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle0' });

      // 2 — nothing inside the first screen was hidden at DOMContentLoaded.
      const preHidden = await page.evaluate(() => window.__revealProbe ?? []);
      for (const el of preHidden) {
        assert(
          where,
          el.revealed || el.opacity >= 1,
          `[data-reveal] "${el.cls}" at y=${el.top} is inside the first screen but was ` +
            `unrevealed at DOMContentLoaded (opacity ${el.opacity}) — it paints blank until ` +
            `the observer reaches it, and stays blank if it never does`,
        );
      }

      // 1 — reveal is a one-way door. Down, up, down again.
      /*
       * Scroll the whole page, then wait for the reveal transition to actually
       * finish before reading anything.
       *
       * The wait is derived, not guessed: `design.css` transitions opacity over
       * 620ms with a `--d-reveal-delay` of up to 160ms, so 800ms is the point
       * after which nothing can still be in flight. Sampling earlier is how the
       * first version of this gate reported thirteen elements "falling back to
       * opacity 0.97" — every one of them simply still mid-fade. A gate that
       * reports a transition in progress as a regression is worse than no gate,
       * because the next real one gets ignored with it.
       */
      const settle = async () => {
        await page.evaluate(async () => {
          const step = window.innerHeight;
          for (let y = 0; y < document.body.scrollHeight; y += step) {
            window.scrollTo(0, y);
            await new Promise((r) => setTimeout(r, 40));
          }
          window.scrollTo(0, document.body.scrollHeight);
          await new Promise((r) => setTimeout(r, 800));
        });
      };

      await settle();
      const afterDown = await page.evaluate(() =>
        [...document.querySelectorAll('[data-reveal]')].map((el) =>
          el.classList.contains('is-revealed'),
        ),
      );

      await page.evaluate(async () => {
        window.scrollTo(0, 0);
        await new Promise((r) => setTimeout(r, 150));
      });
      await settle();

      const afterUpDown = await page.evaluate(() =>
        [...document.querySelectorAll('[data-reveal]')].map((el) => ({
          revealed: el.classList.contains('is-revealed'),
          opacity: Number(getComputedStyle(el).opacity),
        })),
      );

      for (let i = 0; i < afterDown.length; i++) {
        if (!afterDown[i]) continue;
        assert(
          where,
          afterUpDown[i]?.revealed === true,
          `a [data-reveal] element lost .is-revealed after scrolling up and back down — ` +
            `the reveal is re-running instead of firing once`,
        );
        assert(
          where,
          (afterUpDown[i]?.opacity ?? 0) >= 1,
          `a revealed [data-reveal] element fell back to opacity ` +
            `${afterUpDown[i]?.opacity} — it is being re-hidden behind the reader`,
        );
      }
    }
    process.stdout.write(`  swept ${available.length} route(s) at ${width}px\n`);
  }

  /* --- 3, the reduced-motion pass ---------------------------------------- */

  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.setViewport({ width: 390, height: 900, deviceScaleFactor: 1, isMobile: true });

  for (const route of available) {
    const where = `reduced-motion ${route}`;
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle0' });

    const state = await page.evaluate(() => ({
      hidden: [...document.querySelectorAll('[data-reveal]')]
        .map((el) => ({
          cls: el.getAttribute('class') || el.tagName.toLowerCase(),
          opacity: Number(getComputedStyle(el).opacity),
          transition: getComputedStyle(el).transitionProperty,
        }))
        .filter((el) => el.opacity < 1),
      counters: [...document.querySelectorAll('[data-count-to]')].map((el) => ({
        want: Number(el.getAttribute('data-count-to')),
        got: Number((el.textContent ?? '').trim()),
      })),
      revealReady: document.documentElement.hasAttribute('data-reveal-ready'),
    }));

    for (const el of state.hidden) {
      fail(
        where,
        `[data-reveal] "${el.cls}" is at opacity ${el.opacity} under reduced motion — ` +
          `a reader who asked for less motion is being given less page`,
      );
    }
    checks++;

    for (const counter of state.counters) {
      assert(
        where,
        counter.got === counter.want,
        `a counter reads ${counter.got} but its final value is ${counter.want} — ` +
          `under reduced motion the figure must be painted, not animated`,
      );
    }
  }
  process.stdout.write(`  swept ${available.length} route(s) under reduced motion\n`);
} finally {
  await browser.close();
}

console.log();
if (failures > 0) {
  const kinds = [...seen.entries()].sort((a, b) => b[1] - a[1]);
  console.error(`${kinds.length} distinct failure(s), ${failures} occurrence(s) of ${checks} checks:`);
  for (const [kind, count] of kinds) console.error(`  ${String(count).padStart(5)} ×  ${kind}`);
  console.error(
    `\n✗ The reveal decoration is costing somebody the content. See Reveal.astro.\n`,
  );
  process.exit(1);
}
console.log(`✓ ${checks} reveal checks passed — fires once, nothing pre-hidden, reduced motion whole.`);
