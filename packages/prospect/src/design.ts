import { readFileSync } from "node:fs";
import { join } from "node:path";

import { designAccentPasses, onColorFor, type DesignPalette } from "./color.js";
import { templateDir } from "./paths.js";
import type { CopyResult } from "./copy.js";
import type { SiteConfig, SiteIconName } from "./site-config.js";
import { VERIFY_MARKER } from "./project.js";
import type { ProspectConfig, ThemePreset } from "./types.js";
import { valueOf } from "./types.js";

/**
 * The design block: `SiteConfig.design`.
 *
 * ## Why a generated demo needs one at all
 *
 * `src/pages/index.astro` branches on `site.design`. Present, the home page
 * renders through `DesignLayout` + `DesignHome` — a design family, with its
 * own header, footer, section order and palette. Absent, it renders the
 * original `BaseLayout` composition. All five hand-authored clients carry a
 * design block. A generated demo without one is therefore not a thinner
 * version of the same page; it is a structurally different page, and the
 * pipeline's own drift check has been saying so on every run.
 *
 * ## How this differs from `clients/design/`
 *
 * The four brief-based clients compose a small hand-written JSON brief with
 * their already-reviewed `SiteConfig` (`clients/design/derive.ts`). This does
 * the same composition with a *generated* brief, and emits the result inline
 * in the config that `SITE_CONFIG_FILE` points at. Nothing is written into
 * `packages/template/clients/design/` — those files are hand-authored, and
 * ingested third-party data does not go in the repo.
 *
 * ## The one rule
 *
 * Every string below is either read from the already-projected `SiteConfig`
 * (where it has already passed through `project.ts`'s sourcing rules), taken
 * from the copy engine (where it has passed the fabrication guard), or is
 * about the *page* rather than the business — "Where we work", "Questions we
 * get asked". Nothing here introduces a new claim. Where a section would need
 * one, the section is disabled instead.
 */

/* ------------------------------------------------------------- presets.json */

interface PresetFile {
  presets: {
    id: ThemePreset;
    palette: DesignPalette;
    accents: { id: string; label: string; accent: string; onAccent: string }[];
    fonts: { id: string; label: string }[];
  }[];
}

let cache: PresetFile | undefined;

/**
 * The presets, read from the template's own data file.
 *
 * Read rather than re-stated: the palettes, the curated accents and the font
 * pairing ids all live in `src/design/presets.json`, and a copy of them here
 * would be a second source of truth that drifts the first time a swatch is
 * retuned. `resolveTheme()` rejects an accent or font id the preset does not
 * offer, so a stale copy would fail the build — loudly, but a release late.
 */
export function loadPresets(file: string = join(templateDir, "src", "design", "presets.json")): PresetFile {
  if (cache === undefined) cache = JSON.parse(readFileSync(file, "utf8")) as PresetFile;
  return cache;
}

function presetById(preset: ThemePreset): PresetFile["presets"][number] {
  const found = loadPresets().presets.find((p) => p.id === preset);
  if (!found) {
    throw new Error(
      `presets.json has no preset "${preset}". The design families are the template's; ` +
        `if one was renamed, packages/prospect/src/niches.ts needs the same rename.`,
    );
  }
  return found;
}

/* ------------------------------------------------------------------ output */

/**
 * A structural mirror of `DesignConfig` in
 * `packages/template/src/types/design.ts`, for the same reason
 * `site-config.ts` mirrors `SiteConfig`: this package cannot import the
 * template's types without pulling the whole Astro program into its build.
 *
 * Unlike `SiteConfig`, this one is validated at the far end — `parseDesign()`
 * checks every field and fails the build with the path of the offender — so a
 * drift here surfaces as a build failure on the next demo run rather than a
 * silently wrong page.
 */
export interface DesignBlock {
  theme: {
    preset: ThemePreset;
    accent: string;
    fontPairing: string;
    brandAccent?: { id: string; label: string; accent: string; onAccent: string; sourceNote: string };
  };
  header: { nav: { label: string; href: string }[]; cta?: { text: string; href: string }; showPhone: boolean };
  order?: string[];
  sections: Record<string, unknown>;
}

export interface DesignResult {
  design: DesignBlock;
  /** Decisions worth printing in the run summary. */
  notes: string[];
}

interface Image {
  src: string;
  alt: string;
  width: number;
  height: number;
}

const image = (src: string, alt: string, width: number, height: number): Image => ({
  src,
  alt,
  width,
  height,
});

/**
 * Which sections a demo can carry, in the order they read best.
 *
 * `stats` leads for a client that has sourced numbers and is dropped entirely
 * for one that does not, rather than being filled — see `statsFor`.
 */
const SECTION_ORDER = ["stats", "services", "reviews", "serviceArea", "faq"] as const;

export interface DesignOptions {
  prospect: ProspectConfig;
  site: SiteConfig;
  copy: CopyResult;
  preset: ThemePreset;
}

export function buildDesign(opts: DesignOptions): DesignResult {
  const { prospect, site, copy, preset } = opts;
  const notes: string[] = [];
  const presetData = presetById(preset);

  const place = [site.business.address.locality, site.business.address.region]
    .filter(Boolean)
    .join(", ");

  /* -- theme ------------------------------------------------------------- */

  const theme: DesignBlock["theme"] = {
    preset,
    accent: presetData.accents[0]?.id ?? "",
    fontPairing: presetData.fonts[0]?.id ?? "",
  };

  const brand = prospect.brand.colors;
  if (prospect.brand.createdByUs) {
    // A palette we invented is not a brand accent. Offering it as one would
    // put our own colour in the customizer under the label "your brand".
    notes.push(
      `design: no brand accent offered — the palette is ours, not theirs (brand.createdByUs)`,
    );
  } else if (brand.status === "known") {
    const accent = brand.value.accent;
    const onAccent = onColorFor(accent);
    if (designAccentPasses(presetData.palette, accent, onAccent)) {
      theme.brandAccent = {
        id: "brand",
        label: "Your brand colour",
        accent,
        onAccent,
        sourceNote: `Extracted from ${brand.note ?? "the prospect's own brand assets"} (${brand.source}, ${brand.retrievedAt}). Confirm with the owner before go-live.`,
      };
      theme.accent = "brand";
      notes.push(`design: their own ${accent} is the accent — it clears the ${preset} contrast pairs`);
    } else {
      // Dropped, not nudged. A shifted colour is not their colour.
      notes.push(
        `design: their ${accent} was DROPPED as an accent — it fails the ${preset} family's ` +
          `contrast pairs, and a colour darkened until it passes is no longer theirs. ` +
          `The demo uses the preset's "${theme.accent}" swatch instead.`,
      );
    }
  }

  /* -- sections ---------------------------------------------------------- */

  const stats = statsFor(site, prospect, notes);
  const faq = faqFor(copy);
  const serviceArea = serviceAreaFor(site, copy);

  const enabled = new Set<string>(["services"]);
  if (stats.enabled) enabled.add("stats");
  if (site.testimonials.length > 0) enabled.add("reviews");
  if (serviceArea.enabled) enabled.add("serviceArea");
  if (faq.enabled) enabled.add("faq");

  const nav: { label: string; href: string }[] = [{ label: "What we do", href: "#services" }];
  if (enabled.has("reviews")) nav.push({ label: "Reviews", href: "#reviews" });
  if (enabled.has("serviceArea")) nav.push({ label: "Where we work", href: "#service-area" });
  if (enabled.has("faq")) nav.push({ label: "Questions", href: "#faq" });

  const design: DesignBlock = {
    theme,
    header: {
      nav,
      cta: { text: "Get in touch", href: "/contact" },
      showPhone: site.business.phone !== "",
    },
    order: SECTION_ORDER.filter((s) => enabled.has(s)),
    sections: {
      hero: {
        // `split` puts the copy above the image on mobile and beside it from
        // `lg`, so text never sits over a photograph and legibility is a
        // property of the palette alone. The safe default for a prospect
        // whose photographs we have not seen.
        variant: "split",
        ...(place ? { eyebrow: place } : {}),
        headline: site.hero.headline,
        subhead: site.hero.subhead,
        ctaPrimary: { text: site.hero.ctaPrimary.text, href: site.hero.ctaPrimary.href },
        ctaSecondary: { text: site.hero.ctaSecondary.text, href: site.hero.ctaSecondary.href },
        image: image(site.hero.image, site.hero.imageAlt, 1920, 1080),
        // Badges are the trust strip, which `project.ts` already builds from
        // sourced facts only. Nothing new is asserted by repeating them.
        ...(site.trustStrip.length > 0
          ? { badges: site.trustStrip.slice(0, 2).map((t) => t.label) }
          : {}),
        showPhone: site.business.phone !== "",
      },
      stickyCta: {
        enabled: site.business.phone !== "",
        callLabel: "Call",
        ...(site.business.hours ? { callNote: "See opening hours" } : {}),
        secondary: { text: "Contact", href: "/contact" },
      },
      services: {
        enabled: true,
        eyebrow: "What we do",
        heading: site.pages.home.servicesHeading,
        intro: site.pages.home.servicesIntro,
        variant: "cards",
        items: site.services.map((service) => ({
          title: service.title,
          body: service.oneLiner,
          icon: service.icon satisfies SiteIconName,
          image: image(service.image, service.imageAlt, 800, 600),
          href: `/services#${service.slug}`,
        })),
      },
      reviews: {
        enabled: site.testimonials.length > 0,
        eyebrow: "What customers say",
        heading: "In their own words",
        // `status` and `sourceNote` travel across unchanged, exactly as
        // `deriveDesign` carries them: a placeholder stays labelled a
        // placeholder, and `Reviews.astro` keeps refusing to mark it up as a
        // quotation in JSON-LD.
        sourceLabel: reviewSourceLabel(site),
        variant: "grid",
        items: site.testimonials.map((t) => ({
          author: t.attribution,
          rating: t.rating,
          quote: t.quote,
          ...(t.role ? { date: t.role } : {}),
          sourceNote: t.sourceNote,
          status: t.status,
        })),
      },
      stats,
      faq,
      gallery: {
        // Off, not filled. The four hand-authored briefs ship placeholder
        // galleries because a person decided to, per client. A generated demo
        // has no photographs of this shop's work and six stock SVGs under the
        // heading "Off the shop floor" is a claim about what they do.
        enabled: false,
        heading: "Our work",
        items: [],
      },
      serviceArea,
      beforeAfter: {
        // Same reasoning as the gallery, and stronger: a before/after pair is
        // a claim about one specific job.
        enabled: false,
        heading: "Before and after",
        before: image("/images/gallery-1.svg", "Placeholder", 1200, 900),
        after: image("/images/gallery-2.svg", "Placeholder", 1200, 900),
        beforeLabel: "Before",
        afterLabel: "After",
        verified: false,
      },
      openNow: {
        // Only with sourced hours. An "Open now" badge computed from hours we
        // guessed sends somebody to a closed unit.
        enabled: site.business.hours !== undefined && site.business.hours.length > 0,
        openLabel: "Open now",
        closedLabel: "Closed right now",
      },
      footer: {
        blurb: site.business.tagline,
        showHours: site.business.hours !== undefined && site.business.hours.length > 0,
        columns: [
          {
            heading: "The shop",
            links: nav.map((n) => ({ text: n.label, href: n.href })),
          },
        ],
        legal: `Certifications, insurance and licence numbers — ${VERIFY_MARKER}.`,
      },
    },
  };

  notes.push(
    `design: ${preset} family, sections ${design.order?.join(" → ") ?? "default order"}`,
  );

  return { design, notes };
}

/**
 * What the reviews section says about where its quotes came from.
 *
 * The distinction is the whole value of the line: Google reviews shown
 * verbatim are one thing, and our own placeholder text describing itself is
 * another. `project.ts` has already set `status` correctly; this reads it
 * rather than deciding again.
 */
function reviewSourceLabel(site: SiteConfig): string {
  const placeholder = site.testimonials.every((t) => t.status === "placeholder");
  return placeholder
    ? `Placeholder text written by us, not customer reviews — ${VERIFY_MARKER}`
    : "Verbatim Google reviews, shown with attribution";
}

/**
 * Numbers, or no stats section.
 *
 * This is the section a generator is most tempted to fill — "15 years",
 * "500 jobs", "24-hour turnaround" — and every one of those is a claim about a
 * business nobody has spoken to. Only two numbers are ever available to an
 * ingest run without inventing something: how long they have traded, if a
 * source told us, and how many reviews their public listing carries. Neither,
 * and the section is off.
 */
function statsFor(
  site: SiteConfig,
  prospect: ProspectConfig,
  notes: string[],
): { enabled: boolean; heading?: string; items: { value: number; label: string; note?: string; suffix?: string }[] } {
  const items: { value: number; label: string; note?: string; suffix?: string }[] = [];

  const founded = site.business.foundedYear;
  if (founded !== undefined) {
    items.push({
      value: founded,
      label: "Trading since",
      note: "Stated by a source we can point to",
    });
  }

  const rating = valueOf(prospect.ratingSummary);
  if (rating !== undefined && rating.count > 0) {
    items.push({
      value: rating.count,
      label: `Google review${rating.count === 1 ? "" : "s"}`,
      note: `Averaging ${rating.rating.toFixed(1)} at the time of the demo`,
    });
  }

  if (items.length === 0) {
    notes.push(
      "design: no stats section — nothing about this business is countable from a source, " +
        "and a stats band is where invented numbers go",
    );
    return { enabled: false, items: [] };
  }
  return { enabled: true, heading: "The shop in numbers", items };
}

function faqFor(copy: CopyResult): {
  enabled: boolean;
  eyebrow?: string;
  heading: string;
  items: { q: string; a: string }[];
} {
  const items = copy.faq ?? [];
  if (items.length === 0) {
    return { enabled: false, heading: "Questions we get asked", items: [] };
  }
  return {
    enabled: true,
    eyebrow: "Before you call",
    heading: "Questions we get asked",
    items: items.map((f) => ({ q: f.question, a: f.answer })),
  };
}

function serviceAreaFor(
  site: SiteConfig,
  copy: CopyResult,
): {
  enabled: boolean;
  eyebrow?: string;
  heading: string;
  intro?: string;
  areas: string[];
  note?: string;
} {
  const areas = copy.serviceAreas;
  if (areas !== undefined) {
    return {
      enabled: true,
      eyebrow: "Where we work",
      heading: areas.heading,
      intro: areas.intro,
      areas: areas.towns.map((t) => t.town),
      ...(areas.widerLine !== undefined ? { note: areas.widerLine } : {}),
    };
  }

  // No copy pack, or no towns it could write about. The business block's own
  // service area is still a sourced list, so the section can name the places
  // without the town-by-town prose — and an empty `areas` list would fall back
  // to exactly that list anyway.
  const listed = site.business.serviceArea;
  if (listed.length === 0) return { enabled: false, heading: "Where we work", areas: [] };
  return {
    enabled: true,
    eyebrow: "Where we work",
    heading: "Where we work",
    areas: listed,
    note: `The area we understand the shop to cover — ${VERIFY_MARKER}.`,
  };
}
