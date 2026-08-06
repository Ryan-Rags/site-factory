import type { SiteConfig } from '../src/types/site';
import { VERIFY_MARKER as V } from '../src/types/site';

/**
 * KTS MACHINE SHOP — Elmwood Park, NJ.
 *
 * PITCH MOCKUP. `seo.noindex: true`; nothing here is published or indexed.
 *
 * Confirmed: name, address, phone, founding year, the people, the kind of
 * work, walk-in policy, and weekday hours. Everything else is either omitted
 * (email, postal-code-less fields we do not hold) or carries
 * `[verify with client]`. Weekend hours are explicitly unconfirmed: sources
 * conflict and an earlier "Sat 7–12" came from a stale listing, so it is
 * marked rather than guessed.
 *
 * No age is hard-coded anywhere. `foundedYear` is the only place 1987 is
 * stated as a number; copy says "Since 1987", which never goes stale.
 */
export const site: SiteConfig = {
  business: {
    name: 'KTS Machine Shop',
    legalName: 'KTS Machine Shop',
    tagline: 'Quick-turnaround machining for prototypes, replacement parts and rush repairs.',
    foundedYear: 1987,
    phone: '(201) 791-2228',
    phoneHref: '+12017912228',
    // email omitted on purpose — we hold no confirmed inbox. This is what
    // drives forms.mode below, and the footer/contact email rows disappear.
    address: {
      street: '60 Bushes Ln',
      locality: 'Elmwood Park',
      region: 'NJ',
      postalCode: '07407',
      country: 'US',
    },
    serviceArea: ['Elmwood Park', 'Bergen County', 'Northern New Jersey'],
    hours: [
      { day: 'Monday', opens: '07:00', closes: '17:00' },
      { day: 'Tuesday', opens: '07:00', closes: '17:00' },
      { day: 'Wednesday', opens: '07:00', closes: '17:00' },
      { day: 'Thursday', opens: '07:00', closes: '17:00' },
      { day: 'Friday', opens: '07:00', closes: '17:00' },
      // Weekend deliberately absent rather than marked: an hours table row
      // reading "[verify with client]" is worse than no row. Confirm before
      // sending — see README.
    ],
  },

  theme: {
    colors: {
      primary: '#1e3a5f',
      accent: '#c2410c',
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
    headline: 'Precision Machining Since 1987. Same-Week Turnaround.',
    subhead:
      'An Elmwood Park machine shop doing prototypes, replacement parts and rush repairs for manufacturers. Walk-ins welcome.',
    ctaPrimary: { text: 'Call the shop', href: '/contact' },
    ctaSecondary: { text: 'See what we do', href: '/services' },
    image: '/images/hero.svg',
    imageAlt: 'Machinist setting up a part on a lathe on the KTS Machine Shop floor',
  },

  trustStrip: [
    { icon: 'badge', label: 'Machining since 1987' },
    { icon: 'clock', label: 'Same-week turnaround' },
    { icon: 'wrench', label: 'Prototypes, replacement parts and rush repairs' },
    { icon: 'gear', label: 'Walk-ins welcome' },
  ],

  services: [
    {
      slug: 'general-machining',
      title: 'General Machining',
      oneLiner: 'Quick-turnaround machining for manufacturers, from one piece upward.',
      icon: 'precision',
      image: '/images/service-precision-machining.svg',
      imageAlt: 'Finished machined components on a workbench',
    },
    {
      slug: 'prototypes',
      title: 'Prototypes',
      oneLiner: 'First articles and one-off proof parts, made from your drawing or your sample.',
      icon: 'gear',
      image: '/images/service-custom-fabrication.svg',
      imageAlt: 'A one-off prototype part beside the drawing it was made from',
    },
    {
      slug: 'replacement-parts',
      title: 'Replacement Parts',
      oneLiner: 'Bring the worn part in and we will make you a new one.',
      icon: 'wrench',
      image: '/images/service-repairs-rebuilds.svg',
      imageAlt: 'Worn industrial shaft being measured with a micrometer',
    },
    {
      slug: 'rush-repairs',
      title: 'Rush Repairs',
      oneLiner: 'Line down? Walk it in and we will tell you straight away what we can do.',
      icon: 'clock',
      image: '/images/service-repairs-rebuilds.svg',
      imageAlt: 'Machinist working on an urgent repair at the bench',
    },
  ],

  about: {
    headline: 'Machining in Elmwood Park since 1987.',
    entry: 'about',
    image: '/images/story.svg',
    imageAlt: 'The KTS Machine Shop floor with lathes and milling machines',
  },

  // Paraphrases of sentiment relayed about this shop. The wording is ours,
  // not a customer's; no review text was copied from anywhere and no Google
  // property was accessed. Both must be replaced or confirmed before sending.
  testimonials: [
    {
      quote:
        'They are the only shop in the area I trust with our FDA food-contact part repairs, and with the high-precision pump and homogenizer work. Ten years of parts coming back right.',
      attribution: `${V} — customer name`,
      role: 'Head engineer, manufacturing',
      rating: 5,
      sourceNote:
        'Paraphrase of sentiment relayed by a ten-year customer (head engineer at a manufacturer; FDA food-contact part repair, high-precision pump and homogenizer parts). Wording is ours. Not a quotation.',
      status: 'placeholder',
    },
    {
      quote:
        'I walked in with an axle that needed rethreading and waited while they did it. Straightforward, and I was back on the road.',
      attribution: `${V} — customer name`,
      role: 'Walk-in customer',
      rating: 5,
      sourceNote:
        'Paraphrase of sentiment relayed by a walk-in customer (axle rethreaded while he waited). Wording is ours. Not a quotation.',
      status: 'placeholder',
    },
  ],

  certifications: [
    {
      label: `Certifications — ${V}`,
      detail: 'Confirm which certifications or affiliations the shop holds before publishing.',
    },
  ],

  cta: {
    headline: 'Need a part made or a repair done this week?',
    body: 'Call the shop or walk it in. Stanley, Chris or Mike will tell you what it takes and how quickly it can be done.',
    buttonText: 'Call the shop',
    buttonHref: '/contact',
  },

  pages: {
    home: {
      servicesHeading: 'Prototypes, replacement parts and rush repairs',
      servicesIntro: 'Quick turnaround on the work manufacturers need back fast.',
    },
    services: {
      title: 'What we do',
      intro:
        'Quick-turnaround machining for manufacturers. Bring us a drawing, a sample, or the broken part itself.',
      metaDescription:
        'General machining, prototypes, replacement parts and rush repairs from KTS Machine Shop in Elmwood Park, NJ.',
    },
    about: {
      eyebrow: 'KTS Machine Shop · Elmwood Park, NJ · Est. 1987',
      metaDescription:
        'KTS Machine Shop has been machining prototypes, replacement parts and rush repairs in Elmwood Park, NJ since 1987.',
    },
    contact: {
      title: 'Tell us about the job',
      intro:
        'Call the shop or walk in. We will tell you what the job takes and how quickly we can turn it around.',
      metaDescription:
        'Call or visit KTS Machine Shop in Elmwood Park, NJ for prototypes, replacement parts and rush repairs.',
    },
  },

  seo: {
    titleTemplate: '%s | KTS Machine Shop',
    defaultDescription:
      'KTS Machine Shop is a machine shop in Elmwood Park, NJ, doing quick-turnaround prototypes, replacement parts and rush repairs for manufacturers since 1987.',
    // No domain is registered or pointed at this build.
    siteUrl: 'https://example.invalid',
    noindex: true,
  },

  features: {
    gallery: false,
  },

  forms: {
    // No confirmed inbox and no deployed worker, so the form would have
    // nowhere to send. Disabled rather than shipped inert — the contact page
    // still carries the phone number, address and hours, which is how this
    // shop actually takes work.
    mode: 'disabled',
    workerEndpoint: '',
    maxUploadMB: 10,
    acceptedFileTypes: ['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'application/pdf'],
    turnstileSiteKey: '',
  },
};

export default site;
