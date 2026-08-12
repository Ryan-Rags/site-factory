/**
 * The prospect config: everything we know about one business, and where each
 * piece came from.
 *
 * The shape is deliberately not a plain record of values. Every field is a
 * {@link Field}, which is either a value *with* its provenance or an explicit
 * `unavailable` with a reason. There is no third state and no bare string, so
 * "we do not know this" cannot decay into "" and then into a plausible-looking
 * guess somewhere downstream. This is the same rule the audit package applies
 * to its checks (`pass | fail | unavailable`), enforced structurally.
 *
 * The file lives at `prospects/<id>/prospect.json` and is gitignored: it is
 * third-party business data, which CLAUDE.md forbids committing.
 */

/**
 * Where a value came from, in precedence order (highest first).
 *
 * - `manual`    — a hand-authored client config in `packages/template/clients/`.
 *                 Those five carry researched provenance for every value they
 *                 hold, so nothing ingested may overwrite one.
 * - `folder`    — files the operator dropped in `prospects/<id>/assets/`.
 * - `places`    — the official Google Places API. Never scraped.
 * - `website`   — the prospect's own current website, read-only.
 * - `generated` — we made it up *as design, not as fact*: the per-niche
 *                 palette and the preset choice. Never used for a claim about
 *                 the business.
 */
export type FieldSource = 'manual' | 'folder' | 'places' | 'website' | 'generated';

export const SOURCE_PRECEDENCE: readonly FieldSource[] = [
  'manual',
  'folder',
  'places',
  'website',
  'generated',
] as const;

export interface KnownField<T> {
  status: 'known';
  value: T;
  source: FieldSource;
  /** ISO date. When this value was read from its source. */
  retrievedAt: string;
  /** Where exactly it came from, in plain words, e.g. `footer tel: link`. */
  note?: string;
}

export interface UnavailableField {
  status: 'unavailable';
  /** Why, in plain words. Rendered in the run report so gaps are visible. */
  reason: string;
}

export type Field<T> = KnownField<T> | UnavailableField;

export interface ProspectAddress {
  street?: string;
  locality: string;
  region: string;
  postalCode?: string;
  country: string;
}

/** One row of opening hours. Mirrors the template's `Hours`. */
export interface ProspectHours {
  day: string;
  opens?: string;
  closes?: string;
  closed?: boolean;
}

export interface ProspectService {
  slug: string;
  title: string;
  /** One line, in the business's own words where we have them. */
  oneLiner?: string;
}

export interface ProspectPhoto {
  /** Path relative to the repo root, or a Places photo resource name. */
  ref: string;
  /** `folder` photos are on disk; `places` photos are referenced, not stored. */
  kind: 'folder' | 'places';
  attribution?: string;
  /** Set for folder photos only: the file exists at this absolute path. */
  file?: string;
}

export interface ProspectReview {
  author: string;
  rating: number;
  text: string;
  /** ISO date if the source gave one. */
  publishedAt?: string;
  /**
   * Displayed verbatim beside the quote. Google review content carries an
   * attribution requirement, and the demo shows it — see PLAN-demo.md Q4.
   */
  attribution: string;
}

export interface BrandColors {
  primary: string;
  accent: string;
}

/** Mirrors `ThemePreset` in `packages/template/src/types/site.ts`. */
export type ThemePreset = 'forge' | 'precision' | 'heritage';

/**
 * What is actually at the prospect's listed web address.
 *
 * See `ingest/parked.ts` for how it is decided. The short version: a URL that
 * answers is not the same as a website. `parked` and `dead` are treated
 * exactly as `none` for content derivation — nothing on a registrar's sale
 * page is a fact about the business — but the three are recorded distinctly,
 * because "your domain has lapsed and somebody is selling it" is a different
 * conversation from "you have never had a site".
 */
export type WebsiteStatus = 'live' | 'parked' | 'dead' | 'none';

/**
 * A value two sources disagreed about. The higher-precedence source wins and
 * the loser is recorded here rather than dropped: a live site whose phone
 * number differs from the Places listing is a fact worth knowing at first
 * contact, and silently picking one would hide it.
 */
export interface Conflict {
  field: string;
  kept: { value: string; source: FieldSource };
  discarded: { value: string; source: FieldSource };
}

export interface ProspectConfig {
  /** Slug. The join key across prospects/, audit/out/, dist/ and Pages. */
  id: string;
  /** ISO timestamp of the ingest run that wrote this file. */
  generatedAt: string;

  businessName: Field<string>;
  legalName: Field<string>;
  niche: Field<string>;
  phone: Field<string>;
  email: Field<string>;
  address: Field<ProspectAddress>;
  serviceArea: Field<string[]>;
  hours: Field<ProspectHours[]>;
  services: Field<ProspectService[]>;
  foundedYear: Field<number>;
  currentSiteUrl: Field<string>;
  /**
   * What is at `currentSiteUrl`. Always known after an ingest run that was not
   * given `--skip-website`: `none` is an answer, not a gap.
   */
  websiteStatus: Field<WebsiteStatus>;
  ratingSummary: Field<{ rating: number; count: number }>;
  reviews: Field<ProspectReview[]>;
  photos: Field<ProspectPhoto[]>;

  brand: {
    colors: Field<BrandColors>;
    logoPath: Field<string>;
    /**
     * True when the palette is ours rather than theirs. Surfaced in the run
     * report so the colours are never pitched as the business's own brand.
     */
    createdByUs: boolean;
  };

  /** The design family. Chosen from the niche unless one was given. */
  preset: Field<ThemePreset>;

  conflicts: Conflict[];
}

export function known<T>(
  value: T,
  source: FieldSource,
  retrievedAt: string,
  note?: string,
): KnownField<T> {
  return note === undefined
    ? { status: 'known', value, source, retrievedAt }
    : { status: 'known', value, source, retrievedAt, note };
}

export function unavailable(reason: string): UnavailableField {
  return { status: 'unavailable', reason };
}

export function isKnown<T>(field: Field<T>): field is KnownField<T> {
  return field.status === 'known';
}

/** The value, or `undefined` when the field is unavailable. */
export function valueOf<T>(field: Field<T>): T | undefined {
  return field.status === 'known' ? field.value : undefined;
}

/** The value, or `fallback` when the field is unavailable. */
export function valueOr<T>(field: Field<T>, fallback: T): T {
  return field.status === 'known' ? field.value : fallback;
}
