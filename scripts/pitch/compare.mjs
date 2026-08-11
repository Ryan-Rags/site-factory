#!/usr/bin/env node
/**
 * pitch — the before/after Lighthouse comparison that opens the conversation.
 *
 *   pnpm pitch -- --client kts-machine-shop
 *   pnpm pitch -- --client kh-machine-works --demo https://kh-preview.pages.dev
 *   pnpm pitch:all
 *
 * For each prospect it writes into `outreach/<slug>/pitch/` (gitignored):
 *
 *   headline.txt        "Your site: 38/100. New site: 96/100."
 *   scores.json         both runs, all four categories, every failure recorded
 *   pitch-card.html     one self-contained page to hold up on a phone
 *   live-mobile.png     their current homepage
 *   demo-mobile.png     the new one, same viewport
 *
 * Rules this script is held to:
 *
 *   - The prospect's site is visited read-only, GET only, through
 *     `packages/audit`'s NavigationBudget: at most one page navigation per
 *     second per domain and ten per site (claude.md). A Lighthouse run counts
 *     as one navigation. This script uses two: the screenshot and the audit.
 *   - A number that could not be measured is written as `null` and rendered as
 *     "unavailable". It is never defaulted to 0 — a 0 is a claim about
 *     somebody's business, and an unfinished run is not evidence for it.
 *   - Lighthouse runs against both sites with identical settings, from
 *     `packages/audit/src/lighthouse.ts`. Two numbers produced differently are
 *     not a comparison.
 *   - `--local` is for checking the plumbing, not for producing a pitch. A
 *     build served from 127.0.0.1 has no network in front of it and scores
 *     near 100 whatever it contains, while the prospect's site is measured
 *     across the internet. Run against the deployed demo for a real number.
 */
import { createServer } from 'node:net';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

import { assertKnownClient, listClients } from '../mockup/clients.mjs';
import { serveDir } from '../mockup/serve.mjs';
import { headline, pitchCard } from './render.mjs';
import {
  businessNameFor,
  currentSiteUrlFor,
  defaultDemoUrl,
  distDirFor,
  pitchDirFor,
  repoRoot,
} from './paths.mjs';

const USAGE = `
Usage:
  node scripts/pitch/compare.mjs --client <slug> [options]
  node scripts/pitch/compare.mjs --all [options]

Options:
  --demo <url>    The new site's URL. Default https://<slug>-preview.pages.dev
  --live <url>    The prospect's current site. Default: read from their config
  --local         Build nothing; serve packages/template/dist/<slug> and audit
                  that instead of a deployed demo. Use before you have deployed
  --no-live       Skip the prospect's site entirely (audit the demo only)
`;

/** The phone viewport `packages/audit/src/probe.ts` shoots "before" shots at. */
const MOBILE = { width: 390, height: 844 };

function parseArgs(argv) {
  const opts = { all: false, client: null, demo: null, live: null, local: false, live_: true };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--') continue;
    else if (arg === '--all') opts.all = true;
    else if (arg === '--local') opts.local = true;
    else if (arg === '--no-live') opts.live_ = false;
    else if (arg === '--client' || arg === '-c') opts.client = argv[++i];
    else if (arg === '--demo') opts.demo = argv[++i];
    else if (arg === '--live') opts.live = argv[++i];
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else throw new Error(`Unrecognised argument "${arg}".${USAGE}`);
  }
  return opts;
}

const rel = (p) => relative(repoRoot, p).split('\\').join('/');

/** An ephemeral port for Chromium's CDP endpoint, so parallel runs cannot clash. */
function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

/**
 * Borrow `@site-factory/audit`'s built output rather than re-implementing the
 * Lighthouse call. The settings there — four categories, Moto G4 emulation,
 * simulated throttling — are what makes the two sides comparable, and a second
 * copy of them would drift.
 */
async function loadAudit() {
  const dist = join(repoRoot, 'packages', 'audit', 'dist', 'index.js');
  try {
    return await import(pathToFileURL(dist).href);
  } catch (err) {
    throw new Error(
      `Could not load packages/audit/dist. Run \`pnpm -r build\` first.\n${err.message}`,
    );
  }
}

/** Playwright lives in packages/audit's tree; pnpm does not hoist it. */
async function loadPlaywright() {
  const require = createRequire(join(repoRoot, 'packages', 'audit', 'package.json'));
  const mod = await import(pathToFileURL(require.resolve('playwright')).href);
  return mod.chromium ? mod : mod.default;
}

const hostOf = (url) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

/**
 * Screenshot + Lighthouse for one URL. Two navigations, both budgeted.
 *
 * Returns a side object. `scores: null` with a populated `error` is a normal
 * outcome — an unreachable site is a fact about the prospect, not a crash.
 */
async function measure({ url, browser, port, budget, shotPath, audit, label }) {
  const side = { url, status: 'ok', scores: null, error: '', screenshot: null, noindex: false };
  const host = hostOf(url);

  process.stdout.write(`  ${label}: screenshot ... `);
  const context = await browser.newContext({ viewport: { ...MOBILE }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  try {
    await budget.acquire(host);
    /*
     * `load`, not `networkidle`, and the same 45s budget `packages/audit`'s
     * probe uses. A neglected site — the kind this whole pipeline is aimed at —
     * frequently never reaches network idle at all: a chat widget or an ad
     * script keeps a connection open indefinitely. Waiting for idle reported
     * "would not load" for a site that loads fine, which overstates our side
     * of the comparison. That is the one direction this must never be wrong in.
     */
    await page.goto(url, { waitUntil: 'load', timeout: 45_000 });
    // Best-effort settle for late images. Failure here is not a failure to
    // load, so it is swallowed deliberately.
    await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {});
    // Images below the fold are lazy; a full-page shot would capture empty
    // boxes without scrolling through first.
    await page.evaluate(async () => {
      const step = window.innerHeight;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {});

    /*
     * Our own demos ship with `seo.noindex: true` — the mockup lock that keeps
     * an unapproved site out of search results. Lighthouse scores that as an
     * SEO failure, so the new site can show a *worse* SEO number than the
     * prospect's. The flag is a deliberate temporary state, not a property of
     * the finished site, and the card has to say so: a comparison that quietly
     * misrepresents either side is worthless, and this one misrepresents ours.
     */
    side.noindex = await page.evaluate(() => {
      const meta = document.querySelector('meta[name="robots"]');
      return meta ? /noindex/i.test(meta.getAttribute('content') ?? '') : false;
    });

    await page.screenshot({ path: shotPath, fullPage: true });
    side.screenshot = shotPath.split(/[\\/]/).pop();
    console.log('ok');
  } catch (err) {
    side.status = 'unreachable';
    side.error = err.message.split('\n')[0];
    console.log(`unreachable (${side.error})`);
  } finally {
    await context.close();
  }

  if (side.status === 'unreachable') return side;

  process.stdout.write(`  ${label}: lighthouse ... `);
  await budget.acquire(host);
  const outcome = await audit.runLighthouse(url, port);
  if (outcome.scores) {
    side.scores = outcome.scores;
    console.log(
      `perf ${outcome.scores.performance ?? 'n/a'} a11y ${outcome.scores.accessibility ?? 'n/a'}`,
    );
  } else {
    side.error = outcome.error;
    console.log(`unavailable (${outcome.error})`);
  }
  return side;
}

async function compareOne(slug, opts, ctx) {
  console.log(`\n=== ${slug} ===`);

  const outDir = pitchDirFor(slug);
  mkdirSync(outDir, { recursive: true });

  // The prospect's current site. `null` means they have none — the strongest
  // case there is, and the one this must not report as a failure.
  const liveUrl = opts.live ?? currentSiteUrlFor(slug);

  let demoUrl = opts.demo ?? defaultDemoUrl(slug);
  let server = null;
  if (opts.local && !opts.demo) {
    server = await serveDir(distDirFor(slug));
    demoUrl = server.origin;
    console.log(`  serving ${rel(distDirFor(slug))} at ${demoUrl}`);
    /*
     * Said out loud every time, because it is the one number in here that can
     * mislead in our favour: a site served from 127.0.0.1 has no network
     * between it and the browser and scores near 100 almost regardless of how
     * it was built. Their site is being measured across the internet. Use a
     * deployed demo URL for anything a prospect will actually be shown.
     */
    console.log('  NOTE: --local removes the network from our side. Not a fair pitch number.');
  }

  const result = {
    slug,
    name: businessNameFor(slug) ?? slug,
    measuredAt: new Date().toISOString(),
    live: { url: liveUrl, status: 'no-site', scores: null, error: '', screenshot: null },
    demo: { url: demoUrl, status: 'ok', scores: null, error: '', screenshot: null },
  };

  try {
    if (liveUrl && opts.live_) {
      result.live = await measure({
        url: liveUrl,
        browser: ctx.browser,
        port: ctx.port,
        budget: new ctx.audit.NavigationBudget(),
        shotPath: join(outDir, 'live-mobile.png'),
        audit: ctx.audit,
        label: 'current site',
      });
    } else if (liveUrl && !opts.live_) {
      result.live = { url: liveUrl, status: 'skipped', scores: null, error: '--no-live', screenshot: null };
      console.log('  current site: skipped (--no-live)');
    } else {
      console.log('  current site: none on file — the "before" half is "no website"');
    }

    // Our own demo is not a third party, but it gets the same budget object
    // shape so the two sides are measured through identical machinery.
    result.demo = await measure({
      url: demoUrl,
      browser: ctx.browser,
      port: ctx.port,
      budget: new ctx.audit.NavigationBudget(),
      shotPath: join(outDir, 'demo-mobile.png'),
      audit: ctx.audit,
      label: 'new site',
    });
  } finally {
    if (server) await server.close();
  }

  result.headline = headline(result);

  writeFileSync(join(outDir, 'scores.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  writeFileSync(join(outDir, 'headline.txt'), `${result.headline}\n`, 'utf8');
  writeFileSync(join(outDir, 'pitch-card.html'), pitchCard(result), 'utf8');

  console.log(`  → ${rel(outDir)}/`);
  console.log(`  ${result.headline}`);
  return result;
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
    if (opts.demo || opts.live) {
      console.error('--demo and --live name one site, so they cannot be used with --all.');
      process.exit(2);
    }
    slugs = known;
  } else if (opts.client) {
    slugs = [assertKnownClient(opts.client, known)];
  } else {
    console.error(`No client selected.${USAGE}\nKnown clients: ${known.join(', ')}`);
    process.exit(2);
  }

  const audit = await loadAudit();
  const { chromium } = await loadPlaywright();
  const port = await freePort();
  const browser = await chromium.launch({ args: [`--remote-debugging-port=${port}`] });

  const failures = [];
  const lines = [];
  try {
    for (const slug of slugs) {
      try {
        const result = await compareOne(slug, opts, { browser, port, audit });
        lines.push(`${slug}: ${result.headline}`);
      } catch (err) {
        console.error(`✗ ${slug}: ${err.message}`);
        failures.push(slug);
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`\n${slugs.length - failures.length}/${slugs.length} comparisons written.`);
  for (const line of lines) console.log(`  ${line}`);
  if (failures.length > 0) {
    console.error(`failed: ${failures.join(', ')}`);
    process.exit(1);
  }
}

await main();
