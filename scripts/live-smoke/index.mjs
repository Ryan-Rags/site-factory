#!/usr/bin/env node
/**
 * live-smoke — verify the deployed demos, not the artifacts that produced them.
 *
 *   pnpm smoke -- --client kh-machine-works
 *   pnpm smoke -- --all
 *   pnpm smoke -- --client kh-machine-works --demo https://somewhere-else.pages.dev
 *
 * `deploy:mockups` proves that `/` and `/services/` answered 200. That is a
 * liveness check, not a correctness check. Everything a prospect actually
 * experiences — whether the link they were sent unfurls with a picture, whether
 * the form they fill in reaches anyone, whether the page carries the policy the
 * build measured — is unverified the moment the artifact leaves `dist/`.
 *
 * Eight checks, all against the live response: routes and the designed 404,
 * security headers re-derived from the served pages, the demo lock, the social
 * card, the service worker, the form path, the customizer, and Lighthouse.
 *
 * Arg parsing mirrors `verify-offline.mjs` because that is the shape already in
 * the operator's fingers. Exit code is non-zero if any client fails any check,
 * a `not-deployed` client included.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { outreachDir, repoRoot } from '../pitch/paths.mjs';
import { assertSmokeable, listSmokeable, originFor } from './slugs.mjs';
import { renderBoard } from './board.mjs';
import { CHECK_ORDER } from './checks/index.mjs';
import { Politeness, hostOf, loadAudit, loadPlaywright, request } from './fleet.mjs';
import { openSession } from './browser.mjs';
import { renderReport } from './report.mjs';

import * as routesCheck from './checks/routes.mjs';
import * as headersCheck from './checks/headers.mjs';
import * as postureCheck from './checks/demo-posture.mjs';
import * as ogCheck from './checks/og.mjs';
import * as offlineCheck from './checks/offline.mjs';
import * as formCheck from './checks/form.mjs';
import * as customizerCheck from './checks/customizer.mjs';
import * as lighthouseCheck from './checks/lighthouse.mjs';

const USAGE = `
Usage:
  node scripts/live-smoke/index.mjs --client <slug> [--client <slug> ...] [--demo <url>]
  node scripts/live-smoke/index.mjs --all

Options:
  --client, -c <slug>  One demo; repeatable, so a sample runs under one
                       politeness ledger. Hand-authored clients and generated
                       prospect demos both. The origin comes from
                       prospects/<slug>/demo.json when there is one, and is
                       derived as https://<slug>-preview.pages.dev otherwise.
  --all                Every registered demo except the zz- fixtures — that is
                       clients/index.ts u prospects/known.json, which is
                       currently dozens of live sites. Expect a long run.
  --demo <url>         Override the origin. One --client only.
  --help, -h           This
`;

/**
 * Fixtures never deploy — the same exclusion `deploy-mockups.mjs` makes, for
 * the same reason and by the same prefix (ledger 2026-08-12). A `zz-` slug
 * reaching this suite would mean it reached a public URL.
 */
const FIXTURE_PREFIX = 'zz-';

/**
 * The one route the board does not photograph, so the customizer can afford to
 * sample every design family. See the ledger in `browser.mjs` and the loop that
 * reads this. `/about/` is the cheapest shot to lose: it is the only one of the
 * four carrying neither the form nor the service list.
 */
const BOARD_SHOT_SKIP = '/about/';

const rel = (p) => relative(repoRoot, p).split('\\').join('/');

function parseArgs(argv) {
  // `--client` accumulates. A sample of five under one run is one navigation
  // ledger and one report; five runs are five of each, and the ledger is how
  // this suite proves it kept to claude.md's rate limit.
  const opts = { all: false, clients: [], demo: null, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--') continue;
    else if (arg === '--all') opts.all = true;
    else if (arg === '--client' || arg === '-c') opts.clients.push(argv[++i]);
    else if (arg === '--demo') opts.demo = argv[++i];
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else throw new Error(`Unrecognised argument "${arg}".${USAGE}`);
  }
  return opts;
}

/** `2026-08-12T21-04-33Z`, safe as a directory name on every platform. */
const stamp = (date = new Date()) => date.toISOString().replace(/\.\d+Z$/, 'Z').replace(/:/g, '-');

/**
 * One client, start to finish.
 *
 * The fetch-based checks run first and collect the HTML every later check
 * reads, so the route fetches are spent once. The browser phase then runs in a
 * deliberate order: the service worker (which needs a cold context), then
 * Lighthouse, then the customizer. Lighthouse clears storage for the origin
 * before it audits, which would invalidate the service-worker assertions if it
 * ran first and — usefully — leaves the customizer with the clean slate
 * `check-switching.mjs` insists on, so a shared link is proved to be doing the
 * work rather than `localStorage` remembering.
 */
async function smokeOne(slug, origin, ctxBase) {
  const { politeness, chromium, audit, shotsDir, log } = ctxBase;
  log(`\n=== ${slug} ===\n  ${origin}`);

  const client = { slug, origin, status: 'pass', checks: [], findings: [], shots: [], reason: '' };

  // Reachability first. A registry slug whose project does not answer is a
  // finding of its own class, and fatal — see the report header.
  const probe = await request(`${origin}/`, { politeness });
  if (!probe.ok) {
    client.status = 'not-deployed';
    client.reason = probe.error
      ? `${origin}/ — ${probe.error}`
      : `${origin}/ answered HTTP ${probe.status}`;
    client.findings.push({
      class: 'not-deployed',
      detail: `${slug}: registered in clients/index.ts, but ${client.reason}`,
    });
    log(`  ✗ not deployed — ${client.reason}`);
    return client;
  }

  const ctx = { ...ctxBase, slug, origin, pages: new Map() };
  // `routes` re-fetches `/` so every page in `ctx.pages` came from the same
  // pass; the probe above is only ever a reachability question.
  ctx.pages.set('/', probe);

  /**
   * A check that throws is a failed check, not a failed client.
   *
   * The realistic thrower is the navigation budget: `acquire()` refuses past
   * ten per host, and the last check to run would otherwise take every earlier
   * result down with it — a client reported as one opaque error when seven
   * checks had already measured cleanly. The error becomes the check's own
   * failure, with its message, and everything measured before it survives.
   */
  const safely = async (name, title, fn) => {
    try {
      return await fn();
    } catch (err) {
      const detail = err.message.split('\n')[0];
      return {
        name,
        title,
        status: 'fail',
        assertions: [{ label: `${title} ran to completion`, ok: false, value: detail, expected: 'no error', note: '' }],
        findings: [{ class: 'suite-error', detail: `${slug}: ${title} threw — ${detail}` }],
        data: {},
      };
    }
  };

  const record = (result) => {
    client.checks.push(result);
    client.findings.push(...result.findings);
    log(
      `  ${result.status === 'pass' ? '✓' : result.status === 'fail' ? '✗' : '·'} ` +
        `${result.title}: ${result.status}` +
        (result.status === 'fail'
          ? ` — ${result.assertions.filter((a) => !a.ok).length} of ${result.assertions.length} assertions failed`
          : ''),
    );
    return result;
  };

  record(await safely('routes', 'Routes', () => routesCheck.run(ctx)));
  record(await safely('headers', 'Security headers', () => headersCheck.run(ctx)));
  record(await safely('posture', 'Demo posture', () => postureCheck.run(ctx)));
  record(await safely('og', 'og:image', () => ogCheck.run(ctx)));
  record(await safely('form', 'Form path', () => formCheck.run(ctx)));

  const session = await openSession({
    slug,
    origin,
    politeness,
    chromium,
    freePort: audit.freePort,
    shotsDir,
  });
  try {
    record(await safely('offline', 'Service worker', () => offlineCheck.run(ctx, session)));
    // The remaining board shots. `/` and `/services/` were visited by the
    // service-worker check and are already in `session.shots`.
    //
    // `/about/` is deliberately not among them. #44 took the design families
    // from three to five, so the customizer sample needs six navigations where
    // the ledger in `browser.mjs` budgeted four — one more than claude.md's ten
    // per site allows. The board loses the about shot; the customizer keeps
    // measuring every family it offers, which is the claim worth more. `/about/`
    // is still fetched and asserted by the routes check, so nothing goes
    // unchecked — only unphotographed.
    for (const route of ctx.pages.keys()) {
      if (route === '/' || route === '/services/' || route === BOARD_SHOT_SKIP) continue;
      await session.visit(route);
    }
    record(await safely('lighthouse', 'Lighthouse', () => lighthouseCheck.run(ctx, session, audit)));
    record(await safely('customizer', 'Customizer', () => customizerCheck.run(ctx, session)));
  } finally {
    client.shots = session.shots;
    await session.close();
  }

  client.status = client.checks.some((c) => c.status === 'fail' || c.status === 'unavailable')
    ? 'fail'
    : 'pass';
  return client;
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

  const known = listSmokeable({ fixturePrefix: FIXTURE_PREFIX });
  let slugs;
  if (opts.all) {
    if (opts.clients.length > 0) {
      console.error('Pass either --all or --client <slug>, not both.');
      process.exit(2);
    }
    if (opts.demo) {
      console.error('--demo names one site, so it cannot be used with --all.');
      process.exit(2);
    }
    slugs = known.map((entry) => entry.slug);
  } else if (opts.clients.length > 0) {
    if (opts.demo && opts.clients.length > 1) {
      console.error('--demo overrides one origin, so it cannot be used with several --client flags.');
      process.exit(2);
    }
    try {
      slugs = opts.clients.map((slug) => assertSmokeable(slug, known).slug);
    } catch (err) {
      console.error(err.message);
      process.exit(2);
    }
  } else {
    console.error(
      `No demo selected.${USAGE}\n${known.length} known: ` +
        `${known.filter((e) => e.from === 'clients/index.ts').length} in clients/index.ts, ` +
        `${known.filter((e) => e.from !== 'clients/index.ts').length} in prospects/known.json.`,
    );
    process.exit(2);
  }

  const startedAt = new Date();
  const outDir = join(outreachDir, 'smoke', stamp(startedAt));
  const shotsDir = join(outDir, 'shots');
  mkdirSync(shotsDir, { recursive: true });

  const audit = await loadAudit();
  const { chromium } = await loadPlaywright();
  const politeness = new Politeness(audit.NavigationBudget);
  const log = (msg) => console.log(msg);

  const clients = [];
  for (const slug of slugs) {
    /*
     * The origin is read from the deploy's own manifest where there is one.
     * Deriving `https://<slug>-preview.pages.dev` is right for every demo whose
     * Pages project name was not substituted, and wrong — silently, reported as
     * "not deployed" — for the one whose was. See `slugs.mjs` and
     * known-issues #13.
     */
    const resolved = opts.demo
      ? { origin: opts.demo.replace(/\/+$/, ''), source: '--demo' }
      : originFor(slug);
    const origin = resolved.origin;
    log(`  origin: ${origin}  (${resolved.source})`);
    try {
      clients.push(await smokeOne(slug, origin, { politeness, chromium, audit, shotsDir, log }));
    } catch (err) {
      // A check that throws is a failure of this suite, and is reported as one
      // rather than swallowed into a green.
      console.error(`  ✗ ${slug}: the suite errored — ${err.message.split('\n')[0]}`);
      clients.push({
        slug,
        origin,
        status: 'fail',
        checks: [],
        shots: [],
        reason: err.message.split('\n')[0],
        findings: [{ class: 'suite-error', detail: `${slug}: live-smoke threw — ${err.message.split('\n')[0]}` }],
      });
    }
  }

  const run = {
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    clients,
    ledger: politeness.ledger(),
    failing: clients.filter((c) => c.status !== 'pass').length,
    ok: clients.every((c) => c.status === 'pass'),
    checkOrder: CHECK_ORDER,
  };

  writeFileSync(join(outDir, 'report.md'), renderReport(run), 'utf8');
  writeFileSync(join(outDir, 'board.html'), renderBoard(run), 'utf8');
  writeFileSync(join(outDir, 'report.json'), `${JSON.stringify(run, null, 2)}\n`, 'utf8');

  console.log(`\n${clients.length - run.failing}/${clients.length} demo(s) passed every check.`);
  for (const c of clients) {
    if (c.status === 'pass') continue;
    const bad = c.checks.filter((k) => k.status === 'fail' || k.status === 'unavailable').map((k) => k.name);
    console.error(`  ✗ ${c.slug}: ${c.status === 'not-deployed' ? 'not deployed' : bad.join(', ') || c.reason}`);
  }
  console.log(`\n  → ${rel(join(outDir, 'report.md'))}`);
  console.log(`  → ${rel(join(outDir, 'board.html'))}`);

  for (const row of run.ledger) {
    console.log(
      `  ${row.host}: ${row.navigations}/${row.maxPerHost} navigations, ${row.probes} probes` +
        (row.minNavGapMs === null ? '' : `, min gap ${row.minNavGapMs} ms`),
    );
  }

  if (!run.ok) process.exit(1);
}

await main();
