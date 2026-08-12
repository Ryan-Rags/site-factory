import type { SiteConfig } from '../src/types/site';
import { VERIFY_MARKER as V } from '../src/types/site';
import { copyFor } from './from-copy';
import { designFor } from './design';

/**
 * SEED CLIENT: K-H Machine Works Inc — North Bergen, NJ.
 *
 * This is a PITCH MOCKUP. Nothing here is published or indexed
 * (`seo.noindex: true`).
 *
 * Every string of copy on this site is now generated from
 * `packages/copy/src/prospects/kh-machine-works.ts`, where each fact sits
 * next to the source that supports it. What remains below is the half that is
 * not copy: identity, theme, brand assets, testimonials, and the form's
 * deploy-time configuration.
 *
 * TWO THINGS CHANGED IN CHARACTER WITH THE REGENERATION.
 *
 * 1. The legacy `PLACEHOLDER` marker is gone. K-H was the last config using
 *    it, kept only because its build output was byte-locked as the
 *    multi-client refactor's equivalence proof. Regenerating the copy ends
 *    that lock deliberately — see `clients/EQUIVALENCE.md` — so the marker
 *    goes with it and the repo now has exactly one spelling.
 *
 * 2. Nothing on this site says the shop is family-run. The previous copy said
 *    "the same family keeping things running since 1918", which conflated the
 *    *company's* age with a *family's* tenure. 1918 is verified; continuous
 *    family ownership is not, and it is now an explicit question on the
 *    prospect record rather than an assumption in a headline.
 *
 * What is still unconfirmed, and why each is a marker rather than a guess:
 *   - `testimonials[].attribution` — the quotes are our paraphrase of what
 *     the client described. No customer said these words. Needs sign-off from
 *     the client, and no public source could ever substitute for it.
 *   - `certifications[].label` — no source found. Do not guess a cert.
 *   - `forms.workerEndpoint` / `forms.turnstileSiteKey` — not a fact about
 *     the business at all. The infrastructure does not exist yet; these fill
 *     in at deploy time (README steps 7–8), not from research.
 *
 * Founding year, phone, email, address and domain are sourced from K-H's own
 * public statements; the provenance for each lives on the prospect record.
 */
const copy = copyFor('kh-machine-works');

/**
 * PROVENANCE — 1918 is externally verified, not inferred (retrieved Aug 2026):
 *   - K-H's own live site hero: "Keeping Things Running Since 1918"
 *     (khmachineworks.com)
 *   - D&B and Manta listings: est. 1918 / ~108 years in business
 *
 * Restated here because `business.foundedYear` is the schema's single source
 * of truth for the shop's age and a reader of this file should not have to
 * open another package to find out whether it was checked. It is checked. Do
 * not change it without a source of at least this strength.
 */
const FOUNDED_YEAR = 1918;

// Annotated rather than `satisfies` on purpose: the annotation keeps the
// optional fields (mapUrl, fonts.faces) present in the type even when this
// config leaves them out, so consumers can read them without casts.
const base: SiteConfig = {
  business: {
    name: 'K-H Machine Works',
    legalName: 'K-H Machine Works Inc',
    tagline: 'Precision machining and repair for the people who keep things running.',
    foundedYear: FOUNDED_YEAR,
    phone: '(201) 867-2338',
    phoneHref: '+12018672338',
    email: 'KHCanDo@optonline.net',
    address: {
      street: '4322 Grand Ave',
      locality: 'North Bergen',
      region: 'NJ',
      postalCode: '07047',
      country: 'US',
    },
    // North Bergen is Hudson County, not Bergen — which is why this client
    // gets no Bergen County town sections and its service-area block is a
    // wider-area line instead. The copy engine partitions on the real county
    // list rather than on the word "Bergen" in the town name.
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
    // `geo` unset. Coordinates come from the pipeline's Places ingestion path
    // or not at all — the copy engine never fetches them.
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
    ctaPrimary: { text: 'Send us your part', href: '/contact' },
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

  // Both entries are `status: "placeholder"`. The sentiment comes from what
  // the client told us about their reviews; the wording is ours, not a
  // customer's, and no review text was copied from anywhere. Replace with
  // client-supplied wording before this is sent.
  testimonials: [
    {
      quote:
        'We had a part fail on a Friday and no way to get a replacement before the following week. They turned a new one the same day and saved us an expensive return trip.',
      attribution: `${V} — customer name`,
      role: 'Commercial maintenance contractor',
      rating: 5,
      sourceNote:
        'Paraphrase of sentiment relayed by the client (5.0 rating, commercial customer, "saved an expensive return trip"). Wording is ours. Not a quotation.',
      status: 'placeholder',
    },
    {
      quote:
        'They will take on the one-off jobs the big shops turn away, and the part comes back right. That is the whole reason we keep calling them.',
      attribution: `${V} — customer name`,
      role: 'Building engineer',
      rating: 5,
      sourceNote:
        'Paraphrase of sentiment relayed by the client (5.0 rating, no-minimum-order work). Wording is ours. Not a quotation.',
      status: 'placeholder',
    },
  ],

  certifications: copy.certifications,
  cta: copy.cta,
  pages: copy.pages,
  faq: copy.faq,
  serviceAreas: copy.serviceAreas,

  seo: {
    titleTemplate: '%s | K-H Machine Works',
    defaultDescription: copy.seoDescription,
    // K-H's real, verified-live domain (retrieved Aug 2026). Set now rather
    // than at go-live so canonicals and JSON-LD `@id` point at the business's
    // actual identity instead of a fake one.
    //
    // Note what this does NOT mean: this build is not deployed there. Astro
    // resolves absolute URLs (og:image, logo, JSON-LD) against it, so those
    // point at paths that do not exist on the live site. Harmless while
    // `noindex` is true — nothing crawls them — but if this mockup is ever
    // hosted at a preview URL for the client to click through, the OG preview
    // image will not resolve. Fix that by pointing siteUrl at the preview
    // host, not by reverting this.
    siteUrl: 'https://www.khmachineworks.com',
    // MOCKUP LOCK. While true: every page emits noindex,nofollow and
    // robots.txt disallows everything. README step 8 is the only place this
    // should ever be flipped, and only with client sign-off.
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
    // `worker` with an empty endpoint is the pre-deploy state: the form
    // renders and validates client-side but reports that submission is not
    // wired up.
    mode: 'worker',
    // Deploy worker/ and paste its URL here. Not a fact about the business,
    // so not a marker — it fills in at deploy time.
    workerEndpoint: '',
    maxUploadMB: 10,
    acceptedFileTypes: ['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'application/pdf'],
    // Empty string hides the Turnstile widget entirely.
    turnstileSiteKey: '',
  },
};

/**
 * The design family.
 *
 * Composed from the copy generated above and the theme, stats, FAQ and
 * service-area copy in `clients/design/kh-machine-works.brief.json`. Nothing is restated:
 * every headline, service one-liner and review below comes from the
 * copy-generated literal above, so the two cannot drift apart.
 */
export const site: SiteConfig = { ...base, design: designFor('kh-machine-works', base) };

export default site;
