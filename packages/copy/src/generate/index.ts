/**
 * The engine's entry point: one prospect record in, one site's worth of copy
 * out.
 *
 * The composition order is not arbitrary. Allowances are computed first, from
 * the record alone, so that every generator downstream is checked against the
 * same set of sourced facts — there is no path by which one generator's
 * output becomes another's licence to make a claim. A sentence cannot bless
 * itself.
 */
import type { CopyOutput, MarkerReport, ProspectRecord } from '../types.js';
import { isCarried, isFact } from '../types.js';
import { nicheFor } from '../niches/index.js';
import { allowancesFor } from '../guard.js';
import { buildContext } from './context.js';
import { headline, callToAction } from './headline.js';
import { trust, type TrustItem } from './trust.js';
import { services, type ServiceConfigEntry, type ServiceMarkdown } from './services.js';
import { about, type AboutOutput } from './about.js';
import { faq } from './faq.js';
import { serviceArea, type ServiceAreaOutput } from './service-area.js';
import { seo, type SeoLengthWarning } from './seo.js';
import { jsonLd, type JsonLdSeed } from './jsonld.js';
import { assertPublishable } from '../guard.js';

/**
 * Everything a client config and its markdown need.
 *
 * Shaped to drop straight into `SiteConfig` rather than to be elegant: the
 * value of this package is that a config can spread it in, and a field that
 * needed reshaping at the call site would be a field five configs reshape
 * five slightly different ways.
 */
export interface Generated extends CopyOutput {
  slug: string;
  hero: { headline: string; subhead: string; imageAlt: string };
  trustStrip: TrustItem[];
  certifications: { label: string; detail: string }[];
  serviceConfig: ServiceConfigEntry[];
  serviceMarkdown: ServiceMarkdown[];
  about: AboutOutput;
  area: ServiceAreaOutput;
  cta: { headline: string; body: string; buttonText: string };
  pages: {
    home: { servicesHeading: string; servicesIntro: string };
    services: { title: string; intro: string; metaDescription: string };
    about: { eyebrow: string; metaDescription: string };
    contact: { title: string; intro: string; metaDescription: string };
  };
  jsonLd: JsonLdSeed;
  /** Titles and descriptions that overrun their listing budget. */
  seoWarnings: SeoLengthWarning[];
  /** Services with no niche taxonomy entry, which got minimal descriptions. */
  unmappedServices: MarkerReport[];
  /** Facts inherited from the existing mockups rather than sourced afresh. */
  toReadBack: { field: string; value: string; evidence: string }[];
}

export function generate(record: ProspectRecord): Generated {
  const pack = nicheFor(record.niche);
  const ctx = buildContext(record);
  const allowed = allowancesFor(record);
  const check = (s: string, field: string): string =>
    assertPublishable(s.replace(/\s+/g, ' ').trim(), field, allowed);

  const hero = headline(ctx, pack);
  const trustOut = trust(ctx);
  const servicesOut = services(ctx, pack, allowed);
  const aboutOut = about(ctx, pack, allowed);
  const faqOut = faq(ctx, pack, allowed);
  const areaOut = serviceArea(ctx, pack, allowed);
  const seoOut = seo(ctx, pack, allowed);
  const cta = callToAction(ctx, pack);
  const seoAlt = seoOut.seo.alt;

  // Every string in the trust strip and CTA goes through the guard too. They
  // are short, which is exactly why they get skimmed in review.
  for (const [i, item] of trustOut.strip.entries()) check(item.label, `trustStrip[${i}]`);
  check(cta.headline, 'cta.headline');
  check(cta.body, 'cta.body');
  check(cta.buttonText, 'cta.buttonText');
  check(hero.headline, 'hero.headline');
  check(hero.subhead, 'hero.subhead');

  const count = servicesOut.config.length;
  const servicesHeading = check(
    count === 0 ? 'What we do' : ctx.servicesSentence().replace(/^./, (c) => c.toUpperCase()),
    'pages.home.servicesHeading',
  );

  const pages: Generated['pages'] = {
    home: {
      servicesHeading,
      servicesIntro: check(
        ctx.has('walk-ins')
          ? `Whatever the job, you deal with the same shop from the first call to collection.`
          : `Whatever the job, you deal with the same shop from quote to delivery.`,
        'pages.home.servicesIntro',
      ),
    },
    services: {
      title: 'What we do',
      intro: check(
        count === 0
          ? `Tell us about the job and you will get a straight answer on whether it is one for us.`
          : `${sentenceCase(ctx.servicesSentence())} — all of it quoted before any work starts.`,
        'pages.services.intro',
      ),
      metaDescription: seoOut.seo.services.description,
    },
    about: {
      eyebrow: aboutOut.eyebrow,
      metaDescription: seoOut.seo.about.description,
    },
    contact: {
      title: ctx.has('quote-from-photo') ? 'Send a photo or call' : 'Tell us about the job',
      intro: check(
        ctx.has('quote-from-photo')
          ? `Send a photo and the dimensions and you will be told what it takes and what it costs.`
          : `Call and describe the job. You will be told what it takes and what it costs before any work starts.`,
        'pages.contact.intro',
      ),
      metaDescription: seoOut.seo.contact.description,
    },
  };

  // Carried facts are the ones whose provenance is one hop longer than the
  // rest. Surfacing them here is what stops that distinction quietly
  // evaporating between this run and the next.
  const toReadBack: Generated['toReadBack'] = [];
  const consider = (field: string, f: { value: unknown; evidence: string } | undefined): void => {
    if (f === undefined || !isCarried(f as never)) return;
    // `String(hoursArray)` is `[object Object],[object Object]…`, which in a
    // report is worse than useless: it looks like a bug in the report rather
    // than a value to check. Structured values get described instead.
    const shown = Array.isArray(f.value)
      ? `${f.value.length} rows`
      : String(f.value);
    toReadBack.push({ field, value: shown, evidence: f.evidence });
  };
  consider('foundedYear', record.foundedYear);
  consider('phone', record.phone);
  consider('email', record.email);
  consider('hours', record.hours);
  consider('people', record.people);
  for (const [id, t] of Object.entries(record.traits)) if (isFact(t)) consider(`traits.${id}`, t);
  for (const s of record.services) consider(`services.${s.slug}.detail`, s.detail);

  return {
    slug: record.slug,
    hero: { ...hero, imageAlt: seoAlt['hero'] as string },
    trustStrip: trustOut.strip,
    certifications: trustOut.certifications,
    serviceConfig: servicesOut.config,
    serviceMarkdown: servicesOut.markdown,
    about: aboutOut,
    faq: faqOut.items,
    serviceAreas: areaOut.towns,
    area: areaOut,
    cta,
    pages,
    seo: seoOut.seo,
    seoWarnings: seoOut.warnings,
    jsonLd: jsonLd(ctx, faqOut.items),
    markers: trustOut.markers,
    droppedQuestions: faqOut.dropped,
    unmappedServices: servicesOut.unmapped,
    toReadBack,
  };
}

function sentenceCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
