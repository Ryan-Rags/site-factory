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
 */
import type { DesignConfig } from './design';

export const VERIFY_MARKER = '[verify with client]';

/**
 * The older marker, kept for one reason only: the K-H Machine Works config
 * predates `VERIFY_MARKER` and its build output is byte-locked as the
 * refactor's equivalence proof. Do not use it in any new config — the marker
 * check treats both as equally disqualifying for a live build.
 *
 * @deprecated Use {@link VERIFY_MARKER}.
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
  /**
   * Optional. Digits only, E.164, of a number that can actually receive a text
   * message. Every "Text us" link on the site renders only when this is set.
   *
   * Deliberately separate from `phoneHref` rather than defaulting to it. Most
   * shop numbers are landlines, and a text to a landline is delivered nowhere
   * and answered never — a dead end in the one moment a customer was willing
   * to make contact. Set this only for a number somebody has confirmed
   * receives SMS. Absent, the site has no text links at all, which is honest.
   */
  smsHref?: string;
  /**
   * Optional message prefilled into the text. Keep it short: some clients
   * truncate long bodies, and the customer should be able to add their own
   * sentence without deleting ours first.
   */
  smsBody?: string;
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
   * IANA timezone for the shop, e.g. `America/New_York`.
   *
   * Required by the "open now" badge and by nothing else. It is optional, and
   * absent it the badge does not render — because the alternatives are both
   * wrong: computing opening hours in the *visitor's* zone tells someone two
   * states away that a shop is open when it is not, and inferring the zone
   * from the address is a guess this repo does not make.
   */
  timezone?: string;
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
  | 'phone'
  | 'message';

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
  /**
   * The design preview panel, for pitch builds only.
   *
   * Optional so the configs written before it existed typecheck unchanged.
   * When it is false or absent the panel component, its inline script and the
   * whole theme matrix are **not emitted** — not hidden, not shipped and
   * disabled. A delivered site should carry no trace of it.
   *
   * `SITE_DELIVERED=1` forces it off whatever the config says, so a stale
   * flag cannot leak a customizer into a client's live site.
   */
  customizer?: boolean;
  /**
   * Emit `/sw.js` and register it, so the site keeps working on a dead
   * connection once it has been visited.
   *
   * This exists for one concrete reason: these sites get shown on a phone,
   * standing inside a workshop, where reception is frequently nothing. A demo
   * that spins on a blank page is worse than no demo at all.
   *
   * The cost, stated plainly: a service worker can serve one navigation from
   * an earlier build after a redeploy. HTML is network-first so a connected
   * phone always gets fresh bytes, and the cache name carries the build id so
   * old caches are dropped on activate — the stale window is narrowed, not
   * eliminated. False disables registration entirely and the page ships
   * exactly as it did before this flag existed.
   */
  offline: boolean;
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
   * Optional design family.
   *
   * Absent — as it is for every client written before the families existed —
   * the site renders through `BaseLayout` and the original home-page
   * composition, byte for byte unchanged. That is why the field is optional
   * rather than required: adding three design families cost the five existing
   * clients nothing.
   *
   * Present, it selects one of Forge / Precision / Heritage and supplies
   * every colour, font, image, copy block and section toggle those families
   * render. See `src/types/design.ts`; the payload itself is JSON, in
   * `clients/design/<slug>.design.json`.
   */
  design?: DesignConfig;
}
