import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildDesign, loadPresets } from '../dist/design.js';
import { designAccentPasses } from '../dist/color.js';
import { emptyProspect } from '../dist/schema.js';

/**
 * PR #54's Brief item 4, ruled 2026-08-17.
 *
 * 44 of the 50 prospects in the 2026-08-16 Bergen batch are general
 * contractors, `presetFor` keys on niche, and `buildDesign` pinned both the tone
 * and the accent — so 44 demos came out byte-identical in design. Every
 * individual decision was right and the aggregate was a pitch problem.
 *
 * What is asserted here is the whole of the ruling: variety *within* the family,
 * deterministic, keyed on the place id, and AA-passing only. The family mapping
 * itself is `presetFor`'s and is asserted in `niche-preset.test.mjs`.
 *
 * The prospects are synthetic — `emptyProspect` plus a place id. Nothing here
 * needs a real business, which is the point: the rotation is a pure function of
 * an identifier.
 */

/** A minimal prospect: no brand colours, so no `brandAccent` to take precedence. */
function fixture(id, placeId) {
  const p = emptyProspect(id, '2026-08-17T00:00:00.000Z');
  if (placeId !== undefined) {
    p.placeId = { status: 'known', value: placeId, source: 'website', retrievedAt: '2026-08-17' };
  }
  return p;
}

/** The smallest `SiteConfig` `buildDesign` reads. */
const site = {
  business: {
    name: 'Fixture Co',
    legalName: 'Fixture Co',
    tagline: 'Work in Fairview, NJ.',
    phone: '(201) 000-0000',
    phoneHref: '+12010000000',
    address: { locality: 'Fairview', region: 'NJ', country: 'US' },
    serviceArea: ['Fairview'],
  },
  hero: {
    headline: 'Work in Fairview, NJ',
    subhead: 'Tell us what you need.',
    ctaPrimary: { text: 'Get in touch', href: '/contact' },
    ctaSecondary: { text: 'See what we do', href: '/services' },
    image: '/images/hero.svg',
    imageAlt: 'Fixture Co',
  },
  trustStrip: [],
  services: [
    {
      slug: 'what-we-do',
      title: 'What we do',
      oneLiner: 'Work for customers in Fairview.',
      icon: 'gear',
      image: '/images/gallery-1.svg',
      imageAlt: 'Work at Fixture Co',
    },
  ],
  testimonials: [],
  pages: {
    home: { servicesHeading: 'What we do', servicesIntro: 'One shop, start to finish.' },
    services: { title: 'What we do', intro: 'In-house.', metaDescription: 'What we do.' },
    about: { eyebrow: 'Fixture Co', metaDescription: 'About Fixture Co.' },
    contact: { title: 'Tell us about the job', intro: 'Send details.', metaDescription: 'Contact.' },
  },
};

const copy = { pack: null, notes: [], droppedQuestions: [], seoWarnings: [], seoNotes: [] };

const themeFor = (prospect, preset) =>
  buildDesign({ prospect, site, copy, preset }).design.theme;

test('the same place id always gets the same design', () => {
  const a = themeFor(fixture('one', 'ChIJplaceid0000000000000001'), 'meridian');
  const b = themeFor(fixture('one', 'ChIJplaceid0000000000000001'), 'meridian');
  assert.deepEqual(a, b);

  // And the slug is not the key when a place id is present: two records that
  // differ only in slug must land on the same design, because it is the same
  // business under a different filename.
  const c = themeFor(fixture('a-different-slug', 'ChIJplaceid0000000000000001'), 'meridian');
  assert.equal(c.scheme, a.scheme);
  assert.equal(c.accent, a.accent);
});

test('a record with no place id falls back to the slug, not to a crash', () => {
  const a = themeFor(fixture('no-place-id-here'), 'meridian');
  const b = themeFor(fixture('no-place-id-here'), 'meridian');
  assert.equal(a.accent, b.accent);
  assert.notEqual(a.accent, '');
  assert.ok(['light', 'dark'].includes(a.scheme));
});

test('the rotation reaches every combination the family offers', () => {
  // 200 synthetic place ids is well past the point where an unbiased draw covers
  // 16 buckets. Falling short here means the two indices have become correlated
  // again — which is exactly what happened once, and cost half the variety
  // without changing anything visible in the code. See `hashKey`.
  const seen = new Set();
  for (let i = 0; i < 200; i += 1) {
    const t = themeFor(fixture(`slug-${i}`, `ChIJsynthetic${i}`), 'meridian');
    seen.add(`${t.scheme}/${t.accent}`);
  }

  const meridian = loadPresets().presets.find((p) => p.id === 'meridian');
  const available =
    Object.keys(meridian.schemes).length * meridian.schemes[meridian.defaultScheme].accents.length;
  assert.equal(seen.size, available, `reached ${seen.size} of ${available} combinations`);
});

test('every accent the rotation can select clears WCAG AA in its own tone', () => {
  for (const preset of loadPresets().presets) {
    const chosen = new Map();
    for (let i = 0; i < 120; i += 1) {
      const t = themeFor(fixture(`slug-${i}`, `ChIJsynthetic${preset.id}${i}`), preset.id);
      chosen.set(`${t.scheme}/${t.accent}`, t);
    }
    for (const [label, theme] of chosen) {
      const tone = preset.schemes[theme.scheme];
      const swatch = tone.accents.find((a) => a.id === theme.accent);
      assert.ok(swatch, `${preset.id}: selected accent "${theme.accent}" is not in the ${theme.scheme} tone`);
      assert.ok(
        designAccentPasses(tone.palette, swatch.accent, swatch.onAccent),
        `${preset.id} ${label}: selected an accent that fails contrast`,
      );
    }
  }
});

test('the family is never rotated — only the tone and accent inside it', () => {
  for (const preset of loadPresets().presets) {
    for (let i = 0; i < 40; i += 1) {
      const t = themeFor(fixture(`slug-${i}`, `ChIJsynthetic${i}`), preset.id);
      assert.equal(t.preset, preset.id);
      // The font pairing is deliberately not a variety axis: a family's first
      // pairing is the one its headline sizes were tuned against.
      assert.equal(t.fontPairing, preset.fonts[0].id);
    }
  }
});
