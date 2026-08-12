/**
 * Headline formulas: what + where + trust.
 *
 * Three slots, and the discipline is entirely in the third. `what` and
 * `where` are always available — a business that cannot say what it does or
 * where it is has bigger problems than its copy. `trust` is the slot every
 * local site fills with something unearned: "quality you can count on",
 * "your trusted partner since [year we made up]".
 *
 * So `trust` is sourced or it is absent. The formulas below degrade in a
 * fixed order — founding year, then a sourced trait, then nothing — and the
 * two-slot headline that results is a perfectly good headline. It is
 * certainly better than a three-slot one with an invented third.
 */
import type { CopyContext, NichePack } from '../niches/types.js';
import { orList } from '../text.js';

export interface HeadlineSet {
  /** The `<h1>`-equivalent hero headline. */
  headline: string;
  /** The paragraph under it. Carries the where, if the headline did not. */
  subhead: string;
}

/**
 * The trust clause, or `null`.
 *
 * Order matters: a founding year beats a trait because it is checkable, and a
 * trait beats nothing because it tells the customer something they can act
 * on. Nothing beats an invention.
 */
function trustClause(ctx: CopyContext): string | null {
  if (ctx.foundedYear !== undefined) return `Since ${ctx.foundedYear}`;
  if (ctx.has('walk-ins')) return 'Walk-Ins Welcome';
  if (ctx.has('no-minimum')) return 'No Minimum Order';
  if (ctx.has('rush')) return 'Urgent Work Taken On';
  if (ctx.has('owner-led')) return 'You Deal With the Owner';
  return null;
}

/**
 * Title Case for a headline clause, leaving small words small.
 *
 * Written out rather than pulled from a dependency because the list of words
 * that stay lowercase is the entire content of the function, and it is four
 * lines.
 */
const SMALL = new Set(['a', 'an', 'and', 'the', 'for', 'in', 'of', 'on', 'to', 'with', 'at']);

function titleCase(s: string): string {
  return s
    .split(' ')
    .map((word, i) =>
      i > 0 && SMALL.has(word.toLowerCase())
        ? word.toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(' ');
}

/**
 * `what` — the shop's own leading service where it has one, otherwise the
 * trade's own name for the work.
 *
 * Using the first configured service rather than the niche's generic `work`
 * matters: "Contract Manufacturing" and "Walk-In Welding" are different
 * businesses, and a headline that says "metalwork" for both has told the
 * customer nothing.
 */
function whatClause(ctx: CopyContext, pack: NichePack): string {
  const first = ctx.serviceTitles[0];
  return first === undefined ? titleCase(pack.work) : titleCase(first);
}

export function headline(ctx: CopyContext, pack: NichePack): HeadlineSet {
  const what = whatClause(ctx, pack);
  const where = ctx.town;
  const trust = trustClause(ctx);

  const head = trust === null ? `${what} in ${where}.` : `${what} in ${where}. ${trust}.`;

  const services = ctx.servicesSentence();
  const areaTail =
    ctx.county === undefined
      ? `${ctx.town}, ${ctx.record.region.value}`
      : `${ctx.town} and ${ctx.county}`;

  // The subhead does the work the headline is not allowed to: naming every
  // service, and naming the route in. It is the sentence a customer reads to
  // decide whether to keep reading, so it ends on the action.
  const routes: string[] = [];
  if (ctx.has('walk-ins')) routes.push('bring it in');
  if (ctx.has('quote-from-photo')) routes.push('send a photo');
  routes.push(`call ${ctx.phone}`);

  const sub =
    `A ${pack.noun} serving ${areaTail}. ${
      services === '' ? '' : `We do ${services}. `
    }To get started, ${orList(routes)}.`.replace(/\s+/g, ' ');

  return { headline: head, subhead: sub };
}

/**
 * The CTA band's headline and body.
 *
 * Kept in this module because it is the same formula with the trust slot
 * dropped: at the bottom of a page the customer has already decided whether
 * they believe you, and what they need is the instruction.
 */
export function callToAction(
  ctx: CopyContext,
  pack: NichePack,
): { headline: string; body: string; buttonText: string } {
  const walkIn = ctx.has('walk-ins');
  const photo = ctx.has('quote-from-photo');

  const buttonText = photo ? 'Send a photo for a quote' : `Call ${ctx.phone}`;

  const body = photo
    ? `Send a photo of ${pack.object} and the dimensions. You will be told what it takes and what it costs before any work starts.`
    : walkIn
      ? `Call, or bring ${pack.object} to the shop in ${ctx.town}. You will be told what it takes and what it costs before any work starts.`
      : `Call and describe ${pack.object}. You will be told what it takes and what it costs before any work starts.`;

  return {
    headline: `Got ${pack.object === 'the part' ? 'a part that needs making or fixing' : `${pack.object} you need looked at`}?`,
    body,
    buttonText,
  };
}
