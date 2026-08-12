/**
 * @site-factory/shortlist — county-wide discovery and scoring.
 *
 * Sweeps Bergen County through the official Places API, decides what is
 * actually at each business's web address, audits the live ones, and emits a
 * ranked call list.
 *
 * Three rules run through it:
 *
 *  - **One sweep, nothing else.** A single Text Search per (niche, town) buys
 *    everything the scoring needs. Nothing here calls Place Details, and every
 *    call is priced and capped before it is issued.
 *  - **Nothing is invented.** A business with no rating scores neutral and
 *    says so; a live site nobody audited is recorded as unmeasured, never as
 *    fine. Unmeasured is unavailable.
 *  - **The judgement lives in one place.** Website classification is
 *    `packages/prospect`'s `classifyWebsite`, neglect is `packages/audit`'s
 *    check weights, and copy-pack availability is `packages/copy`'s registry.
 *    This package orchestrates them; it does not re-decide what they decided.
 */

export const PACKAGE_NAME = "@site-factory/shortlist";

export {
  NICHES,
  COPY_PACK_NICHE_SLUGS,
  copyPackFor,
  hasCopyPack,
  nicheBySlug,
  type Niche,
} from "./niches.js";

export {
  SCORED_COLUMNS,
  type Assessment,
  type CheapSignals,
  type IdentityMatch,
  type ScoredColumn,
  type ScoredRow,
  type StatusOutcome,
  type SweepResult,
  type WebsiteStatus,
} from "./types.js";

export { REGION, queryFor, sweep, type SweepOptions, type SweepOutcome } from "./sweep.js";

export { unreachableSignals, websiteStatus, type StatusOptions } from "./signals.js";

export {
  RANK_CRITERIA,
  criteriaFor,
  provisionalRank,
  rankForAudit,
  renderOrdering,
  type RankCriterion,
  type RankedCandidate,
} from "./rank.js";

export {
  LIVE_FLOOR,
  LIVE_RANGE,
  NEUTRAL_RATING_COMPONENT,
  OPPORTUNITY,
  W_COPY_PACK,
  W_PHONE,
  W_RATING,
  opportunityOf,
  scoreProspect,
  viabilityOf,
  type ScoreInput,
  type ScoreResult,
} from "./score.js";

export {
  applyBackfill,
  loadKnownRecords,
  planBackfill,
  readClientPlaceIds,
  renderBackfillPlan,
  resolveIdentity,
  type BackfillOutcome,
  type ClientPlaceIds,
} from "./identity.js";

export {
  mergeScored,
  readScored,
  serializeScored,
  writeScored,
  type ExistingFile,
  type MergeOutcome,
} from "./csv.js";

export {
  histogram,
  renderHistogram,
  renderStatusTally,
  renderTop,
  tallyByStatus,
  type HistogramBand,
} from "./summary.js";

export { assess, toScoredRow, type AssessOptions, type AssessOutcome } from "./run.js";

export { fixtureFetch, fixturePlaces } from "./fixture.js";

export {
  DEFAULT_TOP,
  USAGE,
  parseArgs as parseShortlistArgs,
  render,
  renderCommand,
  select,
  type Args as ShortlistArgs,
  type ShortlistRow,
} from "./shortlist.js";
