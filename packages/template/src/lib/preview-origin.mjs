/**
 * Where a preview demo is actually served from.
 *
 * A demo build and a delivered build differ in one way that no artifact
 * inspection can see: the delivered site is served from its own
 * `seo.siteUrl`, and a demo is served from a Cloudflare Pages project named
 * after its slug. Everything absolute in the page resolves against the first
 * of those, which is correct for a client and wrong for a prospect — see
 * issue #25, where 0 of 8 deployed demos advertised a reachable social card
 * while all 8 served the card correctly at this origin.
 *
 * Plain `.mjs` with a `.d.ts` beside it, for the same reason
 * `src/design/contrast.mjs` is: it has to be readable both by TypeScript
 * that Astro compiles (`site.config.ts`) and by a bare `node scripts/…`
 * gate, and a `.ts` module cannot be the second of those.
 *
 * THE RULE IS THE DEPLOY'S RULE. `scripts/deploy/deploy-mockups.mjs` names a
 * Pages project `<slug>-preview` and reports `https://<name>.pages.dev` as
 * the URL a prospect is sent. That script still declares its own
 * `PROJECT_SUFFIX`; it is outside this stream's granted paths, so it was not
 * repointed at this module. See the Decision Brief — the two constants must
 * agree, and today they agree by inspection rather than by construction.
 *
 * Not covered here, deliberately: that script's collision fallback
 * (`<slug>-preview-rr`, used only when the project name is held in another
 * account). No client is on that path. If one ever is, `check-metadata.mjs`
 * goes red rather than quiet, which is the correct direction for a rule that
 * has stopped describing reality.
 */

/** The suffix `deploy-mockups.mjs` gives a per-client Pages project. */
export const PREVIEW_SUFFIX = '-preview';

/**
 * The origin a preview build of `slug` is served from.
 *
 * Derived from the slug alone, so nothing has to be configured per client and
 * a client added tomorrow gets a correct card with no extra step.
 */
export function previewOriginFor(slug) {
  return `https://${slug}${PREVIEW_SUFFIX}.pages.dev`;
}
