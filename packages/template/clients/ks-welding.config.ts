import type { SiteConfig } from '../src/types/site';
import { VERIFY_MARKER as V } from '../src/types/site';
import { ksWeldingDesign } from './design';
import { copyFor } from './from-copy';

/**
 * K&S WELDING & FABRICATING — Bergenfield, NJ. Bergen County.
 *
 * PITCH MOCKUP. `seo.noindex: true`; nothing here is published or indexed.
 *
 * All copy is generated from `packages/copy/src/prospects/ks-welding.ts`,
 * through the `welding-fabrication` niche pack — the only one of the five
 * that is not a machine shop, and therefore the proof that the niche packs
 * are doing real work rather than templating the same paragraphs.
 *
 * No founding year is confirmed, so `foundedYear` is absent and the headline
 * formula falls back to a sourced trait for its trust slot. There is no code
 * path by which "serving Bergen County for years" can appear on this site.
 *
 * This is also the two-service case: the services grid and the copy around it
 * must read correctly for a shop that does two things, not four.
 */
const copy = copyFor('ks-welding');

export const site: SiteConfig = {
  business: {
    name: 'K&S Welding & Fabricating',
    legalName: 'K&S Welding & Fabricating',
    tagline: 'Walk-in welding and metal fabrication. Fast turnaround, fair prices.',
    // foundedYear omitted — not verified. No "since ..." copy anywhere.
    phone: '(201) 385-8848',
    phoneHref: '+12013858848',
    // email omitted — not verified.
    address: {
      street: '23 North St',
      locality: 'Bergenfield',
      region: 'NJ',
      postalCode: '07621',
      country: 'US',
    },
    serviceArea: ['Bergenfield', 'Bergen County', 'Northern New Jersey'],
    // Needed by the "open now" badge and by nothing else. Bergenfield is in
    // New Jersey, so this is a fact about the confirmed address rather than a
    // guess — without it the badge does not render at all.
    timezone: 'America/New_York',
    hours: [
      { day: 'Monday', opens: '07:00', closes: '16:00' },
      { day: 'Tuesday', opens: '07:00', closes: '16:00' },
      { day: 'Wednesday', opens: '07:00', closes: '16:00' },
      { day: 'Thursday', opens: '07:00', closes: '16:00' },
      { day: 'Friday', opens: '07:00', closes: '16:00' },
    ],
  },

  theme: {
    colors: {
      primary: '#1f4e79',
      accent: '#b03a12',
    },
    fonts: {
      heading:
        'ui-sans-serif, system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      body: 'ui-sans-serif, system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      faces: [],
    },
  },

  brand: {
    logo: '/images/logo.svg',
    favicon: '/favicon.svg',
    // Rendered from this client's own preset by scripts/gen-brand-assets.mjs.
    // PNG rather than SVG because several platforms refuse SVG for og:image,
    // and an unfurled demo link is the first thing a prospect sees.
    ogImage: '/og/ks-welding.png',
  },

  hero: {
    ...copy.hero,
    ctaPrimary: { text: 'Send a photo for a quote', href: '/contact' },
    ctaSecondary: { text: 'See what we do', href: '/services' },
    image: '/images/hero.svg',
  },

  trustStrip: copy.trustStrip,
  services: copy.services,

  about: {
    ...copy.about,
    entry: 'about',
    image: '/images/story.svg',
  },

  // Paraphrases of sentiment relayed about this shop. The wording is ours, not
  // a customer's; no review text was copied from anywhere and no Google
  // property was accessed. Replace or confirm before sending.
  testimonials: [
    {
      quote:
        'I brought in a mock-up of a part for a car I am restoring and they made the real thing from it. Nobody else would take it on.',
      attribution: `${V} — customer name`,
      role: 'Vintage car restorer',
      rating: 5,
      sourceNote:
        'Paraphrase of sentiment relayed by a vintage-car restoration customer (custom prototype part built from his own mock-up). Wording is ours. Not a quotation.',
      status: 'placeholder',
    },
    {
      quote:
        'Walked in with a broken bracket, walked out a few minutes later with it fixed, and the price was fair.',
      attribution: `${V} — customer name`,
      role: 'Walk-in customer',
      rating: 5,
      sourceNote:
        'Paraphrase of sentiment relayed by a walk-in customer (repairs done in minutes, fair pricing). Wording is ours. Not a quotation.',
      status: 'placeholder',
    },
  ],

  certifications: copy.certifications,
  cta: copy.cta,
  pages: copy.pages,
  faq: copy.faq,
  serviceAreas: copy.serviceAreas,

  seo: {
    titleTemplate: '%s | K&S Welding & Fabricating',
    defaultDescription: copy.seoDescription,
    siteUrl: 'https://example.invalid',
    noindex: true,
  },

  features: {
    gallery: false,
    // Pitch build: the prospect can switch family, accent and lettering in the
    // browser and send the combination back. `SITE_DELIVERED=1` forces it off
    // whatever this says, so a delivered site cannot leak the panel.
    customizer: true,
    // Demoed on a phone inside a shop; reception there is not a given.
    offline: true,
  },

  // The design payload itself is JSON: clients/design/ks-welding.design.json.
  design: ksWeldingDesign,

  forms: {
    // Photo-upload quote needs a backend. `worker` with an empty endpoint is
    // the pre-deploy state: the form validates and says submission is not
    // wired up, and the page still pushes the walk-in and phone routes.
    mode: 'worker',
    workerEndpoint: '',
    maxUploadMB: 10,
    acceptedFileTypes: ['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'application/pdf'],
    turnstileSiteKey: '',
  },
};

export default site;
