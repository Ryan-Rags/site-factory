import type { SiteConfig } from '../src/types/site';
import { VERIFY_MARKER as V } from '../src/types/site';

/**
 * K&S WELDING & FABRICATING — Bergenfield, NJ.
 *
 * PITCH MOCKUP. `seo.noindex: true`; nothing here is published or indexed.
 *
 * Confirmed: name, address, phone, the owner's first name, the trade, the
 * walk-in model, and weekday hours. No founding year and no inbox are
 * confirmed, so `foundedYear` and `email` are both omitted — which is why no
 * copy anywhere on this site refers to how long the shop has been going.
 *
 * This is also the two-service case: the services grid and the copy around it
 * must read correctly for a shop that does two things, not four.
 */
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
    ogImage: '/images/og.svg',
  },

  hero: {
    headline: "Bring It In. We'll Fix It Fast.",
    subhead:
      'Walk-in welding and metal fabrication in Bergenfield. Bring the part or send a photo and we will tell you what it takes.',
    ctaPrimary: { text: 'Send a photo for a quote', href: '/contact' },
    ctaSecondary: { text: 'See what we do', href: '/services' },
    image: '/images/hero.svg',
    imageAlt: 'Welder joining a steel assembly in the shop',
  },

  trustStrip: [
    { icon: 'clock', label: 'Fast turnaround' },
    { icon: 'wrench', label: 'Walk-ins welcome' },
    { icon: 'badge', label: 'Fair, up-front pricing' },
    { icon: 'gear', label: 'Welding and metal fabrication' },
  ],

  services: [
    {
      slug: 'welding',
      title: 'Welding',
      oneLiner: 'Repairs and joining work, most of it done while you wait.',
      icon: 'shield',
      image: '/images/service-welding-fitting.svg',
      imageAlt: 'Welder repairing a steel component at the bench',
    },
    {
      slug: 'metal-fabrication',
      title: 'Metal Fabrication',
      oneLiner: 'Custom pieces made from your sketch, your sample, or your mock-up.',
      icon: 'gear',
      image: '/images/service-custom-fabrication.svg',
      imageAlt: 'Custom fabricated steel piece beside the mock-up it was made from',
    },
  ],

  about: {
    headline: 'Bring it in and we will take a look.',
    entry: 'about',
    image: '/images/story.svg',
    imageAlt: 'The K&S Welding & Fabricating shop',
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

  certifications: [
    {
      label: `Certifications and insurance — ${V}`,
      detail: 'Confirm what the shop holds before anything is published.',
    },
  ],

  cta: {
    headline: 'Got something that needs welding?',
    body: 'Send a photo for a quote, or just walk it in today. Simon will tell you what it takes and what it costs.',
    buttonText: 'Send a photo for a quote',
    buttonHref: '/contact',
  },

  pages: {
    home: {
      servicesHeading: 'Welding and metal fabrication',
      servicesIntro: 'Two things, done fast, at a price you agree before we start.',
    },
    services: {
      title: 'What we do',
      intro:
        'Welding and metal fabrication. Bring the part in or send a photo and we will tell you what it takes.',
      metaDescription:
        'Walk-in welding and metal fabrication from K&S Welding & Fabricating in Bergenfield, NJ.',
    },
    about: {
      eyebrow: 'K&S Welding & Fabricating · Bergenfield, NJ',
      metaDescription:
        'K&S Welding & Fabricating is a walk-in welding and metal fabrication shop in Bergenfield, NJ.',
    },
    contact: {
      title: 'Send a photo or walk it in',
      intro:
        'Send a photo of the job and we will tell you what it takes and what it costs. Or just bring it in.',
      metaDescription:
        'Contact K&S Welding & Fabricating in Bergenfield, NJ — send a photo for a quote or walk in.',
    },
  },

  seo: {
    titleTemplate: '%s | K&S Welding & Fabricating',
    defaultDescription:
      'K&S Welding & Fabricating is a walk-in welding and metal fabrication shop in Bergenfield, New Jersey, offering fast turnaround at fair prices.',
    siteUrl: 'https://example.invalid',
    noindex: true,
  },

  features: {
    gallery: false,
  },

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
