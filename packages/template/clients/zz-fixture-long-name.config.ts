import type { SiteConfig } from '../src/types/site';
import { designFor } from './design';

/**
 * TEST FIXTURE — NOT A PROSPECT. NOT A CLIENT. NEVER DEPLOYED.
 *
 * The standing regression case for the header lockup rule, and the only build
 * in the repo that exercises the `/gallery` route.
 *
 * WHY IT EXISTS. `design.css` used to resolve a business name too wide for the
 * header bar by ellipsising it — `K-H Machine Works` was rendered as
 * `K-H Machine Wo…` on the shop's own site at 320px. The rule that replaced it
 * escalates instead (fluid size, then tracking, then a second line) and stops
 * before truncation, so the guarantee "a business name is never shortened to
 * fit" is enforced by `check:textfit` at gate time rather than by construction.
 * A gate is only worth what it is exercised against, and the two real clients
 * with awkward names could each be renamed by their owner tomorrow. This
 * fixture cannot be: it is invented, it is pinned here, and its whole job is to
 * sit near the measured bound so the bound cannot be relaxed by accident.
 *
 * THE NAME IS THE FIXTURE. `Alder & Voss Welding Company` is 28 characters
 * with an ampersand and a trailing "Company" — the shape that wraps worst,
 * because the conjunction offers a tempting break that leaves one line almost
 * empty. Under the old stylesheet it truncated at every one of the five gated
 * viewports. Under the new one it must set on at most two lines at all of them,
 * in all 112 cells, including Heritage's signwriter — the widest display face
 * in the matrix. See the measured budget above `.d-header__name` in design.css.
 *
 * WHY THE NAME IS NOT MARKED "(test data)" LIKE THE OTHER FIXTURE'S.
 * `zz-fixture-phone-optional` carries the marker inside `business.name`, and
 * that is the right default. It cannot be the default here: the marker adds
 * twelve characters to the one string this fixture exists to measure, which
 * would put it past the two-line bound and make the fixture fail the gate it
 * was built to defend. So the marker moves to every *other* identity field
 * instead — `legalName` carries it, and it is `legalName` the footer prints in
 * the copyright line, so it appears on every rendered page. Everything else is
 * unmistakable on its own: a 555-01xx number (reserved for fiction, rings
 * nowhere), an invented town, and `example.invalid` as the domain.
 *
 * NEVER DEPLOYED, by the pipeline rather than by a note:
 *   - `scripts/build-all.mjs` skips every `zz-fixture-` slug, so it never
 *     lands in `dist/` during a batch and therefore never reaches
 *     `deploy-mockups.mjs`, which publishes whatever it finds there;
 *   - `seo.noindex` is true, as in every config here.
 *
 * Build it deliberately, on its own:
 *   SITE_CLIENT=zz-fixture-long-name pnpm exec astro build
 *
 * `astro build` rather than `pnpm build`, and the difference is not a detail.
 * The `build` script chains `check-fabrication.mjs`, which resolves every claim
 * on the page against that slug's prospect record — and a fixture has no
 * prospect record, because it describes no business for a record to be about.
 * So `pnpm build` fails here at the fabrication step, and it fails identically
 * for `zz-fixture-phone-optional`; this is the state on `main` and not
 * something this fixture introduced. Neither fixture meets it during a normal
 * run, because `build-all.mjs` skips both. The gates that *do* apply to a
 * fixture — markers, contrast, contact links, form fields, textfit, overflow —
 * are run against it directly and all pass.
 */
const base: SiteConfig = {
  business: {
    name: 'Alder & Voss Welding Company',
    legalName: 'Alder & Voss Welding Company (test data)',
    tagline: 'Invented business. Used to test the header lockup, nothing else.',
    foundedYear: 1974,
    // 555-01xx is reserved for fiction and rings nowhere.
    phone: '(555) 010-0142',
    phoneHref: '+15550100142',
    smsHref: '+15550100142',
    email: 'nobody@example.invalid',
    address: {
      street: '18 Kiln Road',
      locality: 'Testville',
      region: 'NJ',
      postalCode: '07000',
      country: 'US',
    },
    serviceArea: ['Testville', 'North Testville', 'Kiln Valley'],
    timezone: 'America/New_York',
    hours: [
      { day: 'Monday', opens: '07:30', closes: '16:00' },
      { day: 'Tuesday', opens: '07:30', closes: '16:00' },
      { day: 'Wednesday', opens: '07:30', closes: '16:00' },
      { day: 'Thursday', opens: '07:30', closes: '16:00' },
      { day: 'Friday', opens: '07:30', closes: '15:00' },
      { day: 'Saturday', closed: true },
      { day: 'Sunday', closed: true },
    ],
  },

  theme: {
    colors: {
      primary: '#1f4e79',
      accent: '#b03a12',
    },
    fonts: {
      heading: 'ui-sans-serif, system-ui, "Segoe UI", Roboto, Arial, sans-serif',
      body: 'ui-sans-serif, system-ui, "Segoe UI", Roboto, Arial, sans-serif',
      faces: [],
    },
  },

  brand: {
    logo: '/images/logo.svg',
    favicon: '/favicon.svg',
    ogImage: '/images/og.svg',
  },

  hero: {
    /*
     * `Machining` on its own line is the other half of this fixture.
     *
     * At 320px in Heritage's signwriter the single word `Machining` set 261px
     * wide in a 230px column and was clipped against the edge of the phone by
     * `body { overflow-x: hidden }`. No element's box crossed the viewport, so
     * `check:overflow` could not see it. The headline below keeps a long
     * unbreakable word in the first position deliberately, so the hero's size
     * curve stays exercised at the narrow widths.
     */
    headline: 'Fabrication and welding, done in the shop.',
    subhead:
      'An invented business. This build exists to exercise the header lockup rule and the gallery route.',
    ctaPrimary: { text: 'Send us the job', href: '/contact' },
    ctaSecondary: { text: 'See what we do', href: '/services' },
    image: '/images/hero.svg',
    imageAlt: 'Placeholder illustration',
  },

  trustStrip: [
    { icon: 'wrench', label: 'Test fixture' },
    { icon: 'gear', label: 'Long business name' },
    { icon: 'shield', label: 'Never deployed' },
  ],

  services: [
    {
      slug: 'fabrication',
      title: 'Fabrication',
      oneLiner: 'A service that does not exist, for a business that does not exist.',
      icon: 'gear',
      image: '/images/service-precision-machining.svg',
      imageAlt: 'Placeholder illustration',
    },
    {
      slug: 'welding-and-repair',
      title: 'Welding and repair',
      oneLiner: 'A second invented service, so the services route renders more than one section.',
      icon: 'wrench',
      image: '/images/service-welding.svg',
      imageAlt: 'Placeholder illustration',
    },
  ],

  about: {
    headline: 'A fixture, not a shop.',
    entry: 'about',
    image: '/images/story.svg',
    imageAlt: 'Placeholder illustration',
  },

  testimonials: [
    {
      quote:
        'Invented quotation, kept here so the reviews section has something to render on a fixture.',
      attribution: 'Not a real customer',
      role: 'Test fixture',
      rating: 5,
      sourceNote: 'Invented for a test fixture. No customer, real or otherwise, said this.',
      status: 'placeholder',
    },
  ],

  certifications: [
    {
      label: 'Invented credential',
      detail: 'Exists so the about route has a credentials block to render. Not a real certification.',
    },
  ],

  cta: {
    headline: 'Still a fixture.',
    body: 'Nothing here describes a real business.',
    buttonText: 'Send a message',
    buttonHref: '/contact',
  },

  pages: {
    home: {
      servicesHeading: 'Two invented services',
      servicesIntro: 'Enough content for the page to render. No more than that.',
    },
    services: {
      title: 'What we do',
      intro: 'Two invented services, for a fixture.',
      metaDescription: 'Test fixture. Not a real business.',
    },
    about: {
      eyebrow: 'Alder & Voss · Testville, NJ',
      metaDescription: 'Test fixture. Not a real business.',
    },
    contact: {
      title: 'Get in touch',
      intro: 'Nothing submitted here goes anywhere. This is a test fixture.',
      metaDescription: 'Test fixture. Not a real business.',
    },
  },

  seo: {
    titleTemplate: '%s | Alder & Voss Welding Company',
    defaultDescription: 'Test fixture for the header lockup rule. Not a real business.',
    siteUrl: 'https://example.invalid',
    noindex: true,
  },

  features: {
    /*
     * The only build in the repo with the gallery on.
     *
     * `features.gallery` is `false` in all eight client configs, so no client
     * emits `/gallery` at all — turning it on for a real shop needs real
     * photographs of that shop's own work, which is a content decision and not
     * one a coverage stream gets to make. The route still has to be built and
     * gated somewhere, and a fixture with declared placeholders is the honest
     * place for it.
     */
    gallery: true,
    // Pitch build, so `check:textfit` sweeps all 112 cells against this name
    // rather than the one cell a delivered build would offer.
    customizer: true,
    offline: false,
  },

  forms: {
    mode: 'worker',
    workerEndpoint: '',
    maxUploadMB: 10,
    acceptedFileTypes: ['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'application/pdf'],
    turnstileSiteKey: '',
    quickQuote: {
      enabled: true,
      heading: 'Tell us about the job',
      blurb: 'A name, a number and a line about the work.',
      buttonText: 'Send it over',
      placements: ['home', 'cta'],
    },
  },
};

export const site: SiteConfig = { ...base, design: designFor('zz-fixture-long-name', base) };

export default site;
