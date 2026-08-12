import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  DISCOVERY_FIELD_MASK,
  FIELD_TIERS,
  checkSkuTable,
  fieldTier,
  fieldsAtOrAbove,
  maskFields,
  tierOf,
  unknownFields,
} from '../dist/index.js';

/**
 * THE GATE.
 *
 * The discovery sweep asks the same question 210 times — 70 Bergen
 * municipalities across three niches — so the discovery mask is the single
 * most leveraged field mask in the repo. One Enterprise field in it multiplies
 * across every one of those calls, and nothing in the response says so: the
 * JSON looks identical whether the call cost Pro rates or Enterprise rates.
 *
 * The acceptance criterion for this stream is "zero Enterprise-tier calls
 * outside the survivor pass". This test is that criterion, executable.
 *
 * It is committed FAILING, against the mask as it stands on main, per
 * CLAUDE.md: "A new gate lands with its failure demonstrated first, then the
 * fix." What it catches today is real and pre-existing — see PLAN-discovery.md
 * §1.1.
 */
test('GATE: the discovery mask contains no Enterprise-tier field', () => {
  const offenders = fieldsAtOrAbove(DISCOVERY_FIELD_MASK, 'enterprise');
  assert.deepEqual(
    offenders,
    [],
    `The discovery Text Search mask requests ${offenders.length} Enterprise-tier ` +
      `field(s): ${offenders.join(', ')}. A Places call bills at the highest tier ` +
      `any requested field belongs to, so this promotes every sweep query to ` +
      `Enterprise. Move these fields to the survivor Place Details pass.`,
  );
});

test('GATE: the discovery mask bills at Pro or below', () => {
  assert.equal(tierOf(DISCOVERY_FIELD_MASK), 'pro');
});

/**
 * An unclassified field is an unpriced field. If someone adds a field to the
 * discovery mask that the SKU table has never heard of, the cost projection is
 * a guess — so that is a gate failure too, not a shrug.
 */
test('GATE: every field in the discovery mask has a known tier', () => {
  assert.deepEqual(
    unknownFields(DISCOVERY_FIELD_MASK),
    [],
    'A field in the discovery mask is absent from the SKU table, so its cost is unknown. ' +
      'Classify it in sku.ts before requesting it.',
  );
});

// --- the measuring instrument itself ---------------------------------------

test('the SKU table is internally consistent', () => {
  assert.doesNotThrow(() => checkSkuTable());
});

test('a mask bills at the highest tier any field in it belongs to', () => {
  assert.equal(tierOf('places.id'), 'essentials');
  assert.equal(tierOf('places.id,places.displayName'), 'pro');
  assert.equal(tierOf('places.id,places.displayName,places.rating'), 'enterprise');
  assert.equal(tierOf('places.id,places.rating,places.reviews'), 'atmosphere');
});

/**
 * The row that decides this stream's whole shape. `websiteUri` and
 * `nationalPhoneNumber` are Enterprise, not Pro — they are the reason the
 * discovery pass cannot have both a website URL and a Pro-tier bill.
 */
test('phone and website are Enterprise-tier, not Pro', () => {
  assert.equal(fieldTier('places.websiteUri'), 'enterprise');
  assert.equal(fieldTier('places.nationalPhoneNumber'), 'enterprise');
  assert.equal(fieldTier('websiteUri'), 'enterprise');
});

test('the prefix is stripped so one table serves Text Search and Details', () => {
  assert.equal(fieldTier('places.rating'), fieldTier('rating'));
  assert.equal(fieldTier('places.types'), 'pro');
});

test('an unknown field is treated as the dearest tier, never the cheapest', () => {
  assert.equal(fieldTier('places.somethingNobodyClassified'), 'atmosphere');
  assert.deepEqual(unknownFields('places.id,places.notAThing'), ['places.notAThing']);
});

test('rating and userRatingCount are Enterprise', () => {
  assert.equal(FIELD_TIERS['rating'], 'enterprise');
  assert.equal(FIELD_TIERS['userRatingCount'], 'enterprise');
});

test('mask parsing tolerates whitespace and trailing commas', () => {
  assert.deepEqual(maskFields(' places.id , places.types ,'), ['places.id', 'places.types']);
});
