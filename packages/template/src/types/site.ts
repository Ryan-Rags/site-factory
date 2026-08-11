/**
 * The single typed contract for a client site.
 *
 * Every client-specific string, colour, phone number and image path enters the
 * template through this shape. No `.astro` file may hard-code client content.
 */

/**
 * The marker for any value we have not confirmed with the client.
 *
 * Write it inline in the copy where the unconfirmed value would go, e.g.
 * `'Tolerances to [verify with client]'`. It is deliberately conspicuous:
 * a reader cannot mistake it for real content, and `scripts/check-markers.mjs`
 * refuses to let a build carrying it go live.
 *
 * Prefer omitting an optional field over marking it. An absent `hours` renders
 * no hours block at all, which is honest; a marked one renders a table full of
 * `[verify with client]`, which is noise. Mark only where the surrounding copy
 * needs the value to make sense.
 *
 * The constant itself now lives in `@site-factory/copy`, because that package
 * is what *emits* markers and a constant belongs with the thing that produces
 * it. This re-export keeps every existing import working, and keeps there
 * being exactly one spelling: a second wording would be a marker
 * `check-markers.mjs` does not recognise, which is a marker that ships.
 */
export { VERIFY_MARKER } from '@site-factory/copy';

/**
 * The older marker. No config uses it any more — the copy regeneration
 * retired the last of it from K-H, whose build was the only reason it
 * survived — but `check-markers.mjs` still refuses it, so an old config
 * resurrected from history cannot quietly go live.
 *
 * @deprecated Use `VERIFY_MARKER`.
 */
export const LEGACY_MARKER = 'PLACEHOLDER';

export interface Address {
  /** Optional: omitted when unconfirmed. The address block degrades to
   *  locality/region, which is still enough to place the business. */
  street?: string;
  locality: string;
  region: string;
  /** Optional: omitted when unconfirmed. Dropped from the rendered address
   *  line and from `PostalAddress` JSON-LD rather than emitted empty. */
  postalCode?: string;
  country: string;
}

/** One row of the opening-hours table. `closed` days omit `opens`/`closes`. */
export interface Hours {
  /** Schema.org day token, e.g. `Monday`. */
  day: string;
  /** 24h `HH:MM`. Omit when `closed` is true. */
  opens?: string;
  closes?: string;
  closed?: boolean;
}

export interface Business {
  name: string;
  legalName: string;
  tagline: string;
  /**
   * Optional. The single source of truth for the business's age.
   *
   * NEVER hard-code an age or a decade count in copy — "38 years of trust"
   * and "four decades" are both wrong the moment a year turns. Write the
   * founding year (`Since 1987`) or derive from this field at render time
   * via `yearsInBusiness()`. Copy that needs an age and has no `foundedYear`
   * to derive from must be rewritten, not guessed at.
   */
  foundedYear?: number;
  phone: string;
  /** Digits only, E.164 without punctuation — used for `tel:` links. */
  phoneHref: string;
  /** Optional: omitted when unconfirmed. Hides the email row in the footer
   *  and drops `email` from JSON-LD. `forms.mode: 'mailto'` requires it. */
  email?: string;
  address: Address;
  serviceArea: string[];
  /** Optional: omitted when unconfirmed. The whole hours block and the
   *  `openingHoursSpecification` JSON-LD are skipped, not emitted empty. */
  hours?: Hours[];
  /**
   * Optional plain link to a map listing. Rendered as a normal anchor only —
   * the template never embeds a map iframe or calls any map API.
   */
  mapUrl?: string;
  /**
   * Optional coordinates for `LocalBusiness.geo`.
   *
   * Absent on every client today, and absent is the correct default: a
   * coordinate pair in structured data is a factual claim a crawler believes
   * without checking, so a guessed one is worse than none. Values arrive from
   * the discovery pipeline's Places ingestion path; nothing in the template or
   * the copy engine fetches them, and `source` exists so any pair that does
   * appear can be traced back to the run that produced it.
   */
  geo?: Geo;
}

/** Coordinates plus their provenance. See `Business.geo`. */
export interface Geo {
  latitude: number;
  longitude: number;
  /** Where the pair came from, e.g. `Places API run 2026-08-11`. */
  source: string;
}

export interface Theme {
  colors: {
    /** Brand colour. Must reach 4.5:1 against white for body text use. */
    primary: string;
    /** Secondary/CTA colour. Same contrast requirement. */
    accent: string;
  };
  fonts: {
    /** CSS font stack for headings. */
    heading: string;
    /** CSS font stack for body copy. */
    body: string;
    /**
     * Optional self-hosted webfonts. Drop `.woff2` files in `public/fonts/`
     * and describe them here; the base layout emits the `@font-face` rules.
     * Left empty the site renders on system fonts with zero font requests.
     */
    faces?: FontFace[];
  };
}

export interface FontFace {
  family: string;
  /** Path under `public/`, e.g. `/fonts/heading-700.woff2`. */
  src: string;
  weight: string;
  style: string;
  display: string;
}

export interface Brand {
  /**
   * Rendered decoratively (`alt=""`) in both header and footer — the business
   * name sits beside it as real text, so alt text would only be announced
   * twice. Hence no `logoAlt` field.
   */
  logo: string;
  favicon: string;
  ogImage: string;
}

export interface Hero {
  headline: string;
  subhead: string;
  ctaPrimary: LinkCta;
  ctaSecondary: LinkCta;
  image: string;
  imageAlt: string;
}

export interface LinkCta {
  text: string;
  href: string;
}

export interface TrustItem {
  icon: IconName;
  label: string;
}

export type IconName =
  | 'precision'
  | 'clock'
  | 'shield'
  | 'wrench'
  | 'gear'
  | 'truck'
  | 'badge'
  | 'phone';

export interface Service {
  /** Must match a file in `src/content/services/<slug>.md`. */
  slug: string;
  title: string;
  oneLiner: string;
  icon: IconName;
  image: string;
  imageAlt: string;
}

export interface About {
  headline: string;
  /** Entry id in the `about` content collection. */
  entry: string;
  image: string;
  imageAlt: string;
  /**
   * Optional. The phrases in the About prose that came from the business's
   * own material, with their sources — and, crucially, whose words they
   * actually are.
   *
   * Rendered nowhere. It exists so the person reviewing a rewrite can check
   * line by line that the voice on the About page is the owner's and not
   * ours. `attributed: 'ours-pending-confirmation'` marks prose we wrote from
   * their public description of themselves: accurate, possibly good, and
   * still not their voice until they say so.
   */
  voiceNotes?: VoiceNote[];
}

/** See `About.voiceNotes`. */
export interface VoiceNote {
  phrase: string;
  source: string;
  attributed: string;
}

/**
 * Review status. `verified` means the words came from the client or the
 * reviewer. `placeholder` means we wrote them and they MUST be replaced or
 * confirmed before the site is shown to anyone outside the shop.
 */
export type TestimonialStatus = 'verified' | 'placeholder';

export interface Testimonial {
  quote: string;
  attribution: string;
  role: string;
  /** 1–5. */
  rating: number;
  /** Where the sentiment came from, in plain words. Rendered nowhere. */
  sourceNote: string;
  status: TestimonialStatus;
}

export interface Certification {
  label: string;
  detail: string;
}

export interface CtaBand {
  headline: string;
  body: string;
  buttonText: string;
  buttonHref: string;
}

export interface Seo {
  /** `%s` is replaced by the page title. */
  titleTemplate: string;
  defaultDescription: string;
  /** Canonical origin. Placeholder until the client's domain is live. */
  siteUrl: string;
  /**
   * While true every page emits `noindex,nofollow` and `robots.txt` disallows
   * everything. Flip to false only when the client has signed off on going
   * live. See README step 8.
   */
  noindex: boolean;
}

export interface Features {
  /** The `/gallery` page and its nav link build only when this is true. */
  gallery: boolean;
}

/** One shop-news entry. The updates section renders newest-first. */
export interface Update {
  /** ISO `YYYY-MM-DD`. Rendered via `<time datetime>`. */
  date: string;
  title: string;
  /** One short paragraph. Plain text — no markup is parsed. */
  body: string;
}

/** One machine or capability on the shop floor. */
export interface EquipmentItem {
  name: string;
  /** Capacity in the shop's own words, e.g. `60" swing, 3-jaw`. */
  detail?: string;
}

/**
 * How the contact form behaves.
 *
 * - `worker`   — POST to `workerEndpoint`. Requires a non-empty endpoint.
 * - `mailto`   — no backend; the form composes a `mailto:` to `business.email`.
 *                Requires `business.email`.
 * - `disabled` — the form is not rendered. The contact page still shows phone,
 *                address and hours. Use when neither a worker nor a confirmed
 *                inbox exists, rather than shipping a form that silently fails.
 */
export type FormsMode = 'worker' | 'mailto' | 'disabled';

export interface Forms {
  mode: FormsMode;
  /** Cloudflare Worker URL that receives the contact form POST.
   *  Required when `mode` is `worker`, ignored otherwise. */
  workerEndpoint: string;
  maxUploadMB: number;
  acceptedFileTypes: string[];
  /** Cloudflare Turnstile site key. Empty string disables the widget. */
  turnstileSiteKey: string;
}

/**
 * Per-page headings and meta descriptions.
 *
 * These used to be literals inside the `.astro` pages, which was invisible
 * until there was a second client: "Four things, done properly" and
 * "Machining, repair and fabrication under one roof" are K-H's words, not
 * every client's. A welding shop with two services rendered both as lies.
 * Copy that names a trade, a count, or a service belongs here.
 */
export interface PageCopy {
  home: {
    servicesHeading: string;
    servicesIntro: string;
    /**
     * Optional. The home page's own `<title>`, used bare — it is the brand
     * result, so it carries the business name itself rather than letting
     * `titleTemplate` append it.
     *
     * Optional because the pre-copy-engine behaviour, `name — tagline`, is a
     * perfectly reasonable title and every config had it. Set this when the
     * engine has written something better targeted, e.g.
     * `KTS Machine Shop — General Machining in Elmwood Park`.
     */
    title?: string;
    /** Optional. Home-page meta description; falls back to `seo.defaultDescription`. */
    metaDescription?: string;
  };
  services: {
    title: string;
    intro: string;
    metaDescription: string;
  };
  about: {
    /** Sub-line under the about heading, e.g. `Acme Ltd · Leeds · Est. 1990`.
     *  Write the founding year, never a computed age. */
    eyebrow: string;
    metaDescription: string;
  };
  contact: {
    title: string;
    intro: string;
    metaDescription: string;
  };
}

/**
 * One question and its answer.
 *
 * The answer is plain text and is rendered inside a `<details>` element with
 * no markup parsed — an FAQ that needs formatting is an FAQ whose answer is
 * too long to be useful.
 */
export interface FaqItem {
  question: string;
  answer: string;
}

/** One town's block in the service-area section. */
export interface TownSection {
  town: string;
  /**
   * Two or three sentences. Never a distance, a drive time, a landmark or a
   * neighbourhood: those are the invented details that mark a service-area
   * page as automated, and we do not know them.
   */
  body: string;
}

/**
 * The service-area section.
 *
 * Sections on one real page, never a thin page per town — the per-town page
 * is the doorway-page pattern search engines have demoted for years, and it
 * is worse for the reader too.
 */
export interface ServiceAreas {
  heading: string;
  intro: string;
  towns: TownSection[];
  /** One line for areas that do not get their own block. Omitted when null. */
  widerLine?: string;
}

export interface SiteConfig {
  business: Business;
  theme: Theme;
  brand: Brand;
  hero: Hero;
  trustStrip: TrustItem[];
  services: Service[];
  about: About;
  testimonials: Testimonial[];
  certifications: Certification[];
  /** Optional shop news. Absent or empty renders no updates section. */
  updates?: Update[];
  /** Optional capability list. Absent or empty renders no equipment section. */
  equipment?: EquipmentItem[];
  cta: CtaBand;
  pages: PageCopy;
  seo: Seo;
  features: Features;
  forms: Forms;
  /**
   * Optional FAQ. Absent or empty renders no section and emits no `FAQPage`
   * structured data.
   *
   * Generated by `@site-factory/copy`, which drops any question the prospect
   * record cannot answer truthfully rather than padding to a round number —
   * so a short FAQ here means a short list of confirmed facts, not a
   * shortcoming in the template.
   */
  faq?: FaqItem[];
  /** Optional town-by-town service-area section. Absent renders nothing. */
  serviceAreas?: ServiceAreas;
}
