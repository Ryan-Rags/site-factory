import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { parseCsv } from "@site-factory/discover";

import { SCORED_COLUMNS, type ScoredColumn, type ScoredRow } from "./types.js";

/**
 * `data/prospects-scored.csv` — the ranked call list.
 *
 * ## The one rule
 *
 * This module owns eleven columns and **nothing else**. A column in the file
 * that is not one of ours belongs to Ryan: a call date, a note, an outcome,
 * added by hand in a spreadsheet. Those are preserved byte-for-byte across
 * every re-run, in their original positions relative to each other.
 *
 * That is what makes the file safe to work in. A pipeline that rewrites its
 * output wholesale trains the operator never to touch it, and a call list
 * nobody annotates is not a call list.
 */

const BYTE_ORDER_MARK = 0xfeff;

function encodeField(value: string): string {
  return /[",\r\n]/.test(value) || value !== value.trim()
    ? `"${value.replace(/"/g, '""')}"`
    : value;
}

export interface ExistingFile {
  header: string[];
  /** Every row, keyed by placeId, holding ALL columns including human ones. */
  rows: Map<string, Record<string, string>>;
  /** Rows with no placeId — kept, but never merged into. */
  orphans: Record<string, string>[];
  humanColumns: string[];
}

export function readScored(file: string): ExistingFile {
  const empty: ExistingFile = { header: [], rows: new Map(), orphans: [], humanColumns: [] };
  if (!existsSync(file)) return empty;

  const text = readFileSync(file, "utf8");
  const source = text.charCodeAt(0) === BYTE_ORDER_MARK ? text.slice(1) : text;
  const parsed = parseCsv(source);
  const header = parsed[0];
  if (!header) return empty;

  const machine = new Set<string>(SCORED_COLUMNS);
  const humanColumns = header.map((h) => h.trim()).filter((h) => h !== "" && !machine.has(h));

  const idIndex = header.findIndex((h) => h.trim() === "placeId");
  const rows = new Map<string, Record<string, string>>();
  const orphans: Record<string, string>[] = [];

  for (const cells of parsed.slice(1)) {
    if (cells.every((c) => c.trim() === "")) continue;
    const row: Record<string, string> = {};
    header.forEach((name, i) => {
      const key = name.trim();
      if (key !== "") row[key] = cells[i] ?? "";
    });
    const id = idIndex >= 0 ? (cells[idIndex] ?? "").trim() : "";
    if (id === "") orphans.push(row);
    else rows.set(id, row);
  }

  return { header: header.map((h) => h.trim()), rows, orphans, humanColumns };
}

export interface MergeOutcome {
  text: string;
  added: number;
  refreshed: number;
  /** Rows in the file that this run did not see. Kept as they were. */
  untouched: number;
  humanColumns: string[];
  orphans: number;
}

/**
 * Merge this run's rows into whatever is already on disk.
 *
 * - A business the run scored **refreshes** its machine columns and keeps
 *   every human column exactly as it was.
 * - A business already in the file that this run did not see is left entirely
 *   alone. A narrower `--niche` run must not silently delete the rest of the
 *   list.
 * - `status` is written `NEW` only for rows that were not already present. An
 *   existing row keeps whatever `status` says, because by then it is Ryan's
 *   column in spirit — the pipeline has no business resetting a lead marked
 *   CALLED back to NEW.
 */
export function mergeScored(existing: ExistingFile, incoming: readonly ScoredRow[]): MergeOutcome {
  const humanColumns = existing.humanColumns;
  const columns: string[] = [...SCORED_COLUMNS, ...humanColumns];

  const merged = new Map<string, Record<string, string>>();
  for (const [id, row] of existing.rows) merged.set(id, { ...row });

  let added = 0;
  let refreshed = 0;

  for (const row of incoming) {
    const id = row.placeId.trim();
    if (id === "") continue;
    const prior = merged.get(id);
    if (prior === undefined) {
      merged.set(id, { ...row });
      added += 1;
      continue;
    }
    // Machine columns refresh; everything else on the prior row survives.
    const next: Record<string, string> = { ...prior };
    for (const column of SCORED_COLUMNS) {
      if (column === "status") continue; // never reset a human's tracking state
      next[column] = row[column];
    }
    merged.set(id, next);
    refreshed += 1;
  }

  // Everything in the file that this run neither added nor refreshed.
  const untouched = merged.size - added - refreshed;

  const lines = [columns.map(encodeField).join(",")];
  const emit = (row: Record<string, string>): void => {
    lines.push(columns.map((c) => encodeField(row[c] ?? "")).join(","));
  };

  // Highest score first — the file IS the call list, so its order is the order
  // to work it in. Rows the run did not see keep whatever score they had.
  const ordered = [...merged.values()].sort(
    (a, b) => Number(b["score"] ?? 0) - Number(a["score"] ?? 0),
  );
  for (const row of ordered) emit(row);
  for (const row of existing.orphans) emit(row);

  return {
    text: `${lines.join("\n")}\n`,
    added,
    refreshed,
    untouched,
    humanColumns,
    orphans: existing.orphans.length,
  };
}

export function writeScored(file: string, text: string): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text, "utf8");
}

export function serializeScored(rows: readonly ScoredRow[]): string {
  const lines = [SCORED_COLUMNS.join(",")];
  for (const row of rows) {
    lines.push(SCORED_COLUMNS.map((c: ScoredColumn) => encodeField(row[c])).join(","));
  }
  return `${lines.join("\n")}\n`;
}
