/**
 * Service descriptions.
 *
 * Two outputs per service, because the template splits them: the short form
 * that lives in `clients/<slug>.config.ts` (title, one-liner, icon, alt text)
 * and the long form that lives in
 * `src/content/services/<slug>/<service>.md` (summary, highlights, prose).
 *
 * A service the niche pack has no taxonomy entry for is not skipped and not
 * given a borrowed description. It gets a minimal, honest block built from
 * its own title and whatever confirmed detail the record carries, plus a
 * report line asking the owner to describe it. Borrowing the nearest
 * taxonomy entry would be the single easiest way for this engine to publish
 * a capability the shop does not have.
 */
import type { CopyContext, NichePack, ServiceTemplate } from '../niches/types.js';
import type { IconName } from '../niches/types.js';
import type { MarkerReport, ServiceFact } from '../types.js';
import { assertPublishable } from '../guard.js';

export interface ServiceConfigEntry {
  slug: string;
  title: string;
  oneLiner: string;
  icon: IconName;
  image: string;
  imageAlt: string;
}

export interface ServiceMarkdown {
  slug: string;
  /** Frontmatter `title`. */
  title: string;
  summary: string;
  highlights: string[];
  /** Paragraphs, already guard-checked. */
  paragraphs: string[];
}

export interface ServicesOutput {
  config: ServiceConfigEntry[];
  markdown: ServiceMarkdown[];
  unmapped: MarkerReport[];
}

/**
 * The fallback for a service with no taxonomy entry.
 *
 * Deliberately thin. It says what the shop calls the service, that they do
 * it, and how to ask about it — and nothing else, because nothing else is
 * known. Thin and true beats rich and borrowed.
 */
function fallback(ctx: CopyContext, service: ServiceFact): ServiceTemplate {
  const detail = service.detail?.value;
  return {
    title: service.title,
    oneLiner: detail ?? `${service.title}, done at the shop in ${ctx.town}.`,
    summary: () => detail ?? `${service.title} at ${ctx.name}.`,
    body: (c) => [
      detail ?? `${service.title} is work this shop takes on.`,
      `The quickest way to find out whether your job is one for us is to ask. Call ${c.phone} and describe what you need.`,
    ],
    highlights: () => ['Ask about your job — you will get a straight answer'],
    imageAlt: `Work in progress at ${ctx.name}`,
    icon: 'wrench',
    image: '/images/service-precision-machining.svg',
  };
}

export function services(ctx: CopyContext, pack: NichePack, allowed: string[]): ServicesOutput {
  const config: ServiceConfigEntry[] = [];
  const markdown: ServiceMarkdown[] = [];
  const unmapped: MarkerReport[] = [];

  for (const service of ctx.record.services) {
    const key = service.taxonomy ?? service.slug;
    const template = pack.taxonomy[key];

    if (template === undefined) {
      unmapped.push({
        field: `services.${service.slug}`,
        question: `How would you describe "${service.title}" to a customer who has not used you before? (No niche template matched, so this service currently gets a minimal description.)`,
      });
    }

    const t = template ?? fallback(ctx, service);
    // The shop's own name for the service always wins over the taxonomy's.
    // "Rush Repairs" and "Emergency Service" are the same work, and the one
    // on the door is the one the customer is looking for.
    const title = service.title;

    const check = (s: string, field: string): string =>
      assertPublishable(s.replace(/\s+/g, ' ').trim(), `services.${service.slug}.${field}`, allowed);

    config.push({
      slug: service.slug,
      title,
      oneLiner: check(t.oneLiner, 'oneLiner'),
      icon: t.icon,
      image: t.image,
      imageAlt: check(t.imageAlt, 'imageAlt'),
    });

    const paragraphs = t.body(ctx).map((p, i) => check(p, `body[${i}]`));
    // A confirmed specific from the shop itself is worth more than anything
    // the pack can say, so it goes in as its own paragraph rather than being
    // blended into the generic prose where a reader cannot tell them apart.
    if (service.detail !== undefined && template !== undefined) {
      paragraphs.splice(1, 0, check(service.detail.value, 'detail'));
    }

    markdown.push({
      slug: service.slug,
      title,
      summary: check(t.summary(ctx), 'summary'),
      highlights: t.highlights(ctx).map((h, i) => check(h, `highlight[${i}]`)),
      paragraphs,
    });
  }

  return { config, markdown, unmapped };
}
