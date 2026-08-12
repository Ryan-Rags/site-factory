import type { SweepResult, WebsiteStatus } from "./types.js";

/**
 * Score = opportunity x viability, 0-100.
 *
 * *Opportunity* is how badly they need us. *Viability* is whether they are
 * worth calling at all. They multiply rather than add for the same reason
 * `packages/audit`'s score does: a business with no website and no custom base
 * is not a lead, and adding would let either half carry the other.
 */

/** Reviews at which the volume component saturates. Audit's curve, reused. */
const REVIEW_SATURATION = 100;
/** Floor and range of the viability multiplier. Audit's shape, reused. */
const VIABILITY_FLOOR = 0.25;
const VIABILITY_RANGE = 0.75;

/**
 * Used when Google itself returns no rating — a business with zero reviews.
 * Deliberately mid-range: a business we know nothing about should not outrank
 * a proven one, nor be discarded. Every row that uses it says so in its reasons.
 *
 * Under the single-sweep design this is the rare path. The sweep buys `rating`
 * and `userRatingCount` for every result at no marginal cost, so an empty
 * rating means Google had none, not that we declined to look.
 */
export const NEUTRAL_RATING_COMPONENT = 0.5;

/** Strict tiers, so the worst parked site still outranks the best live one. */
export const OPPORTUNITY: Record<WebsiteStatus, number> = {
  none: 1.0,
  dead: 0.95,
  parked: 0.9,
  live: 0.1, // base; the audited band is added on top
};

/** A live site's opportunity runs across this band, driven by audit neglect. */
export const LIVE_FLOOR = 0.1;
export const LIVE_RANGE = 0.55;

/** Viability component weights. */
export const W_RATING = 0.6;
export const W_PHONE = 0.2;
export const W_COPY_PACK = 0.2;

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

export interface OpportunityInput {
  websiteStatus: WebsiteStatus;
  /** 0-1 from the audit. Undefined when the site was not audited. */
  neglect: number | undefined;
}

export interface OpportunityResult {
  value: number;
  /** Plain words for the reasons column. */
  reason: string;
}

export function opportunityOf(input: OpportunityInput): OpportunityResult {
  switch (input.websiteStatus) {
    case "none":
      return { value: OPPORTUNITY.none, reason: "no website at all" };
    case "dead":
      return { value: OPPORTUNITY.dead, reason: "listed website is dead" };
    case "parked":
      return { value: OPPORTUNITY.parked, reason: "listed website is a parked domain" };
    case "live": {
      if (input.neglect === undefined) {
        return {
          value: LIVE_FLOOR,
          reason: "live site, not audited this run — condition unmeasured",
        };
      }
      const value = LIVE_FLOOR + LIVE_RANGE * clamp01(input.neglect);
      const pct = Math.round(input.neglect * 100);
      return {
        value,
        reason:
          pct >= 50
            ? `live site failing ${pct}% of weighted audit checks`
            : pct > 0
              ? `live site, ${pct}% of weighted audit checks failing`
              : "live site passing every audit check",
      };
    }
  }
}

export interface ViabilityInput {
  rating: string;
  reviewCount: string;
  hasPhone: boolean;
  hasCopyPack: boolean;
}

export interface ViabilityResult {
  value: number;
  ratingComponent: number;
  ratingMeasured: boolean;
  reasons: ReasonCandidate[];
}

/**
 * A reason, with both halves of its salience.
 *
 * `contribution` is what it added to the score; `forfeited` is what its
 * absence cost. A component that is simply missing contributes nothing, so
 * ranking on contribution alone would bury it — and on a call list, "no phone
 * number" is more worth saying than "copy pack ready".
 */
export interface ReasonCandidate {
  text: string;
  contribution: number;
  forfeited: number;
  negative: boolean;
}

export function viabilityOf(input: ViabilityInput): ViabilityResult {
  const rating = Number(input.rating);
  const reviews = Number(input.reviewCount);
  const measured =
    input.rating.trim() !== "" &&
    input.reviewCount.trim() !== "" &&
    Number.isFinite(rating) &&
    Number.isFinite(reviews) &&
    rating > 0;

  let ratingComponent: number;
  let ratingText: string;
  if (measured) {
    const volume = Math.log10(1 + Math.max(0, reviews)) / Math.log10(1 + REVIEW_SATURATION);
    ratingComponent = clamp01((rating / 5) * clamp01(volume));
    ratingText = `${rating}★ from ${reviews} review${reviews === 1 ? "" : "s"}`;
  } else {
    ratingComponent = NEUTRAL_RATING_COMPONENT;
    ratingText = "no rating on their Google listing — scored neutral, not penalised";
  }

  const phone = input.hasPhone ? 1 : 0;
  const pack = input.hasCopyPack ? 1 : 0;

  const weighted = W_RATING * ratingComponent + W_PHONE * phone + W_COPY_PACK * pack;
  const value = VIABILITY_FLOOR + VIABILITY_RANGE * weighted;

  const reasons = [
    {
      text: ratingText,
      contribution: W_RATING * ratingComponent,
      forfeited: W_RATING * (1 - ratingComponent),
      negative: !measured,
    },
    {
      text: input.hasPhone ? "phone number on the listing" : "no phone number — cannot be called",
      contribution: input.hasPhone ? W_PHONE : 0,
      forfeited: input.hasPhone ? 0 : W_PHONE,
      negative: !input.hasPhone,
    },
    {
      text: input.hasCopyPack ? "copy pack ready, demo buildable today" : "no copy pack for this niche yet",
      contribution: input.hasCopyPack ? W_COPY_PACK : 0,
      forfeited: input.hasCopyPack ? 0 : W_COPY_PACK,
      negative: !input.hasCopyPack,
    },
  ];

  return { value, ratingComponent, ratingMeasured: measured, reasons };
}

export interface ScoreInput {
  result: SweepResult;
  websiteStatus: WebsiteStatus;
  neglect: number | undefined;
}

export interface ScoreResult {
  score: number;
  opportunity: number;
  viability: number;
  ratingMeasured: boolean;
  /** Top three, ranked by actual contribution to the final score. */
  reasons: string[];
}

/**
 * Score one business, with the three reasons that moved it most.
 *
 * Reasons are ranked by computed contribution rather than a fixed template, so
 * what a row says about itself is what actually drove its number. Opportunity
 * is listed first when it dominates — and it usually does, because the tiers
 * are strict — but a high-opportunity lead with a fatal viability gap ("no
 * phone number") will surface that instead, which is the honest thing to show
 * on a call list.
 */
export function scoreProspect(input: ScoreInput): ScoreResult {
  const opportunity = opportunityOf({
    websiteStatus: input.websiteStatus,
    neglect: input.neglect,
  });
  const viability = viabilityOf({
    rating: input.result.rating,
    reviewCount: input.result.reviewCount,
    hasPhone: input.result.phone.trim() !== "",
    hasCopyPack: input.result.copyPack !== "",
  });

  const score = Math.round(100 * opportunity.value * viability.value);

  const candidates: ReasonCandidate[] = [
    // Opportunity is the single largest lever and always the most explanatory
    // thing about a row, so it competes on its full value.
    { text: opportunity.reason, contribution: opportunity.value, forfeited: 0, negative: false },
    ...viability.reasons,
  ];

  /**
   * Rank by *salience*: how much this factor explains the score, whether by
   * adding to it or by being the thing that held it down. A missing component
   * forfeits its whole weight, so it competes on that weight rather than on
   * the nothing it contributed — which is why a lead with no phone number says
   * so instead of quietly reporting its copy pack.
   *
   * Ties break toward the negative, because a gap is more decision-relevant on
   * a call list than a feature that is merely present.
   */
  const reasons = candidates
    .sort((a, b) => {
      const salience = Math.max(b.contribution, b.forfeited) - Math.max(a.contribution, a.forfeited);
      if (Math.abs(salience) > 1e-9) return salience;
      return Number(b.negative) - Number(a.negative);
    })
    .slice(0, 3)
    .map((r) => r.text);

  return {
    score,
    opportunity: opportunity.value,
    viability: viability.value,
    ratingMeasured: viability.ratingMeasured,
    reasons,
  };
}
