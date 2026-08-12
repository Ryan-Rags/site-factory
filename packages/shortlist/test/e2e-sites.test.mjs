import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { after, before, describe, test } from 'node:test';

import { chromium } from 'playwright';

import {
  assess,
  histogram,
  renderHistogram,
  renderStatusTally,
  renderTop,
  toScoredRow,
} from '../dist/index.js';

import { startSites } from './fixtures/site-server.mjs';

/**
 * The post-Places path, end to end, against real pages over a real browser.
 *
 * Everything upstream of this — the sweep, the field mask, the meter — is
 * covered by `sweep.test.mjs` and `usage.test.mjs` against a stubbed fetch.
 * Everything downstream is covered as pure functions. This is the seam
 * between: navigation, DOM reading, classification, the audit, and the score
 * that comes out the other end.
 *
 * It exists because the county dry run could not exercise it. Every fixture
 * URL there was `*.example.com`, which does not resolve, so all 2,422 rows
 * classified `dead` and zero audits ran — the live band, the audit cap, the
 * ordering heuristic and `parked` detection were unit-tested only.
 *
 * ZERO network egress: everything is loopback, and no Places call happens
 * anywhere in this file.
 */

/** A free TCP port for Chromium's remote debugging, which Lighthouse attaches to. */
const freePort = () =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });

const sweepResult = (over = {}) => ({
  placeId: `fixture-${over.key ?? 'x'}`,
  name: over.name ?? 'Fixture Business',
  nicheSlug: 'machine-shop',
  nicheLabel: 'machine shop',
  town: 'Lodi',
  address: '1 Fixture Way, Lodi, NJ',
  phone: '(201) 555-0100',
  website: '',
  types: [],
  rating: '4.5',
  reviewCount: '80',
  copyPack: 'machine-shop',
  seenIn: ['machine-shop/Lodi'],
  ...over,
});

describe('post-Places path against served fixture sites', () => {
  let sites;
  let browser;
  let debugPort;
  let outcome;
  let byKey;

  before(async () => {
    sites = await startSites();
    debugPort = await freePort();
    // Launched exactly as packages/audit's own CLI does. Lighthouse attaches
    // over the DevTools protocol, so the port must be opened at launch — a
    // browser started without it makes every Lighthouse-derived check read
    // `unavailable`, silently and without an error.
    browser = await chromium.launch({ args: [`--remote-debugging-port=${debugPort}`] });

    outcome = await assess({
      results: [
        sweepResult({ key: 'healthy', name: 'Fixture Precision Works', website: sites.urls['live-healthy'] }),
        sweepResult({ key: 'neglected', name: 'Fixture Heritage Welding', website: sites.urls['live-neglected'] }),
        sweepResult({ key: 'parked', name: 'Fixture Parked Domain', website: sites.urls['parked'] }),
        sweepResult({ key: 'dead404', name: 'Fixture Gone Away', website: sites.urls['dead-404'] }),
        sweepResult({ key: 'refused', name: 'Fixture Never Answered', website: sites.urls['refused'] }),
        sweepResult({ key: 'nosite', name: 'Fixture No Website', website: '' }),
      ],
      browser,
      debugPort,
      auditCap: 0,
      dataDirOverride: 'test/fixtures/no-such-dir',
      now: new Date('2026-08-12T12:00:00Z'),
    });
    byKey = new Map(outcome.assessments.map((a) => [a.result.placeId.replace('fixture-', ''), a]));
  });

  after(async () => {
    await browser?.close();
    await sites?.close();
  });

  // --- classification ------------------------------------------------------

  test('a real live page is classified live', () => {
    assert.equal(byKey.get('healthy').status.status, 'live');
  });

  test('a thin, unmaintained but genuine site is still live, not parked', () => {
    const a = byKey.get('neglected');
    assert.equal(
      a.status.status,
      'live',
      'a bad site is a live site — misclassifying it as parked would drop a real lead into the wrong tier',
    );
  });

  test('a domain-sale page is classified parked, from a real DOM', () => {
    const a = byKey.get('parked');
    assert.equal(a.status.status, 'parked');
    assert.equal(a.status.rule, 'for-sale-text');
  });

  test('an HTTP 404 is dead by http-error', () => {
    const a = byKey.get('dead404');
    assert.equal(a.status.status, 'dead');
    assert.equal(a.status.rule, 'http-error');
    assert.match(a.status.reason, /404/);
  });

  test('a refused connection is dead by unreachable — a different rule', () => {
    const a = byKey.get('refused');
    assert.equal(a.status.status, 'dead');
    assert.equal(a.status.rule, 'unreachable');
  });

  test('an empty website costs no navigation and classifies none', () => {
    const a = byKey.get('nosite');
    assert.equal(a.status.status, 'none');
    assert.equal(a.status.rule, 'no-url');
    assert.equal(a.status.signals, undefined);
  });

  // --- cheap signals -------------------------------------------------------

  test('cheap signals are collected by the status GET for live sites', () => {
    const healthy = byKey.get('healthy').status.signals;
    assert.ok(healthy, 'a live page must yield the signals the audit queue ranks on');
    assert.equal(healthy.hasViewportMeta, true);
    assert.equal(healthy.hasBusinessJsonLd, true);
    assert.equal(healthy.hasContactLink, true);
    assert.ok(healthy.contentWords > 150, `expected rich prose, got ${healthy.contentWords} words`);
    assert.ok(healthy.descriptionLength > 0);
  });

  test('the neglected site trips the signals the healthy one does not', () => {
    const bad = byKey.get('neglected').status.signals;
    assert.equal(bad.hasViewportMeta, false);
    assert.equal(bad.hasBusinessJsonLd, false);
    assert.equal(bad.hasContactLink, false);
    assert.equal(bad.descriptionLength, 0);
    assert.ok(bad.contentWords < 150, `expected thin content, got ${bad.contentWords} words`);
    assert.ok(
      bad.contentWords >= 40,
      'above the classifier floor on purpose — this is a real site, just a bad one',
    );
  });

  test('loopback is http, so every fixture reads insecure — stated, not hidden', () => {
    assert.equal(byKey.get('healthy').status.signals.insecure, true);
    assert.equal(byKey.get('neglected').status.signals.insecure, true);
  });

  // --- audit ---------------------------------------------------------------

  test('live sites are audited and yield a real neglect measurement', () => {
    for (const key of ['healthy', 'neglected']) {
      const a = byKey.get(key);
      assert.equal(a.audited, true, `${key} should have been audited`);
      assert.equal(typeof a.neglect, 'number');
      assert.ok(a.neglect >= 0 && a.neglect <= 1);
    }
  });

  test('only live sites are audited — nothing navigates to a parked or dead host twice', () => {
    for (const key of ['parked', 'dead404', 'refused', 'nosite']) {
      assert.equal(byKey.get(key).audited, false, `${key} must not be audited`);
    }
  });

  /**
   * The measurement the whole live band rests on. Both sites are http and both
   * fail the https check, so this compares them against each other rather than
   * against an absolute.
   */
  test('the neglected site measures as more neglected than the healthy one', () => {
    const healthy = byKey.get('healthy').neglect;
    const neglected = byKey.get('neglected').neglect;
    assert.ok(
      neglected > healthy,
      `the audit should rate the neglected site worse: neglected=${neglected} healthy=${healthy}`,
    );
  });

  /**
   * The defect this exercise was built to catch. Lighthouse attaches over the
   * DevTools port; if the browser was launched without one, every
   * Lighthouse-derived check reads `unavailable` and neglect is quietly
   * computed over a smaller set of checks.
   */
  test('the audit decides enough checks to be worth trusting', () => {
    for (const key of ['healthy', 'neglected']) {
      const a = byKey.get(key);
      assert.ok(
        a.neglect !== undefined,
        `${key}: no check decided — the audit produced no measurement at all`,
      );
    }
  });

  // --- scoring -------------------------------------------------------------

  test('the tiers hold against real classifications', () => {
    const score = (k) => byKey.get(k).score;
    assert.ok(score('nosite') > score('parked'), 'no website should outrank a parked domain');
    assert.ok(score('dead404') > score('parked'), 'dead should outrank parked');
    assert.ok(score('parked') > score('neglected'), 'parked should outrank the worst live site');
    assert.ok(score('neglected') > score('healthy'), 'a neglected live site should outrank a healthy one');
  });

  test('opportunity lands in the live band for live sites and above it for the rest', () => {
    assert.ok(byKey.get('healthy').opportunity >= 0.1 && byKey.get('healthy').opportunity <= 0.65);
    assert.ok(byKey.get('neglected').opportunity >= 0.1 && byKey.get('neglected').opportunity <= 0.65);
    assert.ok(byKey.get('parked').opportunity > 0.65);
  });

  test('reason strings describe what was actually measured', () => {
    assert.match(byKey.get('nosite').reasons.join(' · '), /no website at all/);
    assert.match(byKey.get('parked').reasons.join(' · '), /parked domain/);
    assert.match(byKey.get('dead404').reasons.join(' · '), /dead/);
    assert.match(byKey.get('neglected').reasons.join(' · '), /live site/);
    assert.match(byKey.get('neglected').reasons.join(' · '), /audit check/);
  });

  test('every assessment carries exactly three reasons', () => {
    for (const a of outcome.assessments) assert.equal(a.reasons.length, 3);
  });

  // --- reporting -----------------------------------------------------------

  test('the histogram bands the real spread by status', () => {
    const bands = histogram(outcome.assessments);
    assert.equal(bands.reduce((n, b) => n + b.total, 0), 6);
    const text = renderHistogram(outcome.assessments);
    assert.match(text, /90-100/);
    assert.match(text, /0-9/);
  });

  test('the tally reports every live site as audited when the cap is unlimited', () => {
    const text = renderStatusTally(outcome.assessments);
    assert.match(text, /Audited: 2 of 2 live site\(s\)/);
    assert.doesNotMatch(text, /not audited/);
  });

  test('the top list renders real rows without throwing', () => {
    const text = renderTop(outcome.assessments, 25);
    assert.match(text, /Fixture No Website/);
    assert.match(text, /Top 6 of 6/);
  });

  test('rows project onto exactly the machine-owned columns', () => {
    const row = toScoredRow(byKey.get('healthy'));
    assert.equal(row.status, 'NEW');
    assert.equal(row.websiteStatus, 'live');
    assert.equal(row.copyPack, 'machine-shop');
    assert.ok(Number(row.score) > 0);
  });
});

/**
 * The cap, exercised separately so the run above can audit everything.
 */
describe('the audit cap, against served sites', () => {
  let sites;
  let browser;
  let debugPort;

  before(async () => {
    sites = await startSites();
    debugPort = await freePort();
    browser = await chromium.launch({ args: [`--remote-debugging-port=${debugPort}`] });
  });

  after(async () => {
    await browser?.close();
    await sites?.close();
  });

  test('the cap audits the worst-ranked live site and skips the rest', async () => {
    const outcome = await assess({
      results: [
        // Healthy first, so passing the cap test cannot be an accident of order.
        sweepResult({ key: 'healthy', name: 'Fixture Precision Works', website: sites.urls['live-healthy'] }),
        sweepResult({ key: 'neglected', name: 'Fixture Heritage Welding', website: sites.urls['live-neglected'] }),
      ],
      browser,
      debugPort,
      auditCap: 1,
      dataDirOverride: 'test/fixtures/no-such-dir',
      now: new Date('2026-08-12T12:00:00Z'),
    });

    const byKey = new Map(outcome.assessments.map((a) => [a.result.placeId.replace('fixture-', ''), a]));
    assert.equal(byKey.get('neglected').audited, true, 'the cap must spend itself on the worse site');
    assert.equal(byKey.get('healthy').audited, false);
    assert.equal(outcome.skippedByCap, 1);
  });

  test('a live site the cap skipped is scored unmeasured, never as fine', async () => {
    const outcome = await assess({
      results: [
        sweepResult({ key: 'healthy', name: 'Fixture Precision Works', website: sites.urls['live-healthy'] }),
        sweepResult({ key: 'neglected', name: 'Fixture Heritage Welding', website: sites.urls['live-neglected'] }),
      ],
      browser,
      debugPort,
      auditCap: 1,
      dataDirOverride: 'test/fixtures/no-such-dir',
      now: new Date('2026-08-12T12:00:00Z'),
    });
    const skipped = outcome.assessments.find((a) => a.result.placeId === 'fixture-healthy');
    assert.equal(skipped.neglect, undefined);
    assert.equal(skipped.opportunity, 0.1);
    assert.match(skipped.notAuditedReason, /audit cap/);
    assert.match(skipped.reasons.join(' · '), /not audited/);
  });
});
