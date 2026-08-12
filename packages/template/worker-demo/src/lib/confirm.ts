/**
 * The visitor's receipt.
 *
 * Somebody in a workshop types a message into a phone, taps send, sees a tick,
 * and then has no evidence any of it happened. The receipt is that evidence. It
 * is short on purpose: it confirms who has the message and that a call is
 * coming, and it does not try to be a newsletter.
 *
 * Two conditions gate it, and both are hard:
 *
 * 1. `CONFIRMATIONS_ENABLED`. Off by default.
 * 2. `MAIL_FROM` must not be on `resend.dev`. Resend's no-DNS sender
 *    (`onboarding@resend.dev`) delivers *only* to the address that owns the
 *    Resend account, so a receipt sent from it would reach the account owner
 *    and never the visitor. Enabling receipts on that sender does not produce a
 *    broken receipt; it produces a silent one, which is worse. So the flag is
 *    inert until a verified domain is configured — see README.md.
 *
 * A failed receipt is logged and otherwise ignored. The lead is already in KV,
 * already with the shop, and the visitor has already seen the success card;
 * turning a delivered lead into an error because a courtesy email bounced would
 * be the tail wagging the dog.
 *
 * No SMS. The numbers collected here are for calling.
 */

import { sendViaResend, type DemoSubmission, type SendResult } from './email';
import { cleanLine } from './validate';

export interface ConfirmEnv {
  RESEND_API_KEY?: string | undefined;
  MAIL_FROM: string;
  CONFIRMATIONS_ENABLED?: string | undefined;
}

const TRUTHY = new Set(['1', 'true', 'yes', 'on']);

/** `Name <addr@host>` or a bare `addr@host`. */
export function parseFrom(value: string): { name: string; address: string } {
  const angled = /^\s*(.*?)\s*<\s*([^>]+?)\s*>\s*$/.exec(value);
  if (angled) return { name: (angled[1] ?? '').replace(/^"|"$/g, ''), address: angled[2] ?? '' };
  return { name: '', address: value.trim() };
}

export interface ConfirmDecision {
  send: boolean;
  /** Why, for the log. Every path says something; none of them are silent. */
  reason: string;
}

export function confirmationDecision(sub: DemoSubmission, env: ConfirmEnv): ConfirmDecision {
  if (!TRUTHY.has((env.CONFIRMATIONS_ENABLED ?? '').trim().toLowerCase())) {
    return { send: false, reason: 'CONFIRMATIONS_ENABLED is off' };
  }
  if (!env.RESEND_API_KEY) {
    return { send: false, reason: 'RESEND_API_KEY is not set' };
  }

  const { address } = parseFrom(env.MAIL_FROM ?? '');
  const domain = address.split('@')[1]?.toLowerCase() ?? '';
  if (!domain) {
    return { send: false, reason: `MAIL_FROM ${JSON.stringify(env.MAIL_FROM)} has no domain` };
  }
  if (domain === 'resend.dev' || domain.endsWith('.resend.dev')) {
    return {
      send: false,
      reason:
        `MAIL_FROM is ${address} — Resend delivers from resend.dev only to the account owner, ` +
        `so a receipt would never reach the visitor. Verify a domain first (see README.md).`,
    };
  }
  if (!sub.email) {
    return { send: false, reason: 'the visitor gave no email address' };
  }

  return { send: true, reason: `sending from ${address}` };
}

/**
 * @param replyTo The routed recipient — the shop, not me and not the sender
 *   address. A visitor who hits reply on the receipt is answering the business.
 */
export async function sendConfirmation(
  sub: DemoSubmission,
  env: ConfirmEnv,
  replyTo: string,
): Promise<SendResult> {
  if (!env.RESEND_API_KEY) return { ok: false, detail: 'RESEND_API_KEY is not set' };

  const { address } = parseFrom(env.MAIL_FROM);
  // The business name comes off the form, so it is visitor-reachable input and
  // is cleaned before it becomes a display name. `cleanLine` has already run
  // over it once in the handler; quotes and angle brackets go here because this
  // is the one place it is used as a mail header value.
  const brand = cleanLine(sub.prospectName, 60).replace(/["<>]/g, '');
  const greeting = sub.name ? `Thanks, ${sub.name.split(' ')[0]}` : 'Thanks';

  const text = [
    `${greeting} — ${brand} has your message.`,
    '',
    'Someone will call you back soon. If you need to add anything, just reply to',
    'this email and it goes straight to them.',
    '',
    `— ${brand}`,
  ].join('\n');

  return sendViaResend(
    {
      // The display name is quoted, not just cleaned. `cleanLine` has already
      // taken the CR/LF that would start a new header, and the quotes make the
      // rest — commas, colons, anything else a business name legitimately
      // contains — a single RFC 5322 quoted-string rather than something a mail
      // parser has to guess at. The `"` itself is stripped above.
      from: brand ? `"${brand}" <${address}>` : address,
      to: [sub.email],
      subject: `Thanks — ${brand} got your message`,
      text,
      // Not the sender address: replying should reach the shop that will do
      // the work, not the mailbox the receipt was posted from.
      ...(replyTo ? { reply_to: replyTo } : {}),
      tags: [
        { name: 'prospect', value: sub.prospectId },
        { name: 'kind', value: 'confirmation' },
      ],
    },
    env.RESEND_API_KEY,
  );
}
