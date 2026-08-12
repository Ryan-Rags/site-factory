/**
 * The single typed contract for a client site.
 *
 * Every client-specific string, colour, phone number and image path enters the
 * template through this shape. No `.astro` file may hard-code client content.
 */
import type { DesignConfig } from './design';

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
   * Optional "leave us a review" link, for the printable counter card.
   *
   * Renders nothing on the site — it exists so `pnpm review-card <slug>` can
   * produce the leave-behind that asks a customer to review the shop while they
   * are standing at the counter. See `packages/prospect/src/review-card.ts`.
   *
   * Google's form is `https://search.google.com/local/writereview?placeid=<ID>`,
   * and the discovery pipeline legitimately holds Place IDs — but this field is
   * written explicitly rather than derived, and the card refuses to render
   * without it. A guessed or stale Place ID does not fail loudly; it points the
   * shop's own customers at a review form for a different business, which is a
   * worse outcome than having no card at all.
   */
  reviewUrl?: string;
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

/**
 * Named theme preset — the "design family" a site is dressed in.
 *
 * The presets themselves are built in the design stream as a layer over this
 * same `SiteConfig`; this type is only the shared vocabulary for naming one.
 * The field is optional, and a config that omits it renders exactly as it did
 * before presets existed.
 *
 * A consumer that meets a preset it has not built must fall back to the base
 * design rather than fail. The demo pipeline selects a preset from the
 * prospect's niche and passes it straight through, so it will name a family
 * before every checkout of the template can render one.
 */
export type ThemePreset = 'forge' | 'precision' | 'heritage';

export interface Theme {
  /** Optional. See {@link ThemePreset}. Absent means the base design. */
  preset?: ThemePreset;
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

/** Every field the contact form knows how to render. */
export type FormFieldName = 'name' | 'phone' | 'email' | 'service' | 'message' | 'file';

/**
 * What one field is worth to this client.
 *
 * - `required` — rendered, marked, and refused empty by the form and by the
 *   Worker.
 * - `optional` — rendered, validated only when filled in.
 * - `hidden`   — not rendered at all. A value posted into it anyway — a phone
 *   in a workshop holding a service-worker copy of an older build — is neither
 *   validated nor thrown away: see `worker-demo/src/lib/validate.ts`.
 */
export type FormFieldRule = 'required' | 'optional' | 'hidden';

/**
 * The compact quote block, for the home page and the CTA band.
 *
 * Not a second form component. It is the same `ContactForm` with a reduced
 * field set and a one-row layout, because a "quick" form that validates
 * differently from the real one is a bug waiting to be found by a customer
 * rather than by a build.
 */
export interface QuickQuote {
  /** Absent or false renders nothing, anywhere. */
  enabled: boolean;
  heading: string;
  /** One short line under the heading. Omitted renders no paragraph. */
  blurb?: string;
  buttonText: string;
  /** Where it appears. An empty list renders it nowhere, same as disabled. */
  placements: ('home' | 'cta')[];
}

export interface Forms {
  mode: FormsMode;
  /** Cloudflare Worker URL that receives the contact form POST.
   *  Required when `mode` is `worker`, ignored otherwise. */
  workerEndpoint: string;
  maxUploadMB: number;
  acceptedFileTypes: string[];
  /** Cloudflare Turnstile site key. Empty string disables the widget. */
  turnstileSiteKey: string;
  /**
   * Which fields this client's form asks for. Absent — as it is in every config
   * written before this existed — resolves to the historical set: name and
   * message required, phone and email offered as an either/or pair, service
   * and file optional.
   *
   * One rule is not negotiable, and is enforced at build time, by the build
   * gate, and again in the Worker: **no configuration may produce a lead
   * nobody can answer.** A valid submission must be impossible without at
   * least one of phone or email. See `src/lib/form-fields.ts`.
   *
   * The Worker keeps its own copy of these rules (`PROSPECT_FIELDS` in
   * `worker-demo/wrangler.jsonc`), because a form's own validation is a
   * courtesy and the server's is the one that counts.
   * `scripts/check-form-fields.mjs` fails the build when the two disagree.
   */
  fields?: Partial<Record<FormFieldName, FormFieldRule>>;
  /** Optional compact quote block. Absent renders nothing. */
  quickQuote?: QuickQuote;
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
