import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  NEUTRAL_RATING_COMPONENT,
  opportunityOf,
  scoreProspect,
  viabilityOf,
} from '../dist/index.js';

const result = (over = {}) => ({
  placeId: 'p1',
  name: 'Test Shop',
  nicheSlug: 'machine-shop',
  nicheLabel: 'machine shop',
  town: 'Lodi',
  address: '1 Main St',
  phone: '(201) 555-0100',
  website: '',
  types: [],
  rating: '4.6',
  reviewCount: '128',
  copyPack: 'machine-shop',
  seenIn: [],
  ...over,
});

/**
 * The ruling was strict tiers: "worst parked outranks best live". That is the
 * whole reason opportunity is banded rather than continuous, so it gets an
 * assertion rather than a comment.
 */
test('the worst possible live site still ranks below the best parked one', () => {
  const worstLive = opportunityOf({ websiteStatus: 'live', neglect: 1 });
  const parked = opportunityOf({ websiteStatus: 'parked', neglect: undefined });
  assert.ok(
    worstLive.value < parked.value,
    `a live site failing every check (${worstLive.value}) must not outrank a parked domain (${parked.value})`,
  );
});

test('opportunity is ordered none > dead > parked > any live', () => {
  const none = opportunityOf({ websiteStatus: 'none', neglect: undefined }).value;
  const dead = opportunityOf({ websiteStatus: 'dead', neglect: undefined }).value;
  const parked = opportunityOf({ websiteStatus: 'parked', neglect: undefined }).value;
  const bestLive = opportunityOf({ websiteStatus: 'live', neglect: 1 }).value;
  assert.ok(none > dead && dead > parked && parked > bestLive);
});

test('the live band runs 0.10 to 0.65 on audit neglect', () => {
  assert.equal(opportunityOf({ websiteStatus: 'live', neglect: 0 }).value, 0.1);
  assert.ok(Math.abs(opportunityOf({ websiteStatus: 'live', neglect: 1 }).value - 0.65) < 1e-9);
});

/**
 * The rule that keeps the list honest: a site nobody measured is never scored
 * as a site that measured well.
 */
test('an unaudited live site floors at 0.10 and says why', () => {
  const o = opportunityOf({ websiteStatus: 'live', neglect: undefined });
  assert.equal(o.value, 0.1);
  assert.match(o.reason, /not audited/);
  assert.match(o.reason, /unmeasured/);
});

test('a clean live site and an unaudited one score the same but read differently', () => {
  const clean = opportunityOf({ websiteStatus: 'live', neglect: 0 });
  const unknown = opportunityOf({ websiteStatus: 'live', neglect: undefined });
  assert.equal(clean.value, unknown.value);
  assert.notEqual(clean.reason, unknown.reason);
  assert.match(clean.reason, /passing every audit check/);
});

// --- viability -------------------------------------------------------------

test('viability weights are 0.60 rating, 0.20 phone, 0.20 copy pack', () => {
  const full = viabilityOf({ rating: '5', reviewCount: '1000', hasPhone: true, hasCopyPack: true });
  // rating component saturates at 1, so weighted = 1.0 and value = floor + range
  assert.ok(Math.abs(full.value - 1.0) < 1e-9);

  const noPhone = viabilityOf({ rating: '5', reviewCount: '1000', hasPhone: false, hasCopyPack: true });
  assert.ok(Math.abs(full.value - noPhone.value - 0.75 * 0.2) < 1e-9);

  const noPack = viabilityOf({ rating: '5', reviewCount: '1000', hasPhone: true, hasCopyPack: false });
  assert.ok(Math.abs(full.value - noPack.value - 0.75 * 0.2) < 1e-9);
});

/**
 * Under the single-sweep design the sweep buys rating for every result, so an
 * empty rating means Google had none — a zero-review business — not that we
 * declined to look. It is scored neutral and says so.
 */
test('a business with no rating scores neutral, not zero, and says so', () => {
  const v = viabilityOf({ rating: '', reviewCount: '', hasPhone: true, hasCopyPack: true });
  assert.equal(v.ratingComponent, NEUTRAL_RATING_COMPONENT);
  assert.equal(v.ratingMeasured, false);
  assert.match(v.reasons[0].text, /no rating on their Google listing/);
  assert.match(v.reasons[0].text, /neutral/);
});

test('a zero rating is treated as unmeasured, never as a bad rating', () => {
  const v = viabilityOf({ rating: '0', reviewCount: '0', hasPhone: true, hasCopyPack: true });
  assert.equal(v.ratingMeasured, false);
  assert.equal(v.ratingComponent, NEUTRAL_RATING_COMPONENT);
});

test('more reviews at the same rating is worth more, up to saturation', () => {
  const few = viabilityOf({ rating: '4.5', reviewCount: '3', hasPhone: true, hasCopyPack: true });
  const many = viabilityOf({ rating: '4.5', reviewCount: '90', hasPhone: true, hasCopyPack: true });
  assert.ok(many.value > few.value);
});

// --- whole score -----------------------------------------------------------

test('no website beats a failing live site beats a clean live site', () => {
  const noSite = scoreProspect({ result: result({ website: '' }), websiteStatus: 'none', neglect: undefined });
  const failing = scoreProspect({ result: result(), websiteStatus: 'live', neglect: 0.9 });
  const clean = scoreProspect({ result: result(), websiteStatus: 'live', neglect: 0.05 });
  assert.ok(noSite.score > failing.score, `${noSite.score} !> ${failing.score}`);
  assert.ok(failing.score > clean.score, `${failing.score} !> ${clean.score}`);
});

test('every score carries exactly three reasons', () => {
  const s = scoreProspect({ result: result(), websiteStatus: 'none', neglect: undefined });
  assert.equal(s.reasons.length, 3);
});

/**
 * Reasons are ranked by computed contribution, not a fixed template, so what a
 * row says about itself is what actually drove its number.
 */
test('reasons are ranked by contribution, and lead with what dominated', () => {
  const s = scoreProspect({ result: result(), websiteStatus: 'none', neglect: undefined });
  assert.match(s.reasons[0], /no website at all/);
});

test('a fatal viability gap surfaces in the reasons rather than hiding', () => {
  const s = scoreProspect({
    result: result({ phone: '', rating: '', reviewCount: '' }),
    websiteStatus: 'none',
    neglect: undefined,
  });
  assert.ok(
    s.reasons.some((r) => /no phone number/.test(r)),
    `a lead that cannot be called must say so. Got: ${JSON.stringify(s.reasons)}`,
  );
});

test('the score is 0-100', () => {
  const best = scoreProspect({
    result: result({ rating: '5', reviewCount: '5000' }),
    websiteStatus: 'none',
    neglect: undefined,
  });
  const worst = scoreProspect({
    result: result({ phone: '', rating: '', reviewCount: '', copyPack: '' }),
    websiteStatus: 'live',
    neglect: 0,
  });
  assert.ok(best.score <= 100 && best.score >= 0);
  assert.ok(worst.score >= 0 && worst.score < best.score);
  assert.equal(best.score, 100);
});

/**
 * The defect the served-site exercise caught.
 *
 * A live site the audit cap skipped scored 0.10 on opportunity — below every
 * viability component — so its one caveat fell out of the top three reasons.
 * The row read as three positives with no hint its site was never measured.
 * The score was right and the sentence was a lie.
 */
test('an unaudited live site leads with the caveat, not with its good reviews', () => {
  const s = scoreProspect({
    result: result({ rating: '4.5', reviewCount: '80' }),
    websiteStatus: 'live',
    neglect: undefined,
  });
  assert.match(
    s.reasons[0],
    /not audited/,
    `an unmeasured site must say so first. Got: ${JSON.stringify(s.reasons)}`,
  );
});

test('the website condition is always the headline reason', () => {
  const cases = [
    ['none', undefined],
    ['dead', undefined],
    ['parked', undefined],
    ['live', 0],
    ['live', 0.5],
    ['live', 1],
    ['live', undefined],
  ];
  for (const [status, neglect] of cases) {
    const s = scoreProspect({
      result: result({ rating: '5', reviewCount: '5000' }),
      websiteStatus: status,
      neglect,
    });
    assert.match(
      s.reasons[0],
      /website|live site/,
      `${status}/${neglect}: expected the site's condition to lead, got ${JSON.stringify(s.reasons)}`,
    );
  }
});

test('a healthy live site still says its site is fine rather than hiding it', () => {
  const s = scoreProspect({
    result: result({ rating: '4.8', reviewCount: '300' }),
    websiteStatus: 'live',
    neglect: 0,
  });
  assert.match(s.reasons[0], /passing every audit check/);
});
