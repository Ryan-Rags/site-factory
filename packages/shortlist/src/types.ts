import type { WebsiteStatus } from "@site-factory/prospect";

export type { WebsiteStatus };

/**
 * The machine-owned columns of `data/prospects-scored.csv`, in order.
 *
 * This list is the contract. Anything not on it that appears in an existing
 * file is a **human** column — something Ryan added by hand to track calls —
 * and is preserved byte-for-byte across re-runs. This package never writes a
 * column outside this list and never drops one that is.
 */
export const SCORED_COLUMNS = [
  "placeId",
  "name",
  "niche",
  "town",
  "phone",
  "website",
  "websiteStatus",
  "score",
  "reasons",
  "copyPack",
  "status",
] as const;

export type ScoredColumn = (typeof SCORED_COLUMNS)[number];

/** One row of the ranked call list, as written to CSV. All values are text. */
export type ScoredRow = Record<ScoredColumn, string>;

/** A business as the sweep found it, before any judgement. */
export interface SweepResult {
  placeId: string;
  name: string;
  /** Niche slug that found it. */
  nicheSlug: string;
  nicheLabel: string;
  /** The municipality whose query returned it. */
  town: string;
  address: string;
  phone: string;
  website: string;
  /** Places `types`, verbatim. */
  types: string[];
  /** Empty string when Google returned none — never a fabricated zero. */
  rating: string;
  reviewCount: string;
  copyPack: string;
  /** Every (niche, town) query that returned this place. */
  seenIn: string[];
}

/** What the one-navigation home-page read concluded. */
export interface StatusOutcome {
  status: WebsiteStatus;
  rule: string;
  reason: string;
  /** Cheap signals collected by that same navigation, for audit ordering. */
  signals?: CheapSignals | undefined;
}

/**
 * Signals the status GET already paid for.
 *
 * Audit ordering may read **only** these. Ranking must never cost a
 * navigation — that is the whole point of collecting them here.
 */
export interface CheapSignals {
  /** Final URL was http:, not https:. */
  insecure: boolean;
  hasViewportMeta: boolean;
  titleLength: number;
  descriptionLength: number;
  contentWords: number;
  hasContactLink: boolean;
  hasBusinessJsonLd: boolean;
}

/** A business after status, audit and scoring. */
export interface Assessment {
  result: SweepResult;
  status: StatusOutcome;
  /** 0-1 share of decided audit weight that failed. Undefined when not audited. */
  neglect: number | undefined;
  audited: boolean;
  /** Why it was not audited, when it was not. */
  notAuditedReason: string;
  opportunity: number;
  viability: number;
  score: number;
  reasons: string[];
  /** placeId-first identity resolution against existing records. */
  identity: IdentityMatch;
}

export interface IdentityMatch {
  /** `placeId` | `slug-fallback` | `none`. */
  how: "placeId" | "slug-fallback" | "none";
  /** What it matched: a CSV file + row name, or a client slug. */
  matchedIn: string;
  matchedName: string;
  /** Set when the slug fallback fired. Printed loudly. */
  warning: string;
}
