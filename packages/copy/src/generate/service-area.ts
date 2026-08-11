/**
 * Service-area sections: one block per town.
 *
 * These pages have a bad reputation, deservedly. The standard implementation
 * is one thin page per town with the town name substituted into the same
 * paragraph, which is exactly what a doorway page is, and search engines have
 * been demoting them for years. Worse, they usually contain the sentence that
 * gets a business caught: "just 10 minutes from downtown Ridgewood", written
 * by somebody who has never been to Ridgewood.
 *
 * So the rules here are narrow:
 *
 *   1. Sections, not pages. They live on one real page with the rest of the
 *      site's content around them.
 *   2. Never a distance, a drive time, a landmark, a neighbourhood or a
 *      highway. We do not know them, and inventing local colour is the most
 *      recognisable tell of automated local copy.
 *   3. Only towns the operator put on the record. The claim "we serve X" is
 *      the business's claim, and it belongs on the prospect record with the
 *      rest of the sourced facts.
 *
 * What is left is honest and still useful: the town named, what this trade
 * does for people there, and how to start. That is what someone searching
 * "welder in Bergenfield" actually wanted.
 */
import type { CopyContext, NichePack } from '../niches/types.js';
import type { TownSection } from '../types.js';
import { assertPublishable } from '../guard.js';
import { partitionTowns } from '../bergen.js';

export interface ServiceAreaOutput {
  /** Heading for the whole section. */
  heading: string;
  intro: string;
  towns: TownSection[];
  /** Wider areas named in one line rather than given their own blocks. */
  widerLine: string | null;
}

export function serviceArea(
  ctx: CopyContext,
  pack: NichePack,
  allowed: string[],
): ServiceAreaOutput {
  const { bergen, other } = partitionTowns(ctx.record.serviceTowns);

  // Towns get sections in the order the operator listed them, with the
  // shop's own town first if it is on the list — a customer in the home town
  // should not have to scroll past six neighbours to find themselves.
  const ordered = [...bergen].sort((a, b) =>
    a === ctx.town ? -1 : b === ctx.town ? 1 : 0,
  );

  /**
   * The closing sentence, rotated independently of the opening one.
   *
   * Two rotations of different lengths, rather than one, so the pairing does
   * not repeat until their lowest common multiple — which for five openers
   * and three closers is fifteen towns, more than any client here has. One
   * rotation would give every third block the same pair.
   */
  const closers = ctx.has('walk-ins')
    ? [
        `Bring the work to ${ctx.town} during opening hours, or call ${ctx.phone} first if you would rather check it is something we take on.`,
        `Call ${ctx.phone} and describe it, or just bring it to the shop in ${ctx.town}.`,
        `Bring it in or call ${ctx.phone}. Either way you get an answer about the job from somebody who does the work.`,
      ]
    : [
        `Call ${ctx.phone} and describe the job, and you will get a straight answer on whether it is one for us.`,
        `Call ${ctx.phone} and tell us what it is, what it does and when you need it.`,
        `Call ${ctx.phone} — the quickest way to find out whether it is a job for this shop.`,
      ];

  const towns: TownSection[] = ordered.map((town, i) => {
    const isHome = town === ctx.town;
    const openers = pack.townLines(ctx, town);
    const opener = openers[i % openers.length] as string;
    const closer = closers[i % closers.length] as string;

    const body = [isHome ? `The shop is here. ${opener}` : opener, closer].join(' ');

    return {
      town,
      body: assertPublishable(body.replace(/\s+/g, ' '), `serviceArea.${town}`, allowed),
    };
  });

  const wider = [...other, ...ctx.record.wider];
  const widerLine =
    wider.length === 0
      ? null
      : assertPublishable(
          `Work also comes in from ${ctx.list(wider)}. If you are further out and the job travels, call and ask.`,
          'serviceArea.wider',
          allowed,
        );

  // `pack.work`, not `pack.noun`: the heading is about the work, and
  // "Welding and fabrication shop work across Bergen County" is what you get
  // from bolting "work" onto a noun that already contains "shop".
  const heading =
    ctx.county === undefined
      ? 'Where we work'
      : `${pack.work.charAt(0).toUpperCase() + pack.work.slice(1)} across ${ctx.county}`;

  const intro = assertPublishable(
    towns.length === 0
      ? `Based in ${ctx.town}, ${ctx.record.region.value}.`
      : `Based in ${ctx.town}, and working across ${ctx.list(towns.map((t) => t.town))}.`,
    'serviceArea.intro',
    allowed,
  );

  return { heading, intro, towns, widerLine };
}
