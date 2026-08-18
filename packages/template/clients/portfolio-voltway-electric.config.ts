import type { SiteConfig } from '../src/types/site';
import { designFor } from './design';

/**
 * PORTFOLIO DEMONSTRATION BUILD — AN INVENTED BUSINESS.
 *
 * Voltway Electric does not exist. Nothing in this file describes a real company, a
 * real person or real work, and the build it produces is linked publicly from
 * raghubans.com/sites as one of five showcases of the apex family.
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
    name: 'Voltway Electric',
    legalName: 'Voltway Electric (demonstration site)',
    tagline: 'Electrical contracting for homes, offices and the panels behind them.',
    phone: '(555) 010-0154',
    phoneHref: '+15550100154',
    smsHref: '+15550100154',
    email: 'hello@example.invalid',
    address: {
      street: '77 Conduit Way',
      locality: 'Voltway',
      region: 'NJ',
      postalCode: '07495',
      country: 'US',
    },
    serviceArea: ["Voltway","Harrowgate","Pier Point","Calder Row"],
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
      primary: '#0b0d0f',
      accent: '#0b7fd4',
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
    headline: 'Wiring you never have to think about.',
    subhead:
      'Panel upgrades, rewiring, lighting and EV charger installation for homes and small commercial buildings around Voltway.',
    ctaPrimary: { text: 'Ask about a job', href: '/contact' },
    ctaSecondary: { text: 'What we do', href: '/services' },
    image: '/images/hero.svg',
    imageAlt: 'Placeholder illustration on a demonstration build',
  },

  trustStrip: [
      {
          "icon": "shield",
          "label": "Permits pulled and closed"
      },
      {
          "icon": "precision",
          "label": "Load assessed first"
      },
      {
          "icon": "truck",
          "label": "EV charger installation"
      }
  ],

  services: [
    {
      slug: 'panel-upgrades',
      title: 'Panel upgrades',
      oneLiner: 'Service and panel upgrades for buildings asking more of the supply than it was built for.',
      icon: 'gear',
      image: '/images/service-precision-machining.svg',
      imageAlt: 'Placeholder illustration on a demonstration build',
    },
    {
      slug: 'rewiring',
      title: 'Rewiring & repairs',
      oneLiner: 'Old wiring replaced, and the mystery circuit finally traced.',
      icon: 'wrench',
      image: '/images/service-repairs-rebuilds.svg',
      imageAlt: 'Placeholder illustration on a demonstration build',
    },
    {
      slug: 'ev-charging',
      title: 'EV charger installation',
      oneLiner: 'Home and workplace chargers, on a circuit sized for the car you actually have.',
      icon: 'truck',
      image: '/images/service-custom-fabrication.svg',
      imageAlt: 'Placeholder illustration on a demonstration build',
    },
  ],

  about: {
    headline: 'The trade behind the drywall.',
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
        'They traced two circuits nobody had been able to account for and labelled the whole panel.',
      attribution: 'Homeowner',
      role: 'Voltway',
      rating: 5,
      sourceNote: 'Invented for a demonstration build. Nobody said this.',
      status: 'placeholder',
    },
    {
      quote:
        'Checked the supply before quoting the charger, which saved us finding out the expensive way.',
      attribution: 'Homeowner',
      role: 'Pier Point',
      rating: 5,
      sourceNote: 'Invented for a demonstration build. Nobody said this.',
      status: 'placeholder',
    },
    {
      quote:
        'Permit was closed out without us having to chase it, which has not been our experience elsewhere.',
      attribution: 'Office manager',
      role: 'Harrowgate',
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
    body: 'This is a demonstration build. Voltway Electric is an invented business created to show a design family — no such company exists, and nothing here describes anybody’s real work.',
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
      title: 'Electrical contracting in NJ',
      servicesHeading: 'What we do',
      servicesIntro: 'Three things, and we would rather do those well than list ten.',
    },
    services: {
      title: 'What we do',
      intro: 'The work that comes through here, and how we approach it.',
      metaDescription:
        'Demonstration build for an invented business. Electrical contracting services, shown to illustrate a design family.',
    },
    about: {
      eyebrow: 'Voltway · Voltway, NJ',
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
    titleTemplate: '%s | Voltway Electric',
    defaultDescription:
      'Electrical contracting for homes, offices and the panels behind them. A demonstration build for an invented business.',
    siteUrl: 'https://portfolio-voltway-electric.pages.dev',
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

export const site: SiteConfig = { ...base, design: designFor('portfolio-voltway-electric', base) };

export default site;
