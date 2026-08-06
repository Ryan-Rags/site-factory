/**
 * The single typed contract for a client site.
 *
 * Every client-specific string, colour, phone number and image path enters the
 * template through this shape. No `.astro` file may hard-code client content.
 */

export interface Address {
  street: string;
  locality: string;
  region: string;
  postalCode: string;
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
  foundedYear: number;
  phone: string;
  /** Digits only, E.164 without punctuation — used for `tel:` links. */
  phoneHref: string;
  email: string;
  address: Address;
  serviceArea: string[];
  hours: Hours[];
  /**
   * Optional plain link to a map listing. Rendered as a normal anchor only —
   * the template never embeds a map iframe or calls any map API.
   */
  mapUrl?: string;
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

export interface Forms {
  /** Cloudflare Worker URL that receives the contact form POST. */
  workerEndpoint: string;
  maxUploadMB: number;
  acceptedFileTypes: string[];
  /** Cloudflare Turnstile site key. Empty string disables the widget. */
  turnstileSiteKey: string;
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
  cta: CtaBand;
  seo: Seo;
  features: Features;
  forms: Forms;
}
