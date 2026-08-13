import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CallBudget, DISCOVERY_FIELD_MASK, UsageMeter } from '@site-factory/discover';

import {
  NICHES,
  criteriaFor,
  nicheBySlug,
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
