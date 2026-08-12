/**
 * Server-side validation. A mirror of the rules in `ContactForm.tsx`, which is
 * a courtesy to the visitor; this copy is the one that counts.
 *
 * The rules are now per-prospect (`lib/fields.ts`) rather than one shape for
 * everyone, because a shop that never calls anybody should not be forced to
 * collect phone numbers, and a shop that only calls should not have to pretend
 * an email address is enough. What does not vary is the invariant: whatever the
 * rules say, a submission that leaves nobody reachable is refused.
 *
 * The single-client Worker next door still carries its own fixed-shape
 * `validate()`. De-duplicating the two is still in the README's Backlog and
 * still deliberately not done here — that Worker is what a real client gets,
 * and a demo-side change has no business rewriting it.
 */

import { contactMode, type FieldRules } from './fields';

const ACCEPTED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/webp',
  'application/pdf',
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Prospect ids are slugs from `packages/template/clients/`. Anchored and
 * length-capped because this value is interpolated into a KV key and into the
 * subject line of an email that lands in my inbox.
 */
export const PROSPECT_ID_RE = /^[a-z0-9][a-z0-9-]{1,63}$/;

/** Control characters, including the CR/LF that would start a new header. */
const CONTROL_RE = /[\u0000-\u001f\u007f]/g;
/** The same, minus the newline, for text that is allowed to have lines. */
const CONTROL_KEEP_LF_RE = /[\u0000-\u0009\u000b-\u001f\u007f]/g;

/**
 * One line of visitor-supplied text, safe to interpolate into a subject line or
 * into a sender's display name.
 *
 * This matters more than it used to. These strings reached my inbox and nowhere
 * else; they now reach a client's inbox and, in the confirmation, a visitor's.
 */
export function cleanLine(value: string, max = 200): string {
  return value.replace(CONTROL_RE, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Multi-line text: newlines survive, other control characters do not. */
export function cleanText(value: string, max = 5000): string {
  return value.replace(/\r\n?/g, '\n').replace(CONTROL_KEEP_LF_RE, ' ').trim().slice(0, max);
}

export interface Validated {
  errors: string[];
  file: File | null;
  /** The cleaned values, so the caller does not re-read the raw form. */
  values: { name: string; phone: string; email: string; service: string; message: string };
  /**
   * Values posted into fields this prospect's form does not ask for.
   *
   * Not an error and not discarded. These sites register a service worker, so a
   * phone in a workshop can be holding a cached copy of a form built before the
   * fields changed; rejecting that would 422 a real customer over a caching
   * detail they cannot see. The value still rides along to the notification —
   * a human typed it, and it may be the only way to reach them.
   */
  extras: Record<string, string>;
}

export function validate(form: FormData, maxBytes: number, rules: FieldRules): Validated {
  const errors: string[] = [];
  const extras: Record<string, string> = {};
  const line = (key: string) => cleanLine(String(form.get(key) ?? ''));

  const name = line('name');
  const phone = line('phone');
  const email = line('email');
  const service = line('service');
  const message = cleanText(String(form.get('message') ?? ''));

  const carry = (field: string, value: string) => {
    if (value) extras[field] = value;
  };

  if (rules.name === 'hidden') carry('name', name);
  else if (rules.name === 'required' && name.length < 2) errors.push('name');
  else if (name && name.length < 2) errors.push('name');

  if (rules.service === 'hidden') carry('service', service);

  // Contact. `either` is the historical pair rule: both offered, neither
  // compulsory on its own, a submission carrying neither refused.
  if (contactMode(rules) === 'either') {
    if (!phone && !email) errors.push('contact');
  } else {
    if (rules.phone === 'required' && !phone) errors.push('phone');
    if (rules.email === 'required' && !email) errors.push('email');
  }

  if (rules.phone === 'hidden') carry('phone', phone);
  else if (phone && phone.replace(/\D/g, '').length < 10) errors.push('phone');

  if (rules.email === 'hidden') carry('email', email);
  else if (email && !EMAIL_RE.test(email)) errors.push('email');

  if (rules.message === 'hidden') carry('message', message);
  else if (rules.message === 'required' && message.length < 10) errors.push('message');

  const candidate = form.get('file');
  let file: File | null = null;
  if (candidate instanceof File && candidate.size > 0) {
    if (rules.file === 'hidden') {
      // Not stored and not attached: this form did not offer an upload, so the
      // bytes are unexpected. The name is carried across so the notification
      // says something arrived rather than dropping it in silence.
      carry('file', cleanLine(candidate.name, 120));
    } else if (candidate.size > maxBytes) {
      errors.push('file-size');
    } else if (!ACCEPTED_TYPES.has(candidate.type)) {
      errors.push('file-type');
    } else {
      file = candidate;
    }
  } else if (rules.file === 'required') {
    errors.push('file');
  }

  return {
    errors,
    file,
    values: {
      // A hidden field's value is reported in `extras`, never in the row the
      // reader takes as "what the form collected".
      name: rules.name === 'hidden' ? '' : name,
      phone: rules.phone === 'hidden' ? '' : phone,
      email: rules.email === 'hidden' ? '' : email,
      service: rules.service === 'hidden' ? '' : service,
      message: rules.message === 'hidden' ? '' : message,
    },
    extras,
  };
}
