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
import { problem, report } from './lib.mjs';

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

console.log(`      verifying ${origin}`);

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
  if (/data-placeholder="/.test(html) === false && route !== '/amenity') {
    problem(`${route}: served HTML carries no placeholder markers — expected some until filled.`);
  }
}

for (const route of ASSET_ROUTES) {
  const res = await get(`${origin}${route}`, { redirect: 'follow' });
  if (res.status !== 200) {
    problem(`${route}: ${res.status || `unreachable (${res._error})`}`);
  }
}

// robots.txt on the live origin must still allow, and must name a sitemap that
// is itself reachable.
const robots = await get(`${origin}/robots.txt`, { redirect: 'follow' });
if (robots.status === 200) {
  const text = await robots.text();
  if (/^\s*Disallow:\s*\S+/im.test(text)) problem('live robots.txt blocks crawling.');
  if (!/^\s*Sitemap:\s*\S+/im.test(text)) problem('live robots.txt names no sitemap.');
}

console.log(
  `      ${DOCUMENT_ROUTES.length} document route(s) + ${ASSET_ROUTES.length} asset(s) checked`,
);
report('check-live');
