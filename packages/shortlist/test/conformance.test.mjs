import assert from 'node:assert/strict';
import { test } from 'node:test';

import { UNIVERSAL_TYPES, classify, nicheBySlug } from '../dist/index.js';

const machineShop = nicheBySlug('machine-shop');
const welding = nicheBySlug('welding-fabrication');
const contractor = nicheBySlug('general-contractor');

/*
 * Every `types` array below is verbatim from a live Places probe of 2026-08-14
 * (6 calls, 117 results). Nothing here is invented — the point of this gate is
 * that a niche claim is sourced, so its own fixtures are sourced too.
 */

test('a real machine shop is accepted on the type that carries it', () => {
  // Progressive Machine Co, Harout Tool & Machine, KTS, D&D Machine — all this shape.
  const got = classify(['manufacturer', 'point_of_interest', 'establishment'], machineShop);
  assert.equal(got.match, 'match');
  assert.deepEqual(got.matched, ['manufacturer']);
});

test('the bakery that scored 100 is rejected', () => {
  // The defect in one line: this row was written to the call list as a machine
  // shop, and the scorer put it near the top because it has no website.
  const got = classify(['bakery', 'store', 'food', 'point_of_interest', 'establishment'], machineShop);
  assert.equal(got.match, 'mismatch');
  assert.match(got.reason, /not this trade/);
});

test('the bowling alley is rejected even though the query returned it first', () => {
  // `Humdingers`, returned by "machine shop in Paramus, NJ".
  const types = [
    'bowling_alley', 'ice_cream_shop', 'video_arcade', 'sports_complex', 'dessert_shop',
    'confectionery', 'food_store', 'store', 'sports_activity_location', 'restaurant', 'food',
    'point_of_interest', 'establishment',
  ];
  assert.equal(classify(types, machineShop).match, 'mismatch');
});

test('a gift shop is not a machine shop, however much its name suggests metal', () => {
  // `GV enGraVing` — engraving in the name, retail in the types.
  const got = classify(
    ['gift_shop', 'home_goods_store', 'store', 'service', 'point_of_interest', 'establishment'],
    machineShop,
  );
  assert.equal(got.match, 'mismatch');
});

test('a car repair shop is not a machine shop', () => {
  const got = classify(['car_repair', 'service', 'point_of_interest', 'establishment'], machineShop);
  assert.equal(got.match, 'mismatch');
  assert.match(got.reason, /car_repair/);
});

/**
 * Welding is the weak niche: Google gives most welders a bare `service`, which
 * is also what a clinic carries. `service` is admitted anyway — excluding it
 * would reject `ks-welding`, an actual client — and the denylist is what keeps
 * that breadth from readmitting the bakery.
 */
test('a welder Google describes only as "service" is accepted', () => {
  // K & S Welding & Fabricating, Pearce Welding, KJ Welding LLC.
  const got = classify(['service', 'point_of_interest', 'establishment'], welding);
  assert.equal(got.match, 'match');
  assert.deepEqual(got.matched, ['service']);
});

test('a metal fabricator is accepted on manufacturer', () => {
  // Arod Custom Metal, Inc.
  assert.equal(classify(['manufacturer', 'point_of_interest', 'establishment'], welding).match, 'match');
});

test('the denylist still bites for welding, where the allowlist is broad', () => {
  // A restaurant also carries `service`; without the denylist it would pass.
  const got = classify(['restaurant', 'food', 'service', 'point_of_interest', 'establishment'], welding);
  assert.equal(got.match, 'mismatch', 'deny beats accept');
});

test('a general contractor is accepted', () => {
  const got = classify(
    ['general_contractor', 'service', 'point_of_interest', 'establishment'],
    contractor,
  );
  assert.equal(got.match, 'match');
  assert.deepEqual(got.matched, ['general_contractor']);
});

test('a machine shop is not a general contractor — the allowlist is per niche', () => {
  assert.equal(
    classify(['manufacturer', 'point_of_interest', 'establishment'], contractor).match,
    'mismatch',
  );
});

/* --- unknown is its own answer ------------------------------------------- */

test('no types at all is unknown, never a match and never a mismatch', () => {
  const got = classify([], machineShop);
  assert.equal(got.match, 'unknown');
  assert.match(got.reason, /no types/);
});

test('universal types alone decide nothing', () => {
  const got = classify([...UNIVERSAL_TYPES], machineShop);
  assert.equal(got.match, 'unknown', 'every one of the 117 probed results carried these');
  assert.match(got.reason, /only universal/);
});

test('universal types are never counted as evidence alongside a real one', () => {
  const got = classify(['manufacturer', ...UNIVERSAL_TYPES], machineShop);
  assert.deepEqual(got.matched, ['manufacturer'], 'the reason names the type that decided it');
});
