/** Types for `preview-origin.mjs`. See that file for why it is not `.ts`. */

/** The suffix `deploy-mockups.mjs` gives a per-client Pages project. */
export declare const PREVIEW_SUFFIX: string;

/** The origin a preview build of `slug` is served from. */
export declare function previewOriginFor(slug: string): string;
