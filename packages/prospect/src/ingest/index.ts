import { mkdirSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";

import { CallBudget, loadEnv } from "@site-factory/discover";
import type { Browser } from "playwright";

import { generatePalette, styleForNiche } from "../niches.js";
import { extractPalette } from "../palette.js";
import { prospectPaths } from "../paths.js";
import { emptyProspect, today } from "../schema.js";
import type { SiteConfig } from "../site-config.js";
import {
  type ProspectConfig,
  type ProspectPhoto,
  type ThemePreset,
  known,
  unavailable,
} from "../types.js";
import { readFolder } from "./folder.js";
import { findLeadRow } from "./leads.js";
import { applyContribution, type Contribution } from "./merge.js";
import { ingestPlaces } from "./places.js";
import { loadClientConfig } from "./seed.js";
import { ingestWebsite } from "./website.js";

/**
 * Fill one prospect config from every source we have.
 *
 * Sources run cheapest-and-most-trusted first, and each one only ever fills
 * gaps or is recorded as a conflict — see `merge.ts`. Any source can be
 * absent: no lead row, no client config, no API key, no website and no dropped
 * assets is a legitimate (if thin) run that produces an honest prospect file
 * full of `unavailable`, not an error.
 */

export interface IngestOptions {
  id: string;
  /** Overrides the niche from the lead row. */
  niche?: string | undefined;
  /** Overrides the design family the niche would have chosen. */
  preset?: ThemePreset | undefined;
  /** Skip the Places calls even when a key is present. */
  skipPlaces?: boolean;
  /** Skip reading their current website. */
  skipWebsite?: boolean;
}

export interface IngestResult {
  prospect: ProspectConfig;
  /** Human-readable account of what each source did, for the run report. */
  log: string[];
}

/** The five hand-authored configs are the top-precedence `manual` source. */
function seedContribution(site: SiteConfig, at: string): Contribution {
  const from = "hand-authored client config (provenance recorded in it)";
  const contribution: Contribution = {
    businessName: known(site.business.name, "manual", at, from),
    legalName: known(site.business.legalName, "manual", at, from),
    phone: known(site.business.phone, "manual", at, from),
    address: known(site.business.address, "manual", at, from),
    serviceArea: known(site.business.serviceArea, "manual", at, from),
    services: known(
      site.services.map((s) => ({ slug: s.slug, title: s.title, oneLiner: s.oneLiner })),
      "manual",
      at,
      from,
    ),
  };

  if (site.business.email) contribution.email = known(site.business.email, "manual", at, from);
  if (site.business.hours) contribution.hours = known(site.business.hours, "manual", at, from);
  if (site.business.foundedYear !== undefined) {
    contribution.foundedYear = known(site.business.foundedYear, "manual", at, from);
  }
  // `example.invalid` is the placeholder these configs use for a business with
  // no known website. Treating it as a real URL would send the crawler at a
  // domain reserved for exactly this purpose.
  if (site.seo.siteUrl && !site.seo.siteUrl.includes("example.invalid")) {
    contribution.currentSiteUrl = known(site.seo.siteUrl, "manual", at, from);
  }
  return contribution;
}

export async function ingestProspect(
  browser: Browser,
  opts: IngestOptions,
): Promise<IngestResult> {
  const at = today();
  const paths = prospectPaths(opts.id);
  const prospect = emptyProspect(opts.id);
  const log: string[] = [];

  // ---- lead row (niche, place id, current URL) --------------------------
  const lead = findLeadRow(opts.id);
  let niche = opts.niche ?? lead?.niche ?? undefined;
  if (lead) {
    log.push(`lead row: found (niche "${lead.niche || "—"}", place_id ${lead.place_id || "none"})`);
    const contribution: Contribution = {};
    if (lead.name) contribution.businessName = known(lead.name, "website", at, "lead CSV");
    if (lead.phone) contribution.phone = known(lead.phone, "website", at, "lead CSV");
    if (lead.url) contribution.currentSiteUrl = known(lead.url, "website", at, "lead CSV");
    // The city column is the one piece of location we can trust without an
    // address: it was the label the discovery run was made under. It is not
    // enough for an `address` (which needs a region to be worth rendering),
    // but it is exactly what the service-area line wants.
    if (lead.city) contribution.serviceArea = known([lead.city], "website", at, "lead CSV city");
    applyContribution(prospect, contribution);
  } else {
    log.push("lead row: none found in data/*.csv");
  }
  if (niche) prospect.niche = known(niche, "manual", at, opts.niche ? "--niche" : "lead CSV");

  // ---- hand-authored client config --------------------------------------
  const seed = await loadClientConfig(opts.id);
  if (seed) {
    applyContribution(prospect, seedContribution(seed, at));
    prospect.brand.colors = known(seed.theme.colors, "manual", at, "hand-authored client config");
    log.push(`client config: seeded from packages/template/clients/${opts.id}.config.ts`);
    if (!niche) {
      // The config has no niche field; its service titles are the next best
      // signal and are the business's own words.
      niche = seed.services.map((s) => s.title).join(" ");
      prospect.niche = known(niche, "manual", at, "inferred from the client config's service titles");
    }
  } else {
    log.push("client config: none (new prospect)");
  }

  // ---- dropped assets ----------------------------------------------------
  const folder = readFolder(paths.assetsDir);
  if (folder.logo) {
    prospect.brand.logoPath = known(folder.logo, "folder", at, "prospects/<id>/assets/");
  }
  if (folder.photos.length > 0) {
    applyContribution(prospect, {
      photos: known(folder.photos, "folder", at, "prospects/<id>/assets/"),
    });
  }
  log.push(
    `assets folder: ${folder.logo ? "logo" : "no logo"}, ${folder.photos.length} photo(s)` +
      (folder.ignored.length > 0 ? `, ignored ${folder.ignored.join(", ")}` : ""),
  );

  // ---- Places ------------------------------------------------------------
  if (opts.skipPlaces) {
    log.push("places: skipped (--skip-places)");
  } else {
    const apiKey = (process.env["GOOGLE_MAPS_API_KEY"] ?? loadEnv()["GOOGLE_MAPS_API_KEY"] ?? "").trim();
    if (!apiKey) {
      log.push("places: no GOOGLE_MAPS_API_KEY — every Places-sourced field stays unavailable");
      const reason = "no Places API key was configured, so no listing data was fetched";
      prospect.reviews = unavailable(reason);
      prospect.photos = prospect.photos.status === "known" ? prospect.photos : unavailable(reason);
      prospect.ratingSummary = unavailable(reason);
    } else {
      const name = prospect.businessName.status === "known" ? prospect.businessName.value : opts.id;
      const address = prospect.address.status === "known"
        ? `${prospect.address.value.locality}, ${prospect.address.value.region}`
        : "";
      try {
        const result = await ingestPlaces({
          placeId: lead?.place_id || undefined,
          query: [name, address].filter(Boolean).join(", "),
          apiKey,
          budget: new CallBudget(),
          retrievedAt: at,
        });
        if (result.failure) {
          log.push(`places: ${result.failure}`);
        } else {
          applyContribution(prospect, result.contribution);
          log.push(`places: details fetched for ${result.placeId}`);
        }
      } catch (err) {
        log.push(`places: failed — ${(err as Error).message}`);
      }
    }
  }

  // ---- their current website --------------------------------------------
  let siteLogoFile: string | undefined;
  const currentUrl =
    prospect.currentSiteUrl.status === "known" ? prospect.currentSiteUrl.value : undefined;
  if (opts.skipWebsite) {
    log.push("website: skipped (--skip-website)");
  } else if (!currentUrl) {
    log.push("website: none known — no before shot and no site-sourced fields");
  } else {
    const result = await ingestWebsite(browser, currentUrl, at);
    if (result.failure) {
      log.push(`website: ${result.failure}`);
    } else {
      applyContribution(prospect, result.contribution);
      log.push(`website: read ${result.visited.length} page(s) at 1/sec — ${result.visited.join(", ")}`);
      if (result.logoUrl) {
        siteLogoFile = await downloadLogo(result.logoUrl, paths.dir);
        if (siteLogoFile) log.push(`website: logo downloaded for palette extraction only`);
      }
    }
  }

  // ---- brand palette ------------------------------------------------------
  await resolvePalette(browser, prospect, { at, folderLogo: folder.logo, folderPhotos: folder.photos, siteLogoFile, niche, log });

  // ---- design family ------------------------------------------------------
  if (opts.preset) {
    prospect.preset = known(opts.preset, "manual", at, "--preset");
  } else if (prospect.preset.status !== "known") {
    const style = styleForNiche(niche);
    prospect.preset = known(style.preset, "generated", at, `chosen from the niche: ${style.rationale}`);
  }

  return { prospect, log };
}

/**
 * Decide the two brand colours, in the order that respects the business most:
 * their logo, then their photos, then a palette of ours.
 */
async function resolvePalette(
  browser: Browser,
  prospect: ProspectConfig,
  ctx: {
    at: string;
    folderLogo: string | undefined;
    folderPhotos: ProspectPhoto[];
    siteLogoFile: string | undefined;
    niche: string | undefined;
    log: string[];
  },
): Promise<void> {
  // A hand-authored config's colours were chosen deliberately; do not re-derive.
  if (prospect.brand.colors.status === "known" && prospect.brand.colors.source === "manual") {
    ctx.log.push("palette: kept the hand-authored client config's colours");
    return;
  }

  const candidates: { file: string; note: string }[] = [];
  if (ctx.folderLogo) candidates.push({ file: ctx.folderLogo, note: "their logo" });
  if (ctx.siteLogoFile) candidates.push({ file: ctx.siteLogoFile, note: "the logo on their site" });
  for (const photo of ctx.folderPhotos) {
    if (photo.file) candidates.push({ file: photo.file, note: "a photo they supplied" });
  }

  for (const candidate of candidates) {
    const extracted = await extractPalette(browser, candidate.file);
    if (!extracted) continue;
    prospect.brand.colors = known(extracted.colors, "folder", ctx.at, `${candidate.note}: ${extracted.note}`);
    prospect.brand.createdByUs = false;
    ctx.log.push(
      `palette: extracted ${extracted.colors.primary}/${extracted.colors.accent} from ${candidate.note}` +
        (extracted.adjusted ? " (darkened for WCAG AA)" : ""),
    );
    return;
  }

  const generated = generatePalette(prospect.id, ctx.niche);
  prospect.brand.colors = known(
    generated.colors,
    "generated",
    ctx.at,
    `brand created by us — no usable brand assets. ${generated.rationale}`,
  );
  prospect.brand.createdByUs = true;
  ctx.log.push(
    `palette: BRAND CREATED BY US — ${generated.colors.primary}/${generated.colors.accent} ` +
      `(per-niche pairing, hue shifted ${generated.hueShift}°)`,
  );
}

/**
 * Fetch the logo from their site — for colour extraction only.
 *
 * It is written under `prospects/<id>/derived/` and never copied into the
 * built site. Reading someone's logo to work out their brand colours is a
 * different act from republishing it on a site we built, and only the first
 * one happens without asking.
 */
async function downloadLogo(url: string, prospectDir: string): Promise<string | undefined> {
  try {
    const res = await fetch(url);
    if (!res.ok) return undefined;
    const buffer = Buffer.from(await res.arrayBuffer());
    const ext = extname(new URL(url).pathname) || ".png";
    const dir = join(prospectDir, "derived");
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `logo-from-site${ext}`);
    writeFileSync(file, buffer);
    return file;
  } catch {
    return undefined;
  }
}
