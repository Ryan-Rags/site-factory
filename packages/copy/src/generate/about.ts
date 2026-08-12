/**
 * The About section.
 *
 * This is the part of a rewrite the owner reads first and judges hardest,
 * because it is the part that is about them. A rewrite that improves clarity
 * and loses their voice has failed at the thing they will notice in the first
 * ten seconds — and the failure is not aesthetic. A shop that has been fixing
 * things since 1918 sounds like a shop that has been fixing things since
 * 1918, and replacing that with "leveraging decades of expertise" makes them
 * sound like every marketing page they have ever mistrusted.
 *
 * So the About generator is the most conservative in the package:
 *
 *   - History comes only from `foundedYear` and confirmed voice notes.
 *   - The owner's own phrases go in verbatim, in their own paragraph, and are
 *     recorded in `voiceNotes` so a reviewer can confirm we kept their words.
 *   - Nothing here narrates a founder, a motivation or a "passion for" —
 *     origin stories are the single most-invented content on small business
 *     sites, and we have never spoken to the founder.
 */
import type { CopyContext, NichePack } from '../niches/types.js';
import { assertPublishable } from '../guard.js';

export interface AboutOutput {
  /** The section headline, also the markdown frontmatter title. */
  headline: string;
  /** The sub-line: `Legal Name · Town, ST · Est. 1987`. */
  eyebrow: string;
  paragraphs: string[];
  imageAlt: string;
  /**
   * The phrases carried through from the prospect's own material, with their
   * sources. Rendered nowhere — this exists so the person reviewing the
   * rewrite can check, line by line, that the voice in the About section is
   * the owner's and not ours.
   */
  voiceNotes: { phrase: string; source: string; attributed: string }[];
}

export function about(ctx: CopyContext, pack: NichePack, allowed: string[]): AboutOutput {
  const check = (s: string, field: string): string =>
    assertPublishable(s.replace(/\s+/g, ' ').trim(), `about.${field}`, allowed);

  const headline = check(
    ctx.foundedYear === undefined
      ? `${sentence(pack.work)} in ${ctx.town}.`
      : `${sentence(pack.work)} in ${ctx.town} since ${ctx.foundedYear}.`,
    'headline',
  );

  const eyebrowParts = [ctx.record.legalName.value, `${ctx.town}, ${ctx.record.region.value}`];
  // `Est. 1987`, never a computed age. An age is correct for at most twelve
  // months, and a mockup can sit in somebody's inbox across a new year.
  if (ctx.foundedYear !== undefined) eyebrowParts.push(`Est. ${ctx.foundedYear}`);
  const eyebrow = check(eyebrowParts.join(' · '), 'eyebrow');

  const paragraphs: string[] = [];

  // 1. What, where, and how long — the three facts, stated plainly.
  paragraphs.push(
    check(
      ctx.foundedYear === undefined
        ? `${ctx.record.legalName.value} is a ${pack.noun} in ${ctx.town}, ${ctx.record.region.value}.`
        : `${ctx.record.legalName.value} has been ${pack.work === 'machining' ? 'making and fixing parts' : `doing ${pack.work}`} in ${ctx.town} since ${ctx.foundedYear}.`,
      'p1',
    ),
  );

  // 2. Who the customer deals with, where that is confirmed.
  if (ctx.record.people !== undefined) {
    paragraphs.push(check(ctx.record.people.value, 'people'));
  }

  // 3. The owner's own words, verbatim and unedited.
  for (const [i, note] of ctx.record.voice.entries()) {
    paragraphs.push(check(note.phrase, `voice[${i}]`));
  }

  // 4. What to do next. Every About page should end with the route in;
  //    a reader who has got this far is the one most likely to call.
  paragraphs.push(
    check(
      ctx.has('walk-ins')
        ? `Bring ${pack.object} to the shop in ${ctx.town}, or call and describe it.`
        : `Call the shop and tell us about ${pack.object}. You will get a straight answer about whether it is work we take on.`,
      'close',
    ),
  );

  return {
    headline,
    eyebrow,
    paragraphs,
    imageAlt: check(`The ${ctx.name} shop floor`, 'imageAlt'),
    voiceNotes: ctx.record.voice.map((v) => ({
      phrase: v.phrase,
      source: v.source,
      attributed: v.attributed,
    })),
  };
}

function sentence(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
