import assert from 'node:assert/strict';
import { test } from 'node:test';

import { generate, prospectFor, TITLE_MAX, titleLength } from '../dist/index.js';

/**
 * The regression behind issue #55.
 *
 * 17 of the 50 demos in the 2026-08-16 Bergen batch failed to build, all on the
 * same gate and all on the same page: `check-metadata.mjs` refuses a `<title>`
 * over 70 characters, and `Name — Trade in Town` overran it by 1 to 24
 * characters for every business with a long name. The demos were generated;
 * only the build step failed. Nothing was wrong with the pages.
 *
 * Two properties are asserted here, and the second matters as much as the first.
 *
 *  1. **No composed home title exceeds the gate**, whatever the name.
 *  2. **A title that already fits is byte-identical to what it was.** The tiers
 *     engage on overflow only, which is what keeps the eight hand-authored
 *     clients — every one of which fits at tier 1 — out of this change.
 *
 * The records are the five hand-authored ones in `src/prospects/`, cloned and
 * given longer trading names. Cloning rather than inventing a record from
 * scratch keeps the fixture honest: everything except the name is a fact
 * somebody checked, so the generator runs against the same input shape it does
 * in production, and the fabrication guard is exercised rather than bypassed.
 *
 * The long names are made up, and deliberately so — they are the *shape* of the
 * real ones (a trade, a qualifier, a legal suffix, an ampersand) without being
 * anybody's business. CLAUDE.md forbids committing third-party business data;
 * the real 50 live in gitignored `prospects/`.
 */

/** A record with a different trading name and nothing else touched. */
function renamed(slug, name) {
  const base = prospectFor(slug);
  return { ...base, tradingName: { ...base.tradingName, value: name } };
}

const LONG_NAMES = [
  // 45 chars with an ampersand — the worst case in the batch, at 94 escaped.
  'Avishar Contractors Kitchen & Bath Remodeling',
  // A legal suffix and a hyphenated qualifier.
  'C4M of NJ Home Renovation - Affordable Handyman',
  // Two ampersands: the escaped length is 8 over the raw one.
  'Chandler & Daughters Roofing & Construction',
  // Long, no punctuation at all.
  'Northvale Designs General Contractors Limited',
  // Right on the line: 70 escaped characters as a bare name.
  'The Extremely Long Bergen County Fabrication And Welding Co',
];

test('every hand-authored record fits the gate, and is unchanged', () => {
  for (const slug of ['kh-machine-works', 'kts-machine-shop', 'ks-welding']) {
    const title = generate(prospectFor(slug)).seo.home.title;
    assert.ok(
      titleLength(title) <= TITLE_MAX,
      `${slug}: "${title}" is ${titleLength(title)} chars`,
    );
    // Tier 1, byte for byte: name, em dash, trade, " in ", town. If this fails,
    // the tiers have started engaging on titles that already fitted and a
    // delivered client's <title> has moved.
    assert.match(title, / — .+ in .+$/, `${slug}: "${title}" is not the full tier-1 formula`);
    assert.equal(generate(prospectFor(slug)).seoNotes.length, 0, `${slug}: narrowed unnecessarily`);
  }
});

test('a long name never pushes the title over the gate', () => {
  for (const slug of ['kh-machine-works', 'ks-welding']) {
    const town = prospectFor(slug).town.value;
    for (const name of LONG_NAMES) {
      const out = generate(renamed(slug, name));
      const title = out.seo.home.title;
      const length = titleLength(title);

      assert.ok(
        length <= TITLE_MAX,
        `${slug} as "${name}": "${title}" is ${length} chars (max ${TITLE_MAX})`,
      );
      // The name survives whole. This is the rule with no exceptions: a machine
      // truncating somebody's business name is worse than a title that is one
      // tier thinner than we wanted.
      assert.ok(
        title.startsWith(name),
        `${slug} as "${name}": the name was altered — got "${title}"`,
      );

      /*
       * Narrowed if and only if noted, both directions.
       *
       * The first version of this test demanded a note for every long name and
       * failed on a 45-character name that still fitted at tier 1 with a short
       * trade ("… — Welding in Bergenfield", 70 exactly). That was the test
       * being wrong: a title that fits is not a narrowing, and reporting one
       * would train the operator to skim the notes.
       */
      const fullFormula = title.endsWith(` in ${town}`);
      if (fullFormula) {
        assert.equal(
          out.seoNotes.length,
          0,
          `${slug} as "${name}": "${title}" is the full formula but was reported as narrowed`,
        );
      } else {
        assert.ok(
          out.seoNotes.length > 0,
          `${slug} as "${name}": title was narrowed to "${title}" with no note`,
        );
      }
    }
  }
});

test('the ladder gives up the town before it gives up the trade', () => {
  // 46 chars: tier 1 overruns, tier 2 (name + full trade, no town) fits.
  const out = generate(renamed('ks-welding', 'C4M of NJ Home Renovation - Affordable Handyman'));
  const title = out.seo.home.title;
  assert.ok(titleLength(title) <= TITLE_MAX, title);
  assert.ok(title.includes(' — '), `the trade was dropped entirely: "${title}"`);
  assert.ok(!/ in [A-Z]/.test(title.split(' — ')[1] ?? ''), `the town survived tier 2: "${title}"`);
});

test('a name that alone overruns is emitted whole, not truncated', () => {
  const huge =
    'The Considerably Longer Than Seventy Characters Bergen County Welding & Fabrication Company';
  const out = generate(renamed('ks-welding', huge));
  assert.equal(out.seo.home.title, huge, 'the name was truncated');
  assert.ok(titleLength(out.seo.home.title) > TITLE_MAX);
  assert.match(
    out.seoNotes.join(' '),
    /not truncated/,
    'an over-gate title was emitted with no note saying the build will fail',
  );
});

test('titleLength counts what the gate counts', () => {
  assert.equal(titleLength('a & b'), '&'.length + 'a  b'.length + 4);
  assert.equal(titleLength('plain'), 5);
  // Quotes are not escaped in element content, so they must not be counted as
  // if they were. Counting them would narrow titles that would have passed.
  assert.equal(titleLength(`Bob's "Shop"`), 12);
});
