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
 * Order of operations, cheapest rejection first:
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
import { sendDemoEmail, type DemoSubmission } from './lib/email';
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
