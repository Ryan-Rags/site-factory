/**
 * The shared demo contact-form endpoint.
 *
 * One Worker behind every prospect demo. Each demo site posts the same form
 * with one extra field — `prospectId`, which is that build's client slug — and
 * this Worker decides, from that id alone, who the lead belongs to.
 *
 * Why one Worker instead of one per prospect: they used to all deliver to the
 * same inbox, so five prospects would have meant five deployments, five KV
 * namespaces and five origin lists to keep in step for no difference in
 * behaviour. That is still true now that they deliver to *different* inboxes —
 * the difference is a lookup, not a deployment. The single-tenant Worker next
 * door (`../worker/`) stays as it is; that one is what a real client eventually
 * gets, pointed at their own inbox with none of this machinery.
 *
 * Two payloads arrive here. A lead, as `multipart/form-data` from the contact
 * form, is what everything below describes. A design selection, as
 * `application/json` from the customizer panel's "send it to us" button, goes
 * through the same origin, prospect-id, rate-limit and KV-before-mail gates and
 * nothing else — see `handleSelections` at the foot of this file and
 * `lib/selections.ts`.
 *
 * Order of operations for a lead, cheapest rejection first:
 *   1. method / origin gate
 *   2. honeypot
 *   3. prospect id — must be one we know, or this is an open relay
 *   4. per-prospect rate limit
 *   5. field validation, against *that prospect's* rules
 *   6. KV write, BEFORE the email, so a mail outage never loses a lead
 *   7. Resend send to the routed recipient (+ my permanent bcc)
 *   8. the visitor's receipt, if it is switched on and can actually arrive
 *
 * No secret is read from a committed file. Everything sensitive comes from
 * `env`, set with `wrangler secret put`.
 */

import { confirmationDecision, sendConfirmation } from './lib/confirm';
import { sendDemoEmail, sendViaResend, type DemoSubmission } from './lib/email';
import {
  parseSelections,
  selectionEmail,
  type SelectionSubmission,
} from './lib/selections';
import { rulesFor } from './lib/fields';
import { corsHeaders, json, parseList, type OriginRules } from './lib/http';
import { routeFor } from './lib/routing';
import { cleanLine, PROSPECT_ID_RE, validate } from './lib/validate';

export interface Env {
  // vars (wrangler.jsonc, not secret)
  ALLOWED_ORIGINS: string;
  /** Comma-separated host suffixes, e.g. `pages.dev`. See lib/http.ts. */
  ALLOWED_ORIGIN_SUFFIXES: string;
  /** Comma-separated slugs of every prospect whose demo may post here. */
  KNOWN_PROSPECTS: string;
  /**
   * `slug=addr,slug=addr`. Who each prospect's leads belong to. A prospect
   * with no entry falls back to `MAIL_TO`. See lib/routing.ts.
   */
  PROSPECT_RECIPIENTS?: string;
  /** The fallback recipient — mine, for every prospect still being pitched. */
  MAIL_TO: string;
  /** Optional permanent bcc, so a live client's leads stay visible to me. */
  BCC_ALWAYS?: string;
  MAIL_FROM: string;
  /** `slug=name!,phone,email,…`. Per-prospect form fields. See lib/fields.ts. */
  PROSPECT_FIELDS?: string;
  /** `true` sends the visitor a receipt. Inert on a resend.dev sender. */
  CONFIRMATIONS_ENABLED?: string;
  MAX_UPLOAD_MB: string;
  /** Submissions accepted per prospect per hour. */
  PROSPECT_RATE_PER_HOUR: string;

  // secrets (wrangler secret put — never committed)
  RESEND_API_KEY?: string;

  // bindings
  SUBMISSIONS: KVNamespace;
  UPLOADS?: R2Bucket;
}

/**
 * A blunt per-prospect cap, counted in KV.
 *
 * KV is eventually consistent, so this is not an exact limiter and is not
 * meant to be — under a race a few extra submissions get through. What it
 * actually protects against is the realistic failure: a demo URL is public and
 * unguessable-but-not-secret, and if one is found by a spam bot I want a
 * ceiling on what reaches my inbox rather than an open pipe. A precise limiter
 * would mean a Durable Object, which is a lot of machinery for that.
 *
 * Returns true when the submission is within the cap.
 */
async function withinRateLimit(prospectId: string, env: Env): Promise<boolean> {
  const limit = Number(env.PROSPECT_RATE_PER_HOUR || '20');
  if (!Number.isFinite(limit) || limit <= 0) return true;

  const hour = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
  const key = `rate:${prospectId}:${hour}`;
  try {
    const current = Number((await env.SUBMISSIONS.get(key)) ?? '0');
    if (current >= limit) return false;
    await env.SUBMISSIONS.put(key, String(current + 1), { expirationTtl: 60 * 90 });
    return true;
  } catch (error) {
    // A KV outage must not silence a real enquiry from a real prospect demo.
    console.error('rate-limit read/write failed, allowing through', error);
    return true;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const rules: OriginRules = {
      exact: parseList(env.ALLOWED_ORIGINS),
      suffixes: parseList(env.ALLOWED_ORIGIN_SUFFIXES),
    };
    const origin = request.headers.get('Origin');
    const cors = corsHeaders(origin, rules);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== 'POST') {
      return json({ ok: false, error: 'method_not_allowed' }, 405, cors);
    }
    // An unrecognised Origin gets no CORS headers, so the browser blocks the
    // response anyway; rejecting here makes that explicit and cheap.
    if (origin && Object.keys(cors).length === 0) {
      return json({ ok: false, error: 'origin_not_allowed' }, 403, {});
    }

    /*
     * Two kinds of POST arrive here, and they are told apart by content type.
     *
     * A lead is `multipart/form-data` from the contact form. A design selection
     * is `application/json` from the customizer panel's "send it to us" button,
     * which posts to this same endpoint — and used to die on the `formData()`
     * call below, because that throws on a JSON body and the catch answers 400.
     * See lib/selections.ts for why that had never been seen in front of anyone
     * and why turning the prospect forms on is what would have exposed it.
     */
    if ((request.headers.get('Content-Type') ?? '').includes('application/json')) {
      return handleSelections(request, env, cors);
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return json({ ok: false, error: 'bad_request' }, 400, cors);
    }

    // Honeypot. Real people never see this field. Answer 200 so the bot
    // believes it succeeded and does not retry.
    if (String(form.get('company') ?? '').trim() !== '') {
      return json({ ok: true }, 200, cors);
    }

    /*
     * The prospect id is what makes this endpoint shared rather than open.
     * Anything not on the known list is refused: without this check, anyone
     * who found the URL could post arbitrary text into an inbox under an
     * arbitrary label, and — now that the label decides *whose* inbox — the
     * routing would be theirs to choose too.
     */
    const prospectId = String(form.get('prospectId') ?? '').trim();
    const known = parseList(env.KNOWN_PROSPECTS);
    if (!PROSPECT_ID_RE.test(prospectId) || !known.includes(prospectId)) {
      return json({ ok: false, error: 'unknown_prospect' }, 422, cors);
    }

    if (!(await withinRateLimit(prospectId, env))) {
      return json({ ok: false, error: 'rate_limited' }, 429, cors);
    }

    const fieldRules = rulesFor(prospectId, env.PROSPECT_FIELDS);
    const maxBytes = Number(env.MAX_UPLOAD_MB || '10') * 1024 * 1024;
    const { errors, file, values, extras } = validate(form, maxBytes, fieldRules);
    if (errors.length > 0) {
      return json({ ok: false, error: 'validation_failed', fields: errors }, 422, cors);
    }

    const submission: DemoSubmission = {
      prospectId,
      // The demo sends the business's display name when it has one; the slug
      // is a readable fallback, never a fabricated name. Cleaned because it
      // ends up in a subject line and in a sender's display name.
      prospectName: cleanLine(String(form.get('prospectName') ?? ''), 80) || prospectId,
      ...values,
      file: file ? { name: file.name, type: file.type, size: file.size } : null,
      extras,
      receivedAt: new Date().toISOString(),
      userAgent: request.headers.get('User-Agent') ?? '',
      country: request.headers.get('CF-IPCountry') ?? '',
      origin: origin ?? '',
    };

    // Who this lead belongs to. Resolved after the known-prospect gate, so an
    // unknown id can never reach a recipient at all.
    const route = routeFor(prospectId, env);

    // Backup FIRST. If Resend is down or the key is wrong, the lead is still
    // recoverable from KV rather than gone. Keyed by prospect so one demo's
    // submissions can be listed with a prefix scan.
    const key = `demo:${prospectId}:${submission.receivedAt}:${crypto.randomUUID()}`;
    try {
      await env.SUBMISSIONS.put(key, JSON.stringify({ ...submission, routedTo: route.to }), {
        // 90 days. These are demo submissions, not a client's lead archive —
        // long enough to recover a real enquiry that arrived during a mail
        // outage, short enough that we are not sitting on contact details.
        expirationTtl: 60 * 60 * 24 * 90,
      });
    } catch (error) {
      console.error('KV write failed', error);
    }

    if (file && env.UPLOADS) {
      try {
        await env.UPLOADS.put(`${key}/${file.name}`, file.stream(), {
          httpMetadata: { contentType: file.type },
        });
      } catch (error) {
        console.error('R2 write failed', error);
      }
    }

    const sent = await sendDemoEmail(submission, file, env, route);
    if (!sent.ok) {
      // The intended recipient goes in the failure line too, not only the
      // success one: the question after a mail outage is "whose lead is sitting
      // in KV?", and the answer should not require re-deriving the routing.
      console.error(
        `Email not sent to ${route.to} (${sent.detail}) — submission retained in KV at ${key}`,
      );
      // The lead is safe in KV, but the visitor must not be shown a success
      // animation for a message nobody has been notified about.
      return json({ ok: false, error: 'delivery_failed' }, 502, cors);
    }
    console.log(`lead ${prospectId} -> ${route.to} (${route.via}), bcc ${route.bcc.length}`);

    /*
     * The receipt. Last, and incapable of changing the answer: by this point
     * the lead is in KV and in the shop's inbox, and the visitor is entitled to
     * the success card whatever happens to a courtesy email.
     */
    const decision = confirmationDecision(submission, env);
    if (!decision.send) {
      console.log(`no receipt sent for ${prospectId}: ${decision.reason}`);
    } else {
      const receipt = await sendConfirmation(submission, env, route.to);
      if (receipt.ok) console.log(`receipt sent to the visitor for ${prospectId}`);
      else console.error(`receipt not sent for ${prospectId}: ${receipt.detail}`);
    }

    return json({ ok: true }, 200, cors);
  },
} satisfies ExportedHandler<Env>;

/**
 * The customizer's design selection: same gates, different payload.
 *
 * Order matches the lead path deliberately — prospect id, rate limit, KV before
 * mail — so there is one story about how this endpoint is protected rather than
 * two. What is *not* here is the honeypot (the panel has no hidden field, and a
 * bot posting JSON is refused by the prospect-id gate anyway), the field
 * validator (a selection has no contact details to validate, and see
 * lib/selections.ts on why sharing that code path would be wrong), and the
 * visitor receipt (nobody left an address).
 *
 * A failed send is reported as a failure, not swallowed: the panel shows the
 * visitor "That did not go through. Please call us instead.", and showing them a
 * thank-you for a preference nobody received is the defect this whole function
 * exists to fix.
 */
async function handleSelections(
  request: Request,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'bad_request' }, 400, cors);
  }

  const parsed = parseSelections(body);
  if (!parsed.ok) return json({ ok: false, error: 'bad_request' }, 400, cors);

  const known = parseList(env.KNOWN_PROSPECTS);
  if (!PROSPECT_ID_RE.test(parsed.prospectId) || !known.includes(parsed.prospectId)) {
    return json({ ok: false, error: 'unknown_prospect' }, 422, cors);
  }

  // Shares the lead counter on purpose. The cap protects one inbox from one
  // public URL; a per-kind cap would let a found URL spend both.
  if (!(await withinRateLimit(parsed.prospectId, env))) {
    return json({ ok: false, error: 'rate_limited' }, 429, cors);
  }

  const submission: SelectionSubmission = {
    prospectId: parsed.prospectId,
    url: parsed.url,
    selections: parsed.selections,
    receivedAt: new Date().toISOString(),
    userAgent: request.headers.get('User-Agent') ?? '',
    country: request.headers.get('CF-IPCountry') ?? '',
    origin: request.headers.get('Origin') ?? '',
  };

  const route = routeFor(parsed.prospectId, env);

  // `design:` rather than `demo:`, so a prefix scan for one prospect's leads
  // does not return their design preferences mixed in with them.
  const key = `design:${parsed.prospectId}:${submission.receivedAt}:${crypto.randomUUID()}`;
  try {
    await env.SUBMISSIONS.put(key, JSON.stringify({ ...submission, routedTo: route.to }), {
      expirationTtl: 60 * 60 * 24 * 90,
    });
  } catch (error) {
    console.error('KV write failed', error);
  }

  if (!env.RESEND_API_KEY) {
    console.error(`design selection ${key} retained in KV: RESEND_API_KEY is not set`);
    return json({ ok: false, error: 'delivery_failed' }, 502, cors);
  }
  if (!route.to) {
    console.error(`design selection ${key} retained in KV: no recipient configured`);
    return json({ ok: false, error: 'delivery_failed' }, 502, cors);
  }

  const sent = await sendViaResend(selectionEmail(submission, env, route), env.RESEND_API_KEY);
  if (!sent.ok) {
    console.error(
      `Design selection email not sent to ${route.to} (${sent.detail}) — retained in KV at ${key}`,
    );
    return json({ ok: false, error: 'delivery_failed' }, 502, cors);
  }

  console.log(`design ${parsed.prospectId} -> ${route.to} (${route.via}), bcc ${route.bcc.length}`);
  return json({ ok: true }, 200, cors);
}
