/**
 * Render one 1200×630 social card per page into public/og/.
 *
 * Why generated rather than one static card for the whole site: the five pages
 * sell to two different audiences, and the amenity link is the one most likely
 * to be forwarded between property managers. A card that says "Ryan Raghubans,
 * developer" under a smart-market pitch actively works against that page.
 *
 * Why PNG rather than the SVG this repo uses for favicons: several platforms —
 * including the ones that matter for a forwarded email — refuse to render SVG
 * for og:image at all, and show a grey box instead.
 *
 * Playwright is a devDependency ONLY. Nothing it produces is a runtime
 * dependency; the output is static PNG and the shipped pages stay
 * zero-dependency. This script is deliberately NOT part of `pnpm build`: it
 * needs a browser, it writes into public/, and its output changes only when the
 * page titles or the brand change. Run it when either does, and commit the PNGs.
 *
 *   node scripts/gen-og.mjs
 *
 * The card markup below intentionally duplicates a handful of token literals
 * from src/styles/global.css. Importing the stylesheet would mean resolving
 * Astro's build pipeline from a bare Node script for four colours; the duplication
 * is cheaper and this file is the only other place it happens.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pkgRoot } from './lib.mjs';

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error(
    'playwright is not installed. Run `pnpm install` in packages/founder-site,\n' +
      'then `pnpm exec playwright install chromium`.',
  );
  process.exit(1);
}

const OUT_DIR = join(pkgRoot, 'public', 'og');
const WIDTH = 1200;
const HEIGHT = 630;

const DARK = {
  base: '#08090a',
  surface: '#101214',
  ink: '#fafafa',
  inkMuted: '#a8adb4',
  line: '#1e2226',
  accent: '#0095fe',
  display: "'Helvetica Neue', Inter, Arial, sans-serif",
  weight: 800,
  tracking: '-0.02em',
};

const LIGHT = {
  base: '#faf8f5',
  surface: '#ffffff',
  ink: '#14120f',
  inkMuted: '#5d564c',
  line: '#ded7cc',
  accent: '#7a5c2e',
  display: "'Century Gothic', Futura, 'Avenir Next', sans-serif",
  weight: 700,
  tracking: '-0.01em',
};

/** Kept in step with PAGES in src/site.ts by hand — five entries, checked below. */
const CARDS = [
  {
    file: 'home.png',
    theme: DARK,
    eyebrow: 'raghubans.com',
    headline: 'Ryan Raghubans',
    sub: 'Full-Stack Developer &amp; Founder',
    foot: 'Bergen County, NJ',
  },
  {
    file: 'sites.png',
    theme: DARK,
    eyebrow: 'site-factory',
    headline: 'Fast, modern websites for Bergen County businesses',
    sub: '',
    foot: 'Ryan Raghubans · Bergen County, NJ',
  },
  {
    file: 'ai.png',
    theme: DARK,
    eyebrow: 'Voice',
    headline: 'AI voice agents that answer the calls you are missing',
    sub: '',
    foot: 'Ryan Raghubans · Bergen County, NJ',
  },
  {
    // Light surface, brand-first, and no mention of the founder — this card gets
    // forwarded between property managers on its own.
    file: 'amenity.png',
    theme: LIGHT,
    eyebrow: 'Alcove Markets',
    headline: 'Curated smart markets for luxury residential buildings',
    sub: '',
    foot: 'New Jersey',
  },
  {
    file: 'about.png',
    theme: DARK,
    eyebrow: 'About',
    headline: 'The longer version',
    sub: 'Developer, founder, three sports and a decade around a camera',
    foot: 'Ryan Raghubans · Bergen County, NJ',
  },
];

function cardHtml({ theme, eyebrow, headline, sub, foot }) {
  // Headline size steps down as the string grows, so a long line stays on the
  // card instead of overflowing it. Three buckets is enough for five cards.
  const size = headline.length > 44 ? 66 : headline.length > 24 ? 84 : 104;
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  html, body { width: ${WIDTH}px; height: ${HEIGHT}px; }
  body {
    background: ${theme.base};
    color: ${theme.ink};
    font-family: ${theme.display};
    display: flex; flex-direction: column;
    padding: 76px 84px;
    border-top: 8px solid ${theme.accent};
  }
  .eyebrow {
    font-size: 22px; letter-spacing: 0.2em; text-transform: uppercase;
    color: ${theme.accent}; font-weight: 600;
  }
  h1 {
    font-size: ${size}px; font-weight: ${theme.weight}; letter-spacing: ${theme.tracking};
    line-height: 1.05; margin-top: 34px; max-width: 950px;
  }
  .sub {
    font-size: 34px; font-weight: 500; color: ${theme.ink};
    margin-top: 26px; letter-spacing: -0.01em;
  }
  .foot {
    margin-top: auto; padding-top: 32px; border-top: 1px solid ${theme.line};
    font-size: 24px; color: ${theme.inkMuted}; letter-spacing: 0.04em;
  }
</style></head>
<body>
  <div class="eyebrow">${eyebrow}</div>
  <h1>${headline}</h1>
  ${sub ? `<div class="sub">${sub}</div>` : ''}
  <div class="foot">${foot}</div>
</body></html>`;
}

mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });

for (const card of CARDS) {
  await page.setContent(cardHtml(card), { waitUntil: 'load' });
  const png = await page.screenshot({ type: 'png' });
  writeFileSync(join(OUT_DIR, card.file), png);
  console.log(`wrote public/og/${card.file}`);
}

await browser.close();
console.log(`${CARDS.length} card(s) written to public/og/`);
