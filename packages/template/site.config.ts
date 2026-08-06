import { resolveClient } from './clients';

/**
 * The active client's config.
 *
 * Every component imports `site` from here and is unaware that more than one
 * client exists — which is why the multi-client change touched no `.astro`
 * file's data flow. Per-client content lives in `clients/<slug>.config.ts`;
 * this module only decides which one is in play, from `SITE_CLIENT`.
 *
 * Build one client:  SITE_CLIENT=kts-machine-shop pnpm build
 *                    pnpm build:client kts-machine-shop
 * Build them all:    pnpm build:all
 */
const resolved = resolveClient();

/** Slug of the client being built. Also the `dist/<slug>/` output directory. */
export const clientSlug = resolved.slug;

export const site = resolved.site;

export default site;
