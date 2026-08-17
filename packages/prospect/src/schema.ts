import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import {
  type Field,
  type ProspectConfig,
  isKnown,
  unavailable,
} from "./types.js";

/** Today, as `YYYY-MM-DD`. Every ingested field is stamped with it. */
export function today(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * A prospect with every field explicitly unavailable.
 *
 * Ingestion fills fields in; whatever no source could supply stays
 * `unavailable` with the reason it started life with, which is what the run
 * report prints. An empty prospect is therefore a complete, honest document
 * rather than a half-initialised one.
 */
export function emptyProspect(id: string, generatedAt: string = new Date().toISOString()): ProspectConfig {
  const none = (what: string): Field<never> => unavailable(`no source supplied ${what}`);
  return {
    id,
    generatedAt,
    placeId: none("a Google Places id"),
    businessName: none("a business name"),
    legalName: none("a legal name"),
    niche: none("a niche"),
    phone: none("a phone number"),
    email: none("an email address"),
    address: none("an address"),
    serviceArea: none("a service area"),
    hours: none("opening hours"),
    services: none("a service list"),
    foundedYear: none("a founding year"),
    currentSiteUrl: none("a current website"),
    websiteStatus: none("a website classification — the site was never checked"),
    ratingSummary: none("a rating"),
    reviews: none("reviews"),
    photos: none("photos"),
    brand: {
      colors: none("brand colours"),
      logoPath: none("a logo"),
      createdByUs: false,
    },
    preset: none("a design preset"),
    conflicts: [],
  };
}

export function writeProspect(file: string, prospect: ProspectConfig): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(prospect, null, 2)}\n`, "utf8");
}

/**
 * Read a record, tolerating one written before a field existed.
 *
 * `prospects/` is gitignored working data with no migration story: the 50
 * records from the 2026-08-16 batch were written before `placeId` was a field,
 * and every one of them is re-used with `--skip-ingest` rather than re-ingested,
 * because re-ingesting under the Places call freeze would blank the reviews,
 * rating and photos they already carry.
 *
 * So a missing field is filled with the same `unavailable` the empty record
 * would have had, rather than left `undefined` for `valueOf` to trip over. The
 * absent-field list is deliberately explicit and short: a general "merge over
 * emptyProspect" would also paper over a record that is genuinely corrupt.
 */
export function readProspect(file: string): ProspectConfig {
  const parsed = JSON.parse(readFileSync(file, "utf8")) as ProspectConfig;
  if (parsed.placeId === undefined) {
    parsed.placeId = unavailable(
      "this record predates the placeId field, and no source has been re-read since",
    );
  }
  return parsed;
}

/** Every field that no source could fill, for the run report. */
export function unavailableFields(prospect: ProspectConfig): { field: string; reason: string }[] {
  const out: { field: string; reason: string }[] = [];
  for (const [key, value] of Object.entries(prospect)) {
    if (key === "brand" || key === "conflicts" || key === "id" || key === "generatedAt") continue;
    const field = value as Field<unknown>;
    if (!isKnown(field)) out.push({ field: key, reason: field.reason });
  }
  if (!isKnown(prospect.brand.colors)) {
    out.push({ field: "brand.colors", reason: prospect.brand.colors.reason });
  }
  if (!isKnown(prospect.brand.logoPath)) {
    out.push({ field: "brand.logoPath", reason: prospect.brand.logoPath.reason });
  }
  return out;
}
