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
