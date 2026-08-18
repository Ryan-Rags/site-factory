import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { dataDir, readLeads, slugify, type LeadRow } from "@site-factory/discover";

/**
 * Find a prospect's row in whatever lead CSVs are on disk.
 *
 * The discover package already writes leads keyed by a slug derived from the
 * business name, and that slug is the prospect id — so a prospect the pipeline
 * discovered arrives here with its niche, phone, current URL and (if Places
 * found it) its place id already known. This is the join, and it is
 * best-effort: a prospect with no CSV row is normal and simply contributes
 * nothing.
 *
 * Every `data/*.csv` is searched rather than `businesses.csv` alone, because
 * real runs write per-niche files (`leads-machine.csv`) and the caller should
 * not have to know which one a prospect came from.
 *
 * Note the known slug-collision hazard recorded in PLAN-pipeline.md's backlog:
 * a lead whose `name` column carries a legal suffix slugifies to a key that
 * matches nothing. That failure is silent there; here it surfaces as "no lead
 * row", and the run report says so.
 *
 * The `&` divergence is matched on BOTH spellings, through {@link slugsFor} —
 * the same read-path workaround {@link findPlaceId} already carries, and for
 * the same reason. Fourteen of the fifty records in the 2026-08-16 batch are
 * filed under the expanded spelling while `slugify` produces the dropped one,
 * so a single-spelling lookup misses exactly those fourteen — and a miss here
 * is indistinguishable from a business nobody discovered, which is what makes
 * it silent. Issue #57.
 */
export function findLeadRow(id: string): LeadRow | null {
  if (!existsSync(dataDir)) return null;
  const files = readdirSync(dataDir)
    .filter((f) => f.toLowerCase().endsWith(".csv"))
    .sort();

  for (const file of files) {
    let rows: LeadRow[];
    try {
      rows = readLeads(join(dataDir, file));
    } catch {
      continue;
    }
    const hit = rows.find((row) => slugsFor(row.name).includes(id));
    if (hit) return hit;
  }
  return null;
}

/**
 * The place id for a slug, from any CSV in `data/` that carries one.
 *
 * A second reader beside {@link findLeadRow}, and it exists because the two
 * shapes are genuinely different files. `readLeads` parses the *discovery*
 * schema (`name,phone,url,city,niche,place_id`); the shortlist sweep writes its
 * own (`placeId,name,niche,types,nicheMatch,town,…`), which `readLeads` cannot
 * read and which is what the 2026-08-16 batch of 50 came from. Teaching
 * `readLeads` both shapes would put a second schema inside the discovery
 * package for one column's sake.
 *
 * Reads the header, finds a place-id column and a name column under either
 * spelling, and matches on the slug. **No network call** — this is a file read,
 * which is the whole point: it backfills the identity of a record ingested
 * before `placeId` was a field without spending a Places call to re-learn
 * something we already wrote down.
 *
 * Returns null when nothing matches, which is not an error: a prospect nobody
 * discovered has no row anywhere.
 */
export function findPlaceId(id: string): { placeId: string; file: string } | null {
  if (!existsSync(dataDir)) return null;

  for (const file of readdirSync(dataDir).filter((f) => f.toLowerCase().endsWith(".csv")).sort()) {
    let text: string;
    try {
      text = readFileSync(join(dataDir, file), "utf8");
    } catch {
      continue;
    }
    const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
    const header = splitCsvLine(lines[0] ?? "").map((h) => h.trim().toLowerCase());
    const idAt = header.findIndex((h) => h === "placeid" || h === "place_id");
    const nameAt = header.indexOf("name");
    if (idAt === -1 || nameAt === -1) continue;

    for (const line of lines.slice(1)) {
      const cells = splitCsvLine(line);
      const name = cells[nameAt];
      const placeId = cells[idAt];
      if (name === undefined || !placeId) continue;
      if (slugsFor(name).includes(id)) return { placeId, file };
    }
  }
  return null;
}

/**
 * Every slug a business name could reasonably have been filed under.
 *
 * There are two slugification conventions in this repo and they disagree on one
 * character. `slugify` in `@site-factory/discover` drops `&`, so
 * `A&A Bergen Home Improvements` becomes `a-a-bergen-home-improvements`. The
 * 2026-08-16 batch of 50 expanded it, filing the same business as
 * `a-and-a-bergen-home-improvements` — and 14 of those 50 names carry an
 * ampersand, so a lookup on `slugify(name)` alone misses exactly those 14.
 *
 * Both are matched here rather than one being declared right. This function
 * *finds* a record; it does not name one. Renaming 14 directories to agree with
 * `slugify` would move 14 already-deployed `<slug>-preview.pages.dev` URLs that
 * are printed on a call sheet, which is a far worse outcome than accepting two
 * spellings on the read path. The divergence itself is recorded in
 * `docs/known-issues.md` #10 — this is the workaround, not the fix.
 *
 * Exported because both readers in this file need it. It was private while only
 * `findPlaceId` matched both spellings, which left `findLeadRow` — the reader
 * that supplies a prospect's niche, phone and current URL — missing the same
 * fourteen records the place-id backfill had just been taught to find. One
 * read path knowing something the other does not is how a workaround becomes a
 * second bug. Issue #57.
 */
export function slugsFor(name: string): string[] {
  const dropped = slugify(name);
  const expanded = slugify(name.replace(/&/g, " and "));
  return dropped === expanded ? [dropped] : [dropped, expanded];
}

/**
 * One CSV line into cells, honouring double quotes.
 *
 * Deliberately small rather than a dependency: the only thing read here is one
 * column of an identifier, and the sweep's own writer quotes fields containing
 * commas. A row this cannot parse yields a wrong-looking name, fails the slug
 * comparison, and contributes nothing — the failure mode is "no place id", not
 * "the wrong place id".
 */
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      cells.push(cell);
      cell = "";
    } else cell += ch;
  }
  cells.push(cell);
  return cells;
}
