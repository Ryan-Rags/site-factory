/**
 * The lead schema.
 *
 * The first seven columns are the original scaffold schema in their original
 * order; the last five were appended (Q2) so rows written before the change
 * stay readable. Every value is text — the CSV is the source of record, and
 * widening a column must never silently reinterpret an old row.
 */
export const LEAD_COLUMNS = [
  "name",
  "url",
  "niche",
  "city",
  "phone",
  "source",
  "notes",
  "place_id",
  "rating",
  "review_count",
  "address",
  "discovered_at",
] as const;

export type LeadColumn = (typeof LEAD_COLUMNS)[number];

/** One row of `data/businesses.csv` or `data/no-site.csv`. */
export type LeadRow = Record<LeadColumn, string>;

/** A row with every column present and empty. */
export function emptyLead(): LeadRow {
  const row = {} as LeadRow;
  for (const column of LEAD_COLUMNS) row[column] = "";
  return row;
}
