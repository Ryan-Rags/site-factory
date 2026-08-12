import assert from 'node:assert/strict';
import { test } from 'node:test';

import { resolveIdentity } from '../dist/index.js';

const result = (over = {}) => ({
  placeId: 'ChIJ_real_place_id',
  name: 'K-H Machine Works',
  nicheSlug: 'machine-shop',
  nicheLabel: 'machine shop',
  town: 'North Bergen',
  address: '',
  phone: '',
  website: '',
  types: [],
  rating: '',
  reviewCount: '',
  copyPack: 'machine-shop',
  seenIn: [],
  ...over,
});

test('a place id match is exact and silent', () => {
  const known = [
    { placeId: 'ChIJ_real_place_id', name: 'Anything At All', source: 'data/leads-machine.csv' },
  ];
  const m = resolveIdentity(result(), known);
  assert.equal(m.how, 'placeId');
  assert.equal(m.matchedIn, 'data/leads-machine.csv');
  assert.equal(m.warning, '', 'an exact match must not warn');
});

/**
 * The interim this stream closes. PLAN-pipeline.md:274-283 records that a lead
 * whose name carries a legal suffix slugifies to a key that matches nothing,
 * and that the failure is silent. Here it is loud.
 */
test('a slug fallback fires only for rows with no place id, and warns', () => {
  const known = [{ placeId: '', name: 'K-H Machine Works', source: 'data/leads-machine.csv' }];
  const m = resolveIdentity(result(), known);
  assert.equal(m.how, 'slug-fallback');
  assert.match(m.warning, /^WARNING:/);
  assert.match(m.warning, /by NAME SLUG/);
  assert.match(m.warning, /--backfill-place-ids/);
});

/**
 * The failure the place id is meant to remove. A legal suffix changes the slug,
 * so the name match misses — and because it misses rather than matching the
 * wrong thing, the result is "new lead", which is safe.
 */
test('a legal suffix breaks the slug match, which is exactly why ids exist', () => {
  const known = [{ placeId: '', name: 'K-H Machine Works Inc', source: 'data/leads-machine.csv' }];
  const m = resolveIdentity(result({ name: 'K-H Machine Works' }), known);
  assert.equal(m.how, 'none');
});

test('the same business under a legal suffix matches anyway once it has a place id', () => {
  const known = [
    { placeId: 'ChIJ_real_place_id', name: 'K-H Machine Works Inc', source: 'data/leads-machine.csv' },
  ];
  const m = resolveIdentity(result({ name: 'K-H Machine Works' }), known);
  assert.equal(m.how, 'placeId', 'the place id survives a rename; that is the point');
});

/**
 * The dangerous case. A record that HAS a place id and did not match is a
 * different business — matching it by name would be the silent wrong answer
 * this design replaces.
 */
test('a record with a different place id is never matched by name', () => {
  const known = [
    { placeId: 'ChIJ_some_other_business', name: 'K-H Machine Works', source: 'data/leads-machine.csv' },
  ];
  const m = resolveIdentity(result(), known);
  assert.equal(m.how, 'none');
  assert.equal(m.warning, '');
});

test('no match at all is the normal case and is not a warning', () => {
  const m = resolveIdentity(result(), []);
  assert.equal(m.how, 'none');
  assert.equal(m.warning, '');
});

test('the client registry is searched alongside the lead CSVs', () => {
  const known = [
    { placeId: 'ChIJ_real_place_id', name: 'kh-machine-works', source: 'client registry' },
  ];
  const m = resolveIdentity(result(), known);
  assert.equal(m.how, 'placeId');
  assert.equal(m.matchedIn, 'client registry');
});

test('a business with an unnameable name does not slug-match everything', () => {
  const known = [{ placeId: '', name: '!!!', source: 'data/x.csv' }];
  const m = resolveIdentity(result({ name: '???' }), known);
  assert.equal(m.how, 'none', 'two names that both slugify to empty are not the same business');
});
