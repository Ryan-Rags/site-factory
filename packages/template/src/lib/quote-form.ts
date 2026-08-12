/**
 * The props every rendered form island needs, worked out once.
 *
 * Four places now mount a `ContactForm` — the contact page, the home page, the
 * CTA band, and the design families' equivalent of both — and the interesting
 * part of those props is not the field list but everything around it: which
 * mode this build resolved to, whether it is a demo (and so must send a
 * `prospectId`), and which upload limits apply. Working that out four times is
 * how three of them end up subtly wrong.
 *
 * Server-side only. It imports `site.config`, which imports every client's
 * config, and nothing that reaches the browser bundle may do that —
 * `src/lib/form-fields.ts` is the half that both sides share.
 */

import { clientSlug, demoFormEndpoint, resolveForms, site } from '../../site.config';
import { quickFields, quickQuoteAt, resolveFields, type ResolvedFields } from './form-fields';
import type { QuickQuote } from '../types/site';

export interface FormIslandProps {
  mode: 'worker' | 'mailto';
  mailto: string;
  services: { slug: string; title: string }[];
  endpoint: string;
  prospectId: string;
  prospectName: string;
  phone: string;
  maxUploadMB: number;
  acceptedFileTypes: string[];
  turnstileSiteKey: string;
  fields: ResolvedFields;
}

/**
 * The `forms` block as it applies to *this* build, not as the config wrote it.
 * A demo build (`DEMO_FORM_ENDPOINT` set) points every prospect at the one
 * shared Worker; without it this is exactly the client's own block.
 */
export function buildForms() {
  const resolved = resolveForms();
  return { ...site.forms, mode: resolved.mode, workerEndpoint: resolved.endpoint };
}

function islandProps(fields: ResolvedFields): FormIslandProps {
  const forms = buildForms();
  return {
    // Callers only reach this after checking the mode is not `disabled`.
    mode: forms.mode === 'mailto' ? 'mailto' : 'worker',
    mailto: site.business.email ?? '',
    services: site.services.map((service) => ({ slug: service.slug, title: service.title })),
    endpoint: forms.workerEndpoint,
    prospectId: demoFormEndpoint ? clientSlug : '',
    prospectName: demoFormEndpoint ? site.business.name : '',
    phone: site.business.phone,
    maxUploadMB: forms.maxUploadMB,
    acceptedFileTypes: forms.acceptedFileTypes,
    turnstileSiteKey: forms.turnstileSiteKey,
    fields,
  };
}

/** The full contact-page form. Throws if this client's rules are illegal. */
export function contactFormProps(): FormIslandProps {
  return islandProps(resolveFields(site.forms, clientSlug));
}

/** The compact block: same component, narrower field set. */
export function quickFormProps(): FormIslandProps {
  return islandProps(quickFields(resolveFields(site.forms, clientSlug)));
}

/**
 * The quick block's copy for one placement, or `null` when it does not render
 * there.
 *
 * `disabled` forms return null wherever they are asked. A block that posts to
 * nothing is worse than no block: it is a promise of a reply from a shop that
 * will never see the message.
 */
export function quickQuoteFor(placement: 'home' | 'cta'): QuickQuote | null {
  if (buildForms().mode === 'disabled') return null;
  return quickQuoteAt(site.forms, placement) ? (site.forms.quickQuote as QuickQuote) : null;
}
