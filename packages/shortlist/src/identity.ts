import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { dataDir, readLeads, slugify, writeLeads, type LeadRow } from "@site-factory/discover";

import type { IdentityMatch, SweepResult } from "./types.js";

/**
 * Who is this, and do we already know them?
 *
 * ## The interim this closes
 *
 * `PLAN-pipeline.md`'s backlog records a slug-collision hazard: a lead whose
 * `name` column carries a legal suffix ("K-H Machine Works Inc") slugifies to a
 * key that matches nothing, and the failure is silent.
 * `packages/prospect/src/ingest/leads.ts` points at the same entry and notes
 * that a majority of registered US businesses carry such a suffix — so the
 * collision class is the norm, not an edge case.
 *
 * A Places id is not derived from a name. It is assigned by Google, stable
 * across renames and punctuation, and it either matches or it does not. Making
 * it the primary key removes the derivation, and with it the whole class.
 *
 * The slug match stays as a **fallback** for rows written before place ids
 * existed — and it is loud. That is the backlog entry's own decision: "the
 * warning is what turns a silent correct-looking failure into a loud one, and
 * that is the signal actually missing today."
 */

/** The sidecar. Client slug -> Places id, or "" when not yet resolved. */
export type ClientPlaceIds = Record<string, string>;

export function readClientPlaceIds(file: string): ClientPlaceIds {
  if (!existsSync(file)) return {};
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: ClientPlaceIds = {};
    for (const [slug, id] of Object.entries(parsed as Record<string, unknown>)) {
      if (slug.startsWith("_")) continue; // documentation keys
      if (typeof id === "string") out[slug] = id;
    }
    return out;
  } catch {
    return {};
  }
}

interface KnownRecord {
  placeId: string;
  name: string;
  /** Where it came from, for the match message. */
  source: string;
}

/** Every record we might already hold: lead CSVs plus the client sidecar. */
export function loadKnownRecords(opts: {
  dir?: string | undefined;
  clientPlaceIds?: ClientPlaceIds | undefined;
  /** Excluded so the output file does not match against itself. */
  exclude?: readonly string[] | undefined;
}): KnownRecord[] {
  const dir = opts.dir ?? dataDir;
  const exclude = new Set((opts.exclude ?? []).map((f) => f.toLowerCase()));
  const out: KnownRecord[] = [];

  if (existsSync(dir)) {
    for (const file of readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".csv")).sort()) {
      if (exclude.has(file.toLowerCase())) continue;
      let rows: LeadRow[];
      try {
        rows = readLeads(join(dir, file));
      } catch {
        continue;
      }
      for (const row of rows) {
        out.push({ placeId: row.place_id.trim(), name: row.name, source: `data/${file}` });
      }
    }
  }

  for (const [slug, placeId] of Object.entries(opts.clientPlaceIds ?? {})) {
    out.push({ placeId: placeId.trim(), name: slug, source: "client registry" });
  }

  return out;
}

/**
 * Resolve one swept business against what we already hold.
 *
 * Order is place id first, silently and exactly; then the slug fallback, which
 * always carries a warning; then nothing, which is the normal case for a
 * county sweep and is not a warning at all.
 */
export function resolveIdentity(
  result: SweepResult,
  known: readonly KnownRecord[],
): IdentityMatch {
  const placeId = result.placeId.trim();

  if (placeId !== "") {
    const hit = known.find((k) => k.placeId !== "" && k.placeId === placeId);
    if (hit) {
      return { how: "placeId", matchedIn: hit.source, matchedName: hit.name, warning: "" };
    }
  }

  const slug = slugify(result.name);
  if (slug !== "") {
    // Only rows with NO place id are eligible for the fallback. A row that has
    // one and did not match above is a different business, and matching it on
    // a name would be exactly the silent-wrong-answer this replaces.
    const hit = known.find((k) => k.placeId === "" && slugify(k.name) === slug);
    if (hit) {
      return {
        how: "slug-fallback",
        matchedIn: hit.source,
        matchedName: hit.name,
        warning:
          `WARNING: "${result.name}" (${placeId}) matched "${hit.name}" in ${hit.source} ` +
          `by NAME SLUG ("${slug}"), not by place id, because that record has no place id. ` +
          "A slug match is a guess: a legal suffix, a punctuation change or a second business " +
          "with the same name all break it silently. Run with --backfill-place-ids to write " +
          "this id into that row and make the match exact.",
      };
    }
  }

  return { how: "none", matchedIn: "", matchedName: "", warning: "" };
}

export interface BackfillPlan {
  file: string;
  rowName: string;
  placeId: string;
  matchedName: string;
}

export interface BackfillOutcome {
  planned: BackfillPlan[];
  written: number;
  /** Files that would change, for the diff summary. */
  files: string[];
}

/**
 * Write discovered place ids into the lead rows that matched by slug.
 *
 * Opt-in, and it prints what it will do before it does it: this rewrites a
 * shared-schema file that other packages read. Only the `place_id` cell of a
 * matched row is touched — nothing else, ever — and only rows whose `place_id`
 * is currently empty are eligible, so it can never overwrite a known-good id
 * with a guess.
 */
export function planBackfill(
  assessments: readonly {
    result: SweepResult;
    identity: { how: string; matchedIn: string; matchedName: string };
  }[],
): BackfillOutcome {
  const planned: BackfillPlan[] = [];

  for (const a of assessments) {
    if (a.identity.how !== "slug-fallback") continue;
    if (!a.identity.matchedIn.startsWith("data/")) continue;
    planned.push({
      file: a.identity.matchedIn.slice("data/".length),
      rowName: a.identity.matchedName,
      placeId: a.result.placeId,
      matchedName: a.result.name,
    });
  }

  return { planned, written: 0, files: [...new Set(planned.map((p) => p.file))] };
}

export function applyBackfill(plan: BackfillOutcome, opts: { dir?: string | undefined } = {}): BackfillOutcome {
  const dir = opts.dir ?? dataDir;
  let written = 0;

  for (const file of plan.files) {
    const path = join(dir, file);
    if (!existsSync(path)) continue;
    const rows = readLeads(path);
    let touched = false;

    for (const item of plan.planned.filter((p) => p.file === file)) {
      const row = rows.find((r) => r.name === item.rowName && r.place_id.trim() === "");
      if (!row) continue;
      row.place_id = item.placeId;
      touched = true;
      written += 1;
    }

    if (touched) writeLeads(path, rows);
  }

  return { ...plan, written };
}

export function renderBackfillPlan(plan: BackfillOutcome): string {
  if (plan.planned.length === 0) {
    return "backfill: nothing to do — no row matched by slug fallback.";
  }
  const lines = [
    `backfill: ${plan.planned.length} row(s) across ${plan.files.length} file(s) would gain a place_id.`,
    "  Only the place_id cell of each row below is written. Nothing else changes.",
  ];
  for (const p of plan.planned) {
    lines.push(`    data/${p.file}: "${p.rowName}"  place_id = ${p.placeId}  (Places: "${p.matchedName}")`);
  }
  return lines.join("\n");
}
