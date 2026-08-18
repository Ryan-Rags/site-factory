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
 * The collision fallback (`<slug>-preview-rr`, used when the project name is
 * held in another account) was left uncovered here, on the reasoning that no
 * client was on that path and that `check-metadata.mjs` would go red rather
 * than quiet if one ever were. BOTH HALVES OF THAT WERE WRONG, and the cost
 * was a live demo: `c3m-of-nj-home-renovation-affordable-handyman` deployed to
 * the `-rr` name on 2026-08-17 and every gate stayed green, because the gate
 * derives the origin from the slug exactly as the build does — so the two
 * agreed with each other and both were wrong about where the site ended up.
 * See `docs/known-issues.md` #13. `PREVIEW_ORIGIN` below is the operator's way
 * to say what actually happened, and `scripts/check-stamped-origins.mjs` is
 * what now goes red instead of nothing.
 */

/** The suffix `deploy-mockups.mjs` gives a per-client Pages project. */
export const PREVIEW_SUFFIX = '-preview';

/**
 * An operator's override for where this build is really served from.
 *
 * Set it ONLY when the Pages project name was substituted and the derived
 * origin is therefore a host that does not resolve. The deploy says when that
 * has happened, and prints the exact command.
 *
 * UNSET BY DEFAULT, AND NOT A TRIGGER — the distinction that matters against
 * the ruling of 2026-08-13, which rejected an env var as the trigger for
 * moving the card. That ruling stands: an unset variable there would silently
 * restore a defect on the next `build:all`. This is not that. `noindex` still
 * decides *whether* the card moves; this only says *where*, it is absent on
 * every ordinary build, and when absent the derived value is returned
 * unchanged — so every existing client stays byte-identical by code path
 * rather than by discipline.
 *
 * What makes an env var safe here when it was not safe there: a wrong value
 * cannot be quiet. `check-stamped-origins.mjs` fetches the origin this
 * produces, and `build-all.mjs` refuses to run a batch while it is set,
 * because one origin across eight clients is the obvious way to misuse it.
 */
function override() {
  const raw = (process.env['PREVIEW_ORIGIN'] ?? '').trim();
  if (raw === '') return '';

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`PREVIEW_ORIGIN is not a URL: ${raw}`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`PREVIEW_ORIGIN must be https, not "${parsed.protocol}": ${raw}`);
  }
  // A path or a query would be stamped into every absolute URL on the site and
  // resolve against something nobody serves.
  if (parsed.origin !== raw.replace(/\/$/, '')) {
    throw new Error(`PREVIEW_ORIGIN must be a bare origin, not ${raw}`);
  }
  return parsed.origin;
}

/**
 * The origin a preview build of `slug` is served from.
 *
 * Derived from the slug alone unless `PREVIEW_ORIGIN` says otherwise, so
 * nothing has to be configured per client and a client added tomorrow gets a
 * correct card with no extra step.
 *
 * Every consumer — `site.config.ts`, `check-metadata.mjs`,
 * `check-delivered-parity.mjs` — goes through this one function, so a build
 * and the gate grading it cannot hold different opinions about the origin.
 * That property is the point, and it is also exactly what let c3m through:
 * agreeing with each other is not the same as being right, which is why
 * `check-stamped-origins.mjs` takes the origin as an input instead.
 */
export function previewOriginFor(slug) {
  return override() || `https://${slug}${PREVIEW_SUFFIX}.pages.dev`;
}
