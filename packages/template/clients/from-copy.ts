import { generate, prospectFor } from '@site-factory/copy';
import type { SiteConfig } from '../src/types/site';

/**
 * The bridge between the copy engine and a client config.
 *
 * Every client config now has two halves. This one — hero, trust strip,
 * service copy, About, CTA, page headings, SEO strings, FAQ, service areas —
 * is *generated*, from the prospect record's confirmed facts, and must not be
 * hand-edited. Editing it here would put a sentence on the site that no
 * record supports, which is the exact hole the engine exists to close: the
 * fabrication guard runs during generation, so a string typed in afterwards
 * has never been checked by anything.
 *
 * The other half — identity, theme, brand assets, testimonials, equipment,
 * forms, `noindex` — stays hand-written in the config, because none of it is
 * copy. A colour is not a claim.
 *
 * To change generated copy: change the prospect record in
 * `packages/copy/src/prospects/<slug>.ts`, or the niche pack, and rebuild.
 * The markdown under `src/content/` is generated the same way, by
 * `pnpm --filter @site-factory/copy emit`.
 */
export function copyFor(slug: string): {
  hero: Pick<SiteConfig['hero'], 'headline' | 'subhead' | 'imageAlt'>;
  trustStrip: SiteConfig['trustStrip'];
  services: SiteConfig['services'];
  about: Pick<SiteConfig['about'], 'headline' | 'imageAlt' | 'voiceNotes'>;
  certifications: SiteConfig['certifications'];
  cta: SiteConfig['cta'];
  pages: SiteConfig['pages'];
  seoDescription: string;
  faq: NonNullable<SiteConfig['faq']>;
  serviceAreas: NonNullable<SiteConfig['serviceAreas']>;
  storyImageAlt: string;
  ogAlt: string;
} {
  const g = generate(prospectFor(slug));

  return {
    hero: { headline: g.hero.headline, subhead: g.hero.subhead, imageAlt: g.hero.imageAlt },
    trustStrip: g.trustStrip,
    services: g.serviceConfig,
    about: {
      headline: g.about.headline,
      imageAlt: g.about.imageAlt,
      voiceNotes: g.about.voiceNotes,
    },
    certifications: g.certifications,
    cta: {
      headline: g.cta.headline,
      body: g.cta.body,
      buttonText: g.cta.buttonText,
      buttonHref: '/contact',
    },
    pages: {
      home: {
        servicesHeading: g.pages.home.servicesHeading,
        servicesIntro: g.pages.home.servicesIntro,
        title: g.seo.home.title,
        metaDescription: g.seo.home.description,
      },
      services: {
        title: g.pages.services.title,
        intro: g.pages.services.intro,
        metaDescription: g.pages.services.metaDescription,
      },
      about: {
        eyebrow: g.pages.about.eyebrow,
        metaDescription: g.pages.about.metaDescription,
      },
      contact: {
        title: g.pages.contact.title,
        intro: g.pages.contact.intro,
        metaDescription: g.pages.contact.metaDescription,
      },
    },
    seoDescription: g.seo.defaultDescription,
    faq: g.faq,
    serviceAreas: {
      heading: g.area.heading,
      intro: g.area.intro,
      towns: g.area.towns,
      // `widerLine` is optional on the config and nullable on the generator.
      // `exactOptionalPropertyTypes` means the two cannot be bridged with a
      // plain assignment — an explicit `undefined` is not the same as absent.
      ...(g.area.widerLine === null ? {} : { widerLine: g.area.widerLine }),
    },
    storyImageAlt: g.seo.alt['story'] as string,
    ogAlt: g.seo.alt['og'] as string,
  };
}
