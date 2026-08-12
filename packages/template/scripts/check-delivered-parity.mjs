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

/**
 * The one delta a delivered `:root` block is allowed to have, and only once.
 *
 * `designTokens()` now emits `color-scheme` for the resolved scheme, so every
 * delivered design page gains exactly one line that was not there before. That
 * is a deliberate rendering change — a dark page without it draws a light
 * scrollbar — and it is the single agreed exemption from the standing
 * byte-identical acceptance.
 *
 * It is written as a *named* exemption rather than by re-baselining the
 * comparison, because a fresh baseline would absorb whatever else happened to
 * land in the same build and would keep absorbing it afterwards. The rule here
 * is deliberately narrow, and the narrowness is the point:
 *
 *   - the baseline must have had NO `color-scheme` in the block (this is the
 *     one-way migration, not a licence for the value to drift afterwards);
 *   - the candidate must add exactly one, valued `light` or `dark`;
 *   - with that single line removed, the two blocks must be identical.
 *
 * So a client's tone silently flipping, or any other token moving alongside,
 * still fails. Returns the scheme name when the exemption applies, else null.
 */
const SCHEME_LINE = /\n[ \t]*color-scheme:\s*(light|dark);/;

function onlyColorSchemeAdded(before, after) {
  if (/color-scheme:/.test(before)) return null;
  const found = SCHEME_LINE.exec(after);
  if (!found) return null;
  // Exactly one: a block carrying two declarations is not this migration.
  if (SCHEME_LINE.test(after.replace(SCHEME_LINE, ''))) return null;
  return after.replace(SCHEME_LINE, '') === before ? found[1] : null;
}

/**
 * The two named `head` exemptions from the trust-seo stream.
 *
 * Same discipline as `onlyColorSchemeAdded` above, and for the same reason: a
 * re-baselined comparison would absorb whatever else landed in the same build
 * and would go on absorbing it. Each is written to the delta that was actually
 * measured — nothing wider — and each is announced by name, because an
 * allowance nobody can see is indistinguishable from a gate that stopped
 * working.
 *
 * They compose in order: the four tags are added on every client, and on four
 * named clients the card URL moves as well.
 *
 * Note that neither covers structured data: `regions()` elides every `<script>`
 * from the head, `application/ld+json` included, so the JSON-LD corrections in
 * this same stream are invisible here and need no exemption. Worth knowing in
 * both directions — this gate would not have caught them either.
 */

/** The four tags `Seo.astro` gained. Completing the card, not changing it. */
const ADDED_CARD_TAGS = [
  /<meta property="og:image:width" content="\d+">/,
  /<meta property="og:image:height" content="\d+">/,
  /<meta property="og:image:alt" content="[^"]*">/,
  /<meta name="twitter:image:alt" content="[^"]*">/,
];

/**
 * Exemption 1 — `cardMetadataAdded`.
 *
 * The baseline must have carried none of the four; the candidate must add
 * exactly one of each; and with those four removed the two heads must be
 * identical. A fifth tag, a second copy, or any other head movement still fails.
 */
function onlyCardMetadataAdded(before, after) {
  let rest = after;
  for (const re of ADDED_CARD_TAGS) {
    if (re.test(before)) return null; // Not the one-way migration.
    if (!re.test(rest)) return null;
    rest = rest.replace(re, '');
    if (re.test(rest)) return null; // Exactly one.
  }
  return rest;
}

/**
 * Exemption 2 — `brandCardSwapped`.
 *
 * These four clients pointed `og:image` at `/images/og.svg`, a file whose own
 * aria-label reads "Social share image placeholder", while their generated
 * 1200×630 card sat unused in `public/og/`. No major unfurler renders SVG, so
 * those links unfurled blank. The value moves to the generated card, both tags
 * move together, and nothing else may move with them.
 *
 * Scoped to these four slugs by name: a fifth client taking this exemption
 * would mean a card swap nobody reviewed.
 */
const CARD_SWAP_CLIENTS = new Set([
  'american-machine-specialty',
  'industrial-machine-corp',
  'kh-machine-works',
  'kts-machine-shop',
]);

function onlyBrandCardSwapped(before, after, slug) {
  if (!CARD_SWAP_CLIENTS.has(slug)) return null;
  const placeholder = '/images/og.svg';
  const card = `/og/${slug}.png`;

  const tags = [
    '<meta property="og:image" content="',
    '<meta name="twitter:image" content="',
  ];
  let rest = after;
  for (const open of tags) {
    const pattern = new RegExp(`${open.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^"]*)">`);
    const b = pattern.exec(before);
    const a = pattern.exec(rest);
    if (!b || !a) return null;
    if (!b[1].endsWith(placeholder)) return null;
    if (!a[1].endsWith(card)) return null;
    rest = rest.replace(a[0], b[0]);
  }
  return rest;
}

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
/** Pages that took the named `color-scheme` exemption, reported at the end. */
const schemeAdded = [];
/** Pages that took each named `head` exemption, by exemption name. */
const headExempt = new Map();

/**
 * The client being compared, taken from the candidate directory's name.
 *
 * `brandCardSwapped` is scoped to four named slugs, so it needs to know which
 * client this is. `dist/<slug>/` is the layout every build produces.
 */
const SLUG = CAND.replace(/[\\/]+$/, '').split(/[\\/]/).pop();

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

  let moved = gated.filter((k) => hash(ra[k]) !== hash(rb[k]));

  // The one named exemption. Applied only to `root`, only when that block's
  // sole change is the added `color-scheme` line, and always announced — an
  // allowance nobody can see is indistinguishable from a gate that stopped
  // working.
  if (moved.includes('root')) {
    const scheme = onlyColorSchemeAdded(ra.root, rb.root);
    if (scheme) {
      moved = moved.filter((k) => k !== 'root');
      schemeAdded.push(`${page} (${scheme})`);
    }
  }

  // The two named `head` exemptions, applied in order and each recorded by
  // name. A head that still differs once both have been applied is a real
  // regression and falls through to the failure below.
  if (moved.includes('head')) {
    const applied = [];
    let rest = rb.head;

    const added = onlyCardMetadataAdded(ra.head, rest);
    if (added !== null) {
      rest = added;
      applied.push('cardMetadataAdded');
    }

    const swapped = onlyBrandCardSwapped(ra.head, rest, SLUG);
    if (swapped !== null) {
      rest = swapped;
      applied.push('brandCardSwapped');
    }

    if (applied.length > 0 && rest === ra.head) {
      moved = moved.filter((k) => k !== 'head');
      for (const name of applied) {
        if (!headExempt.has(name)) headExempt.set(name, []);
        headExempt.get(name).push(page);
      }
    }
  }

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

if (schemeAdded.length > 0) {
  console.log(
    `\n${schemeAdded.length} page(s) took the named color-scheme exemption — the only\n` +
      `  permitted change to a delivered :root block, and a deliberate rendering\n` +
      `  change rather than drift:`,
  );
  for (const entry of schemeAdded) console.log(`    + color-scheme  ${entry}`);
}

if (headExempt.size > 0) {
  console.log(
    `\nNamed head exemptions taken (trust-seo). Each is a deliberate metadata\n` +
      `  change, scoped to the delta that was measured and to nothing else:`,
  );
  for (const [name, pages_] of headExempt) {
    console.log(`    + ${name}  ${pages_.length} page(s): ${pages_.join(', ')}`);
  }
}

if (regressions > 0) {
  console.error(
    `\n✗ ${regressions} page(s) changed what they render. The acceptance is that an\n` +
      `  existing client's site is unaffected by panel work — see the note above.\n`,
  );
  process.exit(1);
}
console.log("✓ No client site changed what it renders.");
