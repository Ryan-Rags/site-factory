/**
 * Server-side validation. A mirror of the rules in `ContactForm.tsx`, which is
 * a courtesy to the visitor; this copy is the one that counts.
 *
 * Kept identical in behaviour to `../../worker/src/index.ts`'s `validate()` on
 * purpose — the two Workers deliver to different inboxes but must not disagree
 * about what a valid enquiry is. (De-duplicating the two into one shared
 * module is worth doing and is filed in the README's Backlog; it is not done
 * here because the single-client Worker is deliberately untouched by this
 * change.)
 */

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

export interface Validated {
  errors: string[];
  file: File | null;
}

export function validate(form: FormData, maxBytes: number): Validated {
  const errors: string[] = [];
  const name = String(form.get('name') ?? '').trim();
  const phone = String(form.get('phone') ?? '').trim();
  const email = String(form.get('email') ?? '').trim();
  const message = String(form.get('message') ?? '').trim();

  if (name.length < 2) errors.push('name');
  if (!phone && !email) errors.push('contact');
  if (phone && phone.replace(/\D/g, '').length < 10) errors.push('phone');
  if (email && !EMAIL_RE.test(email)) errors.push('email');
  if (message.length < 10) errors.push('message');

  const candidate = form.get('file');
  let file: File | null = null;
  if (candidate instanceof File && candidate.size > 0) {
    if (candidate.size > maxBytes) errors.push('file-size');
    else if (!ACCEPTED_TYPES.has(candidate.type)) errors.push('file-type');
    else file = candidate;
  }

  return { errors, file };
}
