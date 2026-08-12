import type { SiteConfig } from '../src/types/site';
import { VERIFY_MARKER as V } from '../src/types/site';
import { copyFor } from './from-copy';
import { designFor } from './design';

/**
 * KTS MACHINE SHOP — Elmwood Park, NJ. Bergen County.
 *
 * PITCH MOCKUP. `seo.noindex: true`; nothing here is published or indexed.
 *
 * All copy is generated from `packages/copy/src/prospects/kts-machine-shop.ts`.
 * This file holds identity, theme, testimonials and form configuration.
 *
 * The first client with real Bergen County service-area sections: eight towns,
 * each with its own block, none of them claiming a distance or a landmark we
 * have not verified.
 *
 * Weekend hours are still absent rather than marked. Sources conflict, an
 * earlier "Sat 7–12" came from a stale listing, and the FAQ's opening-hours
 * answer is now generated from this same data — so a wrong Saturday would
 * appear in the hours table, the FAQ and the JSON-LD at once.
 */
const copy = copyFor('kts-machine-shop');

// Annotated rather than `satisfies` on purpose: the annotation keeps the
// optional fields (mapUrl, fonts.faces) present in the type even when this
// config leaves them out, so consumers can read them without casts.
const base: SiteConfig = {
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

  certifications: copy.certifications,
  cta: copy.cta,
  pages: copy.pages,
  faq: copy.faq,
  serviceAreas: copy.serviceAreas,

  seo: {
    titleTemplate: '%s | KTS Machine Shop',
    defaultDescription: copy.seoDescription,
    // No domain is registered or pointed at this build.
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

/**
 * The design family.
 *
 * Composed from the copy generated above and the theme, stats, FAQ and
 * service-area copy in `clients/design/kts-machine-shop.brief.json`. Nothing is restated:
 * every headline, service one-liner and review below comes from the
 * copy-generated literal above, so the two cannot drift apart.
 */
export const site: SiteConfig = { ...base, design: designFor('kts-machine-shop', base) };

export default site;
