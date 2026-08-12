/**
 * The design-family contract.
 *
 * `src/types/site.ts` describes *who the business is*. This file describes
 * *how its site looks and what blocks it shows* — and nothing else. The split
 * matters: the same `business` block renders in all three families untouched,
 * which is exactly what the K&S acceptance test proves.
 *
 * Every value a family renders arrives through `DesignConfig`. No component
 * and no family stylesheet may hard-code a colour, a font, a headline, an
 * image path or a section's presence. If you find yourself typing a hex code
 * into a `.astro` file, the field belongs here instead.
 *
 * The payload itself ships as JSON (`clients/design/<slug>.design.json`) and
 * is validated against these types at build time by `src/lib/design.ts`.
 * JSON rather than TypeScript because a per-prospect design is *data* — the
 * discovery pipeline should be able to emit one without writing code.
 */

import type { FontFace, IconName, TestimonialStatus } from './site';
import type { ThemeSelection } from '../design/presets';

/**
 * The three families.
 *
 * A family is a token set plus a small number of decorative rules scoped to
 * `[data-family="…"]`. It is deliberately NOT a separate set of components:
 * every family renders the same markup, so a fix to the FAQ accordion or the
 * sticky call bar lands in all three at once, and no family can quietly drift
 * into worse accessibility than its siblings.
 *
 * - `forge`     — near-black carbon base, steel gradients, condensed caps
 *                 headlines, hot accent. Machine shops, welding, fabrication.
 * - `precision` — white/graphite, blueprint grid motifs, blue accent, clean
 *                 sans. Contractors, HVAC, electrical.
 * - `heritage`  — cream with a deep navy or forest ink, serif display,
 *                 ruled dividers. Legacy shops, "family owned since" trades.
 */
export type DesignFamily = 'forge' | 'precision' | 'heritage';

/**
 * Hero layouts, available in every family.
 *
 * Kept as a small closed set rather than a free-form slot because each one
 * carries its own mobile behaviour, and mobile is the case that actually
 * ships. On a phone all three collapse to a single column; the variant
 * decides what happens to the image and the overlay.
 *
 * - `split`         — copy above, media below on mobile; side by side from
 *                     `lg`. The safest default: the image never sits behind
 *                     text, so contrast is a property of the palette alone.
 * - `full-bleed`    — image fills the section with a scrim over it and the
 *                     copy on top. The scrim is derived from the palette's
 *                     `base`, so legibility does not depend on the photo.
 * - `stacked-panel` — copy in a raised panel over a textured/banded field,
 *                     image below it as a wide band. Reads well when the
 *                     client's only photograph is mediocre.
 */
export type HeroVariant = 'split' | 'full-bleed' | 'stacked-panel';

/** Services layout. `cards` is the grid; `list` is a single stacked column. */
export type ServicesVariant = 'cards' | 'list';

/** Reviews layout. `carousel` is a scroll-snap rail; `grid` is static. */
export type ReviewsVariant = 'grid' | 'carousel';

/** Hero image motion. Transform-only, and off under reduced motion. */
export type HeroMotion = 'none' | 'pan' | 'zoom';

/**
 * Every colour the page can use, and the only place colours are named.
 *
 * The pairs matter more than the individual values: `ink` is read on `base`,
 * `onPrimary` on `primary`, `onAccent` on `accent`. `scripts/check-contrast.mjs`
 * checks those pairs, so a family that fails AA fails the build rather than
 * shipping grey-on-grey.
 */
export interface DesignPalette {
  /** Page background. */
  base: string;
  /** Card and panel background, one step off `base`. */
  surface: string;
  /** Alternating section band, so adjacent sections separate without rules. */
  surfaceAlt: string;
  /** Body text on `base` and on `surface`. Must reach 4.5:1 on both. */
  ink: string;
  /** Secondary text. Must reach 4.5:1 on `base` — it is real prose, not decor. */
  inkMuted: string;
  /** Borders, rules, dividers. Not used for text. */
  line: string;
  /** Structural brand colour: headers, footers, filled bands. */
  primary: string;
  /** Text on `primary`. */
  onPrimary: string;
  /** The one colour that means "act": CTAs, the call bar, stat figures. */
  accent: string;
  /** Text on `accent`. */
  onAccent: string;
}

/**
 * The preset layer lives in `src/design/presets.ts`, not here.
 *
 * That is where `ThemePreset`, `AccentSwatch`, `FontPairing`, `ThemeSelection`
 * and `ResolvedTheme` are defined, because they describe the *data file* those
 * types validate rather than the per-prospect contract this file describes.
 * Re-exported here so a component can keep importing its types from one place.
 */
export type {
  AccentSwatch,
  DensityName,
  FontPairing,
  PresetId,
  PresetPalette,
  RadiusName,
  ResolvedTheme,
  ThemePreset,
  ThemeSelection,
} from '../design/presets';

export interface DesignFonts {
  /** Stack for headlines. */
  display: string;
  /** Stack for body copy. */
  body: string;
  /** Weight for display text, e.g. `800`. Condensed faces often want `700`. */
  displayWeight: string;
  /** `uppercase` for Forge's condensed caps; `none` for Heritage's serif. */
  displayTransform: 'none' | 'uppercase';
  /** Letter-spacing for display text, e.g. `-0.02em` or `0.04em`. */
  displayTracking: string;
  /**
   * Optional self-hosted `.woff2` faces, same mechanism as `Theme.fonts.faces`.
   * Left empty, a family renders on system stacks with zero font requests —
   * which is how all three K&S mockups are built, and a large part of why
   * they stay inside the performance bar.
   */
  faces?: FontFace[];
}

export interface DesignCta {
  text: string;
  href: string;
}

export interface DesignImage {
  src: string;
  /** Empty string only for genuinely decorative images. */
  alt: string;
  caption?: string;
  /** Intrinsic size, so the browser reserves the box and CLS stays at zero. */
  width?: number;
  height?: number;
}

export interface HeroSection {
  /** Must be one of the layouts the chosen preset offers. */
  variant: HeroVariant;
  /**
   * Slow transform-only motion on the hero image. `pan` drifts it, `zoom`
   * creeps in. Both are CSS keyframes on `transform` alone, so they never
   * trigger layout, and both are disabled entirely under reduced motion.
   */
  motion?: HeroMotion;
  /** Small line above the headline — locality, trade, or a standing offer. */
  eyebrow?: string;
  headline: string;
  subhead: string;
  ctaPrimary: DesignCta;
  ctaSecondary?: DesignCta;
  image: DesignImage;
  /** Short proof chips under the CTAs, e.g. `Walk-ins welcome`. */
  badges?: string[];
  /** Render the click-to-call line under the CTAs. */
  showPhone: boolean;
}

/**
 * The sticky mobile call bar.
 *
 * Fixed to the bottom of the viewport below `md`, hidden above it — a phone
 * number that is always one thumb-reach away is the single highest-value
 * element on a local service site. Implemented with `position: fixed` and a
 * media query; it costs zero JavaScript.
 */
export interface StickyCtaSection {
  enabled: boolean;
  /** Label beside the phone number, e.g. `Call the shop`. */
  callLabel: string;
  /** Optional second line, e.g. `Open till 4pm today`. */
  callNote?: string;
  /** Optional secondary action beside the call button. */
  secondary?: DesignCta;
}

export interface ServiceCard {
  title: string;
  body: string;
  icon?: IconName;
  image?: DesignImage;
  href?: string;
  /** Optional bullet list under the body. */
  points?: string[];
}

export interface ServicesSection {
  enabled: boolean;
  eyebrow?: string;
  heading: string;
  intro?: string;
  /** Must be one of the layouts the chosen preset offers. */
  variant?: ServicesVariant;
  items: ServiceCard[];
}

/**
 * One review, as it will be rendered.
 *
 * `sourceNote` and `status` are carried over from `Testimonial` for the same
 * reason they exist there: the template must be able to render sentiment we
 * have only heard second-hand without ever presenting it as a verbatim
 * customer quotation. `status: 'placeholder'` means we wrote the words.
 */
export interface ReviewItem {
  author: string;
  /** 1–5. Rendered as filled stars plus a text equivalent for screen readers. */
  rating: number;
  quote: string;
  /** Free text as displayed, e.g. `2 months ago`. Never computed from a lie. */
  date?: string;
  /** Where the sentiment came from, in plain words. Rendered nowhere. */
  sourceNote: string;
  status: TestimonialStatus;
}

export interface ReviewsSection {
  enabled: boolean;
  eyebrow?: string;
  heading: string;
  intro?: string;
  /**
   * How the reviews are attributed on screen, e.g. `Google reviews` once the
   * client has confirmed the listing, or an honest description while they
   * have not. It is a config field precisely so that no component can assert
   * a source we have not verified.
   *
   * Nothing in this template ever contacts, scrapes or automates Google. The
   * reviews rendered here are whatever the config holds, full stop.
   */
  sourceLabel: string;
  /** Plain link to the public listing, when one is confirmed. */
  profileUrl?: string;
  /** Link text for `profileUrl`. */
  profileLinkText?: string;
  /**
   * Confirmed aggregate. Omit it unless the real numbers are known — an
   * invented review count is fabricated audit data, and it is also the number
   * a prospect is most likely to check.
   *
   * `Review`/`AggregateRating` JSON-LD is emitted only when this is present
   * AND every item is `verified`.
   */
  aggregate?: { ratingValue: number; reviewCount: number };
  /** Must be one of the layouts the chosen preset offers. */
  variant?: ReviewsVariant;
  /**
   * Auto-advance interval for the carousel variant, in milliseconds. Omitted
   * or `0` means the rail is swipeable but never advances on its own. The
   * timer never starts under reduced motion regardless of this value.
   */
  autoplayMs?: number;
  items: ReviewItem[];
}

/**
 * The "open now" badge.
 *
 * Computed in the browser from `business.hours` and `business.timezone`, and
 * never at build time — a badge baked into static HTML asserts something
 * about the moment we built the page, not the moment somebody is reading it,
 * and a cached page would happily tell a Sunday visitor the shop is open.
 *
 * It renders nothing at all when the hours are absent or carry a verification
 * marker, and nothing when `business.timezone` is unset: computing "open now"
 * in the *visitor's* zone tells someone two states away the wrong thing, and
 * guessing the shop's zone from its address is exactly the kind of invention
 * this repo does not do.
 */
export interface OpenNowSection {
  enabled: boolean;
  /** Shown while inside opening hours. */
  openLabel: string;
  /** Shown outside them. */
  closedLabel: string;
}

/**
 * A before/after comparison, driven by a range input.
 *
 * Renders only when both photographs are declared real work
 * (`verified: true`). A placeholder pair renders nothing rather than
 * presenting two stock images as a job this shop did.
 *
 * The control is a native `<input type="range">` driving a `clip-path`, so it
 * is keyboard-operable and announced correctly with no drag handling at all.
 */
export interface BeforeAfterSection {
  enabled: boolean;
  eyebrow?: string;
  heading: string;
  intro?: string;
  before: DesignImage;
  after: DesignImage;
  beforeLabel: string;
  afterLabel: string;
  /** Both images must be genuine photographs of this business's own work. */
  verified: boolean;
}

export interface StatItem {
  /** The number itself. The counter animates from 0 to this value. */
  value: number;
  prefix?: string;
  /** e.g. `+`, `%`, `hr`. */
  suffix?: string;
  label: string;
  note?: string;
}

export interface StatsSection {
  enabled: boolean;
  heading?: string;
  intro?: string;
  items: StatItem[];
}

export interface FaqItem {
  q: string;
  a: string;
}

export interface FaqSection {
  enabled: boolean;
  eyebrow?: string;
  heading: string;
  intro?: string;
  items: FaqItem[];
}

export interface GallerySection {
  enabled: boolean;
  eyebrow?: string;
  heading: string;
  intro?: string;
  items: DesignImage[];
}

export interface ServiceAreaSection {
  enabled: boolean;
  eyebrow?: string;
  heading: string;
  intro?: string;
  /**
   * Towns, counties or postcodes. Falls back to `business.serviceArea` when
   * empty, so the section cannot contradict the business block.
   */
  areas: string[];
  note?: string;
  /** Plain anchor to a map listing. The template never embeds a map iframe. */
  mapUrl?: string;
  mapLinkText?: string;
}

export interface FooterColumn {
  heading: string;
  links: DesignCta[];
}

export interface FooterSection {
  /** Short paragraph under the business name. */
  blurb?: string;
  columns?: FooterColumn[];
  /** Show the opening-hours table when `business.hours` exists. */
  showHours: boolean;
  /** Extra line above the copyright, e.g. a licence number. */
  legal?: string;
}

/** One entry in the header's navigation. In-page anchors are the norm. */
export interface NavItem {
  label: string;
  href: string;
}

export interface DesignHeader {
  nav: NavItem[];
  /** CTA button in the desktop header. */
  cta?: DesignCta;
  /** Render the phone number in the header. */
  showPhone: boolean;
}

/**
 * Section keys, in the order `DEFAULT_SECTION_ORDER` renders them. A config
 * may reorder or omit entries via `DesignConfig.order` — the hero is always
 * rendered first regardless, since a page that opens on its FAQ is a bug
 * rather than a design choice.
 */
export type SectionKey =
  | 'stats'
  | 'services'
  | 'beforeAfter'
  | 'reviews'
  | 'gallery'
  | 'serviceArea'
  | 'faq';

export const DEFAULT_SECTION_ORDER: SectionKey[] = [
  'stats',
  'services',
  'beforeAfter',
  'reviews',
  'gallery',
  'serviceArea',
  'faq',
];

export interface DesignSections {
  hero: HeroSection;
  stickyCta: StickyCtaSection;
  services: ServicesSection;
  reviews: ReviewsSection;
  stats: StatsSection;
  faq: FaqSection;
  gallery: GallerySection;
  serviceArea: ServiceAreaSection;
  beforeAfter: BeforeAfterSection;
  openNow: OpenNowSection;
  footer: FooterSection;
}

export interface DesignConfig {
  /**
   * The prospect's theme *selection*: a preset id plus ids of the accent and
   * font pairing it offers. The preset owns the actual colours — see
   * `ThemeSelection`. `theme.preset` is what lands on `<body data-family>`.
   */
  theme: ThemeSelection;
  header: DesignHeader;
  /** Section order after the hero. Defaults to `DEFAULT_SECTION_ORDER`. */
  order?: SectionKey[];
  sections: DesignSections;
}

export const DESIGN_FAMILIES: DesignFamily[] = ['forge', 'precision', 'heritage'];
export const HERO_VARIANTS: HeroVariant[] = ['split', 'full-bleed', 'stacked-panel'];
