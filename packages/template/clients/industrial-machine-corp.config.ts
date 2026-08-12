import type { SiteConfig } from '../src/types/site';
import { copyFor } from './from-copy';
import { designFor } from './design';

/**
 * INDUSTRIAL MACHINE CORPORATION — Elmwood Park, NJ. Bergen County.
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
 * WHAT THE COPY ENGINE CHANGED HERE, AND WHY IT MATTERS MOST ON THIS CLIENT.
 * The previous copy filled its gaps with marked prose: "Machining services.
 * Processes, materials and tolerances [verify with client]." That is a
 * sentence whose subject is its own incompleteness — nobody would publish it,
 * and it told the reader nothing in the meantime. The regenerated copy says
 * the true things instead: what the shop is, where it is, what machining work
 * is, and how to find out whether your job is one for them. It carries fewer
 * markers than it did and states no more than it did.
 *
 * The FAQ is the honest cost of knowing three facts: six questions, not
 * eight. The six that were dropped are dropped rather than hedged, and each
 * one is a question for the owner in `packages/copy/REPORT.md`.
 *
 * On hours specifically: the hours listed for this business upstream are
 * visibly corrupted, so they are omitted rather than marked. A blank hours
 * table would be worse than no hours table, a wrong one worse than both, and
 * a marker does not help the customer who drove to a shop that was shut.
 */
const copy = copyFor('industrial-machine-corp');

// Annotated rather than `satisfies` on purpose: the annotation keeps the
// optional fields (mapUrl, fonts.faces) present in the type even when this
// config leaves them out, so consumers can read them without casts.
const base: SiteConfig = {
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
    ...copy.hero,
    ctaPrimary: { text: 'Call the shop', href: '/contact' },
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

  // No testimonials: none have been relayed for this business, and inventing
  // one would be fabrication. An empty array renders no section.
  testimonials: [],

  certifications: copy.certifications,
  cta: copy.cta,
  pages: copy.pages,
  faq: copy.faq,
  serviceAreas: copy.serviceAreas,

  seo: {
    titleTemplate: '%s | Industrial Machine Corporation',
    defaultDescription: copy.seoDescription,
    siteUrl: 'https://example.invalid',
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
    // No confirmed inbox and no worker. The contact page keeps the phone
    // number and address, which is the only channel we can actually vouch for.
    mode: 'disabled',
    workerEndpoint: '',
    maxUploadMB: 10,
    acceptedFileTypes: ['image/jpeg', 'image/png', 'application/pdf'],
    turnstileSiteKey: '',
  },
};

/**
 * The design family.
 *
 * Composed from the copy generated above and the theme, stats, FAQ and
 * service-area copy in `clients/design/industrial-machine-corp.brief.json`. Nothing is restated:
 * every headline, service one-liner and review below comes from the
 * copy-generated literal above, so the two cannot drift apart.
 */
export const site: SiteConfig = { ...base, design: designFor('industrial-machine-corp', base) };

export default site;
