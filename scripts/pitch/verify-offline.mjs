#!/usr/bin/env node
/**
 * verify-offline — prove a demo still works with the connection cut.
 *
 *   pnpm verify:offline -- --client kts-machine-shop --local
 *   pnpm verify:offline -- --client kh-machine-works --demo https://…pages.dev
 *   pnpm verify:offline -- --all --local
 *
 * The scenario this exists for: the demo is shown on a phone, standing inside
 * a workshop, where reception is frequently nothing. "It loaded on my desk" is
 * not evidence for that. So:
 *
 *   1. open the site once with a connection, exactly as a first visit
 *   2. wait for the service worker to be active and its precache to settle
 *   3. cut the connection at the browser context
 *   4. navigate to EVERY route cold, and check the page actually rendered
 *   5. reload each once more, to catch a worker that only serves the page it
 *      was registered on
 *
 * "Actually rendered" is four assertions per route, because a service worker
 * failure mode is a page that returns 200 and is visibly broken:
 *
 *   - the <h1> is present and non-empty      (HTML came from somewhere)
 *   - the header's brand colour is applied   (CSS is there — this is inlined
 *                                             in the HTML, so it also proves
 *                                             the HTML is the real document
 *                                             and not an error page)
 *   - the hero/section imagery has non-zero naturalWidth  (images cached)
 *   - no request in the navigation failed    (nothing fell through to network)
 *
 * Exit code is non-zero if any route fails any check, and the report says
 * which. A pass here is the only thing that entitles anyone to say these work
 * offline.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

import { assertKnownClient, listClients } from '../mockup/clients.mjs';
import { serveDir } from '../mockup/serve.mjs';
import { defaultDemoUrl, distDirFor, pitchDirFor, repoRoot } from './paths.mjs';

const USAGE = `
Usage:
  node scripts/pitch/verify-offline.mjs --client <slug> [--local | --demo <url>]
  node scripts/pitch/verify-offline.mjs --all [--local]

Options:
  --local        Serve packages/template/dist/<slug> locally and verify that
  --demo <url>   Verify a deployed demo. Default https://<slug>-preview.pages.dev
`;

/** Every route the template can emit. `/gallery` only exists for some clients. */
const ROUTES = ['/', '/services', '/about', '/contact', '/gallery'];
/** A URL that exists on no client, to prove the offline 404 path works. */
const MISSING_ROUTE = '/definitely-not-a-page';

const MOBILE = { width: 390, height: 844 };

function parseArgs(argv) {
  const opts = { all: false, client: null, demo: null, local: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--') continue;
    else if (arg === '--all') opts.all = true;
    else if (arg === '--local') opts.local = true;
    else if (arg === '--client' || arg === '-c') opts.client = argv[++i];
    else if (arg === '--demo') opts.demo = argv[++i];
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else throw new Error(`Unrecognised argument "${arg}".${USAGE}`);
  }
  return opts;
}

const rel = (p) => relative(repoRoot, p).split('\\').join('/');

async function loadPlaywright() {
  const require = createRequire(join(repoRoot, 'packages', 'audit', 'package.json'));
  const mod = await import(pathToFileURL(require.resolve('playwright')).href);
  return mod.chromium ? mod : mod.default;
}

/**
 * What a rendered page looks like, measured in the page itself.
 *
 * The colour check reads the computed colour of the header's phone button: it
 * comes from a custom property that only exists in the inlined stylesheet, so
 * a naked fallback document or an error page cannot satisfy it.
 *
 * Two properties, because there are two page shells. `BaseLayout` names its
 * brand colour `--color-primary`; a design-family page renders through
 * `DesignLayout`, whose equivalent token is `--d-accent`. Either one proves the
 * same thing — the inlined stylesheet arrived and applied — and a page that has
 * neither is the failure this check exists to catch.
 */
function inspectPage() {
  const h1 = document.querySelector('h1');
  const images = Array.from(document.images);
  const root = getComputedStyle(document.documentElement);
  const styled =
    root.getPropertyValue('--color-primary') || root.getPropertyValue('--d-accent');
  return {
    title: document.title,
    h1: h1 ? h1.textContent.trim() : '',
    brandColour: styled.trim(),
    images: images.length,
    imagesLoaded: images.filter((img) => img.naturalWidth > 0).length,
  };
}

function assess(route, facts, failedRequests) {
  const problems = [];
  if (!facts.h1) problems.push('no <h1> text');
  if (!facts.brandColour) problems.push('brand custom property missing (stylesheet not cached)');
  if (facts.images > 0 && facts.imagesLoaded === 0) problems.push('no image loaded');
  if (failedRequests.length > 0) {
    problems.push(`${failedRequests.length} request(s) failed: ${failedRequests.slice(0, 3).join(', ')}`);
  }
  return { route, ok: problems.length === 0, problems, ...facts };
}

async function verifyOne(slug, opts, chromium) {
  console.log(`\n=== ${slug} ===`);

  let origin = opts.demo ?? defaultDemoUrl(slug);
  let server = null;
  if (opts.local && !opts.demo) {
    server = await serveDir(distDirFor(slug));
    origin = server.origin;
    console.log(`  serving ${rel(distDirFor(slug))} at ${origin}`);
  }

  const browser = await chromium.launch();
  // A fresh context per client: a service worker registered by one demo must
  // not be able to serve another's pages and make this pass by accident.
  const context = await browser.newContext({ viewport: { ...MOBILE } });
  const report = { slug, origin, checkedAt: new Date().toISOString(), routes: [], ok: false };

  try {
    const page = await context.newPage();

    // 1. The first visit, online.
    await page.goto(origin, { waitUntil: 'networkidle', timeout: 30_000 });

    // 2. Wait for the worker to control the page, then for its precache to
    //    settle. `ready` resolves on activation; the precache is a set of
    //    fetches started in `install`, so we wait for the cache to stop
    //    growing rather than for a fixed sleep.
    const registered = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;

      /*
       * `navigator.serviceWorker.ready` never resolves when registration
       * failed — a missing or broken /sw.js leaves it pending forever rather
       * than rejecting. Without this race the verifier hangs instead of
       * reporting the exact failure it exists to catch. Found by deleting
       * sw.js from a build and watching this script never come back.
       */
      const ready = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((resolve) => setTimeout(() => resolve(null), 10_000)),
      ]);
      const reg = /** @type {ServiceWorkerRegistration | null} */ (ready);
      if (!reg || !reg.active) return false;
      let previous = -1;
      for (let i = 0; i < 40; i += 1) {
        const names = await caches.keys();
        const cache = names.length ? await caches.open(names[0]) : null;
        const count = cache ? (await cache.keys()).length : 0;
        if (count > 0 && count === previous) return true;
        previous = count;
        await new Promise((r) => setTimeout(r, 250));
      }
      return previous > 0;
    });

    if (!registered) {
      console.log('  ✗ no active service worker — features.offline is off, or /sw.js failed');
      report.routes.push({
        route: '(registration)',
        ok: false,
        problems: ['no active service worker'],
      });
      return report;
    }

    const cached = await page.evaluate(async () => {
      const names = await caches.keys();
      const cache = await caches.open(names[0]);
      return { name: names[0], entries: (await cache.keys()).length };
    });
    console.log(`  worker active, ${cached.entries} entries in ${cached.name}`);

    // 3. Cut the connection. From here nothing may reach the network.
    await context.setOffline(true);
    console.log('  offline');

    // 4 + 5. Every route, cold, then reloaded.
    for (const route of ROUTES) {
      const url = `${origin}${route}`;
      const failed = [];
      const onFailed = (request) => failed.push(new URL(request.url()).pathname);
      page.on('requestfailed', onFailed);
      try {
        const response = await page.goto(url, { waitUntil: 'load', timeout: 20_000 });
        const facts = await page.evaluate(inspectPage);

        // A client without `features.gallery` emits no /gallery at all, so the
        // offline 404 page is the correct answer there, not a failure.
        const isMissing = facts.h1 === "That page isn't here.";
        if (route === '/gallery' && isMissing) {
          console.log(`  ${route.padEnd(12)} not built for this client (404 served from cache) — ok`);
          report.routes.push({ route, ok: true, problems: [], skipped: 'route not built', ...facts });
          continue;
        }

        const outcome = assess(route, facts, failed);
        outcome.status = response ? response.status() : 0;

        // The reload catches a worker that only serves its registration page.
        await page.reload({ waitUntil: 'load', timeout: 20_000 });
        const again = await page.evaluate(inspectPage);
        if (!again.h1) outcome.problems.push('empty after reload'), (outcome.ok = false);

        report.routes.push(outcome);
        console.log(
          `  ${route.padEnd(12)} ${outcome.ok ? 'ok' : `FAIL — ${outcome.problems.join('; ')}`}`,
        );
      } catch (err) {
        report.routes.push({ route, ok: false, problems: [err.message.split('\n')[0]] });
        console.log(`  ${route.padEnd(12)} FAIL — ${err.message.split('\n')[0]}`);
      } finally {
        page.off('requestfailed', onFailed);
      }
    }

    // An unknown URL offline must land on the site's own 404, not the
    // browser's dinosaur.
    try {
      await page.goto(`${origin}${MISSING_ROUTE}`, { waitUntil: 'load', timeout: 20_000 });
      const facts = await page.evaluate(inspectPage);
      const ok = Boolean(facts.h1);
      report.routes.push({ route: MISSING_ROUTE, ok, problems: ok ? [] : ['no page rendered'], ...facts });
      console.log(`  ${'(unknown URL)'.padEnd(12)} ${ok ? 'ok — site 404 from cache' : 'FAIL'}`);
    } catch (err) {
      report.routes.push({ route: MISSING_ROUTE, ok: false, problems: [err.message.split('\n')[0]] });
      console.log(`  ${'(unknown URL)'.padEnd(12)} FAIL — ${err.message.split('\n')[0]}`);
    }

    report.ok = report.routes.every((r) => r.ok);
    return report;
  } finally {
    await context.close();
    await browser.close();
    if (server) await server.close();

    const outDir = pitchDirFor(slug);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, 'offline.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(`  → ${rel(join(outDir, 'offline.json'))}`);
  }
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }
  if (opts.help) {
    console.log(USAGE.trim());
    return;
  }

  const known = listClients();
  let slugs;
  if (opts.all) {
    if (opts.client) {
      console.error('Pass either --all or --client <slug>, not both.');
      process.exit(2);
    }
    if (opts.demo) {
      console.error('--demo names one site, so it cannot be used with --all.');
      process.exit(2);
    }
    slugs = known;
  } else if (opts.client) {
    slugs = [assertKnownClient(opts.client, known)];
  } else {
    console.error(`No client selected.${USAGE}\nKnown clients: ${known.join(', ')}`);
    process.exit(2);
  }

  const { chromium } = await loadPlaywright();
  const results = [];
  for (const slug of slugs) {
    try {
      results.push(await verifyOne(slug, opts, chromium));
    } catch (err) {
      console.error(`✗ ${slug}: ${err.message}`);
      results.push({ slug, ok: false, routes: [] });
    }
  }

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} demo(s) verified offline.`);
  for (const r of results) {
    if (r.ok) continue;
    const bad = r.routes.filter((route) => !route.ok).map((route) => route.route);
    console.error(`  ✗ ${r.slug}: ${bad.length ? bad.join(', ') : 'did not complete'}`);
  }
  if (passed !== results.length) process.exit(1);
}

await main();
