/**
 * @site-factory/copy — the copywriting engine.
 *
 * Input: a `ProspectRecord`, which is everything we can source about one
 * business plus the question we would ask about everything we cannot.
 * Output: the copy, FAQ, service-area sections, SEO and structured-data seed
 * for that business's site, with every unsourceable claim rendered as a
 * marker rather than a sentence.
 *
 * The package fetches nothing. It holds no API key, makes no network call and
 * touches no Google property — prospect data arrives on the record from the
 * discovery pipeline, and this side of the line only writes.
 */
export * from './types.js';
export { VERIFY_MARKER, marked } from './marker.js';
export { assertPublishable, allowancesFor, FabricationError } from './guard.js';
export {
  BERGEN_MUNICIPALITIES,
  isBergenTown,
  partitionTowns,
  checkBergenList,
  type BergenTown,
} from './bergen.js';
export { niches, nicheFor } from './niches/index.js';
export type { NichePack, ServiceTemplate, FaqTemplate, CopyContext } from './niches/types.js';
export { generate, type Generated } from './generate/index.js';
export { FAQ_TARGET } from './generate/faq.js';
export { TITLE_BUDGET, DESCRIPTION_BUDGET } from './generate/seo.js';
export type { JsonLdSeed } from './generate/jsonld.js';
export type { TrustItem } from './generate/trust.js';
export type { ServiceConfigEntry, ServiceMarkdown } from './generate/services.js';
export type { AboutOutput } from './generate/about.js';
export type { ServiceAreaOutput } from './generate/service-area.js';
export { prospects, prospectFor, PROSPECT_SLUGS } from './prospects/index.js';
