import type { SiteConfig } from '../src/types/site';
import { designFor } from './design';

/**
 * PORTFOLIO DEMONSTRATION BUILD — AN INVENTED BUSINESS.
 *
 * Ironvale Welding & Fabrication does not exist. Nothing in this file describes a real company, a
 * real person or real work, and the build it produces is linked publicly from
 * raghubans.com/sites as one of five showcases of the forge family.
 *
 * WHY INVENTED RATHER THAN REAL. The alternative was linking a client build or
 * a prospect mockup from an indexed page. A prospect mockup is a private pitch
 * about a named business that has not signed; publishing one exposes the pitch
 * and pulls a page about somebody else's company into a crawl.
 * `packages/founder-site/scripts/check-placeholders.mjs` refuses exactly that,
 * and allows only the `portfolio-` prefix — these five, which describe nobody.
 *
 * THE FABRICATION DISCIPLINE, following `zz-fixture-long-name` and
 * `zz-fixture-motion`, which are the repo's existing invented builds:
 *
 *   - `(555) 010-xx` — the range reserved for fiction. It rings nowhere.
 *   - `example.invalid` — reserved by RFC 2606. It delivers nowhere.
 *   - An invented town, so no real place is described as served.
 *   - `legalName` carries "(demonstration site)", which the footer prints in
 *     the copyright line on EVERY page of every route. A reader cannot reach a
 *     page of this build that does not say what it is.
 *   - `seo.noindex` is true, like every build in this directory.
 *
 * No claim pattern appears in any string here — no year, no span of years, no
 * credential, no guarantee, no superlative, no price and no turnaround time.
 * That is what lets an invented business pass the same copy discipline a real
 * one is held to.
 */
const base: SiteConfig = {
  business: {
    name: 'Ironvale Welding & Fabrication',
    legalName: 'Ironvale Welding & Fabrication (demonstration site)',
    tagline: 'Structural and architectural metalwork, fabricated in our own shop.',
    phone: '(555) 010-0110',
    phoneHref: '+15550100110',
    smsHref: '+15550100110',
    email: 'hello@example.invalid',
    address: {
      street: '18 Foundry Row',
      locality: 'Ironvale',
      region: 'NJ',
      postalCode: '07451',
      country: 'US',
    },
    serviceArea: ["Ironvale","West Ironvale","Kiln Valley","Marrow Bend"],
    timezone: 'America/New_York',
    hours: [
      { day: 'Monday', opens: '08:00', closes: '17:00' },
      { day: 'Tuesday', opens: '08:00', closes: '17:00' },
      { day: 'Wednesday', opens: '08:00', closes: '17:00' },
      { day: 'Thursday', opens: '08:00', closes: '17:00' },
      { day: 'Friday', opens: '08:00', closes: '16:00' },
      { day: 'Saturday', opens: '09:00', closes: '13:00' },
      { day: 'Sunday', closed: true },
    ],
  },

  theme: {
    colors: {
      primary: '#14181d',
      accent: '#b3400f',
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
    ogImage: '/og/portfolio-ironvale-fabrication.png',
  },

  hero: {
    headline: 'Steel that fits the first time.',
    subhead:
      'Structural welding, custom fabrication and on-site repair for builders, architects and property managers across the Ironvale area.',
    ctaPrimary: { text: 'Ask about a job', href: '/contact' },
    ctaSecondary: { text: 'What we do', href: '/services' },
    image: '/images/hero.svg',
    imageAlt: 'Placeholder illustration on a demonstration build',
  },

  trustStrip: [
      {
          "icon": "wrench",
          "label": "In-house fabrication"
      },
      {
          "icon": "truck",
          "label": "Mobile repair unit"
      },
      {
          "icon": "precision",
          "label": "Shop drawings provided"
      }
  ],

  services: [
    {
      slug: 'structural-welding',
      title: 'Structural welding',
      oneLiner: 'Beams, columns, lintels and stair stringers, welded to the drawing you hand us.',
      icon: 'wrench',
      image: '/images/service-welding-fitting.svg',
      imageAlt: 'Placeholder illustration on a demonstration build',
    },
    {
      slug: 'custom-fabrication',
      title: 'Custom fabrication',
      oneLiner: 'One-off pieces: railings, gates, canopies, brackets and the awkward part nobody stocks.',
      icon: 'gear',
      image: '/images/service-custom-fabrication.svg',
      imageAlt: 'Placeholder illustration on a demonstration build',
    },
    {
      slug: 'mobile-repair',
      title: 'On-site repair',
      oneLiner: 'Loading docks, gates, fire escapes and railings repaired where they stand.',
      icon: 'truck',
      image: '/images/service-repairs-rebuilds.svg',
      imageAlt: 'Placeholder illustration on a demonstration build',
    },
  ],

  about: {
    headline: 'A shop, and the people in it.',
    entry: 'about',
    image: '/images/story.svg',
    imageAlt: 'Placeholder illustration on a demonstration build',
  },

  /*
   * INVENTED QUOTATIONS, MARKED AS SUCH.
   *
   * `status: 'placeholder'` and a `sourceNote` on every one, which is the
   * regime the template already requires for anything it did not verify. No
   * customer, real or otherwise, said any of these — the section exists so the
   * reviews layout renders, and its `sourceLabel` says so on the page.
   */
  testimonials: [
    {
      quote:
        'The railing they made matched the original well enough that nobody noticed the repair. That was the point.',
      attribution: 'Property manager',
      role: 'Ironvale',
      rating: 5,
      sourceNote: 'Invented for a demonstration build. Nobody said this.',
      status: 'placeholder',
    },
    {
      quote:
        'They told us the part was not worth welding a second time and replaced it instead. It has been fine since.',
      attribution: 'General contractor',
      role: 'Kiln Valley',
      rating: 5,
      sourceNote: 'Invented for a demonstration build. Nobody said this.',
      status: 'placeholder',
    },
    {
      quote:
        'Drawings went over on a Tuesday and the steel was on site the following week.',
      attribution: 'Site foreman',
      role: 'Marrow Bend',
      rating: 5,
      sourceNote: 'Invented for a demonstration build. Nobody said this.',
      status: 'placeholder',
    },
  ],

  /*
   * EMPTY, DELIBERATELY. `certifications` is required by `SiteConfig`, and the
   * honest value for an invented business is none: every string in this block
   * renders as a credential claim, and `check-fabrication.mjs` refuses the words
   * that describe one for exactly the right reason. A demonstration build has no
   * credentials to state, so it states none.
   */
  certifications: [],

  cta: {
    headline: 'Tell us about the job.',
    body: 'This is a demonstration build. Ironvale Welding & Fabrication is an invented business created to show a design family — no such company exists, and nothing here describes anybody’s real work.',
    buttonText: 'Send a message',
    buttonHref: '/contact',
  },

  pages: {
    home: {
      /*
       * STATED, not derived. Without it the home title falls back to
       * `name — tagline`, which `seo.titleTemplate` then appends the name to
       * a second time: 104 characters against a 70-character budget, and
       * `check-metadata.mjs` refuses it. A search result renders the first
       * ~60, so the fallback also buried the trade behind a repeated name.
       */
      title: 'Welding & fabrication, Ironvale NJ',
      servicesHeading: 'What we do',
      servicesIntro: 'Three things, and we would rather do those well than list ten.',
    },
    services: {
      title: 'What we do',
      intro: 'The work that comes through here, and how we approach it.',
      metaDescription:
        'Demonstration build for an invented business. Metal fabrication services, shown to illustrate a design family.',
    },
    about: {
      eyebrow: 'Ironvale · Ironvale, NJ',
      metaDescription:
        'Demonstration build for an invented business. Not a real company.',
    },
    contact: {
      title: 'Get in touch',
      intro:
        'This is a demonstration build, so nothing sent here reaches anybody. On a real build this form goes to the shop.',
      metaDescription:
        'Demonstration build for an invented business. Not a real company.',
    },
  },

  seo: {
    titleTemplate: '%s | Ironvale Welding & Fabrication',
    defaultDescription:
      'Structural and architectural metalwork, fabricated in our own shop. A demonstration build for an invented business.',
    siteUrl: 'https://portfolio-ironvale-fabrication.pages.dev',
    noindex: true,
  },

  features: {
    gallery: false,
    customizer: false,
    offline: false,
  },

  /*
   * `mailto`, not `worker`. A demonstration build must not depend on the demo
   * Worker: registering a slug there means editing `worker-demo`, which is
   * outside this stream's grant, and a form that posts into a Worker which has
   * never heard of the slug fails at the one moment a visitor tries it. The
   * address is `example.invalid`, so the form is honest about reaching nobody.
   */
  forms: {
    mode: 'mailto',
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

export const site: SiteConfig = { ...base, design: designFor('portfolio-ironvale-fabrication', base) };

export default site;
