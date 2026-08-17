/**
 * Rebuild `data/call-sheet.csv` from the roster and the run manifests.
 *
 * The call sheet is the one artifact of a demo batch a person actually uses: it
 * is what Ryan reads down while making the calls. It is *derived* — the roster
 * says who is on the list and each `prospects/<slug>/demo.json` says what
 * happened to their demo — and it was previously assembled by hand at the end of
 * a run. That is why the 2026-08-16 batch left a call sheet with 17 blank
 * `demoUrl` cells and no way to refresh them: the sheet was an output nobody
 * could regenerate.
 *
 * Two columns are authoritative here and nowhere else:
 *
 *   demoUrl  — from the manifest's `liveUrl`, so a demo that did not deploy is
 *              blank rather than carrying a URL that 404s in front of a call.
 *   NOTES    — machine-written flags an operator should see before dialling.
 *
 * Everything else is copied from the roster unchanged. Blank stays the marker for
 * unmeasured: no cell is ever filled with a zero, a guess or an "n/a".
 *
 * The output is gitignored, like every other file under `data/`. It holds names,
 * phone numbers and place ids for real businesses.
 *
 * Usage:
 *   node scripts/batch/call-sheet.mjs                     # data/roster-50.json
 *   node scripts/batch/call-sheet.mjs data/roster-50.json
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = process.cwd();
const rosterFile = join(repoRoot, process.argv[2] ?? 'data/roster-50.json');
const outFile = join(repoRoot, 'data/call-sheet.csv');

if (!existsSync(rosterFile)) {
  console.error(
    `${rosterFile} does not exist. The roster is the batch's own record of who is on the ` +
      `list; without it there is no call sheet to rebuild.`,
  );
  process.exit(1);
}

const COLUMNS = [
  'rank',
  'placeId',
  'slug',
  'name',
  'phone',
  'town',
  'niche',
  'copyPack',
  'score',
  'rating',
  'reviews',
  'websiteStatus',
  'currentSite',
  'demoUrl',
  'email',
  'NOTES',
];

/** RFC 4180: quote a cell only when it needs it, so the file stays readable. */
const cell = (value) => {
  const text = value === undefined || value === null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const roster = JSON.parse(readFileSync(rosterFile, 'utf8'));
const rows = [];
let deployed = 0;
let missing = 0;

for (const entry of roster) {
  const slug = entry.slug;
  const manifestFile = join(repoRoot, 'prospects', slug, 'demo.json');
  const notes = [];

  let manifest = null;
  if (existsSync(manifestFile)) {
    try {
      manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
    } catch (err) {
      notes.push(`manifest unreadable: ${err.message}`);
    }
  } else {
    notes.push('never run: no prospects/<slug>/demo.json');
  }

  const demoUrl = manifest?.liveUrl ?? '';
  if (demoUrl === '') {
    missing += 1;
    if (manifest) notes.push('NOT DEPLOYED - do not read a URL out on this call');
  } else {
    deployed += 1;
  }

  // Flags worth seeing before dialling, not a summary of the manifest.
  if (manifest && manifest.verified === false) {
    notes.push('deploy not verified: home or services did not answer 200');
  }
  if (manifest?.brandCreatedByUs) {
    notes.push('palette is ours, not theirs - do not call it their brand');
  }
  for (const warning of manifest?.warnings ?? []) notes.push(warning);

  rows.push({
    rank: entry.n,
    placeId: entry.placeId,
    slug,
    name: entry.name,
    phone: entry.phone,
    town: entry.town,
    niche: entry.niche,
    copyPack: entry.copyPack,
    score: entry.score,
    rating: entry.rating,
    reviews: entry.reviewCount,
    websiteStatus: entry.websiteStatus,
    currentSite: entry.website,
    demoUrl,
    // Never invented: the harvest that would fill this is not built, and an
    // empty cell is the honest state. See PR #54's Brief item 6.
    email: entry.email ?? '',
    NOTES: notes.join('; '),
  });
}

/*
 * ASCII only in the cells this script writes.
 *
 * The call sheet is opened in a spreadsheet, and Excel reads a BOM-less CSV in
 * the system codepage — so an em dash or a middle dot arrives as mojibake in the
 * one artifact a person actually reads down while dialling. Roster values pass
 * through as they are (a business's own name is theirs, accents included); only
 * the notes this script composes are held to ASCII.
 */
const csv = [COLUMNS.join(','), ...rows.map((row) => COLUMNS.map((c) => cell(row[c])).join(','))];
writeFileSync(outFile, `${csv.join('\n')}\n`, 'utf8');

console.log(`wrote ${outFile}`);
console.log(`  ${rows.length} row(s): ${deployed} with a live demo URL, ${missing} without`);
