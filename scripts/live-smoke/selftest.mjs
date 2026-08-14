#!/usr/bin/env node
/**
 * Proves the suite can fail.
 *
 *   pnpm smoke:selftest
 *
 * Green is only information if red is reachable. Every check here is run twice:
 * once against a healthy fixture, which must pass, and once against a fixture
 * broken in exactly one named way, which must fail *on the assertion that names
 * the defect* — not merely somewhere. A check that went red for the wrong
 * reason would still be a check that cannot be trusted to be right.
 *
 * Two of the eight are unit cases rather than served ones. The Lighthouse
 * known-issue rule is a decision about an LHR's shape, so it is exercised
 * against LHRs of that shape; standing up a real Lighthouse run whose LCP audit
 * fails on demand would test Chrome, not the rule.
 *
 * The fixture is a local process on 127.0.0.1, so the crawl limit — which
 * exists for hosts we do not own — is set aside here and only here. The live
 * suite's own intervals are asserted in the run it prints.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Politeness, loadAudit, loadPlaywright, request } from './fleet.mjs';
import { openSession } from './browser.mjs';
import { FIXTURE_SLUG, serveFixture, serveWorkerStub } from './fixture.mjs';

import * as routesCheck from './checks/routes.mjs';
import * as headersCheck from './checks/headers.mjs';
import * as postureCheck from './checks/demo-posture.mjs';
import * as ogCheck from './checks/og.mjs';
import * as offlineCheck from './checks/offline.mjs';
import * as formCheck from './checks/form.mjs';
import * as customizerCheck from './checks/customizer.mjs';
import { isKnownNoLcp, noLcpWaiverStands } from './checks/lighthouse.mjs';

let failures = 0;
let cases = 0;

function ok(label, condition, detail = '') {
  cases += 1;
  if (condition) {
    console.log(`  ✓ ${label}`);
    return true;
  }
  failures += 1;
  console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  return false;
}

/** The fixture is local; the crawl limit is for hosts we do not own. */
const localPoliteness = (NavigationBudget) =>
  new Politeness(NavigationBudget, { probeIntervalMs: 0, navIntervalMs: 0, maxPerHost: 200 });

async function contextFor(origin, audit) {
  const ctx = {
    slug: FIXTURE_SLUG,
    origin,
    politeness: localPoliteness(audit.NavigationBudget),
    pages: new Map(),
  };
  const home = await request(`${origin}/`, { politeness: ctx.politeness });
  ctx.pages.set('/', home);
  return ctx;
}

/** Did the check fail, and did it fail on an assertion whose label matches? */
function failedOn(result, pattern) {
  if (result.status !== 'fail' && result.status !== 'unavailable') return false;
  if (result.status === 'unavailable') return pattern.test(result.reason ?? '');
  return result.assertions.some((a) => !a.ok && pattern.test(a.label));
}

const findingClasses = (result) => result.findings.map((f) => f.class);

async function withFixture(options, fn) {
  const site = await serveFixture(options);
  try {
    return await fn(site);
  } finally {
    await site.close();
  }
}

async function main() {
  const audit = await loadAudit();

  /* ---------------------------------------------------------------- routes */

  console.log('\nroutes');
  await withFixture({}, async (site) => {
    const ctx = await contextFor(site.origin, audit);
    const result = await routesCheck.run(ctx);
    ok('a healthy fixture passes', result.status === 'pass', JSON.stringify(result.assertions.filter((a) => !a.ok)));
  });
  await withFixture({ aboutStatus: 500 }, async (site) => {
    const ctx = await contextFor(site.origin, audit);
    const result = await routesCheck.run(ctx);
    ok('a 500 on /about/ fails', failedOn(result, /^\/about\/ status$/));
  });
  await withFixture({ genericNotFound: true }, async (site) => {
    const ctx = await contextFor(site.origin, audit);
    const result = await routesCheck.run(ctx);
    ok("a host's generic 404 fails", failedOn(result, /template's own 404 page/));
  });

  /* --------------------------------------------------------------- headers */

  console.log('\nheaders');
  await withFixture({}, async (site) => {
    const ctx = await contextFor(site.origin, audit);
    await routesCheck.run(ctx);
    const result = await headersCheck.run(ctx);
    ok('a healthy fixture passes', result.status === 'pass', JSON.stringify(result.assertions.filter((a) => !a.ok)));
  });
  await withFixture({ headers: false }, async (site) => {
    const ctx = await contextFor(site.origin, audit);
    await routesCheck.run(ctx);
    const result = await headersCheck.run(ctx);
    ok('no _headers fails', failedOn(result, /content-security-policy/));
    // The point of §3.2: the two headers Pages supplies must not be counted as
    // ours, or a CSP-less site scores 2/4 and reads as mostly fine.
    ok(
      'the two platform headers are labelled, not credited',
      result.data.provenance['x-content-type-options'].startsWith('platform (inferred'),
      result.data.provenance['x-content-type-options'],
    );
    ok(
      'x-frame-options is absent, not platform-supplied',
      result.data.provenance['x-frame-options'] === 'absent',
      result.data.provenance['x-frame-options'],
    );
  });

  /* --------------------------------------------------------------- posture */

  console.log('\ndemo posture');
  await withFixture({}, async (site) => {
    const ctx = await contextFor(site.origin, audit);
    await routesCheck.run(ctx);
    const result = await postureCheck.run(ctx);
    ok('a healthy fixture passes', result.status === 'pass', JSON.stringify(result.assertions.filter((a) => !a.ok)));
  });
  await withFixture({ noindex: false, robotsDisallow: false, sitemap: true }, async (site) => {
    const ctx = await contextFor(site.origin, audit);
    await routesCheck.run(ctx);
    const result = await postureCheck.run(ctx);
    ok('an indexable page fails', failedOn(result, /meta robots/));
    ok('a permissive robots.txt fails', failedOn(result, /robots\.txt/));
    ok('a sitemap present fails', failedOn(result, /sitemap-index\.xml/));
  });

  /* -------------------------------------------------------------- og:image */

  console.log('\nog:image');
  await withFixture({}, async (site) => {
    const ctx = await contextFor(site.origin, audit);
    const result = await ogCheck.run(ctx);
    ok('a healthy fixture passes', result.status === 'pass', JSON.stringify(result.assertions.filter((a) => !a.ok)));
  });
  await withFixture({ og: 'missing' }, async (site) => {
    const ctx = await contextFor(site.origin, audit);
    const result = await ogCheck.run(ctx);
    ok('a 404 card fails', failedOn(result, /reachable/));
  });
  await withFixture({ og: 'svg' }, async (site) => {
    const ctx = await contextFor(site.origin, audit);
    const result = await ogCheck.run(ctx);
    // The defect the ledger records: every platform declines an SVG card, and a
    // Content-Type of image/png does not make one a PNG.
    ok('an SVG served as image/png fails', failedOn(result, /bytes are a PNG/));
  });
  await withFixture({ og: 'small' }, async (site) => {
    const ctx = await contextFor(site.origin, audit);
    const result = await ogCheck.run(ctx);
    ok('a 600×315 card fails', failedOn(result, /dimensions/));
  });
  await withFixture({ og: 'off-origin' }, async (site) => {
    const ctx = await contextFor(site.origin, audit);
    const result = await ogCheck.run(ctx);
    ok('a card advertised on a host we do not serve fails', failedOn(result, /advertised on the origin/));
    ok(
      'and it is reported as og-image-origin, not as a broken asset',
      findingClasses(result).includes('og-image-origin'),
      findingClasses(result).join(', '),
    );
  });

  /* ------------------------------------------------------------------ form */

  console.log('\nform path');
  /*
   * The stub is told to allow the fixture's own `http://127.0.0.1` origin,
   * because the fixture cannot be served over https and the live Worker's
   * allowlist is `https` + `*.pages.dev`. What is under test here is the
   * check's reading of a CORS answer, not the allowlist itself — the allowlist
   * has its own unit tests next door, and its dot-boundary rule is the one case
   * reproduced below.
   */
  for (const [label, mode, allowThisSite, expectPass, pattern] of [
    ['a Worker that answers correctly passes', 'strict', true, true, null],
    ['an endpoint that refuses this origin fails', 'strict', false, false, /Access-Control-Allow-Origin echoes/],
    ['a substring origin allowlist fails the dot-boundary case', 'loose', true, false, /suffix-lookalike origin/],
  ]) {
    const worker = await serveWorkerStub({ mode });
    await withFixture({ endpoint: worker.origin }, async (site) => {
      if (allowThisSite) worker.allow(site.origin);
      const ctx = await contextFor(site.origin, audit);
      await routesCheck.run(ctx);
      const result = await formCheck.run(ctx);
      ok(
        label,
        expectPass ? result.status === 'pass' : failedOn(result, pattern),
        JSON.stringify(result.assertions.filter((a) => !a.ok)),
      );
    });
    await worker.close();
  }
  await withFixture({ endpoint: null }, async (site) => {
    const ctx = await contextFor(site.origin, audit);
    await routesCheck.run(ctx);
    const result = await formCheck.run(ctx);
    ok('a contact page that posts nowhere fails', failedOn(result, /carries a form endpoint/));
  });

  /* --------------------------------------------------------------- browser */

  const { chromium } = await loadPlaywright();
  const shotsDir = mkdtempSync(join(tmpdir(), 'live-smoke-selftest-'));

  console.log('\nservice worker');
  for (const [label, options, pattern, expectPass] of [
    ['a healthy fixture passes', {}, null, true],
    ['a registration whose /sw.js 404s fails', { worker: 'broken' }, /active/, false],
    ['a build with no registration at all fails', { worker: 'none' }, /registers a service worker/, false],
  ]) {
    await withFixture(options, async (site) => {
      const ctx = await contextFor(site.origin, audit);
      await routesCheck.run(ctx);
      const session = await openSession({
        slug: FIXTURE_SLUG,
        origin: site.origin,
        politeness: ctx.politeness,
        chromium,
        freePort: audit.freePort,
        shotsDir,
      });
      try {
        const result = await offlineCheck.run(ctx, session);
        ok(label, expectPass ? result.status === 'pass' : failedOn(result, pattern), JSON.stringify(result.assertions.filter((a) => !a.ok)));
      } finally {
        await session.close();
      }
    });
  }

  console.log('\ncustomizer');
  for (const [label, options, pattern, expectPass] of [
    ['a fixture that resolves passes', {}, null, true],
    ['a fixture that stamps the URL verbatim fails', { customizer: 'stamps' }, /invented accent|painted cell/, false],
  ]) {
    await withFixture(options, async (site) => {
      const ctx = await contextFor(site.origin, audit);
      await routesCheck.run(ctx);
      const session = await openSession({
        slug: FIXTURE_SLUG,
        origin: site.origin,
        politeness: ctx.politeness,
        chromium,
        freePort: audit.freePort,
        shotsDir,
      });
      try {
        const result = await customizerCheck.run(ctx, session);
        ok(label, expectPass ? result.status === 'pass' : failedOn(result, pattern), JSON.stringify(result.assertions.filter((a) => !a.ok)));
      } finally {
        await session.close();
      }
    });
  }

  /*
   * Budget exhaustion mid-sample.
   *
   * The realistic thrower, and the one this suite met live: #44 took the design
   * families from three to five, so the sample needs six navigations where the
   * ledger in `browser.mjs` had budgeted four. The check ran out on its last
   * cell and threw — and because the throw left `run()`, every assertion it had
   * already collected went with it, turning twenty-five measured results into
   * one opaque "Customizer threw". The cells that WERE measured are real
   * measurements and must survive; what must not happen is an unmeasured cell
   * being reported as a good one.
   *
   * The fixture is local, so the budget here is set deliberately low rather
   * than being the real ten — the point is the boundary, not the number.
   */
  await withFixture({}, async (site) => {
    const ctx = await contextFor(site.origin, audit);
    const cells = customizerCheck.sampleCells().length;
    // One short of the sample: every cell but the last can navigate.
    ctx.politeness = new Politeness(audit.NavigationBudget, {
      probeIntervalMs: 0,
      navIntervalMs: 0,
      maxPerHost: cells - 1,
    });
    await routesCheck.run(ctx);
    const session = await openSession({
      slug: FIXTURE_SLUG,
      origin: site.origin,
      politeness: ctx.politeness,
      chromium,
      freePort: audit.freePort,
      shotsDir,
    });
    try {
      let threw = null;
      let result = null;
      try {
        result = await customizerCheck.run(ctx, session);
      } catch (err) {
        threw = err;
      }
      ok(
        'running out of budget keeps the cells already measured',
        threw === null && result !== null && result.assertions.length > 1,
        threw ? `threw: ${threw.message.split('\n')[0]}` : `assertions=${result?.assertions.length}`,
      );
      ok(
        'running out of budget is reported, never a silent pass',
        result !== null && result.status !== 'pass',
        result ? `status=${result.status}` : 'no result',
      );
    } finally {
      await session.close();
    }
  });
  rmSync(shotsDir, { recursive: true, force: true });

  /* ------------------------------------------------- the known-issue rule */

  console.log('\nlighthouse known-issue rule');
  const scored = (id) => ({ id, score: 1 });
  const knownLhr = {
    audits: {
      'largest-contentful-paint': { errorMessage: 'NO_LCP: The page did not display content...' },
      'first-contentful-paint': scored('first-contentful-paint'),
      'speed-index': scored('speed-index'),
      'total-blocking-time': scored('total-blocking-time'),
      'cumulative-layout-shift': scored('cumulative-layout-shift'),
    },
    categories: {
      performance: {
        auditRefs: [
          { id: 'largest-contentful-paint', weight: 25 },
          { id: 'first-contentful-paint', weight: 10 },
          { id: 'speed-index', weight: 10 },
          { id: 'total-blocking-time', weight: 30 },
          { id: 'cumulative-layout-shift', weight: 25 },
        ],
      },
    },
  };
  ok('known-issues #2\'s signature is allowed', isKnownNoLcp(knownLhr).known);

  /*
   * The widened fingerprint, from both sides. PR #24 measured `NO_LCP` and
   * `total-blocking-time` unscored *together* on five of five red clients, and
   * authorised accepting exactly that pair — so the companion is allowed only
   * in `NO_LCP`'s company, and only alone. The refusals below are the boundary
   * either side of it; none of them follows from the allowed case.
   */
  const tbtWithNoLcp = JSON.parse(JSON.stringify(knownLhr));
  tbtWithNoLcp.audits['total-blocking-time'] = { errorMessage: 'LanternError: NO_LCP' };
  ok(
    'total-blocking-time unscored alongside NO_LCP IS allowed',
    isKnownNoLcp(tbtWithNoLcp).known,
    isKnownNoLcp(tbtWithNoLcp).reason,
  );

  const tbtAlone = JSON.parse(JSON.stringify(tbtWithNoLcp));
  tbtAlone.audits['largest-contentful-paint'] = { errorMessage: 'PROTOCOL_TIMEOUT' };
  ok(
    'total-blocking-time unscored WITHOUT NO_LCP is NOT allowed',
    isKnownNoLcp(tbtAlone).known === false,
    isKnownNoLcp(tbtAlone).reason,
  );

  const otherAudit = JSON.parse(JSON.stringify(knownLhr));
  otherAudit.audits['speed-index'] = { errorMessage: 'something else went wrong' };
  ok(
    'a different weighted audit unscored alongside NO_LCP is NOT allowed',
    isKnownNoLcp(otherAudit).known === false,
    isKnownNoLcp(otherAudit).reason,
  );

  // The waiver is for one companion, not for "TBT plus whatever else". Without
  // this case a rule that merely looked for total-blocking-time *somewhere* in
  // the unscored list would pass every case above while waiving a broken run.
  const tbtAndAThird = JSON.parse(JSON.stringify(tbtWithNoLcp));
  tbtAndAThird.audits['speed-index'] = { errorMessage: 'something else went wrong' };
  ok(
    'total-blocking-time plus a third unscored audit is NOT allowed',
    isKnownNoLcp(tbtAndAThird).known === false,
    isKnownNoLcp(tbtAndAThird).reason,
  );

  const otherCause = JSON.parse(JSON.stringify(knownLhr));
  otherCause.audits['largest-contentful-paint'] = { errorMessage: 'PROTOCOL_TIMEOUT' };
  ok(
    'an absent performance score from another cause is NOT allowed',
    isKnownNoLcp(otherCause).known === false,
    isKnownNoLcp(otherCause).reason,
  );
  ok('a missing LHR is NOT allowed', isKnownNoLcp(undefined).known === false);

  const tmp = mkdtempSync(join(tmpdir(), 'live-smoke-issues-'));
  const withEntry = join(tmp, 'with.md');
  const without = join(tmp, 'without.md');
  writeFileSync(withEntry, '## 2. Lighthouse reports `NO_LCP` ...\n', 'utf8');
  writeFileSync(without, '## 2. something else entirely\n', 'utf8');
  ok('the waiver stands while known-issues.md carries the entry', noLcpWaiverStands(withEntry));
  ok(
    'the waiver is refused once the entry is gone',
    noLcpWaiverStands(without) === false,
  );
  ok('the waiver is refused if the file is missing', noLcpWaiverStands(join(tmp, 'nope.md')) === false);
  rmSync(tmp, { recursive: true, force: true });

  console.log(
    `\n${cases - failures}/${cases} self-test case(s) passed.` +
      (failures === 0 ? ' Every check is proved to fail as well as pass.' : ''),
  );
  if (failures > 0) process.exit(1);
}

await main();
