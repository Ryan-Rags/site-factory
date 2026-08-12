/**
 * Which fields a client's form asks for — resolved, checked, and shared by
 * everything that renders or validates one.
 *
 * The rules themselves are per-client config (`forms.fields`). This module is
 * where they become a complete, legal set: absent config resolves to the shape
 * every client had before it was configurable, and a set that would accept a
 * lead nobody can answer does not resolve at all — it throws, with the client's
 * slug, during the build.
 *
 * The Worker holds a parallel copy of this logic in
 * `worker-demo/src/lib/fields.ts`. Two copies, because one runs at build time
 * in the site's TypeScript and the other runs in the Workers runtime with no
 * access to it; `scripts/check-form-fields.mjs` is what stops them drifting.
 */

import type { FormFieldName, FormFieldRule, Forms } from '../types/site';

export type ResolvedFields = Record<FormFieldName, FormFieldRule>;

export const FORM_FIELD_NAMES: FormFieldName[] = [
  'name',
  'phone',
  'email',
  'service',
  'message',
  'file',
];

/** What every client asked for before `forms.fields` existed. */
export const DEFAULT_FORM_FIELDS: ResolvedFields = {
  name: 'required',
  phone: 'optional',
  email: 'optional',
  service: 'optional',
  message: 'required',
  file: 'optional',
};

/**
 * How the phone/email pair is judged.
 *
 * `either` is the historical rule and still the common one: both offered,
 * neither compulsory on its own, a submission carrying neither refused. It is
 * legal precisely because it cannot produce an unreachable lead.
 */
export type ContactMode = 'either' | 'per-field';

export function contactMode(fields: ResolvedFields): ContactMode {
  return fields.phone === 'optional' && fields.email === 'optional' ? 'either' : 'per-field';
}

/**
 * The invariant, as a predicate.
 *
 * | phone | email | |
 * |---|---|---|
 * | optional | optional | legal — the either/or rule applies |
 * | required | anything | legal |
 * | anything | required | legal |
 * | optional | hidden | ILLEGAL — a lead with neither is submittable |
 * | hidden | hidden | ILLEGAL |
 */
export function contactSatisfiable(fields: ResolvedFields): boolean {
  if (fields.phone === 'required' || fields.email === 'required') return true;
  return fields.phone === 'optional' && fields.email === 'optional';
}

/**
 * Resolve a client's `forms.fields` into a complete rule set.
 *
 * Throws rather than warns. A site that ships a form whose leads cannot be
 * answered has one visible symptom — a customer who never hears back — and it
 * appears weeks later, at the client's expense. A failed build appears now.
 */
export function resolveFields(forms: Pick<Forms, 'fields'>, slug: string): ResolvedFields {
  const resolved: ResolvedFields = { ...DEFAULT_FORM_FIELDS, ...(forms.fields ?? {}) };

  if (!contactSatisfiable(resolved)) {
    throw new Error(
      `${slug}: forms.fields has phone: "${resolved.phone}" and email: "${resolved.email}", ` +
        `which accepts a submission with no phone number and no email address — a lead nobody ` +
        `can answer. Require one of them, or leave both optional so the either/or rule applies.`,
    );
  }

  return resolved;
}

/**
 * The compact block's field set, derived from the client's own rules rather
 * than configured separately.
 *
 * Service and file go — a quote block on a home page is three taps, not a
 * briefing. The contact channels are narrowed to the ones this client insists
 * on, and the either/or pair collapses to a required phone number: a two-field
 * "either" prompt is most of a contact form again, and the block only earns its
 * place on a home page by being short.
 *
 * The narrowing can only ever tighten what is asked for, never loosen it, so a
 * legal rule set stays legal. The assertion below is belt and braces on that.
 */
export function quickFields(fields: ResolvedFields): ResolvedFields {
  const base: ResolvedFields = { ...fields, service: 'hidden', file: 'hidden' };

  const narrowed: ResolvedFields =
    contactMode(fields) === 'either'
      ? { ...base, phone: 'required', email: 'hidden' }
      : {
          ...base,
          phone: fields.phone === 'required' ? 'required' : 'hidden',
          email: fields.email === 'required' ? 'required' : 'hidden',
        };

  if (!contactSatisfiable(narrowed)) {
    throw new Error(
      'quickFields produced a rule set with no required contact channel. This is a bug in ' +
        'form-fields.ts, not in a client config.',
    );
  }
  return narrowed;
}

/** Does this client render the quick block in this slot? */
export function quickQuoteAt(forms: Forms, placement: 'home' | 'cta'): boolean {
  const quick = forms.quickQuote;
  return Boolean(quick?.enabled && quick.placements.includes(placement));
}
