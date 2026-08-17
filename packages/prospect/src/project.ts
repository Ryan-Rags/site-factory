import { slugify } from "@site-factory/discover";

import { writeCopy, type CopyResult } from "./copy.js";
import { buildDesign } from "./design.js";
import type { SiteConfig, SiteIconName } from "./site-config.js";
import { type ProspectConfig, type ProspectService, isKnown, valueOf } from "./types.js";

/**
 * Project a prospect onto the template's `SiteConfig`.
 *
 * The rule that shapes every line of this file: **copy may be generic, but it
 * may never be a claim we cannot source.** "Precision machining in North
 * Bergen, NJ" is fine when both the service and the town came from a source.
 * "Family-run for three generations", "±0.001 tolerances" and "24-hour
 * turnaround" are not, however well they would sell — they are facts about a
 * business we have not been told.
 *
 * Where the template needs a value we do not have, the choice is, in order:
 * omit the optional field, fall back to wording that asserts nothing, or use
 * the template's own `[verify with client]` marker so it is conspicuous. The
 * marker gate (`check-markers.mjs`) then guarantees no marked build can be
 * flipped to indexable without someone dealing with it.
 */

/** The template's own placeholder marker. Mirrors `VERIFY_MARKER` in site.ts. */
export const VERIFY_MARKER = "[verify with client]";

/** Images that ship with the template for every client. */
const STOCK = {
  hero: "/images/hero.svg",
  story: "/images/story.svg",
  gallery: [1, 2, 3, 4, 5, 6].map((n) => `/images/gallery-${n}.svg`),
  logo: "/images/logo.svg",
  favicon: "/favicon.svg",
  og: "/images/og.svg",
} as const;

const SERVICE_ICONS: SiteIconName[] = ["precision", "wrench", "gear", "shield", "truck", "badge"];

function iconFor(title: string, index: number): SiteIconName {
  const t = title.toLowerCase();
  if (/weld|fabricat/.test(t)) return "shield";
  if (/repair|rebuild|fix|service/.test(t)) return "wrench";
  if (/machin|precision|cnc|mill|turn|grind/.test(t)) return "precision";
  if (/deliver|ship|mobile|onsite|on-site/.test(t)) return "truck";
  if (/inspect|quality|cert/.test(t)) return "badge";
  return SERVICE_ICONS[index % SERVICE_ICONS.length] ?? "gear";
}

/** Digits only, E.164-ish, for `tel:` links. */
export function phoneHref(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits ? `+${digits}` : "";
}

export interface ProjectOptions {
  /** Where the demo will be served. Becomes `seo.siteUrl`. */
  siteUrl: string;
  /**
   * A hand-authored config for this prospect, when one exists. Its long-form
   * copy, images and content-collection wiring are reused verbatim: it was
   * written by a person and is better than anything derived here, and reusing
   * it is what stops the demo pipeline from *degrading* the five sites that
   * already exist.
   */
  seed?: SiteConfig | undefined;
  /** Public paths of any prospect-supplied images, already copied into dist. */
  assetPaths?: { logo?: string; photos: string[] } | undefined;
  /**
   * The shared demo Worker endpoint, from `resolveFormEndpoint()`. Empty or
   * absent means none is configured and the form falls back as it did before.
   */
  formEndpoint?: string | undefined;
}

export interface ProjectionResult {
  site: SiteConfig;
  /** Content files the build needs that do not exist yet. */
  requiredContent: { about: string; services: { slug: string; title: string }[] };
  /** Decisions worth printing, e.g. what fell back to a marker. */
  notes: string[];
  /** What the copy engine produced, or why it produced nothing. */
  copy: CopyResult;
}

export function projectToSite(prospect: ProspectConfig, opts: ProjectOptions): ProjectionResult {
  const notes: string[] = [];
  const seed = opts.seed;

  const name = valueOf(prospect.businessName) ?? seed?.business.name ?? prospect.id;
  const legalName = valueOf(prospect.legalName) ?? seed?.business.legalName ?? name;
  const address = valueOf(prospect.address) ??
    seed?.business.address ?? { locality: "", region: "", country: "US" };
  const locality = address.locality;
  const region = address.region;
  const place = [locality, region].filter(Boolean).join(", ");
  const phone = valueOf(prospect.phone) ?? seed?.business.phone ?? "";
  const email = valueOf(prospect.email) ?? seed?.business.email;
  const hours = valueOf(prospect.hours) ?? seed?.business.hours;
  const foundedYear = valueOf(prospect.foundedYear) ?? seed?.business.foundedYear;
  const rating = valueOf(prospect.ratingSummary);
  const colors = valueOf(prospect.brand.colors) ?? seed?.theme.colors ?? {
    primary: "#334155",
    accent: "#b45309",
  };
  const preset = valueOf(prospect.preset);

  const services = resolveServices(prospect, seed, notes);
  const leadService = services[0]?.title ?? "";

  if (!phone) notes.push("no phone number from any source — the header and footer call links are empty");
  if (!place) notes.push("no address from any source — the address block and JSON-LD are thin");

  const business: SiteConfig["business"] = {
    name,
    legalName,
    tagline: tagline(leadService, place),
    phone,
    phoneHref: phoneHref(phone),
    address,
    serviceArea: valueOf(prospect.serviceArea) ?? seed?.business.serviceArea ?? (locality ? [locality] : []),
  };
  if (foundedYear !== undefined) business.foundedYear = foundedYear;
  if (email) business.email = email;
  if (hours) business.hours = hours;

  const site: SiteConfig = {
    business,
    theme: {
      ...(preset ? { preset } : {}),
      colors,
      fonts: seed?.theme.fonts ?? {
        heading: 'ui-sans-serif, system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        body: 'ui-sans-serif, system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        faces: [],
      },
    },
    brand: {
      logo: opts.assetPaths?.logo ?? seed?.brand.logo ?? STOCK.logo,
      favicon: seed?.brand.favicon ?? STOCK.favicon,
      ogImage: seed?.brand.ogImage ?? STOCK.og,
    },
    hero: heroFor(seed, { name, leadService, place, photos: opts.assetPaths?.photos ?? [] }),
    trustStrip: trustStrip(seed, { foundedYear, rating, hours: hours !== undefined, place }),
    services: services.map((s, i) => ({
      slug: s.slug,
      title: s.title,
      oneLiner: s.oneLiner ?? `${s.title} for customers in ${place || "the area"}.`,
      icon: iconFor(s.title, i),
      image: s.image ?? opts.assetPaths?.photos[i + 1] ?? STOCK.gallery[i % STOCK.gallery.length] ?? STOCK.hero,
      imageAlt: s.imageAlt ?? `${s.title} at ${name}`,
    })),
    about: {
      headline: seed?.about.headline ?? aboutHeadline(name, place, foundedYear),
      entry: "about",
      image: seed?.about.image ?? opts.assetPaths?.photos[0] ?? STOCK.story,
      imageAlt: seed?.about.imageAlt ?? `${name}`,
    },
    testimonials: testimonials(prospect, seed, notes),
    certifications: seed?.certifications ?? [],
    cta: seed?.cta ?? {
      headline: `Need ${leadService ? leadService.toLowerCase() : "a quote"}?`,
      // Two things this line must not do, both caught by build gates:
      // claim a price (nobody has asked this shop what a conversation costs),
      // and print the number as prose (the page already carries it as a
      // `tel:` link, and a second untappable copy is where an enquiry dies).
      body: phone
        ? "Call the shop and tell us about the job."
        : "Send us the details of the job and we will come back to you.",
      buttonText: "Get in touch",
      buttonHref: "/contact",
    },
    pages: pageCopy(seed, { name, place, services, leadService }),
    seo: {
      titleTemplate: `%s | ${name}`,
      defaultDescription: seed?.seo.defaultDescription ?? defaultDescription(name, leadService, place),
      siteUrl: opts.siteUrl,
      // Never negotiable in this pipeline: a demo is a private mockup of
      // somebody else's business under their name. It is not indexable.
      noindex: true,
    },
    features: { gallery: false },
    forms: formsFor({ email, endpoint: opts.formEndpoint ?? "" }, notes),
  };

  if (seed?.updates) site.updates = seed.updates;
  if (seed?.equipment) site.equipment = seed.equipment;

  /* -- the copy engine ---------------------------------------------------- */

  // Run for every prospect, seeded or not. A seeded client keeps its
  // hand-authored page copy — a person wrote it and it is better than anything
  // derived here — but the FAQ and the town-by-town service-area sections are
  // things the five configs do not carry at all, so there is nothing to
  // overwrite and everything to gain.
  const copy = writeCopy(prospect);
  notes.push(...copy.notes);

  if (copy.faq !== undefined) site.faq = copy.faq;
  if (copy.serviceAreas !== undefined) site.serviceAreas = copy.serviceAreas;

  if (copy.seo !== undefined && !seed) {
    site.seo.defaultDescription = copy.seo.defaultDescription;
  }
  if (copy.pages !== undefined && !seed) {
    site.pages = {
      home: {
        servicesHeading: copy.pages.home.servicesHeading,
        servicesIntro: copy.pages.home.servicesIntro,
        ...(copy.seo !== undefined
          ? { title: copy.seo.home.title, metaDescription: copy.seo.home.description }
          : {}),
      },
      services: copy.pages.services,
      about: copy.pages.about,
      contact: copy.pages.contact,
    };
    notes.push("copy: page titles and meta descriptions came from the copy engine");
  }

  /* -- the design family -------------------------------------------------- */

  // Last, because it reads the finished `SiteConfig`: every headline, service
  // card and review it renders is a value that has already been through the
  // sourcing rules above. `deriveDesign` composes the hand-authored clients
  // the same way and for the same reason — two copies of a sentence are two
  // chances for one to be corrected and the other not.
  const designed = buildDesign({
    prospect,
    site,
    copy,
    preset: preset ?? "precision",
  });
  site.design = designed.design;
  notes.push(...designed.notes);

  return {
    site,
    requiredContent: {
      about: "about",
      services: site.services.map((s) => ({ slug: s.slug, title: s.title })),
    },
    notes,
    copy,
  };
}

interface ResolvedService extends ProspectService {
  image?: string;
  imageAlt?: string;
}

/**
 * The service list, preferring the hand-authored config.
 *
 * A seeded prospect keeps the seed's slugs exactly, because those slugs are
 * also content-collection ids: inventing a new one would orphan a markdown
 * file a person wrote. A prospect with neither seed nor discovered services
 * gets one honest catch-all entry rather than a guess at their trade.
 */
function resolveServices(
  prospect: ProspectConfig,
  seed: SiteConfig | undefined,
  notes: string[],
): ResolvedService[] {
  if (seed) {
    return seed.services.map((s) => ({
      slug: s.slug,
      title: s.title,
      oneLiner: s.oneLiner,
      image: s.image,
      imageAlt: s.imageAlt,
    }));
  }
  const discovered = valueOf(prospect.services) ?? [];
  if (discovered.length > 0) return discovered.slice(0, 6);

  notes.push("no services from any source — one catch-all service entry was emitted");
  const niche = valueOf(prospect.niche);
  const title = niche ? titleCase(niche) : "What we do";
  return [{ slug: slugify(title) || "what-we-do", title }];
}

function titleCase(text: string): string {
  return text.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Uploads a demo form accepts. Photographs of a job, and a spec sheet. */
const UPLOAD_TYPES = ["image/jpeg", "image/png", "image/heic", "image/webp", "application/pdf"];

/**
 * The `forms` block, and the reason a prospect demo now carries a real one.
 *
 * ## What was wrong
 *
 * The two branches this replaces were `mailto` when a confirmed email address
 * existed and `disabled` otherwise. `disabled` is the right call for a *mockup*
 * — a form that posts nowhere is worse than no form, because it promises a reply
 * from a shop that will never see the message — and it was the wrong call here.
 * Email coverage on the 2026-08-16 batch was 0 of 50, so all 50 took the
 * `disabled` branch and 33 live demos went out unable to capture the one thing
 * they exist to demonstrate. PR #54's Brief item 2, ruled 2026-08-17.
 *
 * ## The order, and why
 *
 * 1. **A configured demo endpoint wins**, whatever we know about their inbox. A
 *    demo lead belongs in *our* inbox until the shop says yes — that is what the
 *    Worker's `MAIL_TO` fallback is, and routing it to a prospect's own address
 *    off the back of a scraped listing would put our pitch traffic in the inbox
 *    of somebody who has not agreed to hear from us.
 * 2. **`mailto`** when there is no endpoint but there is a confirmed address.
 *    Unchanged, and it is what keeps a real client build from ever inheriting
 *    the demo endpoint — the standing rule from PR #13.
 * 3. **`disabled`** when there is neither. Still the honest answer: nothing to
 *    post to, so nothing that looks like it can be posted.
 *
 * No `fields` block is emitted, deliberately. The template's default *is* the
 * standard demo set — name and message required, phone and email offered as an
 * either/or pair so no lead can arrive unanswerable, service and file optional —
 * and it is byte-for-byte the Worker's default too. Writing it out would oblige
 * a matching `PROSPECT_FIELDS` entry per prospect in `wrangler.jsonc`, and
 * `check-form-fields.mjs` cannot verify those against a generated config that
 * exists only under gitignored `prospects/`. Two copies of a rule where only one
 * can be checked is how they drift.
 *
 * `prospectId` needs nothing here: `src/lib/quote-form.ts` sends the build's own
 * slug whenever a demo endpoint is in play.
 */
function formsFor(
  ctx: { email: string | undefined; endpoint: string },
  notes: string[],
): SiteConfig["forms"] {
  if (ctx.endpoint !== "") {
    notes.push(
      `forms: live against the shared demo Worker — leads arrive tagged with this slug and, ` +
        `with no PROSPECT_RECIPIENTS entry, land in our own inbox rather than the shop's`,
    );
    return {
      mode: "worker",
      workerEndpoint: ctx.endpoint,
      maxUploadMB: 10,
      acceptedFileTypes: UPLOAD_TYPES,
      turnstileSiteKey: "",
    };
  }

  if (ctx.email) {
    notes.push("forms: mailto — no demo endpoint is configured, so the form opens their inbox");
    return {
      mode: "mailto",
      workerEndpoint: "",
      maxUploadMB: 10,
      acceptedFileTypes: UPLOAD_TYPES,
      turnstileSiteKey: "",
    };
  }

  notes.push(
    "forms: DISABLED — no demo endpoint is configured and no email address was sourced, so the " +
      "contact page ships without a form rather than with one that goes nowhere. Set " +
      "DEMO_FORM_ENDPOINT before pitching this demo.",
  );
  return {
    mode: "disabled",
    workerEndpoint: "",
    maxUploadMB: 10,
    acceptedFileTypes: [],
    turnstileSiteKey: "",
  };
}

/** Asserts only what a source gave us: a trade and a place. */
function tagline(leadService: string, place: string): string {
  if (leadService && place) return `${leadService} in ${place}.`;
  if (leadService) return `${leadService}, done properly.`;
  if (place) return `Serving ${place}.`;
  return "Get in touch and tell us about the job.";
}

function aboutHeadline(name: string, place: string, foundedYear: number | undefined): string {
  if (foundedYear) return `${name} — working in ${place || "the trade"} since ${foundedYear}.`;
  return place ? `${name}, in ${place}.` : name;
}

function defaultDescription(name: string, leadService: string, place: string): string {
  const parts = [name];
  if (leadService) parts.push(`— ${leadService.toLowerCase()}`);
  if (place) parts.push(`in ${place}`);
  return `${parts.join(" ")}.`;
}

function heroFor(
  seed: SiteConfig | undefined,
  ctx: { name: string; leadService: string; place: string; photos: string[] },
): SiteConfig["hero"] {
  if (seed) return seed.hero;
  return {
    headline: ctx.leadService && ctx.place ? `${ctx.leadService} in ${ctx.place}` : ctx.name,
    subhead: ctx.place
      ? `${ctx.name} works out of ${ctx.place}. Tell us what you need and we will tell you what it takes.`
      : `Tell us what you need and we will tell you what it takes.`,
    ctaPrimary: { text: "Get in touch", href: "/contact" },
    ctaSecondary: { text: "See what we do", href: "/services" },
    image: ctx.photos[0] ?? STOCK.hero,
    imageAlt: `${ctx.name}`,
  };
}

/**
 * Four badges, every one of them a fact from a source.
 *
 * This is the section a generator is most tempted to fill with "Fast
 * turnaround" and "Quality guaranteed". Those are claims about how the
 * business operates, and we have not been told either. What is left — how long
 * they have traded, what their reviews say, that they publish hours, that a
 * human answers the phone — is thin, and true.
 */
function trustStrip(
  seed: SiteConfig | undefined,
  ctx: {
    foundedYear: number | undefined;
    rating: { rating: number; count: number } | undefined;
    hours: boolean;
    place: string;
  },
): SiteConfig["trustStrip"] {
  if (seed) return seed.trustStrip;

  const items: SiteConfig["trustStrip"] = [];
  if (ctx.foundedYear) items.push({ icon: "badge", label: `Trading since ${ctx.foundedYear}` });
  if (ctx.rating) {
    items.push({
      icon: "badge",
      label: `${ctx.rating.rating.toFixed(1)}★ from ${ctx.rating.count} Google review${ctx.rating.count === 1 ? "" : "s"}`,
    });
  }
  if (ctx.place) items.push({ icon: "truck", label: `Based in ${ctx.place}` });
  if (ctx.hours) items.push({ icon: "clock", label: "Published opening hours" });
  if (items.length === 0) items.push({ icon: "phone", label: "Call and speak to the shop" });
  return items;
}

/**
 * Testimonials, from their Google reviews, verbatim and attributed.
 *
 * Where there are no reviews to show, the template's own placeholder path is
 * used: one entry, `status: 'placeholder'`, whose text says plainly what it is.
 * That makes the template render its "these words are ours" banner, and the
 * marker gate refuses to let the build go indexable. What is never done is the
 * obvious alternative — writing a plausible customer quote.
 */
function testimonials(
  prospect: ProspectConfig,
  seed: SiteConfig | undefined,
  notes: string[],
): SiteConfig["testimonials"] {
  const reviews = valueOf(prospect.reviews) ?? [];
  if (reviews.length > 0) {
    notes.push(`${Math.min(reviews.length, 3)} Google review(s) shown verbatim with attribution`);
    return reviews.slice(0, 3).map((r) => ({
      quote: r.text,
      attribution: r.attribution,
      role: r.publishedAt ? `Google review, ${r.publishedAt}` : "Google review",
      rating: r.rating,
      sourceNote: `Verbatim Google review via the Places API${r.publishedAt ? `, published ${r.publishedAt}` : ""}. Shown with attribution; to be confirmed with the owner before go-live.`,
      status: "verified" as const,
    }));
  }

  if (seed) return seed.testimonials;

  notes.push("no reviews available — one self-describing placeholder testimonial was emitted");
  return [
    {
      quote: `Your customers' words go here. We will pull them from your Google reviews once you confirm the listing is yours.`,
      attribution: `${VERIFY_MARKER} — customer name`,
      role: "",
      rating: 5,
      sourceNote: "Not a review. Placeholder copy written by us, describing itself.",
      status: "placeholder" as const,
    },
  ];
}

function pageCopy(
  seed: SiteConfig | undefined,
  ctx: { name: string; place: string; services: ResolvedService[]; leadService: string },
): SiteConfig["pages"] {
  if (seed) return seed.pages;
  const list = ctx.services.map((s) => s.title.toLowerCase());
  const listed =
    list.length > 1 ? `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}` : (list[0] ?? "our work");
  return {
    home: {
      servicesHeading: "What we do",
      servicesIntro: `Whatever the job, you deal with the same people from quote to collection.`,
    },
    services: {
      title: "What we do",
      intro: `Everything below is done in-house. Tell us about the job and we will tell you what it takes.`,
      metaDescription: `${titleCase(listed)} from ${ctx.name}${ctx.place ? ` in ${ctx.place}` : ""}.`,
    },
    about: {
      eyebrow: [ctx.name, ctx.place].filter(Boolean).join(" · "),
      metaDescription: `About ${ctx.name}${ctx.place ? `, ${ctx.place}` : ""}.`,
    },
    contact: {
      title: "Tell us about the job",
      intro: "Send the details and we will come back to you with what it takes and what it costs.",
      metaDescription: `Contact ${ctx.name}${ctx.place ? ` in ${ctx.place}` : ""}.`,
    },
  };
}

/** True when every field the template needs came from somewhere real. */
export function isFullySourced(prospect: ProspectConfig): boolean {
  return (
    isKnown(prospect.businessName) &&
    isKnown(prospect.phone) &&
    isKnown(prospect.address) &&
    isKnown(prospect.services)
  );
}
