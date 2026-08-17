/**
 * Mobile fit, measured in a browser at 320px.
 *
 * Not part of `pnpm build`, for the same reason the template keeps its
 * browser-driven checks out of its build: `build` must run on a machine with no
 * Chromium. This is a pre-deploy gate — run it before publishing, and it is
 * reported alongside the Lighthouse numbers.
 *
 *   node scripts/check-textfit.mjs
 *
 * Three assertions:
 *
 *   1. No page scrolls horizontally at 320px. A sideways-scrolling page is the
 *      clearest possible signal of "amateur" to someone opening a link on a
 *      phone, which is the exact impression this site exists to avoid.
 *   2. "Ryan Raghubans" renders untruncated and inside the viewport. It is the
 *      one string on the site that cannot be allowed to clip.
 *   3. The home <h1>'s text is exactly the spec string, separators included.
 *      The separators are visually hidden (`.vh`), so this is the only thing
 *      that can catch someone "tidying up" the markup and dropping them.
 *
 * Serves dist/ from a throwaway local server on an ephemeral port rather than
 * assuming one is already running — CLAUDE.md's "verify you're measuring your
 * own build" applies, and a hardcoded port is how you end up measuring another
 * worktree's preview.
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { distDir, problem, report, requireDist } from './lib.mjs';

requireDist();

const WIDTH = 320;
const HEIGHT = 720;
const ROUTES = ['/', '/sites', '/ai', '/amenity', '/about'];

const EXPECTED_H1 = 'Ryan Raghubans — Full-Stack Developer & Founder · Bergen County, NJ';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('playwright is not installed. Run `pnpm install` then `pnpm exec playwright install chromium`.');
  process.exit(1);
}

const server = createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
  // normalize() plus the prefix test keeps `..` from escaping dist/.
  let file = normalize(join(distDir, urlPath));
  if (!file.startsWith(distDir)) {
    res.writeHead(403).end();
    return;
  }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) {
    const asHtml = `${file}.html`;
    if (existsSync(asHtml)) file = asHtml;
    else {
      res.writeHead(404).end('not found');
      return;
    }
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const origin = `http://127.0.0.1:${port}`;
console.log(`      serving own dist/ at ${origin}`);

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});

for (const route of ROUTES) {
  const res = await page.goto(`${origin}${route}`, { waitUntil: 'load' });
  if (!res || res.status() !== 200) {
    problem(`${route}: served ${res ? res.status() : 'no response'} from our own dist/.`);
    continue;
  }

  const overflow = await page.evaluate((vw) => {
    const doc = document.documentElement;
    const offenders = [];
    if (doc.scrollWidth > vw) {
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        // Ignore deliberately off-canvas helpers (.vh, .skip).
        if (getComputedStyle(el).position === 'absolute' && r.right < 0) continue;
        if (r.right > vw + 1) {
          offenders.push(`${el.tagName.toLowerCase()}.${el.className || '(no class)'} right=${Math.round(r.right)}`);
        }
      }
    }
    return { scrollWidth: doc.scrollWidth, offenders: offenders.slice(0, 6) };
  }, WIDTH);

  if (overflow.scrollWidth > WIDTH) {
    problem(
      `${route}: scrolls horizontally at ${WIDTH}px (scrollWidth ${overflow.scrollWidth}). ` +
        `Offenders: ${overflow.offenders.join('; ') || 'none isolated'}`,
    );
  }

  if (route === '/') {
    const hero = await page.evaluate(() => {
      const name = document.querySelector('.hero__name');
      const h1 = document.querySelector('h1');
      if (!name || !h1) return null;
      const r = name.getBoundingClientRect();
      return {
        text: (h1.textContent ?? '').replace(/\s+/g, ' ').trim(),
        nameText: (name.textContent ?? '').trim(),
        clipped: name.scrollWidth > name.clientWidth + 1,
        right: r.right,
        left: r.left,
        overflowStyle: getComputedStyle(name).textOverflow,
      };
    });

    if (!hero) {
      problem('/: could not find .hero__name / h1 — the fit assertion is blind.');
    } else {
      if (hero.nameText !== 'Ryan Raghubans') {
        problem(`/: .hero__name reads "${hero.nameText}", expected "Ryan Raghubans".`);
      }
      if (hero.clipped) {
        problem(`/: "${hero.nameText}" is truncated at ${WIDTH}px (scrollWidth > clientWidth).`);
      }
      if (hero.right > WIDTH + 1 || hero.left < -1) {
        problem(
          `/: "${hero.nameText}" sits outside the ${WIDTH}px viewport (left=${Math.round(hero.left)}, right=${Math.round(hero.right)}).`,
        );
      }
      if (hero.overflowStyle === 'ellipsis') {
        problem('/: .hero__name has text-overflow:ellipsis — the name must never be abbreviated.');
      }
      if (hero.text !== EXPECTED_H1) {
        problem(`/: h1 text is "${hero.text}", expected "${EXPECTED_H1}".`);
      }
    }
  }
}

await browser.close();
await new Promise((resolve) => server.close(resolve));

console.log(`      ${ROUTES.length} route(s) fit ${WIDTH}px with no horizontal scroll`);
report('check-textfit');
