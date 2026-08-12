/**
 * Allowances for a site the demo pipeline generated, read from its ingested
 * record (`prospects/<id>/prospect.json`).
 *
 * The hand-authored records in `packages/copy/src/prospects/` are not the only
 * kind of record. `packages/prospect` ingests a discovered lead into JSON with
 * the same discipline — every field is either `{status:'known', value, source}`
 * or `{status:'unavailable', reason}` — and generates a site from it. Those
 * sites need checking *more* than the hand-authored five, not less: their copy
 * is machine-written from third-party data nobody has read.
 *
 * So this is the same function as `allowancesFor` in `@site-factory/copy`,
 * against the other record shape. A field that ingest marked `unavailable`
 * contributes nothing, which is the point: if no source supplied a founding
 * year, a year in the built page is a fabrication and should fail.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** `{status:'known', value}` → value; anything else → undefined. */
function known(field) {
  if (field === null || typeof field !== 'object') return undefined;
  if (field.status !== 'known') return undefined;
  return field.value;
}

/**
 * The allowance strings, or `null` when this slug has no ingested record —
 * which is how the caller tells "generated site" from "no record anywhere".
 */
export function ingestedAllowances(prospectsDir, slug) {
  const file = join(prospectsDir, slug, 'prospect.json');
  if (!existsSync(file)) return null;

  let record;
  try {
    record = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`${file} could not be read as JSON: ${err.message}`);
  }

  const out = [];
  const push = (v) => {
    if (v !== undefined && v !== null && v !== '') out.push(String(v));
  };

  // Identity. A phone number is a sourced fact that happens to contain four
  // digits in a row — the same reason the hand-authored path allows it.
  push(known(record.businessName));
  push(known(record.legalName));
  push(known(record.phone));
  push(known(record.email));
  push(known(record.foundedYear));
  push(known(record.niche));

  const address = known(record.address);
  if (address) for (const part of Object.values(address)) push(part);

  for (const town of known(record.serviceArea) ?? []) push(town);

  for (const service of known(record.services) ?? []) {
    push(service.title);
    push(service.detail);
  }

  // Hours are a sourced fact, so the numerals in an hours sentence are too.
  for (const h of known(record.hours) ?? []) {
    if (h.opens !== undefined && h.closes !== undefined) out.push(`${h.opens} ${h.closes}`);
  }

  // A rating and a review count are numerals the listing published.
  const rating = known(record.ratingSummary);
  if (rating) {
    push(rating.rating);
    push(rating.count);
  }

  // The business's own published words, quoted back to them.
  for (const review of known(record.reviews) ?? []) push(review.text ?? review);

  return out;
}
