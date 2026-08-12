import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  classifyWebsite,
  legacySignal,
  presetFor,
  MIN_CONTENT_WORDS,
} from '../dist/index.js';

/**
 * The regression that made this stream necessary.
 *
 * Wortmann Machine Works is a real machine shop in Teterboro, NJ. Their listed
 * domain had lapsed onto a domain-marketplace sale page, and the demo pipeline
 * read that page as the business speaking. The generated site offered two
 * services — "WortmannMachineWorks.com" and "Why WortmannMachineWorks.com is
 * worth it" — and wore a green-and-purple palette extracted from a marketplace
 * logo. Every one of those is a claim published under a real business's name
 * that the business never made.
 *
 * The fixture below is **hand-written**, not a saved copy of anyone's page.
 * CLAUDE.md forbids committing third-party business data, so the classifier is
 * a pure function over a signals object precisely so that its regression test
 * can live in git. What is reproduced is the *shape* of what was seen: the
 * marketplace's own name in the structured data, the two sale headings, and
 * the absence of anything a business would put on a page.
 */
const wortmannParked = {
  requestedUrl: 'https://www.wortmannmachineworks.com/',
  finalUrl: 'https://www.wortmannmachineworks.com/',
  httpStatus: 200,
  title: 'WortmannMachineWorks.com',
  bodyText:
    'WortmannMachineWorks.com Why WortmannMachineWorks.com is worth it ' +
    'Make an offer Related searches',
  contentWords: 14,
  hasContactLink: false,
  hasBusinessJsonLd: false,
  jsonLdNames: ['ExpiredDomains.com'],
  headings: ['WortmannMachineWorks.com', 'Why WortmannMachineWorks.com is worth it'],
};

test('the Wortmann parking page is classified parked, not live', () => {
  const verdict = classifyWebsite(wortmannParked);
  assert.equal(verdict.status, 'parked');
  assert.equal(verdict.rule, 'marketplace-name');
  assert.match(verdict.reason, /ExpiredDomains/);
});

test('a parked verdict survives losing any single signal', () => {
  // Belt and braces on the one case that has actually burned us. Each variant
  // removes one tell and must still come out parked, because the failure mode
  // is not "we missed a rule" — it is "we shipped a machine shop's site with a
  // domain broker's copy on it".
  const withoutJsonLd = { ...wortmannParked, jsonLdNames: [] };
  assert.equal(classifyWebsite(withoutJsonLd).status, 'parked');

  const withoutHeadings = { ...wortmannParked, jsonLdNames: [], headings: [] };
  assert.equal(classifyWebsite(withoutHeadings).status, 'parked');

  const textOnly = {
    ...wortmannParked,
    jsonLdNames: [],
    headings: [],
    contentWords: 120,
    hasContactLink: true,
    bodyText: 'This domain is for sale. Inquire about this domain.',
  };
  assert.equal(classifyWebsite(textOnly).status, 'parked');
  assert.equal(classifyWebsite(textOnly).rule, 'for-sale-text');
});

test('a registrar host and an off-domain meta refresh are both parked', () => {
  const redirected = {
    ...wortmannParked,
    title: '',
    bodyText: '',
    headings: [],
    jsonLdNames: [],
    finalUrl: 'https://sedoparking.com/wortmannmachineworks.com',
  };
  assert.equal(classifyWebsite(redirected).rule, 'parking-host');

  const refresh = {
    ...wortmannParked,
    title: '',
    bodyText: '',
    headings: [],
    jsonLdNames: [],
    metaRefreshUrl: 'https://www.hugedomains.com/domain_profile.cfm?d=example',
  };
  assert.equal(classifyWebsite(refresh).rule, 'parking-host');

  const offsite = {
    ...wortmannParked,
    title: '',
    bodyText: '',
    headings: [],
    jsonLdNames: [],
    contentWords: 200,
    hasContactLink: true,
    metaRefreshUrl: 'https://someotherplace.example/landing',
  };
  assert.equal(classifyWebsite(offsite).rule, 'meta-refresh-offsite');
});

test('unreachable and erroring domains are dead, and a missing URL is none', () => {
  assert.equal(classifyWebsite({ ...wortmannParked, httpStatus: null }).status, 'dead');
  assert.equal(classifyWebsite({ ...wortmannParked, httpStatus: 404 }).status, 'dead');
  assert.equal(classifyWebsite(null).status, 'none');
  assert.equal(classifyWebsite({ ...wortmannParked, requestedUrl: '  ' }).status, 'none');
});

/**
 * The other half of the bargain. A classifier that calls everything parked
 * would pass every test above and destroy the pipeline, because a real site
 * misread as parked loses the business its own phone number, address and
 * services.
 */
test('a thin but real one-page site is live', () => {
  const smallShop = {
    requestedUrl: 'https://example-machine-shop.test/',
    finalUrl: 'https://example-machine-shop.test/',
    httpStatus: 200,
    title: 'Example Machine Shop — Teterboro, NJ',
    bodyText:
      'Example Machine Shop has been turning and milling parts in Teterboro since 1974. ' +
      'Call us on 201-555-0100 or come by the unit on Hollister Road.',
    contentWords: 28,
    hasContactLink: true,
    hasBusinessJsonLd: false,
    jsonLdNames: [],
    headings: ['Example Machine Shop'],
  };
  // Under the word floor, but it has a tel: link — the floor never fires alone.
  assert.ok(smallShop.contentWords < MIN_CONTENT_WORDS);
  assert.equal(classifyWebsite(smallShop).status, 'live');
});

test('a site whose only heading is its own domain is live if you can call it', () => {
  const bareHeading = {
    requestedUrl: 'https://chasemachineco.test/',
    finalUrl: 'https://chasemachineco.test/',
    httpStatus: 200,
    title: 'Chase Machine Co',
    bodyText: 'Precision machining. '.repeat(20),
    contentWords: 60,
    hasContactLink: true,
    hasBusinessJsonLd: true,
    jsonLdNames: ['Chase Machine Co Inc'],
    headings: ['chasemachineco.com'],
  };
  assert.equal(classifyWebsite(bareHeading).status, 'live');
});

/* ------------------------------------------------------- the preset mapping */

test('the design family follows the template, not the old table', () => {
  // `design.ts` in the template: forge is "Machine shops, welding,
  // fabrication"; precision is "Contractors, HVAC, electrical". The old
  // NICHE_STYLES had these two swapped.
  assert.equal(presetFor('machine shop').preset, 'forge');
  assert.equal(presetFor('welding and fabrication').preset, 'forge');
  assert.equal(presetFor('general contractor').preset, 'precision');
  assert.equal(presetFor('hvac').preset, 'precision');
  assert.equal(presetFor(undefined).preset, 'precision');
});

test('heritage needs sourced evidence, never a hunch', () => {
  assert.equal(legacySignal({ thisYear: 2026 }), null);
  assert.equal(legacySignal({ foundedYear: 2015, thisYear: 2026 }), null);

  assert.ok(legacySignal({ foundedYear: 1918, thisYear: 2026 }));
  assert.ok(legacySignal({ legalName: 'Buxbaum Brothers Automotive', thisYear: 2026 }));
  assert.ok(legacySignal({ familyRun: 'Three generations of the family', thisYear: 2026 }));

  // And it outranks the niche: a machine shop trading since 1918 is a legacy
  // shop first and a machine shop second.
  const old = presetFor('machine shop', { foundedYear: 1918, thisYear: 2026 });
  assert.equal(old.preset, 'heritage');
  assert.match(old.rationale, /1918/);

  const young = presetFor('machine shop', { foundedYear: 2015, thisYear: 2026 });
  assert.equal(young.preset, 'forge');
});
