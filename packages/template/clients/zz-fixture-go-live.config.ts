import type { SiteConfig } from '../src/types/site';

/**
 * TEST FIXTURE — NOT A PROSPECT. NOT A CLIENT. NEVER A REAL BUSINESS.
 *
 * The only config in this directory with `seo.noindex: false`, and the reason
 * it exists.
 *
 * Every other config here is a mockup: `noindex` true, `robots.txt` disallowing
 * everything, no sitemap emitted at all. That is correct, and it means the
 * go-live half of the build — the half that flips a site from "private pitch"
 * to "please crawl this" — has never actually been executed by anything. A
 * branch nothing runs is a branch nobody has checked, and the first time it
 * would have run is on a real client's real domain, which is the worst possible
 * moment to discover it.
 *
 * So this fixture runs it. Building it exercises, end to end:
 *
 *   - `robots.txt` switching from `Disallow: /` to `Allow: /` plus a `Sitemap:`
 *     line that names a file which actually exists;
 *   - `@astrojs/sitemap` being included at all — `astro.config.mjs` omits the
 *     integration entirely while `noindex` is true;
 *   - `check-markers.mjs` in its strict mode, where a single unconfirmed value
 *     fails the build. Hence not one marker anywhere below;
 *   - `check-go-live.mjs`, whose every precondition is inert until `noindex`
 *     is false;
 *   - `check-metadata.mjs`'s live-mode rule that a social card must be a raster
 *     a platform will actually render.
 *
 * Why a fixture and not a real client: flipping a pitchable demo to `index`
 * would ask a search engine to crawl a mockup of somebody's business that they
 * have not signed off on. The standing rule is that a non-default config gets
 * proved on a throwaway, never on anything a prospect might see.
 *
 * Safety, in layers:
 *   - `scripts/build-all.mjs` skips the `zz-fixture-` prefix, so this never
 *     lands in `dist/` during a batch and therefore never reaches
 *     `scripts/deploy/deploy-mockups.mjs`, which publishes whatever it finds.
 *   - The business is invented and reads as invented. The phone number is in
 *     the 555-01xx range reserved for fiction.
 *   - `siteUrl` is on `.test`, a TLD reserved by RFC 6761 that can never be
 *     registered by anyone. A live-mode fixture has to carry a structurally
 *     real domain — `example.invalid` is what `check-go-live.mjs` rejects — and
 *     `.test` is the one way to have that without pointing at a name somebody
 *     could actually own.
 *
 * Build it deliberately, on its own:
 *   SITE_CLIENT=zz-fixture-go-live pnpm --filter @site-factory/template build
 */
export const site: SiteConfig = {
  business: {
    name: 'Go-Live Fixture Works (test data)',
    legalName: 'Go-Live Fixture Works (test data)',
    tagline: 'Invented business. Exists to prove the go-live build path.',
    phone: '(555) 010-0142',
    phoneHref: '+15550100142',
    email: 'nobody@fixture-go-live.test',
    address: {
      street: '1 Fixture Way',
      locality: 'Testville',
      region: 'NJ',
      postalCode: '07000',
      country: 'US',
    },
    serviceArea: ['Testville', 'Fixture County'],
    timezone: 'America/New_York',
    hours: [
      { day: 'Monday', opens: '08:00', closes: '16:00' },
      { day: 'Tuesday', opens: '08:00', closes: '16:00' },
      { day: 'Wednesday', opens: '08:00', closes: '16:00' },
      { day: 'Thursday', opens: '08:00', closes: '16:00' },
      { day: 'Friday', opens: '08:00', closes: '16:00' },
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
    // Its own generated 1200×630 raster, not the shared `/images/og.svg`
    // placeholder. A live build must not ship an SVG card: no major unfurler
    // renders one, so the link would arrive blank. See check-metadata.mjs.
    ogImage: '/og/zz-fixture-go-live.png',
  },

  hero: {
    headline: 'This is a go-live test fixture.',
    subhead:
      'It exists so the indexable build path can be proved without pointing a search engine at a real shop.',
    ctaPrimary: { text: 'Send a message', href: '/contact' },
    ctaSecondary: { text: 'See the services', href: '/services' },
    image: '/images/hero.svg',
    imageAlt: 'Placeholder illustration',
  },

  trustStrip: [
    { icon: 'wrench', label: 'Test fixture' },
    { icon: 'gear', label: 'Indexable build' },
    { icon: 'shield', label: 'Reserved .test domain' },
    { icon: 'phone', label: 'Never deployed' },
  ],

  services: [
    {
      slug: 'fixture-service',
      title: 'Fixture Service',
      oneLiner: 'A service that does not exist, for a business that does not exist.',
      icon: 'gear',
      image: '/images/service-precision-machining.svg',
      imageAlt: 'Placeholder illustration',
    },
  ],

  about: {
    headline: 'A fixture, not a shop.',
    entry: 'about',
    image: '/images/story.svg',
    imageAlt: 'Placeholder illustration',
  },

  // `placeholder` status, so the template's own "nobody said this" banner
  // renders over it. A live build may carry an unverified testimonial as long
  // as the page says so on its face; what it may not carry is *structured
  // data* claiming it as a review, which `canEmitReviewJsonLd` already refuses.
  testimonials: [
    {
      quote: 'Invented quotation, kept here so the testimonials section has something to render.',
      attribution: 'Not a real customer',
      role: 'Test fixture',
      rating: 5,
      sourceNote: 'Invented for a test fixture. No customer, real or otherwise, said this.',
      status: 'placeholder',
    },
  ],

  certifications: [],

  cta: {
    headline: 'Still a fixture.',
    body: 'Nothing here describes a real company, and the domain can never be registered.',
    buttonText: 'Send a message',
    buttonHref: '/contact',
  },

  pages: {
    home: {
      // Explicit, because the default (`name — tagline`) runs to 94 characters
      // here and check-metadata.mjs refuses a title past 70. That refusal is
      // the gate doing its job: a title Google truncates mid-sentence is a
      // worse first impression than a short one.
      title: 'Go-Live Fixture Works — a test fixture, not a business',
      servicesHeading: 'One invented service',
      servicesIntro: 'Enough content for the page to render. No more than that.',
      metaDescription:
        'Go-live test fixture for the indexable build path. Not a real business.',
    },
    services: {
      title: 'Services',
      intro: 'One invented service, for a fixture.',
      metaDescription: 'Go-live test fixture. Not a real business.',
    },
    about: {
      eyebrow: 'Go-Live Fixture Works · Testville, NJ',
      metaDescription: 'Go-live test fixture. Not a real business.',
    },
    contact: {
      title: 'Send a message',
      intro: 'A fixture form. Nothing sent here reaches anybody.',
      metaDescription: 'Go-live test fixture. Not a real business.',
    },
  },

  seo: {
    titleTemplate: '%s | Go-Live Fixture Works',
    defaultDescription:
      'Go-live test fixture for the indexable build path. Not a real business.',
    // RFC 6761 reserves `.test` permanently; nobody can register it. See the
    // header note on why a live fixture cannot use `example.invalid`.
    siteUrl: 'https://www.fixture-go-live.test',
    // THE POINT OF THIS FIXTURE. The only `false` in this directory.
    noindex: false,
  },

  features: {
    gallery: false,
    customizer: false,
    offline: true,
  },

  forms: {
    mode: 'worker',
    workerEndpoint: '',
    maxUploadMB: 10,
    acceptedFileTypes: ['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'application/pdf'],
    turnstileSiteKey: '',
  },

  faq: [
    {
      question: 'Is this a real business?',
      answer:
        'No. Go-Live Fixture Works does not exist. This site is a test fixture in the site-factory repository, built to prove that the indexable build path works before it is ever used on a real shop.',
    },
    {
      question: 'Why is it set to be indexed when every other mockup is not?',
      answer:
        'Because that is the branch under test. The domain is on a reserved TLD that can never be registered, and the fixture is excluded from batch builds and from the deploy script, so nothing here can reach a crawler.',
    },
  ],
};

export default site;
