/**
 * Per-page SEO: title tags, meta descriptions and image alt text.
 *
 * Three constraints shape all of it.
 *
 * **Length.** Titles are cut off around 60 characters in a result listing and
 * descriptions around 155. Those are not hard limits — search engines rewrite
 * both freely — but a description that is truncated mid-clause looks careless
 * in the one place a prospect sees the business before they click. Generated
 * strings are checked against those budgets and the check reports rather than
 * silently truncating, because a machine cutting a sentence produces exactly
 * the mid-clause truncation it was meant to avoid.
 *
 * **The town belongs in the title.** For a local service business the query
 * is almost always "<trade> <town>" or "<trade> near me" resolved to a town.
 * A title of "Home | Business Name" throws away the only ranking signal the
 * page had for free.
 *
 * **Alt text describes the image.** Not the business, not the keywords. The
 * template's images are illustrative placeholders, so the alt text says what
 * the illustration shows. When real photographs land, these are rewritten
 * against the photographs — which is why they are generated per-image-role
 * rather than being one string reused everywhere.
 */
import type { CopyContext, NichePack } from '../niches/types.js';
import type { PageSeo, SeoOutput } from '../types.js';
import { orList } from '../text.js';
import { assertPublishable } from '../guard.js';

/** Where a listing stops showing the title. */
export const TITLE_BUDGET = 60;
/** Where a listing stops showing the description. */
export const DESCRIPTION_BUDGET = 155;

/**
 * The hard ceiling, and the difference between it and `TITLE_BUDGET`.
 *
 * `TITLE_BUDGET` is advisory: past 60 characters a listing truncates, which is
 * a cosmetic loss and is reported as a warning. This is the *gate* —
 * `TITLE_MAX` in `packages/template/scripts/check-metadata.mjs`, which fails
 * the build. A title over it is not a warning; it is 17 demos that did not
 * ship. See issue #55.
 *
 * Mirrored rather than imported: this package cannot reach into the template's
 * scripts. If the gate's number moves, this one moves with it.
 */
export const TITLE_MAX = 70;

/**
 * Length as the gate counts it.
 *
 * The gate reads the built HTML and measures the raw characters between
 * `<title>` and `</title>`, so an escaped character costs what its entity
 * costs: one `&` is five characters, not one. That is not a rounding error at
 * this scale — `Avishay Contractors Kitchen & Bath Remodeling` composed a title
 * of 90 characters and was reported at 94, and 14 of the 50 names in the
 * 2026-08-16 batch carry an ampersand.
 *
 * Measuring the unescaped string here would produce a formula that agrees with
 * itself and disagrees with the build, which is the failure this replaces. Only
 * the three characters a text node must escape are counted: quotes are not
 * escaped in element content, and counting them would narrow titles that would
 * have passed.
 */
export function titleLength(text: string): number {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').length;
}

export interface SeoLengthWarning {
  field: string;
  length: number;
  budget: number;
  text: string;
}

export interface SeoGenerated {
  seo: SeoOutput;
  warnings: SeoLengthWarning[];
  /**
   * Decisions worth printing: which home-title tier was used, and what it cost.
   *
   * Not warnings. A narrowed title is the correct output; what would be wrong
   * is narrowing 17 titles and saying nothing, because then nobody looks at
   * them before they are pitched.
   */
  notes: string[];
}

export function seo(ctx: CopyContext, pack: NichePack, allowed: string[]): SeoGenerated {
  const warnings: SeoLengthWarning[] = [];
  const notes: string[] = [];

  const check = (text: string, field: string, budget: number): string => {
    const clean = assertPublishable(text.replace(/\s+/g, ' ').trim(), `seo.${field}`, allowed);
    if (clean.length > budget) {
      warnings.push({ field, length: clean.length, budget, text: clean });
    }
    return clean;
  };

  const where = `${ctx.town}, ${ctx.record.region.value}`;
  const services = ctx.servicesSentence();
  const trade = pack.noun;

  // The home title carries the full business name because it is the brand
  // result — someone who searched the name expects to see the name. Interior
  // pages let `titleTemplate` append it and spend their own budget on the
  // page's subject plus the town.
  //
  // The description is built up in priority order rather than written out and
  // hoped for. Who and where come first because they are what the searcher
  // matched on; the call
  // to action second because a description that ends mid-service-list has
  // spent its last characters on nothing. The service list is the part that
  // gets dropped when the budget runs out, and for a shop with four services
  // and a long name it usually does.
  const homeCore = `${ctx.name} is a ${trade} in ${where}${
    ctx.foundedYear === undefined ? '' : `, working since ${ctx.foundedYear}`
  }.`;
  const homeCall = `Call ${ctx.phone}.`;
  const homeWithServices =
    services === '' ? homeCore : `${homeCore} ${sentenceCase(services)}.`;
  const homeDescription =
    `${homeWithServices} ${homeCall}`.length <= DESCRIPTION_BUDGET
      ? `${homeWithServices} ${homeCall}`
      : `${homeCore} ${homeCall}`;

  const homeTitle = fitHomeTitle(ctx, pack);
  notes.push(...homeTitle.notes);

  const home: PageSeo = {
    title: check(homeTitle.text, 'home.title', TITLE_BUDGET),
    description: check(homeDescription, 'home.description', DESCRIPTION_BUDGET),
  };

  const servicesPage: PageSeo = {
    title: check(`${titleTrade(pack, ctx)} in ${ctx.town}`, 'services.title', TITLE_BUDGET),
    description: check(
      services === ''
        ? `What ${ctx.name} takes on, and how to get a job started. ${where}.`
        : `${sentenceCase(services)} from ${ctx.name} in ${where}.`,
      'services.description',
      DESCRIPTION_BUDGET,
    ),
  };

  const about: PageSeo = {
    title: check(`About ${ctx.name}`, 'about.title', TITLE_BUDGET),
    description: check(
      ctx.foundedYear === undefined
        ? `${ctx.record.legalName.value} is a ${trade} in ${where}.`
        : `${ctx.record.legalName.value} has been ${gerund(pack)} in ${where} since ${ctx.foundedYear}.`,
      'about.description',
      DESCRIPTION_BUDGET,
    ),
  };

  const contactRoutes = [`call ${ctx.phone}`];
  if (ctx.email !== undefined) contactRoutes.push('email');
  if (ctx.has('walk-ins')) contactRoutes.push('walk in');

  const contact: PageSeo = {
    title: check(`Contact ${ctx.name} — ${ctx.town}`, 'contact.title', TITLE_BUDGET),
    description: check(
      `Get a quote from ${ctx.name} in ${where}: ${orList(contactRoutes)}.`,
      'contact.description',
      DESCRIPTION_BUDGET,
    ),
  };

  const defaultDescription = check(
    `${ctx.record.legalName.value} is a ${trade} in ${where}${
      services === '' ? '' : `, doing ${services}`
    }.`,
    'defaultDescription',
    DESCRIPTION_BUDGET,
  );

  /**
   * Alt text by image role.
   *
   * `logo` is absent on purpose: the template renders it decoratively with
   * `alt=""` because the business name sits beside it as real text, and
   * giving it alt text would have a screen reader announce the name twice.
   */
  const alt: Record<string, string> = {
    hero: check(
      `${heroSubject(pack)} in the ${ctx.name} shop`,
      'alt.hero',
      Number.MAX_SAFE_INTEGER,
    ),
    story: check(`The ${ctx.name} shop floor`, 'alt.story', Number.MAX_SAFE_INTEGER),
    og: check(`${ctx.name} — ${trade} in ${ctx.town}`, 'alt.og', Number.MAX_SAFE_INTEGER),
  };

  return {
    seo: { defaultDescription, home, services: servicesPage, about, contact, alt },
    warnings,
    notes,
  };
}

/**
 * The trade as it should appear in a title tag: the shop's own leading
 * service if it has one, because that is what its customers search for.
 */
function titleTrade(pack: NichePack, ctx: CopyContext): string {
  return ctx.serviceTitles[0] ?? sentenceCase(pack.work);
}

/**
 * The trade descriptor, longest first, so a title that will not fit can be
 * narrowed without losing the trade entirely.
 *
 * Three sources, in decreasing specificity and decreasing length: the shop's
 * own leading service title, the pack's gerund phrase (`building and
 * remodeling`), and the pack's bare trade noun (`general contractor`).
 * Deduplicated, because for a shop with no sourced services the first two are
 * the same string and offering it twice would waste a tier.
 *
 * The noun is a genuine shortening for every pack the engine has — 18 against
 * 23 for contractors, 28 against 29 for welding, 12 against 9 for machining
 * where it is *longer* and is therefore filtered out below. What matters is
 * that the list is monotonically shorter; a "shortening" that grows the string
 * would silently skip a tier.
 */
function tradeDescriptors(pack: NichePack, ctx: CopyContext): string[] {
  const candidates = [titleTrade(pack, ctx), sentenceCase(pack.work), sentenceCase(pack.noun)];
  const out: string[] = [];
  for (const candidate of candidates) {
    const last = out[out.length - 1];
    if (candidate === '' || out.includes(candidate)) continue;
    // Monotonically shorter only. See above.
    if (last !== undefined && titleLength(candidate) >= titleLength(last)) continue;
    out.push(candidate);
  }
  return out;
}

interface FittedTitle {
  text: string;
  notes: string[];
}

/**
 * The home page's `<title>`, narrowed until it clears the gate.
 *
 * The ladder, in the order Ryan ruled on 2026-08-17 (PR #54's Brief item 1):
 *
 *  1. `Name — Trade in Town`  — today's formula, and what every title that
 *     already fits keeps, byte for byte. That property is the reason the tiers
 *     engage only on overflow rather than being applied unconditionally: the
 *     eight hand-authored clients all fit at tier 1 and none of them may move.
 *  2. drop the locality suffix
 *  3. shorten the trade descriptor, one step at a time
 *  4. the business name alone
 *
 * **The business name is never truncated**, at any tier, including when the
 * name alone overruns. A machine cutting a business name in half is the exact
 * mid-clause truncation this file's header refuses to do to a description, and
 * it is worse here: the name is the one string on the page that belongs to
 * somebody else. A name that cannot fit is emitted whole and reported, and the
 * build then fails the gate — loudly, on our side of the pitch, which is where
 * that decision belongs. No name in the 2026-08-16 batch is in that case: the
 * longest is 47 characters.
 *
 * The town is given up before the trade for a reason worth stating, because
 * this file's own header argues the other way: the town is the ranking signal a
 * local query turns on. But at tier 2 the town is still in the description, the
 * H1, the JSON-LD `address`, the service-area section and the interior page
 * titles — while the trade is what tells a reader scanning results what the
 * business *is*. Losing the town from one tag is recoverable; a title reading
 * `Some Long Business Name LLC — Fair Lawn` is not.
 */
function fitHomeTitle(ctx: CopyContext, pack: NichePack): FittedTitle {
  const trades = tradeDescriptors(pack, ctx);
  const lead = trades[0];

  const tiers: { text: string; why: string }[] = [];
  if (lead !== undefined) {
    tiers.push({ text: `${ctx.name} — ${lead} in ${ctx.town}`, why: 'name, trade and town' });
    tiers.push({ text: `${ctx.name} — ${lead}`, why: 'the locality suffix was dropped' });
    for (const trade of trades.slice(1)) {
      tiers.push({
        text: `${ctx.name} — ${trade}`,
        why: `the locality suffix was dropped and the trade shortened to "${trade}"`,
      });
    }
  }
  tiers.push({ text: ctx.name, why: 'the business name alone' });

  const first = tiers[0] ?? { text: ctx.name, why: 'the business name alone' };
  for (const [index, tier] of tiers.entries()) {
    if (titleLength(tier.text) > TITLE_MAX) continue;
    if (index === 0) return { text: tier.text, notes: [] };
    return {
      text: tier.text,
      notes: [
        `seo: the home title was narrowed to ${titleLength(tier.text)} chars — ${tier.why}. ` +
          `"${first.text}" is ${titleLength(first.text)} chars against the ${TITLE_MAX}-char gate.`,
      ],
    };
  }

  // Nothing fits, which can only mean the name alone overruns. Emit it whole.
  const name = ctx.name;
  return {
    text: name,
    notes: [
      `seo: the home title is the business name alone at ${titleLength(name)} chars, which is ` +
        `over the ${TITLE_MAX}-char gate. The name is not truncated — shorten it with the owner, ` +
        `or waive the gate for this build. This build will fail check-metadata.mjs.`,
    ],
  };
}

function gerund(pack: NichePack): string {
  return pack.work;
}

/**
 * Who is in the hero illustration.
 *
 * Alt text has to describe what is depicted, and the three packs depict
 * different people doing different things. "A machinist at a lathe" is wrong
 * for a contractor's hero and right for a machine shop's.
 */
function heroSubject(pack: NichePack): string {
  switch (pack.id) {
    case 'machine-shop':
      return 'A machinist setting up a part on a lathe';
    case 'welding-fabrication':
      return 'A welder joining a steel assembly';
    case 'general-contractor':
      return 'A carpenter framing an extension';
  }
}

function sentenceCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
