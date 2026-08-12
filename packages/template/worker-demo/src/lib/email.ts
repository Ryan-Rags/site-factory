/**
 * Resend delivery for a demo submission.
 *
 * Every demo lands in one inbox — mine — so the subject line and the body have
 * to answer "which shop was this?" before anything else. A tag rides along on
 * the API call as well, so the Resend dashboard can be filtered by prospect
 * without parsing subject lines.
 */

export interface DemoSubmission {
  prospectId: string;
  /** Human-readable prospect name when the demo sent one; the id otherwise. */
  prospectName: string;
  name: string;
  phone: string;
  email: string;
  service: string;
  message: string;
  file: { name: string; type: string; size: number } | null;
  receivedAt: string;
  userAgent: string;
  country: string;
  /** The demo page the form was submitted from. */
  origin: string;
}

export interface SendResult {
  ok: boolean;
  /** Populated on failure, for the log line. Never shown to a visitor. */
  detail: string;
}

/**
 * Base64 without `Buffer` (which does not exist in the Workers runtime) and
 * without blowing the stack on a 10 MB photo — `String.fromCharCode(...bytes)`
 * spreads every byte as an argument and throws above roughly 100 KB.
 */
function base64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export async function sendDemoEmail(
  sub: DemoSubmission,
  file: File | null,
  env: { RESEND_API_KEY?: string | undefined; MAIL_FROM: string; MAIL_TO: string },
): Promise<SendResult> {
  if (!env.RESEND_API_KEY) return { ok: false, detail: 'RESEND_API_KEY is not set' };

  const lines = [
    `PROSPECT: ${sub.prospectName}  (${sub.prospectId})`,
    `Demo:     ${sub.origin}`,
    '',
    `Name:     ${sub.name}`,
    `Phone:    ${sub.phone || '—'}`,
    `Email:    ${sub.email || '—'}`,
    `Service:  ${sub.service || '—'}`,
    '',
    sub.message,
    '',
    '---',
    `Received: ${sub.receivedAt}`,
    `Country:  ${sub.country}`,
    `Agent:    ${sub.userAgent}`,
    sub.file ? `Attached: ${sub.file.name} (${sub.file.type}, ${sub.file.size} bytes)` : 'No file.',
  ];

  const payload: Record<string, unknown> = {
    from: env.MAIL_FROM,
    to: [env.MAIL_TO],
    subject: `[DEMO ${sub.prospectId}] ${sub.prospectName} — ${sub.name}`,
    text: lines.join('\n'),
    // Reply in the inbox goes to whoever filled the form in, not to me.
    ...(sub.email ? { reply_to: sub.email } : {}),
    tags: [{ name: 'prospect', value: sub.prospectId }],
  };

  if (file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    payload['attachments'] = [{ filename: file.name, content: base64(bytes) }];
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (res.ok) return { ok: true, detail: '' };
    return { ok: false, detail: `Resend responded ${res.status}: ${await res.text()}` };
  } catch (error) {
    return { ok: false, detail: `Resend request threw: ${String(error)}` };
  }
}
