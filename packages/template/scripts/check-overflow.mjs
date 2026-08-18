/**
 * Asserts zero horizontal overflow at a narrow phone width on every route,
 * and names the specific element responsible when it fails.
 *
 * `body { overflow-x: hidden }` in global.css hides the symptom; this check
 * finds the cause, so a wide element cannot quietly clip itself instead of
 * being fixed.
 *
 * Usage:
 *   SITE_CLIENT=<slug> pnpm build && pnpm preview --port 4321   # in one terminal
 *   SITE_CLIENT=<slug> pnpm check:overflow                      # in another
 *
 * `SITE_CLIENT` is REQUIRED, and that is new. This was the one browser gate
 * with no served-slug guard — the third recorded port collision, issue #37 —
 * and a guard has to know which client it is meant to be looking at. There is
 * no safe default: a guessed slug either fails on every client but the guess,
 * or is quietly ignored, which is the defect it exists to stop.
 *
 * Set CHROME_PATH if Chrome is not at the Windows/macOS/Linux default.
 * Exits non-zero on any overflow, so it can gate a deploy.
 */
import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

import { assertServedSlug } from './lib/served-slug.mjs';

const BASE = process.env['PREVIEW_URL'] ?? 'http://localhost:4321';

const SLUG = (process.env['SITE_CLIENT'] ?? '').trim();
if (SLUG === '') {
  console.error(
    'check:overflow needs SITE_CLIENT — the client whose preview is on PREVIEW_URL.\n' +
      'Without it there is nothing to check the served build against, and a stale\n' +
      'preview of another client on a recycled port reports green (issue #37).\n\n' +
      '  SITE_CLIENT=<slug> pnpm check:overflow',
  );
  process.exit(1);
}
const WIDTHS = [320, 390];
const ROUTES = ['/', '/services', '/about', '/contact', '/404'];

/**
 * A specific customizer combination, as a query string.
 *
 * Overflow is a property of a *combination*, not of a build. The widest
 * display type in the matrix is uppercase Georgia at +0.05em tracking, and it
 * is reachable only by switching to it — so checking the shipped combination
 * alone leaves every other cell a prospect can select unchecked.
 *
 *   THEME='theme=heritage&scheme=dark&font=signwriter' pnpm check:overflow
 */
const THEME = process.env['THEME'] ?? '';
const withTheme = (route) =>
  THEME ? `${route}${route.includes('?') ? '&' : '?'}${THEME}` : route;

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

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ['--no-sandbox', '--hide-scrollbars'],
});

let failures = 0;

/**
 * The served-slug guard runs once, on the first page loaded, and before a
 * single measurement is taken — the ruling of 2026-08-13 is "verifies the
 * served slug BEFORE it measures", and a guard that ran after the sweep would
 * only tell you the afternoon was wasted rather than saving it.
 *
 * Once rather than per route: every page of a build carries the same manifest
 * link, so nine more reads would be nine copies of one answer.
 */
let guarded = false;

try {
  for (const width of WIDTHS) {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 844, deviceScaleFactor: 2, isMobile: true });

    for (const route of ROUTES) {
      const response = await page.goto(`${BASE}${withTheme(route)}`, { waitUntil: 'networkidle0' });
      // /404 is served with a 404 status by design. Everything else must be a
      // success or a cache revalidation — a warm preview server answers 304.
      const status = response?.status() ?? 0;
      if (route !== '/404' && status >= 400) {
        console.error(`FAIL  ${width}px  ${route}  — HTTP ${status || 'no response'}`);
        failures += 1;
        continue;
      }

      if (!guarded) {
        await assertServedSlug(page, { slug: SLUG, base: BASE });
        guarded = true;
      }

      const result = await page.evaluate((viewportWidth) => {
        const doc = document.documentElement;
        const scrollWidth = Math.max(doc.scrollWidth, document.body.scrollWidth);

        // Find every element whose painted box actually crosses the right
        // edge of the viewport, ignoring anything intentionally off-screen
        // to the left (nothing here does that, but sr-only tricks can).
        /*
         * A horizontal scroll container is not an overflow bug — it is the
         * feature. The reviews carousel is a `scroll-snap` rail whose later
         * cards are, by definition, laid out past the right edge; so is any
         * `overflow-x: auto` table wrapper. What matters is whether the
         * *page* can be scrolled sideways, which `scrollWidth` already
         * answers, so descendants of a scroller are skipped here.
         *
         * Only genuine scrollers count: `overflow-x: hidden` clips its
         * children rather than letting them be reached, so an element hiding
         * a too-wide child that way is still a bug and is still reported.
         */
        const inScroller = (el) => {
          for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
            const ox = getComputedStyle(p).overflowX;
            if (ox === 'auto' || ox === 'scroll') return true;
          }
          return false;
        };

        const culprits = [];
        for (const el of document.querySelectorAll('body *')) {
          const style = getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden') continue;
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) continue;
          if (inScroller(el)) continue;
          /*
           * A hero image with `data-motion` is deliberately over-scaled
           * (`transform: scale(1.08)`) so it has room to drift, and its hero
           * clips it. Its *painted* box is meant to exceed the viewport; the
           * page still cannot be scrolled sideways, which is what this check
           * is protecting. Reporting it would train everyone to ignore the
           * one check that catches real 320px bugs.
           */
          if (el.hasAttribute('data-motion')) continue;
          if (rect.right > viewportWidth + 1) {
            culprits.push({
              tag: el.tagName.toLowerCase(),
              cls: (el.getAttribute('class') ?? '').slice(0, 90),
              right: Math.round(rect.right),
            });
          }
        }
        return { scrollWidth, culprits: culprits.slice(0, 5) };
      }, width);

      const overflows = result.scrollWidth > width || result.culprits.length > 0;
      if (overflows) {
        failures += 1;
        console.error(
          `FAIL  ${width}px  ${route}  scrollWidth=${result.scrollWidth} (viewport ${width})`,
        );
        for (const c of result.culprits) {
          console.error(`        <${c.tag} class="${c.cls}"> extends to ${c.right}px`);
        }
      } else {
        console.log(`PASS  ${width}px  ${route}  scrollWidth=${result.scrollWidth}`);
      }
    }

    await page.close();
  }
} finally {
  await browser.close();
}

console.log();
if (failures > 0) {
  console.error(`${failures} route/width combination(s) overflow horizontally.`);
  process.exit(1);
}
console.log('No horizontal overflow at any tested width.');
