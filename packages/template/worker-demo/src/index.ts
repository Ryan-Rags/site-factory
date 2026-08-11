/**
 * The shared demo contact-form endpoint.
 *
 * One Worker behind every prospect demo. Each demo site posts the same form
 * with one extra field — `prospectId`, which is that build's client slug — and
 * this Worker tags the email with it so the inbox says which shop the enquiry
 * came from before I have opened it.
 *
 * Why one Worker instead of one per prospect: they all deliver to the same
 * inbox. Five prospects would otherwise mean five deployments, five KV
 * namespaces and five origin lists to keep in step, for no difference in
 * behaviour. The single-tenant Worker next door (`../worker/`) stays as it is —
 * that one is what a real client eventually gets, pointed at their own inbox.
 *
 * Order of operations, cheapest rejection first:
 *   1. method / origin gate
 *   2. honeypot
 *   3. prospect id — must be one we know, or this is an open relay
 *   4. per-prospect rate limit
 *   5. field validation
 *   6. KV write, BEFORE the email, so a mail outage never loses a lead
 *   7. Resend send
 *
 * No secret is read from a committed file. Everything sensitive comes from
 * `env`, set with `wrangler secret put`.
 */

import { sendDemoEmail, type DemoSubmission } from './lib/email';
import { corsHeaders, json, parseList, type OriginRules } from './lib/http';
import { PROSPECT_ID_RE, validate } from './lib/validate';

export interface Env {
  // vars (wrangler.jsonc, not secret)
  ALLOWED_ORIGINS: string;
  /** Comma-separated host suffixes, e.g. `pages.dev`. See lib/http.ts. */
  ALLOWED_ORIGIN_SUFFIXES: string;
  /** Comma-separated slugs of every prospect whose demo may post here. */
  KNOWN_PROSPECTS: string;
  MAIL_TO: string;
  MAIL_FROM: string;
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
     * who found the URL could post arbitrary text into my inbox under an
     * arbitrary label, and the tag on the email would mean nothing.
     */
    const prospectId = String(form.get('prospectId') ?? '').trim();
    const known = parseList(env.KNOWN_PROSPECTS);
    if (!PROSPECT_ID_RE.test(prospectId) || !known.includes(prospectId)) {
      return json({ ok: false, error: 'unknown_prospect' }, 422, cors);
    }

    if (!(await withinRateLimit(prospectId, env))) {
      return json({ ok: false, error: 'rate_limited' }, 429, cors);
    }

    const maxBytes = Number(env.MAX_UPLOAD_MB || '10') * 1024 * 1024;
    const { errors, file } = validate(form, maxBytes);
    if (errors.length > 0) {
      return json({ ok: false, error: 'validation_failed', fields: errors }, 422, cors);
    }

    const submission: DemoSubmission = {
      prospectId,
      // The demo sends the business's display name when it has one; the slug
      // is a readable fallback, never a fabricated name.
      prospectName: String(form.get('prospectName') ?? '').trim() || prospectId,
      name: String(form.get('name') ?? '').trim(),
      phone: String(form.get('phone') ?? '').trim(),
      email: String(form.get('email') ?? '').trim(),
      service: String(form.get('service') ?? '').trim(),
      message: String(form.get('message') ?? '').trim(),
      file: file ? { name: file.name, type: file.type, size: file.size } : null,
      receivedAt: new Date().toISOString(),
      userAgent: request.headers.get('User-Agent') ?? '',
      country: request.headers.get('CF-IPCountry') ?? '',
      origin: origin ?? '',
    };

    // Backup FIRST. If Resend is down or the key is wrong, the lead is still
    // recoverable from KV rather than gone. Keyed by prospect so one demo's
    // submissions can be listed with a prefix scan.
    const key = `demo:${prospectId}:${submission.receivedAt}:${crypto.randomUUID()}`;
    try {
      await env.SUBMISSIONS.put(key, JSON.stringify(submission), {
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

    const sent = await sendDemoEmail(submission, file, env);
    if (!sent.ok) {
      console.error(`Email not sent (${sent.detail}) — submission retained in KV at ${key}`);
      // The lead is safe in KV, but the visitor must not be shown a success
      // animation for a message nobody has been notified about.
      return json({ ok: false, error: 'delivery_failed' }, 502, cors);
    }

    return json({ ok: true }, 200, cors);
  },
} satisfies ExportedHandler<Env>;
