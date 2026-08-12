import type { SiteConfig } from '../src/types/site';
import { VERIFY_MARKER as V } from '../src/types/site';
import { copyFor } from './from-copy';
import { designFor } from './design';

/**
 * AMERICAN MACHINE SPECIALTY LLC — Westwood, NJ. Bergen County.
 *
 * PITCH MOCKUP. `seo.noindex: true`; nothing here is published or indexed.
 *
 * All copy is generated from
 * `packages/copy/src/prospects/american-machine-specialty.ts`.
 *
 * The best-sourced of the five, and the one that shows what the fabrication
 * guard is protecting. AMS is the only client whose copy may say "ISO
 * 9001:2015", "Perry Johnson" or "woman-owned" — not because the engine
 * special-cases it, but because those strings are `Fact`s on its prospect
 * record with sources attached, and the guard checks every claim against that
 * record. The same sentence generated for any other client throws.
 *
 * Only `updates` is unconfirmed, and every entry in it says so. This config is
 * also the coverage case for `equipment[]` and a `worker` form that accepts
 * engineering files.
 */
const copy = copyFor('american-machine-specialty');

// Annotated rather than `satisfies` on purpose: the annotation keeps the
// optional fields (mapUrl, fonts.faces) present in the type even when this
// config leaves them out, so consumers can read them without casts.
const base: SiteConfig = {
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
    ...copy.hero,
    ctaPrimary: { text: 'Send your drawings, get a quote', href: '/contact' },
    ctaSecondary: { text: 'See our capabilities', href: '/services' },
    image: '/images/hero.svg',
  },

  trustStrip: copy.trustStrip,
  services: copy.services,

  about: {
    ...copy.about,
    entry: 'about',
    image: '/images/story.svg',
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

  certifications: copy.certifications,

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

  cta: copy.cta,
  pages: copy.pages,
  faq: copy.faq,
  serviceAreas: copy.serviceAreas,

  seo: {
    titleTemplate: '%s | American Machine Specialty',
    defaultDescription: copy.seoDescription,
    // AMS's real, verified-live domain (retrieved Aug 2026). Same caveat as
    // K-H's: this build is not deployed there, so absolute asset URLs resolve
    // against a host that does not serve them. Harmless while noindex.
    //
    // NOTE — `business.email` above is `info@amsconj.com`, a different domain
    // from this one. Both were sourced independently and both look right, but
    // the mismatch is unexplained: AMS may run a legacy mail domain alongside
    // the marketing site. Confirm which is current before either is used in
    // anger. It is on the prospect record's evidence line too, so the
    // question survives a rewrite of this file.
    siteUrl: 'https://americanmachinespecialty.com',
    noindex: true,
  },

  features: {
    gallery: false,
    // Pitch build: the prospect can switch family, accent and lettering in
    // the browser and send the combination back. `SITE_DELIVERED=1` forces it
    // off whatever this says.
    customizer: true,
    // Demoed on a phone inside a shop; reception there is not a given.
    offline: true,
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

/**
 * The design family.
 *
 * Composed from the copy generated above and the theme, stats, FAQ and
 * service-area copy in `clients/design/american-machine-specialty.brief.json`. Nothing is restated:
 * every headline, service one-liner and review below comes from the
 * copy-generated literal above, so the two cannot drift apart.
 */
export const site: SiteConfig = { ...base, design: designFor('american-machine-specialty', base) };

export default site;
