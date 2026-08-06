import type { SiteConfig } from '../src/types/site';

/**
 * SEED CLIENT: K-H Machine Works Inc — North Bergen, NJ.
 *
 * This is a PITCH MOCKUP. Nothing here is published or indexed
 * (`seo.noindex: true`).
 *
 * Anything reading `PLACEHOLDER` is a value we have not confirmed with the
 * client. Every one of them is listed in README step 2 and must be filled in
 * before this is shown to anybody outside the shop. They are deliberately
 * loud rather than plausible-looking, so a stale one cannot slip through: the
 * phone number uses the reserved 555-01xx range that can never connect.
 */
/**
 * The single source of truth for K-H's age. `business.foundedYear` reads from
 * it, and so does every string below that names the year — so the hero
 * subhead, the trust badge, the about headline, the eyebrow and the two SEO
 * descriptions cannot drift apart from each other or from the schema.
 *
 * The founding year is the *company's*, not the owner's. The two are far
 * apart here, and conflating them is what produced the earlier
 * "four decades on the same shop floor" line — see clients/EQUIVALENCE.md.
 *
 * PROVENANCE — 1918 is externally verified, not inferred (retrieved Aug 2026):
 *   - K-H's own live site hero: "Keeping Things Running Since 1918"
 *     (khmachineworks.com)
 *   - D&B and Manta listings: est. 1918 / ~108 years in business
 * Unlike the `PLACEHOLDER` fields, this value does NOT need confirming with
 * the client before the mockup is shown. Do not change it without a source
 * of at least this strength.
 */
const FOUNDED_YEAR = 1918;

// Annotated rather than `satisfies` on purpose: the annotation keeps the
// optional fields (mapUrl, fonts.faces) present in the type even when this
// seed config leaves them out, so consumers can read them without casts.
export const site: SiteConfig = {
  business: {
    name: 'K-H Machine Works',
    legalName: 'K-H Machine Works Inc',
    tagline: 'Precision machining and repair for the people who keep things running.',
    foundedYear: FOUNDED_YEAR,
    phone: '(201) 555-0142', // PLACEHOLDER — reserved test range, confirm real number
    phoneHref: '+12015550142', // PLACEHOLDER
    email: 'PLACEHOLDER@example.com', // PLACEHOLDER — confirm contact inbox
    address: {
      street: 'PLACEHOLDER — confirm street address',
      locality: 'North Bergen',
      region: 'NJ',
      postalCode: 'PLACEHOLDER', // PLACEHOLDER — confirm ZIP
      country: 'US',
    },
    serviceArea: [
      'North Bergen',
      'Union City',
      'Secaucus',
      'Jersey City',
      'Hoboken',
      'Hudson County',
      'Northern New Jersey',
      'New York City metro',
    ],
    hours: [
      { day: 'Monday', opens: '07:00', closes: '16:30' },
      { day: 'Tuesday', opens: '07:00', closes: '16:30' },
      { day: 'Wednesday', opens: '07:00', closes: '16:30' },
      { day: 'Thursday', opens: '07:00', closes: '16:30' },
      { day: 'Friday', opens: '07:00', closes: '15:00' },
      { day: 'Saturday', closed: true },
      { day: 'Sunday', closed: true },
    ],
    // Left unset on purpose. A map link is optional and the template never
    // embeds a map or calls a map API. Paste a plain listing URL to show one.
  },

  theme: {
    // Two colours, as required. Every shade in the site is derived from these
    // in CSS. Run `pnpm check:contrast` after changing them — it asserts WCAG
    // AA across all eight pairings the template actually renders.
    colors: {
      primary: '#0f4c81', // 8.86:1 on white
      accent: '#b45309', // 5.02:1 on white
    },
    fonts: {
      // System stacks by default: zero font requests, instant first paint,
      // and no call to any third-party font host. To use real brand fonts,
      // drop .woff2 files in public/fonts/ and add `faces` entries below —
      // the base layout emits the @font-face rules from this config.
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
    headline: 'Precision machining, done right the first time.',
    subhead:
      `A Hudson County machine shop since ${FOUNDED_YEAR}. Custom parts, repairs and short runs for contractors, building engineers and manufacturers who need the job done properly.`,
    ctaPrimary: { text: 'Send us your part', href: '/contact' },
    ctaSecondary: { text: 'See what we do', href: '/services' },
    image: '/images/hero.svg',
    imageAlt: 'Machinist setting up a part on a lathe in the K-H Machine Works shop floor',
  },

  trustStrip: [
    { icon: 'badge', label: `Family-run since ${FOUNDED_YEAR}` },
    { icon: 'precision', label: 'Tolerances to ±0.001"' },
    { icon: 'clock', label: 'Same-week turnaround on most repairs' },
    { icon: 'wrench', label: 'One-off parts welcome — no minimum order' },
  ],

  services: [
    {
      slug: 'precision-machining',
      title: 'Precision Machining',
      oneLiner: 'Turning, milling and grinding to print, from one piece to a short run.',
      icon: 'precision',
      image: '/images/service-precision-machining.svg',
      imageAlt: 'Finished machined steel components on a workbench',
    },
    {
      slug: 'repairs-rebuilds',
      title: 'Repairs & Rebuilds',
      oneLiner: 'Bring us the broken part. We measure it, make it, and get you running.',
      icon: 'wrench',
      image: '/images/service-repairs-rebuilds.svg',
      imageAlt: 'Worn industrial shaft being measured with a micrometer',
    },
    {
      slug: 'custom-fabrication',
      title: 'Custom Fabrication',
      oneLiner: 'Brackets, shafts, bushings and fixtures built from a sketch or a sample.',
      icon: 'gear',
      image: '/images/service-custom-fabrication.svg',
      imageAlt: 'Custom fabricated steel bracket next to the sketch it was made from',
    },
    {
      slug: 'welding-fitting',
      title: 'Welding & Fitting',
      oneLiner: 'Steel, stainless and aluminium welding, plus on-bench fitting and assembly.',
      icon: 'shield',
      image: '/images/service-welding-fitting.svg',
      imageAlt: 'Welder joining a steel assembly in the fabrication bay',
    },
  ],

  about: {
    // Evergreen on purpose: a founding year is a fact that never goes stale,
    // where "four decades" silently becomes wrong. Never hard-code an age —
    // see `business.foundedYear` and `yearsInBusiness()`.
    //
    // The claim is family continuity, not one person's time on the floor.
    // Nobody has stood at a machine since 1918; the family has kept the shop
    // running that long, and that is what the line says.
    headline: `The same family keeping things running since ${FOUNDED_YEAR}.`,
    entry: 'about',
    image: '/images/story.svg',
    imageAlt: 'The K-H Machine Works shop floor with lathes and milling machines',
  },

  // Both entries are `status: "placeholder"` — see README step 3. The
  // sentiment comes from what the client told us about their reviews; the
  // wording is ours, not a customer's, and no review text was copied from
  // anywhere. Replace with client-supplied wording before this is sent.
  testimonials: [
    {
      quote:
        'We had a part fail on a Friday and no way to get a replacement before the following week. They turned a new one the same day and saved us an expensive return trip.',
      attribution: 'PLACEHOLDER — customer name',
      role: 'Commercial maintenance contractor',
      rating: 5,
      sourceNote:
        'Paraphrase of sentiment relayed by the client (5.0 rating, commercial customer, "saved an expensive return trip"). Wording is ours. Not a quotation.',
      status: 'placeholder',
    },
    {
      quote:
        'They will take on the one-off jobs the big shops turn away, and the part comes back right. That is the whole reason we keep calling them.',
      attribution: 'PLACEHOLDER — customer name',
      role: 'Building engineer',
      rating: 5,
      sourceNote:
        'Paraphrase of sentiment relayed by the client (5.0 rating, no-minimum-order work). Wording is ours. Not a quotation.',
      status: 'placeholder',
    },
  ],

  certifications: [
    {
      label: 'PLACEHOLDER — certification or affiliation',
      detail: 'Confirm with the client which of these they actually hold before publishing.',
    },
    {
      label: 'Fully insured',
      detail: 'General liability cover in place for on-site and in-shop work.',
    },
    {
      label: 'Materials traceability on request',
      detail: 'Mill certs supplied where the job calls for them.',
    },
  ],

  cta: {
    headline: 'Got a part that needs making or fixing?',
    body: 'Send a photo and the dimensions. We will tell you what it takes and what it costs — no charge for the conversation.',
    buttonText: 'Send us your part',
    buttonHref: '/contact',
  },

  // These strings were literals inside the .astro pages before the
  // multi-client refactor. They are reproduced here verbatim, which is what
  // keeps this client's build byte-identical to the pre-refactor output.
  pages: {
    home: {
      servicesHeading: 'Machining, repair and fabrication under one roof',
      servicesIntro: 'Whatever the job, you deal with the same shop from quote to collection.',
    },
    services: {
      title: 'What we do',
      intro:
        'Four things, done properly, by the same people who quoted the job. Everything below is available as a one-off — there is no minimum order.',
      metaDescription:
        'Precision machining, repairs, custom fabrication and welding from K-H Machine Works in North Bergen, NJ.',
    },
    about: {
      eyebrow: `K-H Machine Works Inc · North Bergen, NJ · Est. ${FOUNDED_YEAR}`,
      metaDescription: `K-H Machine Works Inc has been machining and repairing parts in North Bergen, NJ since ${FOUNDED_YEAR}.`,
    },
    contact: {
      title: 'Tell us about the job',
      intro:
        'Send a photo and the dimensions and we will tell you what it takes and what it costs. No charge for the conversation.',
      metaDescription:
        'Call, email or send a photo of your part to K-H Machine Works in North Bergen, NJ.',
    },
  },

  seo: {
    titleTemplate: '%s | K-H Machine Works',
    defaultDescription:
      `K-H Machine Works is a family-run precision machine shop in North Bergen, NJ, serving Hudson County and the New York metro area since ${FOUNDED_YEAR}.`,
    // PLACEHOLDER — no domain is registered or pointed at this build.
    siteUrl: 'https://example.invalid',
    // MOCKUP LOCK. While true: every page emits noindex,nofollow and
    // robots.txt disallows everything. README step 8 is the only place this
    // should ever be flipped, and only with client sign-off.
    noindex: true,
  },

  features: {
    gallery: false,
  },

  forms: {
    // `worker` with an empty endpoint is the pre-deploy state: the form
    // renders and validates client-side but reports that submission is not
    // wired up. Kept deliberately rather than switching to `disabled`, which
    // would remove the form from the page and change this mockup's output.
    mode: 'worker',
    // PLACEHOLDER — deploy worker/ and paste its URL here. Until then the
    // form validates client-side and reports that submission is not wired up.
    workerEndpoint: '',
    maxUploadMB: 10,
    acceptedFileTypes: ['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'application/pdf'],
    // PLACEHOLDER — empty string hides the Turnstile widget entirely.
    turnstileSiteKey: '',
  },
};

export default site;
