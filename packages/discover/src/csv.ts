import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { LEAD_COLUMNS, emptyLead, type LeadColumn, type LeadRow } from "./types.js";
import { slugify } from "./slug.js";
import { normalizeUrl } from "./url.js";

const BYTE_ORDER_MARK = 0xfeff;

/** RFC 4180 parse. Handles quoted fields, escaped quotes and CRLF. */
export function parseCsv(text: string): string[][] {
  const source = text.charCodeAt(0) === BYTE_ORDER_MARK ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let i = 0;

  while (i < source.length) {
    const c = source[i] as string;
    if (quoted) {
      if (c === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      quoted = true;
      i += 1;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (c === "\r") {
      i += 1;
      continue;
    }
    if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 1;
      continue;
    }
    field += c;
    i += 1;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function encodeField(value: string): string {
  return /[",\r\n]/.test(value) || value !== value.trim()
    ? `"${value.replace(/"/g, '""')}"`
    : value;
}

export function serializeLeads(rows: readonly LeadRow[]): string {
  const lines = [LEAD_COLUMNS.join(",")];
  for (const row of rows) {
    lines.push(LEAD_COLUMNS.map((c) => encodeField(row[c])).join(","));
  }
  return `${lines.join("\n")}\n`;
}

/**
 * Read a lead CSV, mapping by header name rather than position so a file
 * written against the pre-Q2 seven-column header still loads; absent columns
 * come back empty rather than undefined.
 */
export function readLeads(file: string): LeadRow[] {
  if (!existsSync(file)) return [];
  const rows = parseCsv(readFileSync(file, "utf8"));
  const header = rows[0];
  if (!header) return [];

  const known = new Set<string>(LEAD_COLUMNS);
  const index = new Map<LeadColumn, number>();
  header.forEach((name, i) => {
    const key = name.trim();
    if (known.has(key)) index.set(key as LeadColumn, i);
  });

  const out: LeadRow[] = [];
  for (const cells of rows.slice(1)) {
    if (cells.every((c) => c.trim() === "")) continue;
    const row = emptyLead();
    for (const [column, i] of index) row[column] = cells[i]?.trim() ?? "";
    out.push(row);
  }
  return out;
}

export function writeLeads(file: string, rows: readonly LeadRow[]): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, serializeLeads(rows), "utf8");
}

/**
 * Identity for dedupe: the Places id when we have one, otherwise a normalized
 * URL, otherwise name plus address. The fallbacks exist for rows written
 * before `place_id` and for no-website rows, which have no URL at all.
 */
export function leadKey(row: LeadRow): string {
  const placeId = row.place_id.trim();
  if (placeId) return `id:${placeId}`;
  const url = normalizeUrl(row.url);
  if (url) return `url:${url}`;
  return `name:${slugify(row.name)}|${slugify(row.address || row.city)}`;
}

export interface AppendResult {
  added: number;
  duplicates: number;
  total: number;
}

/** Append-only write, skipping rows already present under {@link leadKey}. */
export function appendLeads(file: string, incoming: readonly LeadRow[]): AppendResult {
  const existing = readLeads(file);
  const seen = new Set(existing.map(leadKey));
  const merged = [...existing];
  let added = 0;
  let duplicates = 0;

  for (const row of incoming) {
    const key = leadKey(row);
    if (seen.has(key)) {
      duplicates += 1;
      continue;
    }
    seen.add(key);
    merged.push(row);
    added += 1;
  }

  writeLeads(file, merged);
  return { added, duplicates, total: merged.length };
}
