import type { CheckResult, ValueBasis } from "./types.js";

/**
 * Reviews at which the value component saturates. Above this, more reviews do
 * not make a lead meaningfully better.
 */
const REVIEW_SATURATION = 100;
/** Floor and range of the multiplier when rating data exists. */
const VALUE_FLOOR = 0.25;
const VALUE_RANGE = 0.75;
/**
 * Used when the business has no rating data at all. Deliberately mid-range: a
 * lead we know nothing about should not outrank a proven one, nor be discarded.
 * Every report that uses it says so explicitly.
 */
const NEUTRAL_MULTIPLIER = 0.7;

export interface ScoreInput {
  checks: readonly CheckResult[];
  rating: string;
  reviewCount: string;
}

export interface Score {
  /** Share of decided weight that failed, 0-1. Undefined if nothing decided. */
  neglect: number | undefined;
  valueMultiplier: number;
  valueBasis: ValueBasis;
  /** 0-100. */
  score: number;
  decidedChecks: number;
  unavailableChecks: number;
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/**
 * Score = neglect x value.
 *
 * *Neglect* is how broken the site is, computed only over checks that actually
 * returned a verdict — an `unavailable` check is not evidence of neglect and
 * must not drag the score in either direction.
 *
 * *Value* is whether the business is worth pitching, from rating and review
 * volume. A thoroughly neglected site attached to a business with no custom
 * base is not a lead, so the two multiply rather than add.
 */
export function scoreSite(input: ScoreInput): Score {
  let decidedWeight = 0;
  let failedWeight = 0;
  let decidedChecks = 0;
  let unavailableChecks = 0;

  for (const check of input.checks) {
    if (check.status === "unavailable") {
      unavailableChecks += 1;
      continue;
    }
    decidedChecks += 1;
    decidedWeight += check.weight;
    if (check.status === "fail") failedWeight += check.weight;
  }

  const neglect = decidedWeight > 0 ? failedWeight / decidedWeight : undefined;

  const rating = Number(input.rating);
  const reviews = Number(input.reviewCount);
  const hasRatingData =
    input.rating.trim() !== "" &&
    input.reviewCount.trim() !== "" &&
    Number.isFinite(rating) &&
    Number.isFinite(reviews) &&
    rating > 0;

  let valueMultiplier: number;
  let valueBasis: ValueBasis;
  if (hasRatingData) {
    const volume = Math.log10(1 + Math.max(0, reviews)) / Math.log10(1 + REVIEW_SATURATION);
    const value = clamp01((rating / 5) * clamp01(volume));
    valueMultiplier = VALUE_FLOOR + VALUE_RANGE * value;
    valueBasis = "ratings";
  } else {
    valueMultiplier = NEUTRAL_MULTIPLIER;
    valueBasis = "neutral-no-rating-data";
  }

  const score =
    neglect === undefined ? 0 : Math.round(100 * neglect * valueMultiplier);

  return { neglect, valueMultiplier, valueBasis, score, decidedChecks, unavailableChecks };
}
