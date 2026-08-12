/**
 * Which fields a given prospect's form asks for, and which it insists on.
 *
 * The template renders a form from `forms.fields` in that client's config. This
 * is the server's copy of the same rules, because the client's copy is a
 * courtesy and this one is the one that counts — a form posted from a cached
 * page, a rebuilt site, or curl must all be judged by what the shop actually
 * asked for.
 *
 * Two files, one truth, and a build gate (`scripts/check-form-fields.mjs`)
 * that fails when they disagree. That gate exists because the failure mode
 * without it is silent: a client's form stops asking for a phone number, the
 * server keeps demanding one, and every lead 422s in front of a customer.
 *
 * ── The invariant ──────────────────────────────────────────────────────────
 * No configuration may produce a lead nobody can answer. A submission must be
 * impossible without at least one of phone or email. Rules that fail that are
 * not "applied carefully"; they are thrown away and replaced with the defaults,
 * which satisfy it. Failing closed here means a contactable lead; failing open
 * means a name, a message, and no way to reply.
 */

export type FieldName = 'name' | 'phone' | 'email' | 'service' | 'message' | 'file';
export type FieldRule = 'required' | 'optional' | 'hidden';
export type FieldRules = Record<FieldName, FieldRule>;

export const FIELD_NAMES: FieldName[] = ['name', 'phone', 'email', 'service', 'message', 'file'];

/**
 * What every client asked for before this was configurable, and what any
 * prospect not named in `PROSPECT_FIELDS` still gets.
 */
export const DEFAULT_RULES: FieldRules = {
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
 * `either` is the historical rule and still the common one: both fields are
 * offered, neither is individually compulsory, and a submission carrying
 * neither is refused. It is a legal shape precisely because it cannot produce
 * an unreachable lead.
 */
export type ContactMode = 'either' | 'per-field';

export function contactMode(rules: FieldRules): ContactMode {
  return rules.phone === 'optional' && rules.email === 'optional' ? 'either' : 'per-field';
}

/** The invariant, as a predicate. See the table in `PLAN-lead-flow-2.md`. */
export function contactSatisfiable(rules: FieldRules): boolean {
  if (rules.phone === 'required' || rules.email === 'required') return true;
  return rules.phone === 'optional' && rules.email === 'optional';
}

/**
 * Parse `PROSPECT_FIELDS`.
 *
 *   "kh-machine-works=name!,phone,email,service,message!,file; zz-fixture=name!,email!,phone"
 *
 * `!` marks required, a listed field is rendered and accepted, an unlisted one
 * is hidden. A prospect with no entry uses {@link DEFAULT_RULES}.
 */
export function parseFieldRules(value: string | undefined): Map<string, FieldRules> {
  const map = new Map<string, FieldRules>();

  for (const chunk of (value ?? '').split(';')) {
    const entry = chunk.trim();
    if (!entry) continue;

    const at = entry.indexOf('=');
    const slug = at === -1 ? '' : entry.slice(0, at).trim();
    const spec = at === -1 ? '' : entry.slice(at + 1);
    if (!slug) {
      console.error(`PROSPECT_FIELDS: skipping malformed entry ${JSON.stringify(entry)}`);
      continue;
    }

    const rules: FieldRules = {
      name: 'hidden',
      phone: 'hidden',
      email: 'hidden',
      service: 'hidden',
      message: 'hidden',
      file: 'hidden',
    };
    let bad = false;
    for (const token of spec.split(',')) {
      const raw = token.trim();
      if (!raw) continue;
      const required = raw.endsWith('!');
      const field = (required ? raw.slice(0, -1) : raw).trim() as FieldName;
      if (!FIELD_NAMES.includes(field)) {
        console.error(`PROSPECT_FIELDS[${slug}]: unknown field ${JSON.stringify(raw)}`);
        bad = true;
        break;
      }
      rules[field] = required ? 'required' : 'optional';
    }
    if (bad) continue;

    if (!contactSatisfiable(rules)) {
      // Fail closed. A prospect whose rules would accept an unanswerable lead
      // gets the default rules instead, loudly.
      console.error(
        `PROSPECT_FIELDS[${slug}]: phone=${rules.phone} email=${rules.email} would accept a lead ` +
          `with no way to reply — falling back to the default field rules.`,
      );
      map.set(slug, { ...DEFAULT_RULES });
      continue;
    }

    map.set(slug, rules);
  }

  return map;
}

export function rulesFor(prospectId: string, value: string | undefined): FieldRules {
  return parseFieldRules(value).get(prospectId) ?? { ...DEFAULT_RULES };
}
