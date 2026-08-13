import type { SiteConfig } from '../src/types/site';
import { designFor } from './design';

/**
 * TEST FIXTURE — NOT A PROSPECT. NOT A CLIENT. NEVER DEPLOYED.
 *
 * Where the motion axis is proved, and where the `apex` family is exercised on
 * a build of its own.
 *
 * WHY IT EXISTS. `data-motion-preset` is a pitch-only attribute, so the three
 * presets are unreachable on any delivered build — which is the whole point of
 * the design, and also the reason none of the eight clients can be the thing
 * that proves it works. `check:reveal` sweeps `?motion=still|calm|lively` here.
 *
 * THE PAGE IS SHAPED BY WHAT HAS TO BE MEASURED. Two of the three motion
 * contracts say something CSS cannot express, and both need a section to say
 * it about:
 *
 *   - `counters: paint` needs `[data-count-to]` on the page, so `stats` is
 *     enabled with three figures. Under `still` they must already read their
 *     final value; a counter sitting at 0 because no observer fired is the
 *     preset withholding information rather than withholding motion.
 *   - `carousel: off` needs a rail with a timer, so `reviews.variant` is
 *     `carousel` with a 2500ms autoplay — the only build in the repo that
 *     carries one. `check:reveal` reads `scrollLeft`, waits past the delay and
 *     reads it again, so "the timer never started" is measured rather than
 *     inferred from the script.
 *
 * `gallery` is off here, unlike `zz-fixture-long-name`: that fixture already
 * owns the gallery route, and a second copy would be two fixtures to keep in
 * step for one route's coverage.
 *
 * THE FAMILY IS PART OF THE FIXTURE. `apex/dark/lime/grotesk` — a new family,
 * in its own default tone, on its most saturated accent. The families ship
 * with `check:contrast` and `check:switching` behind them, but neither of
 * those renders a whole page; this is where apex's cosmetic block (the
 * hairline card rule, the accent tick under headings, the stat left-border)
 * is actually built and swept by `check:textfit` and `check:overflow`.
 *
 * The invented identity follows `zz-fixture-long-name`'s rules: a 555-01xx
 * number reserved for fiction, an invented town, `example.invalid` as the
 * domain, and the "(test data)" marker on `legalName`, which the footer prints
 * in the copyright line on every rendered page.
 *
 * NEVER DEPLOYED, by the pipeline rather than by a note:
 *   - `scripts/build-all.mjs` skips every `zz-fixture-` slug, so it never
 *     lands in `dist/` during a batch and therefore never reaches
 *     `deploy-mockups.mjs`, which publishes whatever it finds there;
 *   - `seo.noindex` is true, as in every config here.
 *
 * Build it deliberately, on its own:
 *   SITE_CLIENT=zz-fixture-motion pnpm exec astro build
 *
 * `astro build` rather than `pnpm build`, for the reason recorded at length in
 * `zz-fixture-long-name.config.ts`: `check-fabrication.mjs` resolves every
 * claim against a prospect record, and a fixture describes no business for a
 * record to be about.
 */
const base: SiteConfig = {
  business: {
    name: 'Vane & Rell Motorworks',
    legalName: 'Vane & Rell Motorworks (test data)',
    tagline: 'Invented business. Used to test the motion axis, nothing else.',
    foundedYear: 1998,
    // 555-01xx is reserved for fiction and rings nowhere.
    phone: '(555) 010-0177',
    phoneHref: '+15550100177',
    smsHref: '+15550100177',
    email: 'nobody@example.invalid',
    address: {
      street: '4 Camber Way',
      locality: 'Testville',
      region: 'NJ',
      postalCode: '07000',
      country: 'US',
    },
    serviceArea: ['Testville', 'North Testville', 'Kiln Valley'],
    timezone: 'America/New_York',
    hours: [
      { day: 'Monday', opens: '08:00', closes: '17:00' },
      { day: 'Tuesday', opens: '08:00', closes: '17:00' },
      { day: 'Wednesday', opens: '08:00', closes: '17:00' },
      { day: 'Thursday', opens: '08:00', closes: '17:00' },
      { day: 'Friday', opens: '08:00', closes: '16:00' },
      { day: 'Saturday', closed: true },
      { day: 'Sunday', closed: true },
    ],
  },

  theme: {
    colors: {
      primary: '#0b0d0f',
      accent: '#4a6b00',
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
    headline: 'Diagnostics and repair, done in the shop.',
    subhead:
      'An invented business. This build exists to exercise the motion axis and the apex family.',
    ctaPrimary: { text: 'Book the job', href: '/contact' },
    ctaSecondary: { text: 'See what we do', href: '/services' },
    image: '/images/hero.svg',
    imageAlt: 'Placeholder illustration',
  },

  trustStrip: [
    { icon: 'wrench', label: 'Test fixture' },
    { icon: 'gear', label: 'Motion axis' },
    { icon: 'shield', label: 'Never deployed' },
  ],

  services: [
    {
      slug: 'diagnostics',
      title: 'Diagnostics',
      oneLiner: 'A service that does not exist, for a business that does not exist.',
      icon: 'gear',
      image: '/images/service-precision-machining.svg',
      imageAlt: 'Placeholder illustration',
    },
    {
      slug: 'repair-and-service',
      title: 'Repair and service',
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

  /*
   * Three, not one. The reviews rail is a carousel on this fixture and a rail
   * with a single card has nothing to scroll — `scrollWidth` would equal
   * `clientWidth`, the timer's `scrollTo` would be a no-op, and the
   * `carousel: off` assertion would pass without ever having been tested.
   */
  testimonials: [
    {
      quote:
        'Invented quotation, kept here so the reviews rail has more than one card to advance through.',
      attribution: 'Not a real customer',
      role: 'Test fixture',
      rating: 5,
      sourceNote: 'Invented for a test fixture. No customer, real or otherwise, said this.',
      status: 'placeholder',
    },
    {
      quote:
        'A second invented quotation. Without it the carousel has nothing to scroll and the still preset would have nothing to stop.',
      attribution: 'Also not a real customer',
      role: 'Test fixture',
      rating: 5,
      sourceNote: 'Invented for a test fixture. No customer, real or otherwise, said this.',
      status: 'placeholder',
    },
    {
      quote:
        'A third invented quotation, so the rail is wider than the viewport at every gated width.',
      attribution: 'Not a real customer either',
      role: 'Test fixture',
      rating: 4,
      sourceNote: 'Invented for a test fixture. No customer, real or otherwise, said this.',
      status: 'placeholder',
    },
  ],

  certifications: [
    {
      label: 'Invented credential',
      detail:
        'Exists so the about route has a credentials block to render. Not a real certification.',
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
      eyebrow: 'Vane & Rell · Testville, NJ',
      metaDescription: 'Test fixture. Not a real business.',
    },
    contact: {
      title: 'Get in touch',
      intro: 'Nothing submitted here goes anywhere. This is a test fixture.',
      metaDescription: 'Test fixture. Not a real business.',
    },
  },

  seo: {
    titleTemplate: '%s | Vane & Rell Motorworks',
    defaultDescription: 'Test fixture for the motion axis. Not a real business.',
    siteUrl: 'https://example.invalid',
    noindex: true,
  },

  features: {
    // The gallery route belongs to `zz-fixture-long-name`; one fixture per
    // route's coverage is enough to keep in step.
    gallery: false,
    // Pitch build: `data-motion-preset` is emitted only here, so without this
    // there is no motion axis on the page to sweep.
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

export const site: SiteConfig = { ...base, design: designFor('zz-fixture-motion', base) };

export default site;
