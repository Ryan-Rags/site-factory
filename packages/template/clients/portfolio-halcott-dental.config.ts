import type { SiteConfig } from '../src/types/site';
import { designFor } from './design';

/**
 * PORTFOLIO DEMONSTRATION BUILD — AN INVENTED BUSINESS.
 *
 * Halcott Dental Studio does not exist. Nothing in this file describes a real company, a
 * real person or real work, and the build it produces is linked publicly from
 * raghubans.com/sites as one of five showcases of the meridian family.
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
    name: 'Halcott Dental Studio',
    legalName: 'Halcott Dental Studio (demonstration site)',
    tagline: 'General and cosmetic dentistry, at a pace that suits the patient.',
    phone: '(555) 010-0143',
    phoneHref: '+15550100143',
    smsHref: '+15550100143',
    email: 'hello@example.invalid',
    address: {
      street: '31 Meridian Court',
      locality: 'Halcott',
      region: 'NJ',
      postalCode: '07484',
      country: 'US',
    },
    serviceArea: ["Halcott","Fairmere","Linden Cross","Ashbourne"],
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
      primary: '#1b2b33',
      accent: '#2f7f96',
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
    ogImage: '/og/portfolio-halcott-dental.png',
  },

  hero: {
    headline: 'Dentistry without the rush.',
    subhead:
      'General, cosmetic and restorative care for adults and children in Halcott. Longer appointments, and a plan explained before anything starts.',
    ctaPrimary: { text: 'Ask about a job', href: '/contact' },
    ctaSecondary: { text: 'What we do', href: '/services' },
    image: '/images/hero.svg',
    imageAlt: 'Placeholder illustration on a demonstration build',
  },

  trustStrip: [
      {
          "icon": "clock",
          "label": "Longer appointments"
      },
      {
          "icon": "message",
          "label": "Treatment explained first"
      },
      {
          "icon": "shield",
          "label": "Nervous patients welcome"
      }
  ],

  services: [
    {
      slug: 'general-dentistry',
      title: 'General dentistry',
      oneLiner: 'Examinations, hygiene and the ordinary care that keeps everything else unnecessary.',
      icon: 'shield',
      image: '/images/service-precision-machining.svg',
      imageAlt: 'Placeholder illustration on a demonstration build',
    },
    {
      slug: 'cosmetic-dentistry',
      title: 'Cosmetic dentistry',
      oneLiner: 'Whitening, bonding and veneers, with a frank conversation about what will actually suit you.',
      icon: 'badge',
      image: '/images/service-custom-fabrication.svg',
      imageAlt: 'Placeholder illustration on a demonstration build',
    },
    {
      slug: 'restorative-care',
      title: 'Restorative care',
      oneLiner: 'Crowns, bridges and implant restorations for teeth that need rebuilding rather than patching.',
      icon: 'wrench',
      image: '/images/service-repairs-rebuilds.svg',
      imageAlt: 'Placeholder illustration on a demonstration build',
    },
  ],

  about: {
    headline: 'A small practice, deliberately.',
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
        'The appointment was long enough that I actually understood what was being suggested and why.',
      attribution: 'Patient',
      role: 'Halcott',
      rating: 5,
      sourceNote: 'Invented for a demonstration build. Nobody said this.',
      status: 'placeholder',
    },
    {
      quote:
        'I had avoided dentists for a long time. Nobody made a thing of it.',
      attribution: 'Patient',
      role: 'Linden Cross',
      rating: 5,
      sourceNote: 'Invented for a demonstration build. Nobody said this.',
      status: 'placeholder',
    },
    {
      quote:
        'They talked me out of the treatment I came in asking for, and were right.',
      attribution: 'Patient',
      role: 'Fairmere',
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
    body: 'This is a demonstration build. Halcott Dental Studio is an invented business created to show a design family — no such company exists, and nothing here describes anybody’s real work.',
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
      title: 'General & cosmetic dentistry',
      servicesHeading: 'What we do',
      servicesIntro: 'Three things, and we would rather do those well than list ten.',
    },
    services: {
      title: 'What we do',
      intro: 'The work that comes through here, and how we approach it.',
      metaDescription:
        'Demonstration build for an invented business. Dental practice services, shown to illustrate a design family.',
    },
    about: {
      eyebrow: 'Halcott · Halcott, NJ',
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
    titleTemplate: '%s | Halcott Dental Studio',
    defaultDescription:
      'General and cosmetic dentistry, at a pace that suits the patient. A demonstration build for an invented business.',
    siteUrl: 'https://portfolio-halcott-dental.pages.dev',
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

export const site: SiteConfig = { ...base, design: designFor('portfolio-halcott-dental', base) };

export default site;
