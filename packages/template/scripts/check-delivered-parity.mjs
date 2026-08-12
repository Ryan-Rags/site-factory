/**
 * Diff two `dist/` trees and say exactly what moved, region by region.
 *
 * The standing acceptance on design work is that an existing client's site
 * renders unchanged: whatever we add to the *panel*, the eight sites already
 * built from these configs must come out the same. "Same" needs a definition
 * sharper than "the file differs", because several things legitimately differ
 * between two builds of a pitch page:
 *
 * - Astro stamps a random `uid` on every React island, so `/contact` differs
 *   between two builds of identical source;
 * - the customizer panel is the thing being worked on;
 * - so is the switchable matrix, and the `data-scheme` attribute that selects
 *   within it — neither of which exists on a delivered page.
 *
 * So each page is compared in regions, and which regions are *gated* depends
 * on what kind of page it is:
 *
 *   html     the `<html>` tag's own attributes
 *   root     the `:root { … }` token block — the client's own resolved
 *            colours, fonts and metrics. This is the client's site.
 *   matrix   the `:root[data-theme=…] { … }` blocks — every *other*
 *            combination the panel can switch to. Pitch builds only.
 *   head     `<head>` with scripts and styles elided — meta, links, JSON-LD
 *   content  `<body>` up to the customizer toggle — every word on the page
 *   panel    the customizer markup and its script
 *
 * A **delivered** page (no panel either side) is gated on everything: it is a
 * client's site and nothing here may touch it.
 *
 * A **pitch** page is gated on `root`, `head` and `content` — the site itself
 * — while `html`, `matrix` and `panel` are the panel's own machinery and are
 * expected to move. A pitch build whose `root` block shifted would mean the
 * page a prospect opens no longer looks the way it did, which is a regression
 * whatever the panel gained.
 *
 * Usage:
 *   node scripts/check-delivered-parity.mjs <baseline-dist> [<candidate-dist>]
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, '..');

const [baselineArg, candidateArg] = process.argv.slice(2);
if (!baselineArg) {
  console.error('Usage: node scripts/check-delivered-parity.mjs <baseline-dist> [<candidate-dist>]');
  process.exit(1);
}
const BASE = baselineArg;
const CAND = candidateArg ?? join(pkgRoot, 'dist');

const PANEL_MARK = '<button type="button" class="d-cust__toggle"';

const hash = (s) => createHash('md5').update(s).digest('hex').slice(0, 10);

/** Astro's per-build island id. Not a difference in what the page says. */
const deIsland = (html) =>
  html.replace(/uid="[^"]*"/g, 'uid=""').replace(/prefix="[^"]*"/g, 'prefix=""');

function regions(html) {
  const clean = deIsland(html);
  const headStart = clean.indexOf('<head');
  const headEnd = clean.indexOf('</head>');
  const bodyStart = clean.indexOf('<body');
  const panelAt = clean.indexOf(PANEL_MARK);
  /*
   * `<style is:global>`, not `<style>` — the attribute survives into the built
   * page, and a regex without it silently matches nothing and reports parity.
   *
   * `--d-base:` with the colon, not bare `--d-base`: the whole of `design.css`
   * is inlined into this page and it is full of `var(--d-base)` references, so
   * the looser test swept the entire stylesheet in and reported it as
   * switchable matrix on builds that have no matrix at all.
   */
  const styles = [...clean.matchAll(/<style[^>]*>([^]*?)<\/style>/g)]
    .map((m) => m[1])
    .filter((s) => s.includes('--d-base:'))
    .join('\n');

  // The delivered block is the one `:root {` with no attribute selector; the
  // rest of that stylesheet is the switchable matrix.
  const rootBlock = /(^|\n):root \{[^]*?\n\}/.exec(styles)?.[0] ?? '';
  const matrix = styles.replace(rootBlock, '');

  return {
    html: /<html[^>]*>/.exec(clean)?.[0] ?? '',
    root: rootBlock,
    matrix,
    // From `<head`, not from the top: the `<html>` tag is its own region, and
    // folding it in here would report a pitch-only attribute as a site change.
    head: clean
      .slice(headStart < 0 ? 0 : headStart, headEnd < 0 ? 0 : headEnd)
      .replace(/<script[^>]*>[^]*?<\/script>/g, '<script/>')
      .replace(/<style[^>]*>[^]*?<\/style>/g, '<style/>'),
    content: clean.slice(bodyStart < 0 ? 0 : bodyStart, panelAt > bodyStart ? panelAt : clean.length),
    panel: panelAt < 0 ? '' : clean.slice(panelAt),
  };
}

function walk(dir, root = dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, root, out);
    else if (entry.endsWith('.html')) out.push(relative(root, full).split('\\').join('/'));
  }
  return out;
}

/** What a page is answerable for, by kind. */
/*
 * `matrix` is gated on delivered pages by *absence*: a delivered build must
 * carry no switchable matrix at all, and the emptiness check below would fire
 * on it, so it is checked separately rather than being listed here.
 */
const GATED_DELIVERED = ['html', 'root', 'head', 'content'];
const GATED_PITCH = ['root', 'head', 'content'];
/** A page still rendering through `BaseLayout`: no design tokens to compare. */
const GATED_LEGACY = ['html', 'head', 'content'];

const pages = walk(BASE);
let regressions = 0;
let pitchMoved = 0;
let identical = 0;

for (const page of pages) {
  let a, b;
  try {
    a = readFileSync(join(BASE, page), 'utf8');
    b = readFileSync(join(CAND, page), 'utf8');
  } catch {
    console.error(`  ✗ ${page}: missing from the candidate build`);
    regressions++;
    continue;
  }
  const ra = regions(a);
  const rb = regions(b);

  /*
   * Refuse to report parity on regions that came out empty.
   *
   * Every gated region here is something every page has: an `<html>` tag, a
   * `:root` token block, a `<head>`, a body. An empty one means the extraction
   * missed — which it did, once, because the built markup says
   * `<style is:global>` and the regex said `<style>`. Two empty strings hash
   * equal and the whole check went green while comparing nothing at all.
   */
  const isPitch = ra.panel !== '' || rb.panel !== '';
  /*
   * Not every page is a design page. `/about`, `/services` and `/contact`
   * still render through the original `BaseLayout` for every client, and carry
   * no design token block at all — so requiring a `:root` block there would
   * fail 35 pages that are perfectly fine.
   */
  const isDesign = ra.root !== '' || ra.matrix !== '' || rb.root !== '' || rb.matrix !== '';
  const gated = isDesign ? (isPitch ? GATED_PITCH : GATED_DELIVERED) : GATED_LEGACY;
  const hollow = gated.filter((k) => ra[k].trim() === '' || rb[k].trim() === '');
  if (hollow.length > 0) {
    regressions++;
    console.error(
      `  ✗ ${page}: could not extract ${hollow.join(', ')} — the comparison is not ` +
        `meaningful, so it is a failure rather than a pass`,
    );
    continue;
  }

  // A delivered page must carry no matrix. If one appears, the panel has
  // leaked into a client's site, which is what `SITE_DELIVERED` exists to stop.
  if (!isPitch && rb.matrix.trim() !== '') {
    regressions++;
    console.error(`  ✗ ${page} (delivered): a switchable matrix appeared in a delivered build`);
    continue;
  }

  const moved = gated.filter((k) => hash(ra[k]) !== hash(rb[k]));
  if (moved.length > 0) {
    regressions++;
    console.error(
      `  ✗ ${page} (${isPitch ? 'pitch' : 'delivered'}): ${moved.join(', ')} changed — ` +
        `that is the client's site, not the panel`,
    );
    continue;
  }

  const all = Object.keys(ra);
  if (all.some((k) => hash(ra[k]) !== hash(rb[k]))) pitchMoved++;
  else identical++;
}

console.log(
  `\n${pages.length} pages compared: ${identical} byte-identical, ` +
    `${pitchMoved} changed only in panel machinery, ${regressions} regressed.`,
);

if (regressions > 0) {
  console.error(
    `\n✗ ${regressions} page(s) changed what they render. The acceptance is that an\n` +
      `  existing client's site is unaffected by panel work — see the note above.\n`,
  );
  process.exit(1);
}
console.log("✓ No client site changed what it renders.");
