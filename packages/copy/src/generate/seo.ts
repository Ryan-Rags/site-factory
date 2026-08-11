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

export interface SeoLengthWarning {
  field: string;
  length: number;
  budget: number;
  text: string;
}

export interface SeoGenerated {
  seo: SeoOutput;
  warnings: SeoLengthWarning[];
}

export function seo(ctx: CopyContext, pack: NichePack, allowed: string[]): SeoGenerated {
  const warnings: SeoLengthWarning[] = [];

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

  const home: PageSeo = {
    title: check(`${ctx.name} — ${titleTrade(pack, ctx)} in ${ctx.town}`, 'home.title', TITLE_BUDGET),
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
  };
}

/**
 * The trade as it should appear in a title tag: the shop's own leading
 * service if it has one, because that is what its customers search for.
 */
function titleTrade(pack: NichePack, ctx: CopyContext): string {
  return ctx.serviceTitles[0] ?? sentenceCase(pack.work);
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
