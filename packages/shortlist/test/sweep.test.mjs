import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CallBudget, DISCOVERY_FIELD_MASK, UsageMeter } from '@site-factory/discover';

import {
  NICHES,
  SweepStopped,
  criteriaFor,
  nicheBySlug,
  projectCalls,
  queryFor,
  rankForAudit,
  renderOrdering,
  sweep,
} from '../dist/index.js';

const machineShop = nicheBySlug('machine-shop');

const okFetch = (placesByQuery) =>
  async (_url, init) => {
    const body = JSON.parse(init.body);
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ places: placesByQuery[body.textQuery] ?? [] }),
      text: async () => '',
    };
  };

const place = (id, over = {}) => ({
  id,
  displayName: { text: id },
  formattedAddress: '1 Main St',
  ...over,
});

test('the query names the niche, the town and the state', () => {
  assert.equal(queryFor(machineShop, 'Lodi'), 'machine shop in Lodi, NJ');
});

test('the sweep emits exactly one field mask, and it is the declared one', async () => {
  const outcome = await sweep({
    niches: [machineShop],
    towns: ['Lodi', 'Mahwah'],
    apiKey: 'k',
    meter: new UsageMeter(),
    budget: new CallBudget(),
    fetchImpl: okFetch({}),
  });
  assert.deepEqual(outcome.emittedMasks, [DISCOVERY_FIELD_MASK]);
});

/**
 * A shop near a municipal boundary surfaces in several towns' queries. It is
 * one lead, and `seenIn` keeps the full list.
 */
test('a business found in two towns is one row, with both sightings recorded', async () => {
  const shared = place('ChIJ_shared');
  const outcome = await sweep({
    niches: [machineShop],
    towns: ['Lodi', 'Mahwah'],
    apiKey: 'k',
    meter: new UsageMeter(),
    budget: new CallBudget(),
    fetchImpl: okFetch({
      'machine shop in Lodi, NJ': [shared],
      'machine shop in Mahwah, NJ': [shared],
    }),
  });

  assert.equal(outcome.results.length, 1);
  assert.deepEqual(outcome.results[0].seenIn, ['machine-shop/Lodi', 'machine-shop/Mahwah']);
  assert.equal(outcome.results[0].town, 'Lodi', 'first sighting wins the town column');
});

test('a result with no place id is dropped — identity is the primary key', async () => {
  const outcome = await sweep({
    niches: [machineShop],
    towns: ['Lodi'],
    apiKey: 'k',
    meter: new UsageMeter(),
    budget: new CallBudget(),
    fetchImpl: okFetch({
      'machine shop in Lodi, NJ': [{ displayName: { text: 'No Id Shop' } }, place('ChIJ_ok')],
    }),
  });
  assert.equal(outcome.results.length, 1);
  assert.equal(outcome.results[0].placeId, 'ChIJ_ok');
});

/** Unmeasured is unavailable — never a fabricated zero. */
test('a business with no rating gets empty strings, not zeroes', async () => {
  const outcome = await sweep({
    niches: [machineShop],
    towns: ['Lodi'],
    apiKey: 'k',
    meter: new UsageMeter(),
    budget: new CallBudget(),
    fetchImpl: okFetch({ 'machine shop in Lodi, NJ': [place('ChIJ_a')] }),
  });
  assert.equal(outcome.results[0].rating, '');
  assert.equal(outcome.results[0].reviewCount, '');
});

test('a rating of zero reviews is carried verbatim', async () => {
  const outcome = await sweep({
    niches: [machineShop],
    towns: ['Lodi'],
    apiKey: 'k',
    meter: new UsageMeter(),
    budget: new CallBudget(),
    fetchImpl: okFetch({
      'machine shop in Lodi, NJ': [place('ChIJ_a', { rating: 4.5, userRatingCount: 0 })],
    }),
  });
  assert.equal(outcome.results[0].rating, '4.5');
  assert.equal(outcome.results[0].reviewCount, '0');
});

test('one query per (niche, town) cell', async () => {
  const meter = new UsageMeter();
  await sweep({
    niches: NICHES.slice(0, 2),
    towns: ['Lodi', 'Mahwah', 'Teterboro'],
    apiKey: 'k',
    meter,
    budget: new CallBudget(),
    fetchImpl: okFetch({}),
  });
  assert.equal(meter.spent, 6);
});

/**
 * A single failing query must not abandon the county — but a budget ceiling
 * must stop the run, because continuing would issue one guaranteed-to-throw
 * call per remaining cell.
 */
test('a failed query is recorded and the sweep continues', async () => {
  let n = 0;
  const outcome = await sweep({
    niches: [machineShop],
    towns: ['Lodi', 'Mahwah'],
    apiKey: 'k',
    meter: new UsageMeter(),
    budget: new CallBudget(),
    fetchImpl: async () => {
      n += 1;
      if (n === 1) return { ok: false, status: 500, statusText: 'err', text: async () => '', json: async () => ({}) };
      return { ok: true, status: 200, statusText: 'OK', json: async () => ({ places: [place('ChIJ_b')] }), text: async () => '' };
    },
  });
  assert.equal(outcome.failures.length, 1);
  assert.equal(outcome.results.length, 1);
});

test('a budget ceiling stops the sweep rather than failing every remaining cell', async () => {
  await assert.rejects(
    () =>
      sweep({
        niches: [machineShop],
        towns: ['Lodi', 'Mahwah', 'Teterboro', 'Hackensack'],
        apiKey: 'k',
        meter: new UsageMeter({ total: 1, enterprise: 1 }),
        budget: new CallBudget(),
        fetchImpl: okFetch({}),
      }),
    /budget exhausted/,
  );
});

/* --- the ceiling must not destroy what the run already paid for ----------- */

test('onCell hands over the results so far after every cell', async () => {
  const snapshots = [];
  await sweep({
    niches: [machineShop],
    towns: ['Lodi', 'Mahwah'],
    apiKey: 'k',
    meter: new UsageMeter(),
    budget: new CallBudget(),
    fetchImpl: okFetch({
      'machine shop in Lodi, NJ': [place('ChIJ_a')],
      'machine shop in Mahwah, NJ': [place('ChIJ_b')],
    }),
    onCell: (results) => {
      snapshots.push(results.map((r) => r.placeId));
    },
  });
  assert.deepEqual(snapshots, [['ChIJ_a'], ['ChIJ_a', 'ChIJ_b']]);
});

test('onCell is awaited, so a slow write cannot be overtaken by the next cell', async () => {
  const order = [];
  await sweep({
    niches: [machineShop],
    towns: ['Lodi', 'Mahwah'],
    apiKey: 'k',
    meter: new UsageMeter(),
    budget: new CallBudget(),
    fetchImpl: okFetch({}),
    onCell: async () => {
      order.push('write:start');
      await new Promise((r) => setTimeout(r, 5));
      order.push('write:end');
    },
  });
  assert.deepEqual(order, ['write:start', 'write:end', 'write:start', 'write:end']);
});

test('the cell that exhausts the budget still hands over what was bought', async () => {
  const snapshots = [];
  await assert.rejects(
    () =>
      sweep({
        // Two calls of budget: Lodi succeeds, Mahwah is refused.
        niches: [machineShop],
        towns: ['Lodi', 'Mahwah', 'Teterboro'],
        apiKey: 'k',
        meter: new UsageMeter({ total: 1, enterprise: 1 }),
        budget: new CallBudget(),
        fetchImpl: okFetch({ 'machine shop in Lodi, NJ': [place('ChIJ_paid_for')] }),
        onCell: (results) => {
          snapshots.push(results.map((r) => r.placeId));
        },
      }),
    /budget exhausted/,
  );
  // Once for Lodi, and again on the stop — the business bought with the one
  // call that succeeded reaches the caller before the throw propagates.
  assert.ok(snapshots.length >= 1);
  assert.deepEqual(snapshots.at(-1), ['ChIJ_paid_for']);
});

test('the stop carries the partial outcome, not just a message', async () => {
  const err = await sweep({
    niches: [machineShop],
    towns: ['Lodi', 'Mahwah', 'Teterboro'],
    apiKey: 'k',
    meter: new UsageMeter({ total: 1, enterprise: 1 }),
    budget: new CallBudget(),
    fetchImpl: okFetch({ 'machine shop in Lodi, NJ': [place('ChIJ_paid_for')] }),
  }).then(
    () => null,
    (e) => e,
  );

  assert.ok(err instanceof SweepStopped, 'a budget stop is a SweepStopped');
  assert.match(err.message, /budget exhausted/, 'the budget message is preserved');
  assert.equal(err.outcome.results.length, 1);
  assert.equal(err.outcome.results[0].placeId, 'ChIJ_paid_for');
  assert.deepEqual(err.outcome.emittedMasks, [DISCOVERY_FIELD_MASK], 'the mask is still assertable');
  assert.equal(err.outcome.queries, 1);
});

/* --- the projection ------------------------------------------------------- */

/*
 * The projection is exact again, because the cap makes it exact.
 *
 * It briefly carried a "measured" ~3.6 calls-per-cell constant. That number was
 * an artifact of the runaway: 69 cells cost one call each and a single cell
 * spent 730, so the average described nothing that had ever happened. With each
 * cell capped at `pages` requests, `cells × pages` is a ceiling the run cannot
 * exceed rather than an estimate it might.
 */
test('a live run projects exactly cells x pages, and that is a hard ceiling', () => {
  const p = projectCalls(210, 1, false);
  assert.equal(p.high, 210, 'the original 210 estimate was right all along');
  assert.match(p.label, /at most/);
});

test('a dry run projects the same count and says it spends nothing', () => {
  const p = projectCalls(12, 1, true);
  assert.equal(p.high, 12);
  assert.match(p.label, /zero network/);
});

test('more pages per cell projects proportionally more calls', () => {
  assert.equal(projectCalls(100, 2, false).high, 200);
  assert.equal(projectCalls(100, 1, false).high, 100);
});

// --- audit ordering --------------------------------------------------------

const signals = (over = {}) => ({
  insecure: false,
  hasViewportMeta: true,
  titleLength: 40,
  descriptionLength: 100,
  contentWords: 500,
  hasContactLink: true,
  hasBusinessJsonLd: true,
  ...over,
});

test('audit ordering puts the strongest cheap neglect hints first', () => {
  const items = [
    { id: 'clean', status: { signals: signals() } },
    { id: 'http-only', status: { signals: signals({ insecure: true }) } },
    { id: 'no-viewport', status: { signals: signals({ hasViewportMeta: false }) } },
  ];
  const order = rankForAudit(items).map((r) => r.item.id);
  assert.deepEqual(order, ['http-only', 'no-viewport', 'clean']);
});

test('a site with no cheap signals is marked degraded, not ranked', () => {
  const ranked = rankForAudit([{ id: 'a', status: { signals: undefined } }]);
  assert.equal(ranked[0].degraded, true);
  assert.equal(ranked[0].points, 0);
});

test('the ordering is printed, and says so honestly when it degraded', () => {
  const text = renderOrdering(3, 10);
  assert.match(text, /cheap signals only/);
  assert.match(text, /No extra navigations/);
  assert.match(text, /3 of 10 live site\(s\) yielded no cheap signals/);
  assert.match(text, /discovery order/);
});

test('equal-scoring sites keep discovery order as the documented tie-break', () => {
  const items = [
    { id: 'first', status: { signals: signals({ insecure: true }) } },
    { id: 'second', status: { signals: signals({ insecure: true }) } },
  ];
  assert.deepEqual(rankForAudit(items).map((r) => r.item.id), ['first', 'second']);
});

test('criteria firing is reported per site, so a rank can be explained', () => {
  assert.deepEqual(criteriaFor(signals({ insecure: true, hasViewportMeta: false })), [
    'insecure',
    'no-viewport-meta',
  ]);
  assert.deepEqual(criteriaFor(signals()), []);
});
