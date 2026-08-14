import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  CallBudget,
  DISCOVERY_FIELD_MASK,
  UsageMeter,
  searchTextDetailed,
} from '../dist/index.js';

const okResponse = (places, nextPageToken) => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  json: async () => (nextPageToken ? { places, nextPageToken } : { places }),
  text: async () => '',
});

const place = (id) => ({ id, displayName: { text: id } });

test('the meter records the mask actually sent in the header', async () => {
  const meter = new UsageMeter();
  let sentMask;
  const outcome = await searchTextDetailed({
    niche: 'machine shop in Lodi, NJ',
    max: 20,
    apiKey: 'test-key',
    budget: new CallBudget(),
    mask: DISCOVERY_FIELD_MASK,
    meter,
    town: 'Lodi',
    fetchImpl: async (_url, init) => {
      sentMask = init.headers['X-Goog-FieldMask'];
      return okResponse([place('a'), place('b')]);
    },
  });

  // The header, the reported mask and the priced mask are one string.
  assert.equal(sentMask, DISCOVERY_FIELD_MASK);
  assert.equal(outcome.emittedFieldMask, DISCOVERY_FIELD_MASK);
  assert.equal(meter.records[0].mask, DISCOVERY_FIELD_MASK);
  assert.equal(meter.records[0].tier, 'enterprise');
  assert.equal(meter.records[0].town, 'Lodi');
  assert.equal(meter.records[0].resultCount, 2);
});

test('every paging follow-up is counted as its own billable call', async () => {
  const meter = new UsageMeter();
  let n = 0;
  await searchTextDetailed({
    niche: 'machine shop',
    max: 60,
    apiKey: 'k',
    budget: new CallBudget(),
    mask: DISCOVERY_FIELD_MASK,
    meter,
    fetchImpl: async () => {
      n += 1;
      const page = Array.from({ length: 20 }, (_, i) => place(`p${n}-${i}`));
      return okResponse(page, n < 3 ? `token-${n}` : undefined);
    },
  });

  assert.equal(meter.spent, 3, 'three pages is three Enterprise calls, not one');
  assert.equal(meter.spentAtOrAbove('enterprise'), 3);
});

/*
 * The runaway.
 *
 * `while (out.length < max)` had no request cap: its only exits were "enough
 * results" and "no nextPageToken". A query that keeps handing back a token with
 * a thin page therefore pages until something else kills it, and on 2026-08-14
 * one live cell — `welding and fabrication in Allendale, NJ` — spent 730 of an
 * 800-call budget on its own while every other cell cost exactly one.
 *
 * The fixture below is that shape: two results per page, a token every time,
 * never reaching `max`.
 */
test('a cell cannot outspend its page budget, however many tokens arrive', async () => {
  const meter = new UsageMeter();
  let calls = 0;
  const outcome = await searchTextDetailed({
    niche: 'welding and fabrication in Allendale, NJ',
    max: 20,
    maxCalls: 1,
    apiKey: 'k',
    budget: new CallBudget(),
    mask: DISCOVERY_FIELD_MASK,
    meter,
    fetchImpl: async () => {
      calls += 1;
      return okResponse([place(`a${calls}`), place(`b${calls}`)], `token-${calls}`);
    },
  });

  assert.equal(calls, 1, 'one page requested means one HTTP call, token or not');
  assert.equal(meter.spent, 1, 'and one billable call');
  assert.equal(outcome.calls, 1);
  assert.equal(outcome.places.length, 2, 'it keeps the page it paid for');
});

test('a higher page budget is honoured exactly, not exceeded', async () => {
  const meter = new UsageMeter();
  let calls = 0;
  await searchTextDetailed({
    niche: 'q',
    max: 100,
    maxCalls: 3,
    apiKey: 'k',
    budget: new CallBudget(),
    mask: DISCOVERY_FIELD_MASK,
    meter,
    fetchImpl: async () => {
      calls += 1;
      return okResponse([place(`p${calls}`)], `token-${calls}`);
    },
  });
  assert.equal(calls, 3, 'three pages, then stop — the fourth token is ignored');
  assert.equal(meter.spent, 3);
});

test('reaching max still stops early, below the page budget', async () => {
  const meter = new UsageMeter();
  let calls = 0;
  await searchTextDetailed({
    niche: 'q',
    max: 20,
    maxCalls: 5,
    apiKey: 'k',
    budget: new CallBudget(),
    mask: DISCOVERY_FIELD_MASK,
    meter,
    fetchImpl: async () => {
      calls += 1;
      return okResponse(
        Array.from({ length: 20 }, (_, i) => place(`p${calls}-${i}`)),
        'more',
      );
    },
  });
  assert.equal(calls, 1, 'twenty results satisfies max on the first page');
  assert.equal(meter.spent, 1);
});

test('the total ceiling throws before the call is made', async () => {
  const meter = new UsageMeter({ total: 2, enterprise: 99 });
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return okResponse([place('x')], 'more');
  };
  const run = () =>
    searchTextDetailed({
      niche: 'q',
      max: 60,
      apiKey: 'k',
      budget: new CallBudget(),
      mask: DISCOVERY_FIELD_MASK,
      meter,
      fetchImpl,
    });

  await assert.rejects(run, /budget exhausted/);
  assert.equal(calls, 2, 'the third call must never reach the network');
  assert.equal(meter.spent, 2);
});

test('the Enterprise sub-ceiling throws before the call is made', async () => {
  const meter = new UsageMeter({ total: 99, enterprise: 1 });
  let calls = 0;
  await assert.rejects(
    () =>
      searchTextDetailed({
        niche: 'q',
        max: 60,
        apiKey: 'k',
        budget: new CallBudget(),
        mask: DISCOVERY_FIELD_MASK,
        meter,
        fetchImpl: async () => {
          calls += 1;
          return okResponse([place('x')], 'more');
        },
      }),
    /Enterprise-tier budget exhausted/,
  );
  assert.equal(calls, 1);
});

test('a call that throws still counts — Google billed it', async () => {
  const meter = new UsageMeter();
  await assert.rejects(
    () =>
      searchTextDetailed({
        niche: 'q',
        max: 20,
        apiKey: 'k',
        budget: new CallBudget(),
        mask: DISCOVERY_FIELD_MASK,
        meter,
        fetchImpl: async () => ({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          text: async () => 'boom',
          json: async () => ({}),
        }),
      }),
    /HTTP 500/,
  );
  assert.equal(meter.spent, 1, 'a failed call is still a billed call');
  assert.equal(meter.records[0].resultCount, undefined, 'but it settled no results');
});

test('the API key never appears in an error message', async () => {
  const meter = new UsageMeter();
  const key = 'AIza-super-secret-value';
  await assert.rejects(
    () =>
      searchTextDetailed({
        niche: 'q',
        max: 20,
        apiKey: key,
        budget: new CallBudget(),
        mask: DISCOVERY_FIELD_MASK,
        meter,
        fetchImpl: async () => ({
          ok: false,
          status: 403,
          statusText: 'Forbidden',
          text: async () => `The key ${key} is not authorized`,
          json: async () => ({}),
        }),
      }),
    (err) => {
      assert.ok(!err.message.includes(key), 'the key leaked into an error that gets logged');
      assert.match(err.message, /\[REDACTED\]/);
      return true;
    },
  );
});

test('the summary breaks calls out by endpoint and tier', () => {
  const meter = new UsageMeter({ total: 10, enterprise: 10 }, 'run-1');
  meter.reserve({ endpoint: 'searchText', mask: DISCOVERY_FIELD_MASK, town: 'Lodi' })(20);
  meter.reserve({ endpoint: 'searchText', mask: DISCOVERY_FIELD_MASK, town: 'Mahwah' })(11);
  meter.reserve({ endpoint: 'searchText', mask: 'places.id' })(1);

  const s = meter.summary();
  assert.equal(s.total, 3);
  const enterprise = s.byTier.find((t) => t.tier === 'enterprise');
  assert.equal(enterprise.calls, 2);
  assert.deepEqual(enterprise.masks, [DISCOVERY_FIELD_MASK]);
  assert.equal(s.byTier.find((t) => t.tier === 'essentials').calls, 1);
});

/**
 * The claim being reconciled against the console is "no Atmosphere calls".
 * A line that is absent proves nothing, so zero rows are printed explicitly.
 */
test('the rendered summary states the zero tiers rather than omitting them', () => {
  const meter = new UsageMeter({ total: 5, enterprise: 5 }, 'run-2');
  meter.reserve({ endpoint: 'searchText', mask: DISCOVERY_FIELD_MASK })(20);
  const text = meter.renderSummary();
  assert.match(text, /Enterprise \+ Atmosphere\s+0 calls/);
  assert.match(text, /TOTAL\s+1 calls/);
  assert.match(text, /1\/5 Enterprise-or-above/);
});

test('the default caller mask is unchanged, so existing callers are unaffected', async () => {
  let sentMask;
  await searchTextDetailed({
    niche: 'q',
    max: 3,
    apiKey: 'k',
    budget: new CallBudget(),
    fetchImpl: async (_url, init) => {
      sentMask = init.headers['X-Goog-FieldMask'];
      return okResponse([place('a')]);
    },
  });
  // packages/prospect's resolvePlaceId passes no mask and no meter.
  assert.match(sentMask, /places\.id/);
  assert.doesNotMatch(sentMask, /places\.types/);
});
