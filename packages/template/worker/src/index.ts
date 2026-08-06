/**
 * Contact form handler.
 *
 * Order of operations, and why:
 *   1. method / origin / size gate      — cheapest rejections first
 *   2. honeypot                         — free, catches most bots
 *   3. field validation                 — mirrors the client, never trusts it
 *   4. Turnstile verification           — PLACEHOLDER, see verifyTurnstile()
 *   5. KV write                         — BEFORE the email, so a mail outage
 *                                         never loses a lead
 *   6. Resend send                      — failure is logged, not fatal
 *
 * No secret is ever read from a committed file. Everything sensitive comes
 * from `env`, set with `wrangler secret put`.
 */

export interface Env {
  // vars (wrangler.jsonc, not secret)
  ALLOWED_ORIGINS: string;
  MAIL_TO: string;
  MAIL_FROM: string;
  MAX_UPLOAD_MB: string;

  // secrets (wrangler secret put — never committed)
  RESEND_API_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;

  // bindings
  SUBMISSIONS: KVNamespace;
  UPLOADS?: R2Bucket;
}

interface Submission {
  name: string;
  phone: string;
  email: string;
  service: string;
  message: string;
  file: { name: string; type: string; size: number } | null;
  receivedAt: string;
  userAgent: string;
  /** Cloudflare-provided country code, useful for spotting junk. */
  country: string;
}

const ACCEPTED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/webp',
  'application/pdf',
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function corsHeaders(origin: string | null, env: Env): Record<string, string> {
  const allowed = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
  if (!origin || !allowed.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

/**
 * Server-side mirror of the client-side rules. The client copy is a courtesy
 * to the user; this one is the one that counts.
 */
function validate(form: FormData, maxBytes: number): { errors: string[]; file: File | null } {
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

/**
 * Cloudflare Turnstile verification.
 *
 * PLACEHOLDER BY DESIGN. The real siteverify call is written out below and is
 * correct, but it is short-circuited while `TURNSTILE_SECRET_KEY` is unset so
 * that a fresh deployment works before the captcha is configured. Set the
 * secret and this becomes live with no code change:
 *
 *     wrangler secret put TURNSTILE_SECRET_KEY
 *
 * Until then submissions are accepted on the honeypot and validation alone.
 */
async function verifyTurnstile(token: string, ip: string, env: Env): Promise<boolean> {
  if (!env.TURNSTILE_SECRET_KEY) return true; // <-- the short-circuit

  const body = new FormData();
  body.append('secret', env.TURNSTILE_SECRET_KEY);
  body.append('response', token);
  if (ip) body.append('remoteip', ip);

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
    });
    const result = (await res.json()) as { success?: boolean };
    return result.success === true;
  } catch {
    // A Turnstile outage should not silently drop real leads. Fail open and
    // rely on the honeypot; flip to `return false` if you would rather fail
    // closed and lose submissions during an outage.
    return true;
  }
}

async function sendEmail(sub: Submission, file: File | null, env: Env): Promise<boolean> {
  if (!env.RESEND_API_KEY) return false;

  const lines = [
    `Name:    ${sub.name}`,
    `Phone:   ${sub.phone || '—'}`,
    `Email:   ${sub.email || '—'}`,
    `Service: ${sub.service || '—'}`,
    '',
    sub.message,
    '',
    '---',
    `Received: ${sub.receivedAt}`,
    `Country:  ${sub.country}`,
    sub.file ? `Attached: ${sub.file.name} (${sub.file.type}, ${sub.file.size} bytes)` : 'No file.',
  ];

  const payload: Record<string, unknown> = {
    from: env.MAIL_FROM,
    to: [env.MAIL_TO],
    subject: `Website enquiry — ${sub.name}`,
    text: lines.join('\n'),
    // So hitting reply in the inbox goes to the customer.
    ...(sub.email ? { reply_to: sub.email } : {}),
  };

  if (file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    payload['attachments'] = [{ filename: file.name, content: btoa(binary) }];
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return res.ok;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    const cors = corsHeaders(origin, env);

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

    const maxBytes = Number(env.MAX_UPLOAD_MB || '10') * 1024 * 1024;

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return json({ ok: false, error: 'bad_request' }, 400, cors);
    }

    // Honeypot. Real people never see this field, so anything in it is a bot.
    // Answer 200 so the bot believes it succeeded and does not retry.
    if (String(form.get('company') ?? '').trim() !== '') {
      return json({ ok: true }, 200, cors);
    }

    const { errors, file } = validate(form, maxBytes);
    if (errors.length > 0) {
      return json({ ok: false, error: 'validation_failed', fields: errors }, 422, cors);
    }

    const token = String(form.get('cf-turnstile-response') ?? '');
    const ip = request.headers.get('CF-Connecting-IP') ?? '';
    if (!(await verifyTurnstile(token, ip, env))) {
      return json({ ok: false, error: 'challenge_failed' }, 403, cors);
    }

    const submission: Submission = {
      name: String(form.get('name') ?? '').trim(),
      phone: String(form.get('phone') ?? '').trim(),
      email: String(form.get('email') ?? '').trim(),
      service: String(form.get('service') ?? '').trim(),
      message: String(form.get('message') ?? '').trim(),
      file: file ? { name: file.name, type: file.type, size: file.size } : null,
      receivedAt: new Date().toISOString(),
      userAgent: request.headers.get('User-Agent') ?? '',
      country: request.headers.get('CF-IPCountry') ?? '',
    };

    // Backup FIRST. If Resend is down or the key is wrong, the lead is still
    // recoverable from KV rather than gone.
    const key = `submission:${submission.receivedAt}:${crypto.randomUUID()}`;
    try {
      await env.SUBMISSIONS.put(key, JSON.stringify(submission), {
        // Two years. Long enough to be a real backup, short enough that we are
        // not holding customer contact details indefinitely.
        expirationTtl: 60 * 60 * 24 * 730,
      });
    } catch (error) {
      console.error('KV write failed', error);
    }

    // Optional: keep the uploaded photo itself. Without an R2 bucket bound,
    // only the file's metadata is retained above and the bytes go out with
    // the email alone.
    if (file && env.UPLOADS) {
      try {
        await env.UPLOADS.put(`${key}/${file.name}`, file.stream(), {
          httpMetadata: { contentType: file.type },
        });
      } catch (error) {
        console.error('R2 write failed', error);
      }
    }

    const emailed = await sendEmail(submission, file, env);
    if (!emailed) {
      console.error('Email not sent — submission retained in KV at', key);
      // The lead is safe in KV, but do not tell the customer it arrived when
      // nobody has been notified.
      return json({ ok: false, error: 'delivery_failed' }, 502, cors);
    }

    return json({ ok: true }, 200, cors);
  },
} satisfies ExportedHandler<Env>;
