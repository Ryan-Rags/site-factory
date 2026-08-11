import type { SiteConfig } from '../src/types/site';
import { VERIFY_MARKER as V } from '../src/types/site';

/**
 * INDUSTRIAL MACHINE CORPORATION — Elmwood Park, NJ.
 *
 * PITCH MOCKUP. `seo.noindex: true`; nothing here is published or indexed.
 *
 * THE MINIMUM-DATA CASE. Three facts are verified: the name, the address and
 * the phone number. That is genuinely all. Everything else is either omitted
 * or marked.
 *
 * This config is the regression test for the non-rendering sections. It has
 * no `foundedYear`, no `email`, no `hours`, no `equipment` and no `updates`,
 * so a build of this client proves that each of those sections disappears
 * cleanly instead of rendering an empty shell or the word "undefined".
 *
 * On hours specifically: the hours listed for this business upstream are
 * visibly corrupted, so they are omitted rather than marked. A blank hours
 * table would be worse than no hours table, and a wrong one would be worse
 * than both.
 */
export const site: SiteConfig = {
  business: {
    name: 'Industrial Machine Corporation',
    legalName: 'Industrial Machine Corporation',
    tagline: 'Machine shop and manufacturer in Elmwood Park, New Jersey.',
    // foundedYear omitted — not verified. Nothing in this config states or
    // implies an age, so nothing here can go stale.
    phone: '(973) 345-1800',
    phoneHref: '+19733451800',
    // email omitted — not verified.
    address: {
      street: '413 Market St',
      locality: 'Elmwood Park',
      region: 'NJ',
      postalCode: '07407',
      country: 'US',
    },
    serviceArea: ['Elmwood Park', 'Bergen County', 'Northern New Jersey'],
    // hours omitted — see the note above.
  },

  theme: {
    colors: {
      primary: '#334155',
      accent: '#9a3412',
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
    headline: 'Machine Shop and Manufacturer in Elmwood Park, NJ.',
    subhead: `Machining and manufacturing services. Specific capabilities ${V}.`,
    ctaPrimary: { text: 'Call the shop', href: '/contact' },
    ctaSecondary: { text: 'See what we do', href: '/services' },
    image: '/images/hero.svg',
    imageAlt: 'Machine shop floor with lathes and milling machines',
  },

  trustStrip: [
    { icon: 'gear', label: 'Machine shop and manufacturer' },
    { icon: 'truck', label: 'Elmwood Park, New Jersey' },
    { icon: 'phone', label: 'Call for capabilities and lead times' },
    { icon: 'wrench', label: `Services offered — ${V}` },
  ],

  services: [
    {
      slug: 'machining',
      title: 'Machining',
      oneLiner: `Machining services. Processes, materials and tolerances ${V}.`,
      icon: 'precision',
      image: '/images/service-precision-machining.svg',
      imageAlt: 'Machined metal components on a workbench',
    },
    {
      slug: 'manufacturing',
      title: 'Manufacturing',
      oneLiner: `Manufacturing services. Scope and production capacity ${V}.`,
      icon: 'gear',
      image: '/images/service-custom-fabrication.svg',
      imageAlt: 'Manufactured metal parts ready for despatch',
    },
  ],

  about: {
    headline: 'A machine shop in Elmwood Park.',
    entry: 'about',
    image: '/images/story.svg',
    imageAlt: 'Machine shop floor',
  },

  // No testimonials: none have been relayed for this business, and inventing
  // one would be fabrication. An empty array renders no section.
  testimonials: [],

  certifications: [
    {
      label: `Certifications and affiliations — ${V}`,
      detail: 'Confirm what this business holds before anything is published.',
    },
  ],

  cta: {
    headline: 'Call the shop.',
    body: `Give us a ring and we will tell you whether the job is something we take on. Email and hours ${V}.`,
    buttonText: 'Call the shop',
    buttonHref: '/contact',
  },

  pages: {
    home: {
      servicesHeading: 'Machining and manufacturing',
      servicesIntro: `What the shop takes on, in its own words — ${V}.`,
    },
    services: {
      title: 'What we do',
      intro: `Machining and manufacturing services. The detail on this page is ${V}.`,
      metaDescription:
        'Machining and manufacturing from Industrial Machine Corporation in Elmwood Park, NJ.',
    },
    about: {
      eyebrow: 'Industrial Machine Corporation · Elmwood Park, NJ',
      metaDescription:
        'Industrial Machine Corporation is a machine shop and manufacturer in Elmwood Park, NJ.',
    },
    contact: {
      title: 'Get in touch',
      intro: 'Call the shop and we will tell you what we can do and how long it will take.',
      metaDescription:
        'Call Industrial Machine Corporation in Elmwood Park, NJ for machining and manufacturing.',
    },
  },

  seo: {
    titleTemplate: '%s | Industrial Machine Corporation',
    defaultDescription:
      'Industrial Machine Corporation is a machine shop and manufacturer in Elmwood Park, New Jersey.',
    siteUrl: 'https://example.invalid',
    noindex: true,
  },

  features: {
    gallery: false,
    // Demoed on a phone inside a shop; reception there is not a given.
    offline: true,
  },

  forms: {
    // No confirmed inbox and no worker. The contact page keeps the phone
    // number and address, which is the only channel we can actually vouch for.
    mode: 'disabled',
    workerEndpoint: '',
    maxUploadMB: 10,
    acceptedFileTypes: ['image/jpeg', 'image/png', 'application/pdf'],
    turnstileSiteKey: '',
  },
};

export default site;
