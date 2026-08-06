// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';

import { site, clientSlug } from './site.config.ts';

/**
 * Static output only. There is deliberately no adapter and no deploy target
 * configured here — this build cannot publish itself anywhere.
 *
 * Output is per-client (`dist/<slug>/`) so building one client never
 * overwrites another's artifacts and `pnpm build:all` can run straight
 * through. Select the client with `SITE_CLIENT` — see site.config.ts.
 */
export default defineConfig({
  site: site.seo.siteUrl,
  outDir: `./dist/${clientSlug}`,
  output: 'static',
  trailingSlash: 'ignore',
  build: { inlineStylesheets: 'always' },
  integrations: [
    react(),
    tailwind({ applyBaseStyles: false }),
    // While the site is a private mockup (`seo.noindex`), do not emit a
    // sitemap at all — there is nothing we want a crawler to discover.
    ...(site.seo.noindex ? [] : [sitemap()]),
  ],
});
