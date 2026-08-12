import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  DISCOVERY_FIELD_MASK,
  FIELD_TIERS,
  UsageMeter,
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
 * municipalities across three niches — so its field mask is the single most
 * leveraged string in the repo. One extra field multiplies across every one of
 * those calls, and nothing in the response says so: the JSON looks identical
 * whether the call cost Pro rates or Enterprise rates.
 *
 * ## What this gate asserts, and why it changed
 *
 * It first landed asserting "no Enterprise field in the discovery mask", and
 * it landed RED — see the commit that introduced it. It named four offenders,
 * two of which were the finding that reshaped the stream: `websiteUri` and
 * `nationalPhoneNumber` are Enterprise, not Pro. That killed the two-pass
 * survivor design, because the survivor filter was defined on exactly those
 * two fields and a cheap sweep cannot return them. See the note on
 * `DISCOVERY_FIELD_MASK` for the full argument.
 *
 * So the assertion moved to the invariant that actually protects money now
 * that one Enterprise sweep is the design:
 *
 *   1. The mask is fixed, byte-for-byte. Nothing gets added quietly.
 *   2. The Enterprise + Atmosphere class is banned outright, everywhere.
 *   3. Every field in it has a known price.
 *
 * The red run stands in history as the failure-first record CLAUDE.md requires.
 */

/** Ruling: this mask, nothing else, ever. */
const DECLARED_SWEEP_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.types',
  'places.websiteUri',
  'places.nationalPhoneNumber',
  'places.rating',
  'places.userRatingCount',
  'nextPageToken',
].join(',');

test('GATE: the sweep mask equals the declared mask, byte for byte', () => {
  assert.equal(
    DISCOVERY_FIELD_MASK,
    DECLARED_SWEEP_MASK,
    'The discovery sweep mask has drifted from the mask ruled on. It is fixed: adding a ' +
      'field changes what every one of ~210 sweep calls costs. Change the ruling first.',
  );
});

test('GATE: the sweep mask requests no Enterprise + Atmosphere field', () => {
  const banned = fieldsAtOrAbove(DISCOVERY_FIELD_MASK, 'atmosphere');
  assert.deepEqual(
    banned,
    [],
    `The sweep mask requests banned Enterprise + Atmosphere field(s): ${banned.join(', ')}. ` +
      'Reviews, photos and the atmosphere fields are the dearest data Google sells and ' +
      'nothing in this package needs them.',
  );
});

test('GATE: every field in the sweep mask has a known price', () => {
  assert.deepEqual(
    unknownFields(DISCOVERY_FIELD_MASK),
    [],
    'A field in the sweep mask is absent from the SKU table, so its cost is unknown. ' +
      'Classify it in sku.ts before requesting it.',
  );
});

test('GATE: the sweep mask bills at Enterprise, and knowingly so', () => {
  // Not an aspiration — a statement of the ruling. The sweep IS Enterprise,
  // because websiteUri and nationalPhoneNumber are, and rating rides along at
  // no marginal cost. If this ever reads 'pro', something removed the fields
  // the scoring depends on.
  assert.equal(tierOf(DISCOVERY_FIELD_MASK), 'enterprise');
});

/**
 * The ban is enforced at the call site, not just asserted about a constant.
 * A mask assembled at runtime must be refused too.
 */
test('GATE: the meter refuses an Atmosphere call before it is made', () => {
  const meter = new UsageMeter();
  assert.throws(
    () => meter.reserve({ endpoint: 'searchText', mask: 'places.id,places.reviews' }),
    /Atmosphere/,
  );
  assert.equal(meter.spent, 0, 'a refused call must not be recorded as spent');
});

test('GATE: the meter refuses a mask containing an unpriced field', () => {
  const meter = new UsageMeter();
  assert.throws(
    () => meter.reserve({ endpoint: 'searchText', mask: 'places.id,places.notAThing' }),
    /no known billing tier/,
  );
  assert.equal(meter.spent, 0);
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
 * The row that decided this stream's whole shape. Verified against Google's
 * current Text Search SKU documentation at the time of the ruling.
 */
test('phone and website are Enterprise-tier, not Pro', () => {
  assert.equal(fieldTier('places.websiteUri'), 'enterprise');
  assert.equal(fieldTier('places.nationalPhoneNumber'), 'enterprise');
  assert.equal(fieldTier('websiteUri'), 'enterprise');
});

test('rating and userRatingCount are Enterprise — the same tier as website', () => {
  assert.equal(FIELD_TIERS['rating'], 'enterprise');
  assert.equal(FIELD_TIERS['userRatingCount'], 'enterprise');
  // The whole cost argument in one assertion: once the call is Enterprise for
  // websiteUri, rating is free.
  assert.equal(
    tierOf('places.id,places.websiteUri'),
    tierOf('places.id,places.websiteUri,places.rating,places.userRatingCount'),
  );
});

test('the prefix is stripped so one table serves Text Search and Details', () => {
  assert.equal(fieldTier('places.rating'), fieldTier('rating'));
  assert.equal(fieldTier('places.types'), 'pro');
});

test('an unknown field is treated as the dearest tier, never the cheapest', () => {
  assert.equal(fieldTier('places.somethingNobodyClassified'), 'atmosphere');
  assert.deepEqual(unknownFields('places.id,places.notAThing'), ['places.notAThing']);
});

test('mask parsing tolerates whitespace and trailing commas', () => {
  assert.deepEqual(maskFields(' places.id , places.types ,'), ['places.id', 'places.types']);
});
