import { existsSync, readdirSync } from "node:fs";
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
    const hit = rows.find((row) => slugify(row.name) === id);
    if (hit) return hit;
  }
  return null;
}
