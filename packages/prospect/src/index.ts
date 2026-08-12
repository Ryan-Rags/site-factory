/**
 * @site-factory/prospect — the per-prospect demo pipeline.
 *
 * One command turns a prospect id into a personalised site on its own
 * Cloudflare Pages subdomain, plus two printable cards: a QR leave-behind and
 * a before/after comparison.
 *
 * Two rules run through every module here:
 *
 *  - **Nothing is invented.** Every value carries the source it came from, or
 *    it is explicitly `unavailable` with a reason. Copy may be generic; it may
 *    never be a claim about a business nobody told us.
 *  - **Nothing of theirs is touched.** The five hand-authored client configs
 *    are read as data and never written to, generated content is removed after
 *    the build, and ingested business data stays in gitignored `prospects/`.
 */

export const PACKAGE_NAME = "@site-factory/prospect";

export type {
  BrandColors,
  Conflict,
  Field,
  FieldSource,
  KnownField,
  ProspectAddress,
  ProspectConfig,
  ProspectHours,
  ProspectPhoto,
  ProspectReview,
  ProspectService,
  ThemePreset,
  UnavailableField,
  WebsiteStatus,
} from "./types.js";
export { isKnown, known, unavailable, valueOf, valueOr } from "./types.js";

export { emptyProspect, readProspect, today, unavailableFields, writeProspect } from "./schema.js";
export { prospectPaths, prospectsDir, type ProspectPaths } from "./paths.js";

export { checkSchemaDrift, type SiteConfig } from "./site-config.js";
export { projectToSite, phoneHref, type ProjectionResult } from "./project.js";

export { ingestProspect, type IngestOptions, type IngestResult } from "./ingest/index.js";
export {
  classifyWebsite,
  isUsableSite,
  MIN_CONTENT_WORDS,
  type SiteSignals,
  type WebsiteClassification,
  type WebsiteRule,
} from "./ingest/parked.js";
export {
  generatePalette,
  legacySignal,
  presetFor,
  styleForNiche,
  DEFAULT_STYLE,
  LEGACY_YEARS,
  NICHE_STYLES,
  type PresetChoice,
} from "./niches.js";
export { extractPalette } from "./palette.js";
export {
  contrastPairings,
  designAccentPasses,
  designPairings,
  onColorFor,
  palettePasses,
  repairPalette,
  type DesignPalette,
} from "./color.js";
export { buildRecord, nicheIdFor, type RecordResult } from "./record.js";
export { writeCopy, type CopyResult } from "./copy.js";
export { buildDesign, loadPresets, type DesignBlock, type DesignResult } from "./design.js";

export { buildSite, copyAssets, planAssets } from "./build.js";
export { deploySite, projectNameFor } from "./deploy.js";
export { captureAfter, captureBefore, VIEWPORTS } from "./shots.js";
export { renderComparisonCard, renderQrCard } from "./cards.js";
export { knownProspects, runProspect, type RunOptions, type RunResult } from "./run.js";
export { buildManifest, printSummary, writeManifest, type DemoManifest } from "./report.js";
