/**
 * Acceptance screenshots for the design-coverage stream.
 *
 * Two sets, and each answers a question the gate output cannot:
 *
 *   1. THE LOCKUP, before and after, at all five gated viewports in the widest
 *      display face in the matrix. `check:textfit` proves the name is no longer
 *      truncated; only a picture shows what the two-line lockup actually looks
 *      like beside the logo, which is the thing a person has to sign off.
 *
 *   2. `/` AND `/contact` SIDE BY SIDE, in two families. The whole stream is
 *      about the contact page belonging to the site the prospect was just
 *      looking at, and that is a visual claim.
 *
 * The "before" shots come from a second server holding a build of `main`, so
 * the comparison is against the real baseline rather than against a
 * reconstruction of it.
 *
 * Usage:
 *   PREVIEW_URL=http://localhost:4398 \
 *   BASELINE_URL=http://localhost:4407 \
 *   SITE_CLIENT=kh-machine-works \
 *   node scripts/capture-coverage.mjs [outDir]
 *
 * BASELINE_URL is optional: without it the "before" half is skipped and the run
 * says so rather than quietly producing half the evidence.
 */
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const BASE = process.env['PREVIEW_URL'] ?? 'http://localhost:4321';
const BASELINE = process.env['BASELINE_URL'] ?? '';
const SLUG = process.env['SITE_CLIENT'] ?? 'kh-machine-works';
const outDir = process.argv[2] ?? join(process.cwd(), 'coverage-shots');

const VIEWPORTS = [320, 390, 768, 1024, 1440];

/** The widest display type the matrix offers — uppercase Georgia at +0.05em. */
const WIDEST = 'theme=heritage&scheme=light&accent=brick&font=signwriter';

const PAIRS = [
  { name: 'forge-dark', query: 'theme=forge&scheme=dark&accent=ember&font=condensed-caps' },
  { name: 'heritage-light', query: WIDEST },
];

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

mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ['--no-sandbox', '--hide-scrollbars'],
});

let written = 0;

try {
  const page = await browser.newPage();

  /** Prove the server is the build we mean, exactly as the gates do. */
  const check = async (url, label) => {
    const res = await page.goto(url, { waitUntil: 'networkidle0' });
    if (!res || res.status() >= 400) throw new Error(`${label}: cannot reach ${url}`);
    const served = await page.evaluate(() => {
      const m = document.querySelector('link[rel="manifest"]')?.getAttribute('href') ?? '';
      return /\/icons\/([^/]+)\//.exec(m)?.[1] ?? null;
    });
    if (served !== SLUG) {
      throw new Error(`${label}: ${url} is serving "${served ?? 'an unrecognised build'}", not "${SLUG}"`);
    }
  };

  await check(BASE, 'candidate');
  if (BASELINE) await check(BASELINE, 'baseline');

  const shot = async (path, name) => {
    await page.screenshot({ path: join(outDir, `${name}.png`) });
    written++;
    process.stdout.write(`  ${name}.png\n`);
  };

  /* --- 1. the header lockup, before and after ---------------------------- */

  const header = async (origin, tag) => {
    for (const width of VIEWPORTS) {
      await page.setViewport({ width, height: 400, deviceScaleFactor: 2, isMobile: width < 768 });
      await page.goto(`${origin}/?${WIDEST}`, { waitUntil: 'networkidle0' });
      const bar = await page.$('.d-header');
      if (!bar) {
        console.error(`  ! no .d-header at ${width}px on ${origin} — skipped`);
        continue;
      }
      // The header alone, not the fold: the lockup is the subject and a full
      // screenshot buries it under the hero.
      await bar.screenshot({ path: join(outDir, `lockup-${tag}-${width}.png`) });
      written++;
      process.stdout.write(`  lockup-${tag}-${width}.png\n`);
    }
  };

  console.log(`\ncapture: ${SLUG}\n\nheader lockup, widest face in the matrix:`);
  if (BASELINE) await header(BASELINE, 'before');
  else console.log('  (no BASELINE_URL — "before" shots skipped)');
  await header(BASE, 'after');

  /* --- 2. home and contact, same cell, side by side ---------------------- */

  console.log('\nhome and contact in the same cell:');
  for (const pair of PAIRS) {
    for (const route of ['/', '/contact']) {
      await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
      await page.goto(`${BASE}${route}?${pair.query}`, { waitUntil: 'networkidle0' });
      // Let the reveal transitions finish so the shot is the settled page.
      await new Promise((r) => setTimeout(r, 900));
      await shot(route, `${route === '/' ? 'home' : 'contact'}-${pair.name}`);
    }
  }

  /* --- and the same contact page as it was, for the comparison ----------- */

  if (BASELINE) {
    console.log('\ncontact as it was on main (legacy, one cell — it had no families):');
    await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
    await page.goto(`${BASELINE}/contact`, { waitUntil: 'networkidle0' });
    await shot('/contact', 'contact-before-legacy');
  }
} finally {
  await browser.close();
}

console.log(`\n✓ ${written} screenshot(s) in ${outDir}`);
