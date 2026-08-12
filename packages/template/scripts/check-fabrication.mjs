/**
 * Refuses to let an unsourced claim reach the built bytes.
 *
 * `check-markers.mjs` catches the honest gap — a value we knew we did not
 * have, marked so it could not be missed. This catches the dangerous one: the
 * plausible sentence. "Serving Bergen County since 1985", "fully licensed and
 * insured", "same-day turnaround" — lines that read so naturally nobody
 * re-reads them, and that assert things about a real business that nobody
 * ever checked. A marker is conspicuous by design. A fabrication is
 * conspicuous by nothing.
 *
 * WHY THIS EXISTS WHEN THE GENERATOR ALREADY GUARDS.
 * `@site-factory/copy` runs the same claim patterns over every string it
 * produces, at generation time, and throws. That covers generated copy. It
 * does not cover a string typed straight into a client config by hand — and
 * the config is exactly where somebody in a hurry would type one. This check
 * runs on `dist/`, so it sees the page as the client's customers will,
 * whatever route the words took to get there.
 *
 * WHAT IT DOES NOT COVER, STATED PLAINLY:
 *
 *   - Testimonial quotes (`<blockquote>`). Their provenance is governed by a
 *     different regime — `status: 'placeholder'`, a `sourceNote` recording
 *     where the sentiment came from, and a marker on the attribution — and
 *     they are paraphrases by construction, so the claim patterns would fire
 *     on every one. Excluded, and counted, so the exclusion is visible.
 *   - JSON-LD. Structured data is built from typed config fields, not prose,
 *     and scanning serialised JSON produces noise rather than findings.
 *   - Anything the claim patterns do not know how to recognise. This is a
 *     net with a known mesh size, not a proof.
 *
 * Usage:
 *   node scripts/check-fabrication.mjs              # the SITE_CLIENT build
 *   node scripts/check-fabrication.mjs <slug>
 *   node scripts/check-fabrication.mjs --all
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { allowancesFor, prospectFor, PROSPECT_SLUGS, VERIFY_MARKER } from '@site-factory/copy';

import { resolveBaseSlug } from './lib/base-slug.mjs';
import { ingestedAllowances } from './lib/ingested-allowances.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const distRoot = join(here, '..', 'dist');
const clientsDir = join(here, '..', 'clients');
// Ingested prospects live at the repo root, outside the template package and
// outside git — see clients/index.ts on why generated data never lands in
// `clients/`.
const prospectsDir = join(here, '..', '..', '..', 'prospects');

/**
 * The same patterns the engine's guard uses, restated here rather than
 * imported.
 *
 * Deliberate duplication. This script's job is to disagree with the engine
 * when the engine is wrong, and a check that shares its subject's definition
 * of the thing being checked cannot do that. If the two drift, the drift is
 * the finding.
 */
const CLAIM_PATTERNS = [
  { name: 'a year', re: /\b(?:1[89]\d{2}|20\d{2})\b/g },
  {
    name: 'a span of time',
    re: /\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)[\s-]+(?:years?|decades?|generations?)\b/gi,
  },
  {
    name: 'a credential',
    re: /\b(?:ISO|ASME|AWS|NADCAP|OSHA|AS9100|ITAR|certified|certification|accredited|licen[cs]ed|licen[cs]e|bonded|insured|insurance|registrar)\b/gi,
  },
  {
    name: 'an ownership or status claim',
    re: /\b(?:family[\s-]?(?:owned|run)|woman[\s-]?owned|women[\s-]?owned|veteran[\s-]?owned|minority[\s-]?owned|WOSB|MBE|WBE)\b/gi,
  },
  {
    name: 'a superlative or ranking',
    re: /\b(?:best|#\s?1|number\s+one|top[\s-]rated|highest[\s-]rated|cheapest|largest|biggest|leading|premier|award[\s-]winning|voted|most\s+trusted)\b/gi,
  },
  {
    name: 'a guarantee',
    re: /\b(?:guarantee[ds]?|warrant(?:y|ies|ed)|money[\s-]back|no[\s-]risk)\b/gi,
  },
  {
    name: 'a price claim',
    re: /\b(?:free|no\s+charge|no\s+cost|\$\d|\d+\s*%\s*off|discount|affordable|cheap)\b/gi,
  },
  {
    name: 'a measured capability',
    re: /(?:±\s?[\d.]+|\b\d+\s*(?:hours?|hrs?|days?|weeks?)\b|\b24\/7\b|\bsame[\s-]day\b|\bnext[\s-]day\b|\bsame[\s-]week\b)/gi,
  },
];

/**
 * The text a reader sees, as one block per element rather than one string per
 * page.
 *
 * Per-element matters more than it sounds. Flattening a page to a single
 * string lets a pattern match across a boundary between two unrelated
 * elements: the postal code `07675` in the address block, immediately
 * followed by the `Hours` heading, reads as "07675 Hours" and trips the
 * measured-capability pattern. Nobody wrote that phrase and no reader will
 * ever see it. Keeping elements apart removes a whole class of finding that
 * would otherwise have to be suppressed one string at a time — and every
 * suppression is a place a real claim could later hide.
 */
function visibleBlocks(html) {
  const quotesRemoved = (html.match(/<blockquote[\s\S]*?<\/blockquote>/gi) ?? []).length;
  return {
    quotesRemoved,
    blocks: html
      .replace(/<blockquote[\s\S]*?<\/blockquote>/gi, '\n')
      .replace(/<script[\s\S]*?<\/script>/gi, '\n')
      .replace(/<style[\s\S]*?<\/style>/gi, '\n')
      // Every tag becomes a block boundary, not a space.
      .replace(/<[^>]+>/g, '\n')
      // Entities the template emits in prose. Decoded so `&amp;` does not
      // split a word and hide a claim inside it.
      .replace(/&(?:amp|#38);/g, '&')
      .replace(/&(?:quot|ldquo|rdquo|#34);/g, '"')
      .replace(/&(?:apos|lsquo|rsquo|#39);/g, "'")
      .replace(/&(?:nbsp|#160);/g, ' ')
      .replace(/&(?:mdash|#8212);/g, '—')
      .replace(/&(?:copy|#169);/g, '©')
      .split('\n')
      .map((line) => line.replace(/[ \t]+/g, ' ').trim())
      .filter((line) => line !== ''),
  };
}

function checkClient(slug) {
  const dir = join(distRoot, slug);

  // A design-family comparison build renders the base client's facts, so it is
  // checked against the base client's record. See scripts/lib/base-slug.mjs.
  const factsFrom = resolveBaseSlug(clientsDir, slug);

  // Two kinds of record, checked identically.
  //
  // The five hand-authored clients have a TypeScript record in
  // `@site-factory/copy`. A prospect the demo pipeline discovered has an
  // ingested JSON one under `prospects/<id>/`, written by `packages/prospect`
  // with the same known/unavailable discipline. Only the reader differs — a
  // generated site is checked against its own sources exactly like a
  // hand-authored one, which matters more there, not less: nobody has read
  // that copy before it deploys.
  //
  // A slug can have BOTH, and then the two records UNION rather than one
  // replacing the other. Running the demo pipeline on a slug that is also a
  // hand-authored client used to swap that client's reviewed copy pack for the
  // thinner ingested record — for every later build, not just the demo one —
  // and a sourced sentence then read as a fabrication. `prospects/` is
  // gitignored, so that state is invisible in git and machine-local: the same
  // commit green on one machine, red on another. Both records are sources; a
  // source does not stop being one because another turned up beside it.
  // Demonstrated in docs/evidence/beta-2-fabrication-union/.
  let allowed;
  try {
    const ingested = ingestedAllowances(prospectsDir, factsFrom);
    // No ingested record: the copy pack is the only source, and `prospectFor`
    // throws the right message below when there is not one of those either.
    const curated = ingested !== null && !PROSPECT_SLUGS.includes(factsFrom)
      ? []
      : allowancesFor(prospectFor(factsFrom));
    allowed = [
      ...(ingested ?? []),
      ...curated,
      // The footer's copyright year. It comes off the build clock, it is a
      // fact about this build rather than a claim about the business, and it
      // is the one four-digit number on every page that means nothing about
      // how long the shop has existed.
      String(new Date().getFullYear()),
    ].map((a) => a.toLowerCase());
  } catch (error) {
    console.error(
      `✗ ${slug}: no prospect record, so nothing here can be checked against a source.\n` +
        `  ${error instanceof Error ? error.message : String(error)}\n` +
        `  A generated prospect should have prospects/${slug}/prospect.json; a\n` +
        `  hand-authored client should have a record in @site-factory/copy.`,
    );
    return false;
  }

  const files = walk(dir).filter((f) => f.endsWith('.html'));
  if (files.length === 0) {
    console.error(`✗ ${slug}: no HTML in dist/${slug} — nothing to check. Did the build run?`);
    return false;
  }

  const findings = [];
  let excludedQuotes = 0;

  for (const file of files) {
    const { blocks, quotesRemoved } = visibleBlocks(readFileSync(file, 'utf8'));
    excludedQuotes += quotesRemoved;

    for (const block of blocks) {
      // A claim in a block that also carries the marker is not a claim — the
      // marker is doing the work and `check-markers.mjs` stops it going live.
      // The window is this block, not the page: a marker three paragraphs
      // away excuses nothing.
      if (block.includes(VERIFY_MARKER)) continue;

      for (const { name, re } of CLAIM_PATTERNS) {
        re.lastIndex = 0;
        for (const m of block.matchAll(re)) {
          const claim = m[0];
          const needle = claim.toLowerCase();
          if (allowed.some((a) => a.includes(needle))) continue;
          findings.push({ file: relative(distRoot, file), claim, kind: name, context: block });
        }
      }
    }
  }

  if (findings.length === 0) {
    const note = excludedQuotes > 0 ? ` (${excludedQuotes} testimonial quote(s) excluded)` : '';
    console.log(`✓ ${slug}: every claim in the built pages traces to a sourced fact${note}.`);
    return true;
  }

  console.error(`\n✗ ${slug}: ${findings.length} claim(s) with nothing behind them.\n`);
  for (const f of findings.slice(0, 25)) {
    console.error(`    ${f.file}\n      "${f.claim}" reads as ${f.kind}\n      …${f.context}…\n`);
  }
  if (findings.length > 25) console.error(`    … and ${findings.length - 25} more`);
  console.error(
    `  Each one is a sentence this business would be making a claim with.\n` +
      `  Fix by adding the fact to packages/copy/src/prospects/${slug}.ts with its\n` +
      `  source, by marking it, or by rewriting the line. Do not delete this check.\n`,
  );
  return false;
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const requested = process.argv[2];
let slugs;
try {
  if (requested === '--all') {
    slugs = readdirSync(distRoot).filter((d) => statSync(join(distRoot, d)).isDirectory());
  } else {
    slugs = [requested || process.env.SITE_CLIENT || 'kh-machine-works'];
  }
} catch {
  console.error('No dist/ directory. Run a build first.');
  process.exit(1);
}

const results = slugs.map(checkClient);
process.exit(results.every(Boolean) ? 0 : 1);
