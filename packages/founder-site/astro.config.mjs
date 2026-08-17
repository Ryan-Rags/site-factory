// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

import { SITE_URL } from './src/site.ts';

/**
 * Static output, no adapter, zero client JavaScript.
 *
 * This is the INVERSE of packages/template's posture and that is deliberate:
 * the template builds private prospect mockups that must not be indexed, so it
 * suppresses the sitemap and ships `noindex`. This site is a public credibility
 * page that we actively want crawled, so the sitemap is unconditional and
 * `robots.txt` allows. `scripts/check-indexable.mjs` fails the build if any of
 * that regresses — see it for the full list of inversions.
 *
 * `inlineStylesheets: 'always'` is what keeps the render path to a single
 * request per page: the CSS is small enough that a separate stylesheet would
 * cost more in round-trip than it saves in caching, and a property manager
 * opening this once from a phone on a cold cache is the case that matters.
 */
export default defineConfig({
  site: SITE_URL,
  output: 'static',

  /**
   * `format: 'file'` emits `dist/sites.html`, not `dist/sites/index.html`.
   *
   * This is not cosmetic. Every canonical on this site is written WITHOUT a
   * trailing slash (`https://raghubans.com/sites`), and with directory output
   * Cloudflare Pages answered that exact URL with a 308 to `/sites/` — so each
   * canonical pointed at a redirect rather than at a document. Measured on the
   * first deploy: `/sites`, `/ai`, `/amenity` and `/about` all returned 308.
   *
   * With file output, Pages serves the no-slash URL as a 200 directly and
   * redirects the slashed form instead, which is the direction the canonicals
   * want. `scripts/check-live.mjs` asserts the deployed site answers 200 with no
   * redirect hop, which is the only place this can actually be verified.
   */
  build: { format: 'file', inlineStylesheets: 'always' },
  trailingSlash: 'never',

  integrations: [sitemap()],
});
