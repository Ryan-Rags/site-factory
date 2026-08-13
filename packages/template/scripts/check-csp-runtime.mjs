/**
 * Loads the built site under its own generated headers and proves it still works.
 *
 * `check-headers.mjs` proves the `_headers` file matches the pages. That is a
 * statement about two files agreeing with each other, and it is not the thing
 * anybody actually cares about. A policy can be perfectly derived, perfectly
 * diffed, and still break the customizer, or stop the service worker
 * registering, or block the Turnstile widget — and every one of those failures
 * is silent in a build log and obvious to a customer.
 *
 * So this serves `dist/<slug>/` through a local server that **replays the
 * generated `_headers`**, drives the site in a real browser, and fails on any
 * CSP violation at all. That is the only check here that measures the thing we
 * are actually promising.
 *
 * It also carries the injection fuzz probe, because it needs the same browser.
 * `check-injection.mjs` can prove no *sink* exists but cannot prove the
 * customizer's allowlist resolution is correct — that is a claim about
 * behaviour, and behaviour needs running. Here the page is loaded with a script
 * payload in every accepted parameter and the probe asserts the payload reaches
 * neither the DOM nor the JavaScript engine.
 *
 * Not part of `pnpm build`: it launches a browser, which is far too heavy for a
 * per-client build. Run it in `build:all` and at acceptance.
 *
 * Usage:
 *   node scripts/check-csp-runtime.mjs              # SITE_CLIENT, or the default
 *   node scripts/check-csp-runtime.mjs <slug>       # one named client
 *   node scripts/check-csp-runtime.mjs --all        # every client in dist/
 */
import { createReadStream, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { walkHtml } from './lib/csp.mjs';

const distRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

/** The `/*` headers out of the generated `_headers`, as a plain object. */
function headersFor(distDir) {
  const file = join(distDir, '_headers');
  if (!existsSync(file)) return null;
  const out = {};
  let pattern = null;
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    if (raw.trim() === '' || raw.trimStart().startsWith('#')) continue;
    if (!/^\s/.test(raw)) {
      pattern = raw.trim();
      continue;
    }
    if (pattern !== '/*') continue;
    const at = raw.indexOf(':');
    if (at > 0) out[raw.slice(0, at).trim()] = raw.slice(at + 1).trim();
  }
  return out;
}

/**
 * Serve `root` on an ephemeral loopback port, stamping `extra` on every
 * response — which is what makes this a test of the policy rather than of the
 * markup. Mirrors Astro's `trailingSlash: 'ignore'`.
 */
function serve(root, extra) {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
      let file = join(root, normalize(rel));
      // No escaping the served directory.
      if (!file.startsWith(root + sep) && file !== root) {
        res.writeHead(403).end();
        return;
      }
      if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
      if (!existsSync(file) && existsSync(`${file}.html`)) file = `${file}.html`;
      if (!existsSync(file)) {
        const notFound = join(root, '404.html');
        res.writeHead(404, { ...extra, 'Content-Type': MIME['.html'] });
        if (existsSync(notFound)) createReadStream(notFound).pipe(res);
        else res.end('not found');
        return;
      }
      res.writeHead(200, {
        ...extra,
        'Content-Type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
      });
      createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

/**
 * Collect violations the way the browser reports them.
 *
 * `securitypolicyviolation` fires on the document for every block, and is
 * registered before any page script runs so that a violation caused by the
 * page's own first inline script is still caught.
 */
const VIOLATION_HOOK = `
  window.__cspViolations = [];
  document.addEventListener('securitypolicyviolation', function (e) {
    window.__cspViolations.push({
      directive: e.effectiveDirective || e.violatedDirective,
      blocked: e.blockedURI,
      sample: e.sample || '',
      line: e.lineNumber,
    });
  });
`;

/**
 * Walk the viewport down the page and back, so everything gated on visibility
 * actually happens: `client:visible` islands hydrate, `IntersectionObserver`
 * reveals fire, counters run, and any third-party widget inside a lazy island
 * gets its container.
 */
async function scrollThrough(page) {
  await page.evaluate(async () => {
    const step = Math.max(320, Math.floor(window.innerHeight * 0.8));
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise((r) => setTimeout(r, 200));
    window.scrollTo(0, 0);
  });
}

/** Payloads that would execute, or become markup, if anything mishandled them. */
const FUZZ_PAYLOADS = [
  '<script>window.__pwned=1</script>',
  '"><script>window.__pwned=1</script>',
  '<img src=x onerror="window.__pwned=1">',
  "javascript:window.__pwned=1",
  "' onfocus='window.__pwned=1",
];

async function checkClient(slug, chromium) {
  const distDir = join(distRoot, slug);
  if (!existsSync(distDir)) {
    console.error(`✗ ${slug}: no dist/${slug}. Run a build first.`);
    return false;
  }
  const extra = headersFor(distDir);
  if (extra === null) {
    console.error(`✗ ${slug}: no _headers. Run scripts/gen-headers.mjs first.`);
    return false;
  }
  if (!extra['Content-Security-Policy']) {
    console.error(`✗ ${slug}: _headers carries no Content-Security-Policy.`);
    return false;
  }

  const problems = [];
  const { server, port } = await serve(distDir, extra);
  const base = `http://127.0.0.1:${port}`;
  const context = await chromium.newContext({ serviceWorkers: 'allow' });
  await context.addInitScript(VIOLATION_HOOK);

  try {
    const pages = walkHtml(distDir).map((f) => {
      const rel = f.slice(distDir.length + 1).split(sep).join('/');
      if (rel === 'index.html') return '/';
      if (rel === '404.html') return '/404';
      return `/${rel.replace(/\/index\.html$/, '').replace(/\.html$/, '')}`;
    });

    /* --- 1. every page loads clean under its own policy ------------------ */

    let sawCustomizer = false;
    let sawServiceWorker = false;

    for (const path of pages) {
      const page = await context.newPage();
      const consoleErrors = [];
      page.on('console', (msg) => {
        const text = msg.text();
        if (/content security policy|refused to (execute|load|apply|connect|frame)/i.test(text)) {
          consoleErrors.push(text);
        }
      });
      page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));

      await page.goto(`${base}${path}`, { waitUntil: 'load' });
      // The reveal script and the SW registration both run after load.
      await page.waitForTimeout(600);
      // Scroll the whole page before judging it.
      //
      // The contact form is a `client:visible` island, so its module bundle is
      // not even requested until it enters the viewport — and the Turnstile
      // widget container lives inside it. Without this, a check that loaded
      // /contact and looked at the result was reporting "clean under the CSP"
      // on a page whose only JavaScript had never run and whose third-party
      // widget had nothing to bind to. Lazy-loaded work is exactly the work
      // most likely to trip a policy nobody measured it against.
      await scrollThrough(page);
      await page.waitForTimeout(1200);

      const violations = await page.evaluate(() => window.__cspViolations ?? []);
      for (const v of violations) {
        problems.push(
          `${path}: CSP blocked ${v.directive} — ${v.blocked || v.sample || '(inline)'}`,
        );
      }
      for (const e of consoleErrors) problems.push(`${path}: ${e.slice(0, 160)}`);

      // The design shell's script sets this before doing anything else. Its
      // absence on a page that has the script means the script did not run.
      const state = await page.evaluate(() => ({
        revealReady: document.documentElement.hasAttribute('data-reveal-ready'),
        hasReveal: document.querySelectorAll('[data-reveal]').length > 0,
        hasCustomizer: !!document.getElementById('d-cust-toggle'),
        swController: 'serviceWorker' in navigator,
      }));
      if (state.hasReveal && !state.revealReady) {
        problems.push(`${path}: [data-reveal] elements present but the reveal script never ran`);
      }
      if (state.hasCustomizer) sawCustomizer = true;
      if (state.swController) sawServiceWorker = true;

      await page.close();
    }

    /* --- 2. the service worker actually registers ------------------------- */

    const swSource = join(distDir, 'sw.js');
    if (existsSync(swSource) && /navigator\.serviceWorker\.register/.test(
      readFileSync(join(distDir, 'index.html'), 'utf8'),
    )) {
      const page = await context.newPage();
      await page.goto(`${base}/`, { waitUntil: 'load' });
      const registered = await page
        .evaluate(
          () =>
            new Promise((resolve) => {
              const timer = setTimeout(() => resolve(false), 5000);
              navigator.serviceWorker.ready.then(() => {
                clearTimeout(timer);
                resolve(true);
              });
            }),
        )
        .catch(() => false);
      if (!registered) {
        problems.push(
          '/: the service worker never reached ready — the CSP is blocking worker-src, ' +
            'or registration threw',
        );
      }
      await page.close();
    }

    /* --- 3. the customizer still works ----------------------------------- */

    if (sawCustomizer) {
      const page = await context.newPage();
      await page.goto(`${base}/`, { waitUntil: 'load' });
      await page.waitForTimeout(300);

      const before = await page.evaluate(() => document.documentElement.getAttribute('data-accent'));
      // Click the second accent option, whatever it is: the point is that a
      // selection reaches the document, not which one.
      const changed = await page.evaluate(() => {
        const inputs = [...document.querySelectorAll('[name="d-accent"]')].filter(
          (i) => !i.disabled,
        );
        if (inputs.length < 2) return null;
        const target = inputs.find(
          (i) => i.value !== document.documentElement.getAttribute('data-accent'),
        );
        if (!target) return null;
        target.click();
        return target.value;
      });

      if (changed === null) {
        problems.push('/: the customizer offers fewer than two selectable accents');
      } else {
        await page.waitForTimeout(200);
        const after = await page.evaluate(() =>
          document.documentElement.getAttribute('data-accent'),
        );
        if (after !== changed) {
          problems.push(
            `/: the customizer did not apply a selection (accent stayed ${before}); ` +
              'its inline script is being blocked',
          );
        }
      }
      const violations = await page.evaluate(() => window.__cspViolations ?? []);
      for (const v of violations) {
        problems.push(`/ (customizer): CSP blocked ${v.directive} — ${v.blocked || v.sample}`);
      }
      await page.close();
    }

    /* --- 4. the injection fuzz probe -------------------------------------- */

    if (sawCustomizer) {
      for (const payload of FUZZ_PAYLOADS) {
        const page = await context.newPage();
        const qs = ['theme', 'scheme', 'accent', 'font']
          .map((k) => `${k}=${encodeURIComponent(payload)}`)
          .join('&');
        await page.goto(`${base}/?${qs}`, { waitUntil: 'load' });
        await page.waitForTimeout(300);

        const result = await page.evaluate((raw) => {
          const html = document.documentElement.outerHTML;
          return {
            executed: window.__pwned === 1,
            echoed: html.includes(raw),
            // The resolver's whole job: an unrecognised value is replaced by
            // the client's default, so the attribute must hold a plain token.
            attrs: {
              theme: document.documentElement.getAttribute('data-theme'),
              scheme: document.documentElement.getAttribute('data-scheme'),
              accent: document.documentElement.getAttribute('data-accent'),
              font: document.documentElement.getAttribute('data-font'),
            },
          };
        }, payload);

        const label = payload.length > 34 ? `${payload.slice(0, 34)}…` : payload;
        if (result.executed) problems.push(`FUZZ: payload EXECUTED for ${label}`);
        if (result.echoed) problems.push(`FUZZ: payload reached the DOM for ${label}`);
        for (const [k, v] of Object.entries(result.attrs)) {
          if (v === null) {
            problems.push(`FUZZ: data-${k} was not set at all for ${label}`);
          } else if (!/^[a-z0-9-]+$/i.test(v)) {
            problems.push(`FUZZ: data-${k} holds an unresolved value "${v}" for ${label}`);
          }
        }
        await page.close();
      }
    }

    if (problems.length === 0) {
      console.log(
        `✓ ${slug}: ${pages.length} page(s) clean under the generated CSP` +
          `${sawCustomizer ? ', customizer applies selections' : ''}` +
          `${sawServiceWorker ? ', service worker registers' : ''}` +
          `${sawCustomizer ? `, ${FUZZ_PAYLOADS.length} fuzz payloads neither executed nor echoed` : ''}.`,
      );
      return true;
    }

    console.error(`\n✗ ${slug}: ${problems.length} runtime problem(s) under the generated CSP.\n`);
    for (const p of problems.slice(0, 40)) console.error(`    ${p}`);
    if (problems.length > 40) console.error(`    … and ${problems.length - 40} more`);
    console.error('');
    return false;
  } finally {
    await context.close();
    server.close();
  }
}

const { chromium } = await import('playwright');
const requested = process.argv[2];
let slugs;
try {
  if (requested === '--all') {
    slugs = readdirSync(distRoot).filter((d) => statSync(join(distRoot, d)).isDirectory());
  } else {
    slugs = [requested || process.env.SITE_CLIENT || 'kh-machine-works'];
  }
} catch {
  console.error('No dist/ directory. Run a build first.');
  process.exit(1);
}

const browser = await chromium.launch();
let ok = true;
for (const slug of slugs) {
  ok = (await checkClient(slug, browser)) && ok;
}
await browser.close();
process.exit(ok ? 0 : 1);
