/**
 * Resend delivery for a demo submission.
 *
 * A lead used to have exactly one destination — my inbox — so the subject line
 * and the body only had to answer "which shop was this?". They still answer it
 * first, because a bcc'd copy of a live client's lead lands in the same place
 * as a pitch demo's and the two have to be told apart at a glance. What is new
 * is that the recipient is resolved per prospect (`lib/routing.ts`) rather than
 * assumed, and that a lead can carry values the form never asked for.
 */

import type { Route } from './routing';

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
  /**
   * Values posted into fields this prospect's form does not ask for. Reported
   * separately rather than mixed into the rows above, so the reader can see the
   * form asked for one thing and received another. See `lib/validate.ts`.
   */
  extras: Record<string, string>;
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

/** The one place this Worker talks to Resend. Shared with `lib/confirm.ts`. */
export async function sendViaResend(
  payload: Record<string, unknown>,
  apiKey: string,
): Promise<SendResult> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
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

export async function sendDemoEmail(
  sub: DemoSubmission,
  file: File | null,
  env: { RESEND_API_KEY?: string | undefined; MAIL_FROM: string },
  route: Route,
): Promise<SendResult> {
  if (!env.RESEND_API_KEY) return { ok: false, detail: 'RESEND_API_KEY is not set' };
  if (!route.to) return { ok: false, detail: 'no recipient: PROSPECT_RECIPIENTS and MAIL_TO are both empty' };

  const extraLines = Object.entries(sub.extras).map(
    ([field, value]) => `${field.padEnd(9)} ${value}`,
  );

  const lines = [
    `PROSPECT: ${sub.prospectName}  (${sub.prospectId})`,
    `Demo:     ${sub.origin}`,
    '',
    `Name:     ${sub.name || '—'}`,
    `Phone:    ${sub.phone || '—'}`,
    `Email:    ${sub.email || '—'}`,
    `Service:  ${sub.service || '—'}`,
    '',
    sub.message,
    ...(extraLines.length > 0
      ? ['', 'Sent, but not asked for by this form:', ...extraLines]
      : []),
    '',
    '---',
    `Received: ${sub.receivedAt}`,
    `Country:  ${sub.country}`,
    `Agent:    ${sub.userAgent}`,
    sub.file ? `Attached: ${sub.file.name} (${sub.file.type}, ${sub.file.size} bytes)` : 'No file.',
  ];

  const payload: Record<string, unknown> = {
    from: env.MAIL_FROM,
    to: [route.to],
    ...(route.bcc.length > 0 ? { bcc: route.bcc } : {}),
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

  return sendViaResend(payload, env.RESEND_API_KEY);
}
