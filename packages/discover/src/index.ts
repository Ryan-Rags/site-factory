/**
 * @site-factory/discover — finds candidate local businesses.
 *
 * Source of record is the official Google Places API only; scraping Google
 * Search/Maps (or any Google property) is prohibited. Output is a row per
 * business matching the schema in `data/businesses.sample.csv`.
 *
 * This package also owns the lead schema and the small filesystem helpers that
 * go with it, so `audit` and `outreach` read leads through one definition
 * rather than three.
 */

export const PACKAGE_NAME = "@site-factory/discover";

export { LEAD_COLUMNS, emptyLead } from "./types.js";
export type { LeadColumn, LeadRow } from "./types.js";

export {
  appendLeads,
  leadKey,
  parseCsv,
  readLeads,
  serializeLeads,
  writeLeads,
} from "./csv.js";
export type { AppendResult } from "./csv.js";

export { slugify, uniqueSlug } from "./slug.js";
export { hostOf, normalizeUrl } from "./url.js";
export {
  loadEnv,
  parseEnv,
  requireApiKey,
  resolvePlacesApiKey,
  resetDeprecationWarning,
  PLACES_KEY,
  PLACES_KEY_DEPRECATED,
  type ResolvedApiKey,
} from "./env.js";

export {
  auditCacheDir,
  auditDir,
  auditOutDir,
  auditReportFile,
  dataDir,
  findRepoRoot,
  leadsFile,
  noSiteFile,
  outreachDir,
  outreachSkippedFile,
  repoRoot,
  sampleLeadsFile,
} from "./paths.js";

export {
  CallBudget,
  FIELD_MASK,
  MAX_CALLS_PER_RUN,
  MAX_RESULTS,
  PAGE_SIZE,
  loadFixture,
  placeToLead,
  searchText,
} from "./places.js";
export type {
  FetchLike,
  PlacesPlace,
  PlacesResponse,
  SearchOptions,
  ToLeadOptions,
} from "./places.js";
