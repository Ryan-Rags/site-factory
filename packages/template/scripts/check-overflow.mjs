/**
 * Asserts zero horizontal overflow at a narrow phone width on every route,
 * and names the specific element responsible when it fails.
 *
 * `body { overflow-x: hidden }` in global.css hides the symptom; this check
 * finds the cause, so a wide element cannot quietly clip itself instead of
 * being fixed.
 *
 * Usage:
 *   pnpm build && pnpm preview --port 4321   # in one terminal
 *   pnpm check:overflow                      # in another
 *
 * Set CHROME_PATH if Chrome is not at the Windows/macOS/Linux default.
 * Exits non-zero on any overflow, so it can gate a deploy.
 */
import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const BASE = process.env['PREVIEW_URL'] ?? 'http://localhost:4321';
const WIDTHS = [320, 390];
const ROUTES = ['/', '/services', '/about', '/contact', '/404'];

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

try {
  for (const width of WIDTHS) {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 844, deviceScaleFactor: 2, isMobile: true });

    for (const route of ROUTES) {
      const response = await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle0' });
      // /404 is served with a 404 status by design. Everything else must be a
      // success or a cache revalidation — a warm preview server answers 304.
      const status = response?.status() ?? 0;
      if (route !== '/404' && status >= 400) {
        console.error(`FAIL  ${width}px  ${route}  — HTTP ${status || 'no response'}`);
        failures += 1;
        continue;
      }

      const result = await page.evaluate((viewportWidth) => {
        const doc = document.documentElement;
        const scrollWidth = Math.max(doc.scrollWidth, document.body.scrollWidth);

        // Find every element whose painted box actually crosses the right
        // edge of the viewport, ignoring anything intentionally off-screen
        // to the left (nothing here does that, but sr-only tricks can).
        const culprits = [];
        for (const el of document.querySelectorAll('body *')) {
          const style = getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden') continue;
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) continue;
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
