import { resolveClient } from './clients';
import { previewOriginFor } from './src/lib/preview-origin.mjs';

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

/**
 * The origin this build's social card must be advertised at, or `''` when the
 * card belongs at `seo.siteUrl` like everything else.
 *
 * A demo is served from `https://<slug>-preview.pages.dev`, not from the
 * prospect's own domain — which for six of the eight clients is
 * `https://example.invalid` and for the other two is a real domain that 404s
 * the path. `og:image` is an absolute URL, so it resolved against `siteUrl`
 * and every demo link shared into Facebook, X, LinkedIn, iMessage, WhatsApp
 * or Slack arrived with no image, measured 0 for 8 on the live fleet. The PNG
 * was correct on all eight at this origin the whole time; only the address in
 * the tag was wrong. See issue #25.
 *
 * KEYED ON `seo.noindex`, not on an env var, and that is the load-bearing
 * choice. `DEMO_FORM_ENDPOINT` can be forgotten on a build and the failure is
 * loud — `deploy-mockups.mjs` refuses to publish. Nothing refuses to publish a
 * wrong card, so an unset variable here would silently restore the defect on
 * the next `build:all`. `noindex` is already the mockup lock, it is already on
 * every demo and off on every delivered build, and `check-metadata.mjs` reads
 * it back off the built HTML rather than from this file — so the build and the
 * gate cannot quietly disagree about which kind of build this is.
 *
 * A delivered build is untouched: `noindex` is false, this is `''`, and the
 * card resolves against `siteUrl`, which for a delivered site *is* the origin
 * it is served from.
 */
export const cardOrigin = site.seo.noindex ? previewOriginFor(clientSlug) : '';

/**
 * The shared demo form endpoint, from `DEMO_FORM_ENDPOINT` at build time.
 *
 * Every demo site posts to one Worker rather than one Worker per prospect:
 * five prospects would otherwise mean five deployments, five KV namespaces and
 * five origin lists to keep in step, all to deliver mail to the same inbox.
 * The Worker tells the prospects apart by the `prospectId` field the form
 * sends, which is this build's `clientSlug` — see `worker-demo/`.
 *
 * Unset, this is empty and nothing changes: each client's own `forms` block
 * governs, exactly as it did before. That is deliberate — a real client build
 * must never inherit the demo endpoint by accident, so opting in is an
 * explicit env var on the demo build command and nothing else.
 *
 *   DEMO_FORM_ENDPOINT=https://demo-form.<sub>.workers.dev pnpm build:all
 */
export const demoFormEndpoint = (process.env['DEMO_FORM_ENDPOINT'] ?? '').trim();

/**
 * How the contact form should behave for *this* build.
 *
 * With a demo endpoint present the form is live for every prospect, including
 * the ones whose own config says `disabled` — a disabled form is the right
 * call for a real mockup with nowhere to send, and the wrong one when the
 * point of the build is to demonstrate a form that works.
 */
export function resolveForms(): { mode: typeof site.forms.mode; endpoint: string } {
  if (demoFormEndpoint) return { mode: 'worker', endpoint: demoFormEndpoint };
  return { mode: site.forms.mode, endpoint: site.forms.workerEndpoint };
}

export default site;
