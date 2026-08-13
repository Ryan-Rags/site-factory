/**
 * A stand-in demo site, wrong on purpose in named ways.
 *
 * The suite's own acceptance problem: a check that has only ever been pointed
 * at a healthy site is not known to be able to fail. Eight checks that all
 * printed ✓ against the live fleet would be indistinguishable from eight checks
 * that print ✓ against anything. So every check is also run against this — a
 * site whose defects are chosen one at a time — and the failure is asserted.
 *
 * Same reasoning as `scripts/domain-safety/stub-server.mjs`: the stub is not a
 * weaker test than the real thing, because what can actually be wrong is the
 * parsing and the conclusion, and both are exercised here including the paths a
 * healthy live site never reaches.
 *
 * Nothing here is a real business. The name, the phone number and the services
 * are invented, and it is served on 127.0.0.1 only.
 */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { DENIED_FEATURES, buildPolicy, emptyMeasurement, measurePage, mergeMeasurement } from '../../packages/template/scripts/lib/csp.mjs';
import { repoRoot } from '../pitch/paths.mjs';

const presets = JSON.parse(
  readFileSync(join(repoRoot, 'packages', 'template', 'src', 'design', 'presets.json'), 'utf8'),
);

export const FIXTURE_SLUG = 'selftest-fixture';

/** Every accent in presets.json, as `theme|scheme|accent` -> hex. */
function accentTable() {
  const table = {};
  for (const preset of presets.presets) {
    for (const scheme of ['light', 'dark']) {
      for (const accent of preset.schemes[scheme].accents) {
        table[`${preset.id}|${scheme}|${accent.id}`] = accent.accent;
      }
    }
  }
  return table;
}

/** A 1200×630 PNG: signature, IHDR, and nothing else worth serving. */
export function pngOf(width, height) {
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0);
  ihdr.write('IHDR', 4, 'latin1');
  ihdr.writeUInt32BE(width, 8);
  ihdr.writeUInt32BE(height, 12);
  ihdr[16] = 8;
  ihdr[17] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ihdr,
  ]);
}

const SVG_CARD = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"></svg>',
  'utf8',
);

/**
 * The defaults are a *correct* site. Every case in the self-test switches one
 * thing off, so a failure can only be attributed to the thing it switched.
 */
export const HEALTHY = {
  headers: true,
  noindex: true,
  robotsDisallow: true,
  sitemap: false,
  og: 'png',            // 'png' | 'svg' | 'missing' | 'off-origin' | 'small'
  worker: 'register',   // 'register' | 'broken' | 'none'
  customizer: 'resolves', // 'resolves' | 'stamps'
  aboutStatus: 200,
  genericNotFound: false,
  endpoint: null,       // set by the self-test to its worker stub
  siteOrigin: null,     // canonical origin; defaults to the serving origin
};

function head(opts, origin, { title, canonical }) {
  const site = opts.siteOrigin ?? origin;
  const og =
    opts.og === 'off-origin'
      ? `https://demo-not-served.invalid/og/${FIXTURE_SLUG}.png`
      : `${site}/og/${FIXTURE_SLUG}.png`;
  return `<meta charset="utf-8">
<title>${title}</title>
<link rel="canonical" href="${site}${canonical}">
<link rel="manifest" href="/icons/${FIXTURE_SLUG}/site.webmanifest">
<meta name="robots" content="${opts.noindex ? 'noindex,nofollow' : 'index,follow'}">
<meta property="og:image" content="${og}">
<meta name="twitter:image" content="${og}">
<style>:root { --d-accent: #b3400f; }</style>`;
}

function workerScript(opts) {
  if (opts.worker === 'none') return '';
  if (opts.worker === 'broken' || opts.worker === 'register') {
    return `<script>if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){});});}</script>`;
  }
  return '';
}

/**
 * The customizer, in two behaviours.
 *
 * `resolves` clamps a request to a cell that exists and paints it — what the
 * template does. `stamps` writes whatever the URL asked for straight onto the
 * document, which is the bug `check-switching.mjs` was written for: a
 * legal-looking attribute over a cell with no styles behind it.
 */
function customizerScript(opts) {
  const table = JSON.stringify(accentTable());
  const legal = JSON.stringify({ theme: 'forge', scheme: 'dark', accent: 'ember', font: 'condensed-caps' });
  return `<button id="d-cust-toggle" type="button">design</button>
<script>
(function () {
  var TABLE = ${table};
  var FALLBACK = ${legal};
  var q = new URLSearchParams(location.search);
  var want = {
    theme: q.get('theme') || FALLBACK.theme,
    scheme: q.get('scheme') || FALLBACK.scheme,
    accent: q.get('accent') || FALLBACK.accent,
    font: q.get('font') || FALLBACK.font
  };
  var stamps = ${opts.customizer === 'stamps'};
  var cell = stamps ? want : (TABLE[want.theme + '|' + want.scheme + '|' + want.accent] ? want : FALLBACK);
  var doc = document.documentElement;
  doc.setAttribute('data-theme', cell.theme);
  doc.setAttribute('data-scheme', cell.scheme);
  doc.setAttribute('data-accent', cell.accent);
  doc.setAttribute('data-font', cell.font);
  var hex = TABLE[cell.theme + '|' + cell.scheme + '|' + cell.accent];
  doc.style.setProperty('--d-accent', hex || '');
})();
</script>`;
}

function page(opts, origin, route) {
  const titles = {
    '/': 'Selftest Fixture Engineering',
    '/services/': 'Services',
    '/about/': 'About',
    '/contact/': 'Contact',
  };
  const island =
    route === '/contact/' && opts.endpoint
      ? `<astro-island props="{&quot;endpoint&quot;:[0,&quot;${opts.endpoint}&quot;],&quot;prospectId&quot;:[0,&quot;${FIXTURE_SLUG}&quot;]}"></astro-island>`
      : '';
  return `<!doctype html>
<html lang="en">
<head>
${head(opts, origin, { title: titles[route] ?? route, canonical: route })}
</head>
<body>
<nav><a href="/">Home</a><a href="/services/">Services</a><a href="/about/">About</a><a href="/contact/">Contact</a></nav>
<h1>${titles[route] ?? route}</h1>
${island}
${route === '/' ? customizerScript(opts) : ''}
${workerScript(opts)}
</body>
</html>`;
}

const NOT_FOUND_PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Not found</title></head>
<body><h1>That page isn't here.</h1></body></html>`;

const GENERIC_NOT_FOUND = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>404</title></head>
<body><h1>404 Not Found</h1></body></html>`;

/** The service worker: precaches the four routes so a cache actually fills. */
const SW = `const CACHE = 'selftest:v1';
const PRECACHE = ['/', '/services/', '/about/', '/contact/'];
self.addEventListener('install', (e) => e.waitUntil((async () => {
  const c = await caches.open(CACHE);
  await Promise.all(PRECACHE.map(async (u) => { try { const r = await fetch(u, {cache:'reload'}); if (r.ok) await c.put(u, r); } catch (err) {} }));
  await self.skipWaiting();
})()));
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith((async () => {
    try { return await fetch(e.request); }
    catch (err) { const c = await caches.open(CACHE); return (await c.match(e.request, {ignoreSearch:true})) || Response.error(); }
  })());
});`;

/**
 * The policy this fixture's own pages derive, so a healthy fixture serves the
 * headers a healthy deploy would. Computed from the served HTML by the same
 * module the real check uses — if that ever stopped agreeing with itself, the
 * self-test would say so.
 */
function policyFor(opts, origin) {
  const merged = emptyMeasurement();
  const site = opts.siteOrigin ?? origin;
  for (const route of ['/', '/services/', '/about/', '/contact/']) {
    mergeMeasurement(merged, measurePage(page(opts, origin, route), site));
  }
  return buildPolicy(merged);
}

export function serveFixture(options = {}) {
  const opts = { ...HEALTHY, ...options };
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const origin = `http://127.0.0.1:${server.address().port}`;
      const url = new URL(req.url, origin);
      const path = url.pathname;

      const send = (status, type, body, extra = {}) => {
        const headers = {
          'content-type': type,
          // The two Cloudflare Pages supplies with no `_headers` present. The
          // fixture mimics them so the provenance labelling is exercised.
          'x-content-type-options': 'nosniff',
          'referrer-policy': 'strict-origin-when-cross-origin',
          ...extra,
        };
        if (opts.headers) {
          headers['content-security-policy'] = policyFor(opts, origin);
          headers['x-frame-options'] = 'DENY';
          headers['permissions-policy'] = DENIED_FEATURES.map((f) => `${f}=()`).join(', ');
        }
        res.writeHead(status, headers);
        res.end(body);
      };

      if (path === '/robots.txt') {
        return send(
          200,
          'text/plain; charset=utf-8',
          opts.robotsDisallow ? 'User-agent: *\nDisallow: /\n' : 'User-agent: *\nAllow: /\n',
        );
      }
      if (path === '/sitemap-index.xml' || path === '/sitemap-0.xml') {
        return opts.sitemap
          ? send(200, 'application/xml; charset=utf-8', '<?xml version="1.0"?><sitemapindex/>')
          : send(404, 'text/html; charset=utf-8', NOT_FOUND_PAGE);
      }
      if (path === '/sw.js') {
        return opts.worker === 'broken' || opts.worker === 'none'
          ? send(404, 'text/plain; charset=utf-8', 'not found')
          : send(200, 'text/javascript; charset=utf-8', SW, { 'cache-control': 'no-cache' });
      }
      if (path === `/og/${FIXTURE_SLUG}.png`) {
        if (opts.og === 'missing') return send(404, 'text/html; charset=utf-8', NOT_FOUND_PAGE);
        if (opts.og === 'svg') return send(200, 'image/png', SVG_CARD);
        if (opts.og === 'small') return send(200, 'image/png', pngOf(600, 315));
        return send(200, 'image/png', pngOf(1200, 630));
      }

      const route = path.endsWith('/') ? path : `${path}/`;
      if (route === '/about/' && opts.aboutStatus !== 200) {
        return send(opts.aboutStatus, 'text/html; charset=utf-8', 'upstream error');
      }
      if (['/', '/services/', '/about/', '/contact/'].includes(route)) {
        return send(200, 'text/html; charset=utf-8', page(opts, origin, route));
      }

      return send(
        404,
        'text/html; charset=utf-8',
        opts.genericNotFound ? GENERIC_NOT_FOUND : NOT_FOUND_PAGE,
      );
    });

    server.listen(0, '127.0.0.1', () => {
      resolve({
        origin: `http://127.0.0.1:${server.address().port}`,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

/**
 * A stand-in for the demo Worker, in two behaviours: `strict` matches
 * `worker-demo/src/lib/http.ts` — suffix match at a dot boundary, https only —
 * and `loose` is the substring bug that rule exists to prevent.
 */
export function serveWorkerStub({ mode = 'strict', allowOrigin } = {}) {
  // Settable after construction: the fixture site needs the stub's URL baked
  // into its contact page, and the stub needs the fixture's origin on its
  // allowlist, so one of the two has to be told about the other afterwards.
  let allowed_ = allowOrigin;
  const allowed = (origin) => {
    if (!origin) return false;
    if (allowed_ && origin === allowed_) return true;
    if (mode === 'loose') return origin.includes('pages.dev');
    try {
      const u = new URL(origin);
      return u.protocol === 'https:' && (u.hostname === 'pages.dev' || u.hostname.endsWith('.pages.dev'));
    } catch {
      return false;
    }
  };

  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const origin = req.headers.origin ?? null;
      const cors = allowed(origin)
        ? {
            'access-control-allow-origin': origin,
            'access-control-allow-methods': 'POST, OPTIONS',
            'access-control-allow-headers': 'Content-Type',
            vary: 'Origin',
          }
        : {};

      if (req.method === 'OPTIONS') {
        res.writeHead(204, cors);
        return res.end();
      }
      if (req.method !== 'POST') {
        res.writeHead(405, { 'content-type': 'application/json', ...cors });
        return res.end(JSON.stringify({ ok: false, error: 'method_not_allowed' }));
      }
      // Every POST this stub receives is the honeypot — the real Worker answers
      // 200 {ok:true} and discards, so the stub does the same.
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', ...cors });
        res.end(JSON.stringify({ ok: true }));
      });
    });

    server.listen(0, '127.0.0.1', () => {
      resolve({
        origin: `http://127.0.0.1:${server.address().port}`,
        allow: (origin) => {
          allowed_ = origin;
        },
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}
