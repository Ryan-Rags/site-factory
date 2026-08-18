/**
 * Post-deploy verification against a real origin.
 *
 * The build gates prove things about dist/. This proves things only the deployed
 * site can answer — whether Pages actually serves the canonical URL as a
 * document, and whether _headers took effect. Both were wrong on the first
 * deploy of this package and neither was visible from dist/:
 *
 *   - `/sites` answered 308 (redirect to `/sites/`), so every canonical pointed
 *     at a redirect rather than at a page. Fixed by `build.format: 'file'`.
 *   - Header delivery is a property of the platform reading `_headers` from the
 *     deployment root, which no local check can confirm.
 *
 *   node scripts/check-live.mjs https://raghubans-com.pages.dev
 *
 * Read-only GETs, one request at a time, well inside the repo's audit budget.
 */
import { escapeRe, headshot, linkedinUrl, problem, report } from './lib.mjs';

const base = process.argv[2];
if (!base) {
  console.error('usage: node scripts/check-live.mjs <origin>');
  process.exit(1);
}
const origin = base.replace(/\/$/, '');

/** Canonical routes: must be 200 with NO redirect hop. */
const DOCUMENT_ROUTES = ['/', '/sites', '/ai', '/amenity', '/about'];
/** Supporting files: must be 200. */
const ASSET_ROUTES = [
  '/robots.txt',
  '/sitemap-index.xml',
  '/favicon.svg',
  '/og/home.png',
  '/og/sites.png',
  '/og/ai.png',
  '/og/amenity.png',
  '/og/about.png',
];

/** Pages wearing the founder footer, and therefore the LinkedIn slot. */
const FOUNDER_ROUTES = ['/', '/sites', '/ai', '/about'];

const linkedin = linkedinUrl();
const photo = headshot();
const servedHeadshot = new RegExp(`<img[^>]*\\ssrc="${escapeRe(photo.src)}"`, 'i');
const servedLinkedin = linkedin ? new RegExp(`href="${escapeRe(linkedin)}"`, 'i') : /$^/;

const REQUIRED_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'content-security-policy': "frame-ancestors 'none'",
  'x-frame-options': 'DENY',
};

/**
 * Cloudflare's edge returned a transient 522 on two of ten requests during the
 * first verification pass, on assets that were definitely present. Retrying a
 * 5xx a couple of times is the difference between this gate reporting a real
 * defect and reporting edge weather.
 */
async function get(url, { redirect = 'manual' } = {}) {
  let last;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const res = await fetch(url, { redirect, headers: { 'user-agent': 'founder-site-check' } });
      if (res.status < 500) return res;
      last = `${res.status}`;
    } catch (err) {
      last = err.message;
    }
    if (attempt < 3) await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
  return { status: 0, headers: new Headers(), _error: last };
}

/**
 * Internal document routes this page links to, normalised to the form
 * DOCUMENT_ROUTES uses.
 *
 * Absolute hrefs on our own origin count: the canonical origin and the
 * pages.dev alias are the same site, and a nav written with absolute URLs would
 * still be a working nav. `mailto:`, fragments and asset paths are not routes.
 */
function internalLinks(html) {
  const found = new Set();
  for (const m of html.matchAll(/<a\b[^>]*\shref=["']([^"']+)["']/gi)) {
    let href = m[1].trim();
    if (/^(mailto:|tel:|#)/i.test(href)) continue;

    if (/^https?:\/\//i.test(href)) {
      let url;
      try {
        url = new URL(href);
      } catch {
        continue;
      }
      // Only our own origins — the deployed one under test, and the canonical.
      if (url.origin !== origin && url.hostname !== 'raghubans.com') continue;
      href = url.pathname;
    } else if (!href.startsWith('/')) {
      continue;
    } else {
      href = href.split(/[?#]/)[0];
    }

    // `/sites/` and `/sites` are the same document to a reader.
    const route = href.length > 1 ? href.replace(/\/$/, '') : '/';
    if (DOCUMENT_ROUTES.includes(route)) found.add(route);
  }
  return found;
}

console.log(`      verifying ${origin}`);

/** route → the set of document routes it links. Filled by the loop below. */
const linkGraph = new Map();

for (const route of DOCUMENT_ROUTES) {
  const res = await get(`${origin}${route}`);
  if (res.status !== 200) {
    const to = res.headers.get('location');
    problem(
      `${route}: ${res.status || `unreachable (${res._error})`}` +
        (to ? ` → ${to} (a canonical must be a document, not a redirect)` : ''),
    );
    continue;
  }

  for (const [name, expected] of Object.entries(REQUIRED_HEADERS)) {
    const got = res.headers.get(name);
    if (got !== expected) {
      problem(`${route}: header ${name} is ${got === null ? 'absent' : `"${got}"`}, expected "${expected}"`);
    }
  }

  const html = await res.text();
  const canonical = /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i.exec(html);
  if (!canonical) problem(`${route}: no canonical in the served HTML.`);

  /*
   * The two wired slots, checked against what is actually being SERVED.
   *
   * This compares the deployed HTML to the local slot state, which is only a
   * meaningful comparison immediately after deploying this build — which is
   * precisely when this gate runs, per the README's deploy sequence. It catches
   * the case the build gate cannot: a deploy that published a stale dist/, so
   * the photo is in the repo and not on the site.
   */
  if (photo.present && route === '/' && !servedHeadshot.test(html)) {
    problem(`/: public${photo.src} exists locally but the served hero has no <img src="${photo.src}">.`);
  }
  if (linkedin && FOUNDER_ROUTES.includes(route) && !servedLinkedin.test(html)) {
    problem(`${route}: LINKEDIN_URL is set locally but the served footer does not link it.`);
  }
  if (!photo.present && route === '/' && !/data-placeholder="PHOTO_HERE"/.test(html)) {
    problem('/: no photo placeholder and no photo — the hero slot is neither filled nor marked.');
  }

  linkGraph.set(route, internalLinks(html));
}

/**
 * ONE TAP: every route reaches every other route directly.
 *
 * /amenity shipped as a one-exit page — brand chrome, a mailto CTA and a single
 * discreet footer link back to `/`, so the other three routes were two taps
 * away and the page read as a dead end to anyone who did not find that line.
 * The fix is a persistent nav on both chromes; this is what stops it regressing,
 * and it is stated as reachability rather than as "the nav component is present"
 * because the second one passes on a nav that renders zero links.
 *
 * Costs no extra requests: the documents were already fetched above.
 */
for (const from of DOCUMENT_ROUTES) {
  const links = linkGraph.get(from);
  if (!links) continue; // already reported as unreachable
  const missing = DOCUMENT_ROUTES.filter((to) => to !== from && !links.has(to));
  if (missing.length > 0) {
    problem(
      `${from}: no direct link to ${missing.join(', ')} — every route must be one tap ` +
        'from every other, so a visitor who lands deep is never stranded.',
    );
  }
}

for (const route of ASSET_ROUTES) {
  const res = await get(`${origin}${route}`, { redirect: 'follow' });
  if (res.status !== 200) {
    problem(`${route}: ${res.status || `unreachable (${res._error})`}`);
  }
}

/**
 * Only the `User-agent: *` group speaks for general crawling.
 *
 * MEASURED, 2026-08-18: a flat `/Disallow:\s*\S+/` over the whole file failed
 * on the apex domain and passed on the pages.dev alias, which is why it had
 * never fired. Cloudflare's managed-robots feature prepends a block on the ZONE
 * — content signals, `Allow: /` for `*`, and `Disallow: /` for a list of named
 * AI crawlers (GPTBot, ClaudeBot, CCBot, Google-Extended and others). Those
 * per-agent groups are a zone-level policy of Ryan's, they say nothing about
 * search indexing, and this package is explicitly barred from touching zones.
 *
 * So the assertion is narrowed to the claim the gate actually exists to make:
 * a general crawler — the one that builds the search result this site is for —
 * is not blocked.
 */
function starGroupBlocked(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/#.*$/, '').trim())
    .filter(Boolean);

  let sawStar = false;
  let inStar = false;
  let collectingAgents = false;
  let blocked = false;

  for (const line of lines) {
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const field = m[1].toLowerCase();
    const value = m[2].trim();

    if (field === 'user-agent') {
      // A run of consecutive User-agent lines is ONE group; the first one after
      // a rule line starts a new group, which is where `inStar` must reset.
      if (!collectingAgents) inStar = false;
      collectingAgents = true;
      if (value === '*') {
        inStar = true;
        sawStar = true;
      }
      continue;
    }

    collectingAgents = false;
    if (inStar && field === 'disallow' && value === '/') blocked = true;
  }

  return { sawStar, blocked };
}

const robots = await get(`${origin}/robots.txt`, { redirect: 'follow' });
if (robots.status === 200) {
  const text = await robots.text();
  const { sawStar, blocked } = starGroupBlocked(text);
  if (!sawStar) problem('live robots.txt has no `User-agent: *` group — general crawling is undefined.');
  if (blocked) problem('live robots.txt blocks general crawling (`Disallow: /` under `User-agent: *`).');
  if (!/^\s*Sitemap:\s*\S+/im.test(text)) problem('live robots.txt names no sitemap.');
}

console.log(
  `      ${DOCUMENT_ROUTES.length} document route(s) + ${ASSET_ROUTES.length} asset(s) checked`,
);
report('check-live');
