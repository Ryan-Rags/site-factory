import { mkdirSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";

import { CallBudget, PLACES_KEY, resolvePlacesApiKey } from "@site-factory/discover";
import type { Browser } from "playwright";

import { generatePalette, presetFor } from "../niches.js";
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
  valueOf,
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
  /**
   * Things that went wrong quietly and must not stay quiet.
   *
   * Kept apart from `log` because the log is twenty-odd lines of ordinary
   * progress, and a degradation buried among them reads as ordinary progress.
   * Anything here is printed under its own banner in the run summary.
   */
  warnings: string[];
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
  const warnings: string[] = [];

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
    if (lead.place_id) {
      prospect.placeId = known(lead.place_id, "website", at, "lead CSV");
    }
  } else {
    log.push("lead row: none found in data/*.csv");
    /*
     * A miss is not necessarily wrong — a prospect nobody discovered has no
     * row — but it is indistinguishable from the known slug-collision hazard
     * in PLAN-pipeline.md's backlog, where a lead whose `name` column carries
     * a legal suffix ("… , Inc.") slugifies to a key that matches nothing. In
     * that case the row exists, is not found, and the demo is quietly built
     * without the niche, phone, current URL and place id it should have had.
     *
     * The two are not separable until matching is done on place id rather than
     * on a slugified name, which lands with discovery's CSV. Until then the
     * only honest thing is to say so loudly on every miss and let whoever is
     * running it check, rather than degrade in silence.
     */
    warnings.push(
      `no lead row matched "${opts.id}" in data/*.csv — the demo is being built without ` +
        `the niche, phone, current URL and place id a lead row supplies. If this prospect ` +
        `WAS discovered, this is the slug-collision hazard: a name column carrying a legal ` +
        `suffix slugifies to a key that matches nothing. Check data/*.csv before pitching. ` +
        `(placeId-first matching lands with discovery's CSV.)`,
    );
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
    const resolved = resolvePlacesApiKey();
    const apiKey = resolved?.key ?? "";
    if (!apiKey) {
      log.push(`places: no ${PLACES_KEY} — every Places-sourced field stays unavailable`);
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
          // The id the details actually came back for, which is the strongest
          // provenance available: it is the listing we read, not a listing a CSV
          // said we would read.
          if (result.placeId) prospect.placeId = known(result.placeId, "places", at, "Places details");
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
    prospect.websiteStatus = known(
      "none",
      "places",
      at,
      "no source supplied a website address for this business",
    );
    log.push("website: none known — no before shot and no site-sourced fields");
  } else {
    const result = await ingestWebsite(browser, currentUrl, at);
    prospect.websiteStatus = known(
      result.classification.status,
      "website",
      at,
      result.classification.reason,
    );

    if (result.classification.status !== "live") {
      // Deliberately not a failure. We learned something true and useful about
      // the prospect — arguably the most useful thing in the whole run, since
      // "your domain is parked and someone is selling it" is the opening line
      // of the call. It just is not content.
      log.push(
        `website: ${result.classification.status.toUpperCase()} — ${result.classification.reason}`,
      );
      log.push(
        `website: treated as NO WEBSITE — nothing on that page is a fact about ` +
          `${prospect.businessName.status === "known" ? prospect.businessName.value : opts.id}, ` +
          `so no services, name, phone, address or logo were taken from it`,
      );
    } else if (result.failure) {
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
    // `heritage` is chosen from evidence about this business, not from its
    // trade — see `presetFor`. Everything passed here is a sourced value or
    // `undefined`; there is no path by which an unavailable field becomes a
    // "legacy shop".
    const choice = presetFor(niche, {
      foundedYear: valueOf(prospect.foundedYear),
      legalName: valueOf(prospect.legalName),
      businessName: valueOf(prospect.businessName),
    });
    prospect.preset = known(choice.preset, "generated", at, choice.rationale);
    log.push(`preset: ${choice.preset} — ${choice.rationale}`);
  }

  return { prospect, log, warnings };
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
