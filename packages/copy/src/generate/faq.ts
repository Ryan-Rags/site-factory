/**
 * The FAQ.
 *
 * The target is eight questions with answers a customer could act on. The
 * rule that makes that hard, and makes it worth doing, is that an answer must
 * be supportable by the record: the bank asks each template to answer, and a
 * template that cannot returns `null` and is dropped.
 *
 * Dropping is the whole design. The alternative — padding to eight with
 * "Contact us to learn more about our commitment to quality" — is worse than
 * six honest entries in every way that matters. It wastes the one section a
 * customer arrives at with a real question, it is instantly recognisable as
 * automated, and it is the reason FAQ sections have a bad name.
 *
 * Every dropped question comes back in `REPORT.md` as a question for the
 * owner, so the gap is a work item rather than a silence.
 */
import type { CopyContext, NichePack } from '../niches/types.js';
import type { FaqItem, MarkerReport } from '../types.js';
import { assertPublishable } from '../guard.js';

/** What a good local FAQ aims for. Not a floor — see the module comment. */
export const FAQ_TARGET = 8;

export interface FaqOutput {
  items: FaqItem[];
  dropped: MarkerReport[];
}

export function faq(ctx: CopyContext, pack: NichePack, allowed: string[]): FaqOutput {
  const items: FaqItem[] = [];
  const dropped: MarkerReport[] = [];

  for (const template of pack.faq) {
    const answer = template.answer(ctx);
    const question = template.question(ctx);

    if (answer === null || answer.trim() === '') {
      // A template with no `ifMissing` is one that should always have been
      // answerable — it depends on nothing but the trade. Returning null from
      // one of those is a bug in the pack, not a gap in the record.
      if (template.ifMissing === '') {
        throw new Error(
          `Niche pack "${pack.id}" FAQ template "${template.id}" returned no answer for ` +
            `${ctx.record.slug}, but declares no ifMissing question — meaning it was written ` +
            `to be answerable from the trade alone. Either it has an unnoticed dependency on ` +
            `the record, or it needs an ifMissing question.`,
        );
      }
      dropped.push({ field: `faq.${template.id}`, question: template.ifMissing });
      continue;
    }

    const clean = answer.replace(/\s+/g, ' ').trim();
    assertPublishable(question, `faq.${template.id}.question`, allowed);
    assertPublishable(clean, `faq.${template.id}.answer`, allowed);
    items.push({ question, answer: clean });

    if (items.length === FAQ_TARGET) break;
  }

  return { items, dropped };
}
