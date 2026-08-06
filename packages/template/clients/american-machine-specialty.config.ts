import type { SiteConfig } from '../src/types/site';
import { VERIFY_MARKER as V } from '../src/types/site';

/**
 * AMERICAN MACHINE SPECIALTY LLC — Westwood, NJ.
 *
 * PITCH MOCKUP. `seo.noindex: true`; nothing here is published or indexed.
 *
 * The most fully confirmed of the five: address, phone, inbox, founding year,
 * markets served, certification, ownership status and the machine list are all
 * verified. Only `updates` is unconfirmed, and every entry in it says so.
 *
 * This config is the coverage case for `equipment[]`, `updates[]` and a
 * `worker` form that accepts engineering files.
 */
export const site: SiteConfig = {
  business: {
    name: 'American Machine Specialty',
    legalName: 'American Machine Specialty LLC',
    tagline: 'Contract manufacturing for medical, aerospace and instrumentation.',
    foundedYear: 1990,
    phone: '(201) 664-2100',
    phoneHref: '+12016642100',
    email: 'info@amsconj.com',
    address: {
      street: '51 Bergenline Ave',
      locality: 'Westwood',
      region: 'NJ',
      postalCode: '07675',
      country: 'US',
    },
    serviceArea: ['Westwood', 'Bergen County', 'Northern New Jersey', 'New York metro'],
    hours: [
      { day: 'Monday', opens: '08:00', closes: '17:00' },
      { day: 'Tuesday', opens: '08:00', closes: '17:00' },
      { day: 'Wednesday', opens: '08:00', closes: '17:00' },
      { day: 'Thursday', opens: '08:00', closes: '17:00' },
      { day: 'Friday', opens: '08:00', closes: '17:00' },
      { day: 'Saturday', closed: true },
      { day: 'Sunday', closed: true },
    ],
  },

  theme: {
    colors: {
      primary: '#12507a',
      accent: '#a8481a',
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
    headline: 'Contract Manufacturing for Medical, Aerospace and Instrumentation.',
    subhead:
      'A woman-owned, ISO 9001:2015 certified machine shop in Westwood, NJ. Send your drawings and get a quote.',
    ctaPrimary: { text: 'Send your drawings, get a quote', href: '/contact' },
    ctaSecondary: { text: 'See our capabilities', href: '/services' },
    image: '/images/hero.svg',
    imageAlt: 'Five-axis machining centre cutting a precision component',
  },

  trustStrip: [
    { icon: 'badge', label: 'ISO 9001:2015 certified (Perry Johnson)' },
    { icon: 'shield', label: 'WOSB — woman-owned small business' },
    { icon: 'precision', label: 'CMM inspection in a temperature-controlled room' },
    { icon: 'gear', label: '5-axis milling and CNC turning in-house' },
  ],

  services: [
    {
      slug: 'precision-machining',
      title: 'Precision Machining',
      oneLiner: '5-axis milling and CNC turning to print, from first article to production.',
      icon: 'precision',
      image: '/images/service-precision-machining.svg',
      imageAlt: 'Precision machined components on an inspection bench',
    },
    {
      slug: 'contract-manufacturing',
      title: 'Contract Manufacturing',
      oneLiner: 'Ongoing build-to-print production for medical, aerospace and instrumentation.',
      icon: 'gear',
      image: '/images/service-custom-fabrication.svg',
      imageAlt: 'Production run of finished machined parts ready for inspection',
    },
    {
      slug: 'inspection-quality',
      title: 'Inspection & Quality',
      oneLiner: 'CMM inspection in a temperature-controlled room, under an ISO 9001:2015 system.',
      icon: 'shield',
      image: '/images/service-repairs-rebuilds.svg',
      imageAlt: 'Coordinate measuring machine inspecting a machined part',
    },
  ],

  about: {
    headline: 'Build-to-print work where the tolerance is the whole job.',
    entry: 'about',
    image: '/images/story.svg',
    imageAlt: 'The American Machine Specialty shop floor',
  },

  equipment: [
    { name: 'HAAS UMC-500SS', detail: '5-axis machining centre' },
    { name: 'Doosan DNM 5700', detail: 'Vertical machining centre' },
    { name: 'Doosan HC 400', detail: 'Horizontal machining centre' },
    { name: 'Doosan Lynx 2100', detail: 'CNC turning centres' },
    {
      name: 'Mitutoyo Crysta PM443',
      detail: 'Coordinate measuring machine, in a temperature-controlled inspection room',
    },
  ],

  // Unconfirmed in full. The section is here to show the client what it would
  // carry; every entry says plainly that it is not real yet. Replace or delete
  // before this is sent — the marker check blocks any live build containing it.
  updates: [
    {
      date: V,
      title: `Shop news headline — ${V}`,
      body: `A short paragraph about a new machine, a certification renewal, or a capability the shop wants to lead with. Content and date both ${V}.`,
    },
    {
      date: V,
      title: `Second update — ${V}`,
      body: `Second slot, same treatment. Delete this section entirely if the shop would rather not maintain it. Content and date both ${V}.`,
    },
  ],

  certifications: [
    {
      label: 'ISO 9001:2015',
      detail: 'Quality management system certified by Perry Johnson Registrars.',
    },
    {
      label: 'WOSB — Woman-Owned Small Business',
      detail: 'Woman-owned and family-run.',
    },
  ],

  // Paraphrases of sentiment relayed about this shop. The wording is ours, not
  // a customer's; no review text was copied from anywhere and no Google
  // property was accessed. Replace or confirm before sending.
  testimonials: [
    {
      quote:
        'On-time, to print, and straight with us when something needs a second look. For a family-run, woman-owned shop that is exactly what we want in a supplier.',
      attribution: `${V} — customer name`,
      role: 'Avionics manufacturer',
      rating: 5,
      sourceNote:
        'Paraphrase of sentiment relayed by an avionics customer (on-time delivery, quality, honesty; family-owned and woman-owned shop). Wording is ours. Not a quotation.',
      status: 'placeholder',
    },
    {
      quote:
        'Seven years of parts from them. Prompt, courteous, and the pricing has stayed competitive the whole time.',
      attribution: `${V} — customer name`,
      role: 'Scientific instrument manufacturer',
      rating: 5,
      sourceNote:
        'Paraphrase of sentiment relayed by a scientific-instrument customer (roughly seven-year supplier relationship; prompt, courteous, competitive). Wording is ours. Not a quotation.',
      status: 'placeholder',
    },
  ],

  cta: {
    headline: 'Have a drawing to quote?',
    body: 'Send the drawing, STEP file or PDF and we will come back with a quote and a lead time.',
    buttonText: 'Send your drawings, get a quote',
    buttonHref: '/contact',
  },

  pages: {
    home: {
      servicesHeading: 'Machining, contract manufacturing and inspection under one roof',
      servicesIntro:
        'Build-to-print work for customers who have to prove every dimension.',
    },
    services: {
      title: 'What we do',
      intro:
        'Build-to-print machining for regulated and precision markets, inspected under an ISO 9001:2015 system.',
      metaDescription:
        'Precision machining, contract manufacturing and CMM inspection from American Machine Specialty in Westwood, NJ.',
    },
    about: {
      eyebrow: 'American Machine Specialty LLC · Westwood, NJ · Est. 1990',
      metaDescription:
        'American Machine Specialty LLC is a woman-owned, ISO 9001:2015 certified contract manufacturer in Westwood, NJ, serving medical, aerospace and instrumentation customers since 1990.',
    },
    contact: {
      title: 'Send us your drawings',
      intro:
        'Attach a drawing, STEP file or PDF and tell us the quantity. We will come back with a quote and a lead time.',
      metaDescription:
        'Request a quote from American Machine Specialty in Westwood, NJ — send a drawing, STEP file or PDF.',
    },
  },

  seo: {
    titleTemplate: '%s | American Machine Specialty',
    defaultDescription:
      'American Machine Specialty LLC is a woman-owned, ISO 9001:2015 certified contract manufacturer in Westwood, NJ, machining for medical, aerospace and instrumentation customers.',
    // AMS's real, verified-live domain (retrieved Aug 2026). Same caveat as
    // K-H's: this build is not deployed there, so absolute asset URLs resolve
    // against a host that does not serve them. Harmless while noindex.
    //
    // NOTE — `business.email` above is `info@amsconj.com`, a different domain
    // from this one. Both were sourced independently and both look right, but
    // the mismatch is unexplained: AMS may run a legacy mail domain alongside
    // the marketing site. Confirm which is current before either is used in
    // anger.
    siteUrl: 'https://americanmachinespecialty.com',
    noindex: true,
  },

  features: {
    gallery: false,
  },

  forms: {
    // RFQ intake: the form accepts an engineering file, which needs a backend.
    // `worker` with an empty endpoint is the pre-deploy state — the form
    // validates and reports that submission is not wired up yet.
    mode: 'worker',
    workerEndpoint: '',
    maxUploadMB: 25,
    acceptedFileTypes: [
      'application/pdf',
      'model/step',
      'application/dxf',
      'image/jpeg',
      'image/png',
    ],
    turnstileSiteKey: '',
  },
};

export default site;
