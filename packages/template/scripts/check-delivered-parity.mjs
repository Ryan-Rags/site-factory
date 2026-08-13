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
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { previewOriginFor } from '../src/lib/preview-origin.mjs';

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
/**
 * The five routes that moved from `BaseLayout` into the design system.
 *
 * `/` is deliberately NOT in this list. The home page is the standing
 * acceptance for every piece of design work in this repo, it is compared in
 * full, and it takes no allowance here whatsoever.
 */
const REDESIGNED = new Set([
  'services/index.html',
  'about/index.html',
  'contact/index.html',
  'gallery/index.html',
  '404.html',
]);

/**
 * Whether a page may take the redesigned-route allowance.
 *
 * All three conditions must hold, and each is doing work:
 *
 *   - the page is one of the five named above;
 *   - the BASELINE is a legacy page — no design token block at all. This is
 *     what makes the allowance a one-way migration rather than a standing
 *     licence for those five routes to drift. The moment this branch lands on
 *     main, a later stream comparing against it finds design tokens in the
 *     baseline, this returns false, and those pages are fully gated again;
 *   - the CANDIDATE is a design page. A client with no `design` block still
 *     renders `BaseLayout` on all five, takes no allowance, and stays
 *     byte-locked — which is the property that keeps a legacy client honest.
 */
/*
 * The gate is run both ways: against a single `dist/<slug>/` and against the
 * whole `dist/` tree, in which case every page path carries its client's slug
 * in front. Matching on the tail handles both, and the `/` boundary keeps
 * `404.html` from matching something like `custom-404.html`.
 */
const isRedesignedPath = (page) =>
  [...REDESIGNED].some((route) => page === route || page.endsWith(`/${route}`));

function redesignedRoute(page, ra, rb) {
  if (!isRedesignedPath(page)) return false;
  const baselineIsLegacy = ra.root === '' && ra.matrix === '';
  const candidateIsDesign = rb.root !== '' || rb.matrix !== '';
  return baselineIsLegacy && candidateIsDesign;
}

/**
 * The reveal script changed, and nothing else in the body did.
 *
 * `Reveal.astro` now reveals anything already on the first screen rather than
 * waiting for an IntersectionObserver to reach it — measured, not assumed:
 * `check-reveal.mjs` found 37 elements painting blank inside the initial
 * viewport. That script is inline in `<body>`, so on a DELIVERED design page it
 * sits inside the `content` region and moves it. On a pitch page it renders
 * after the customizer toggle and is already outside the compared region, which
 * is exactly why only the three delivered builds failed.
 *
 * Narrow in the same way the `color-scheme` exemption is narrow: the reveal
 * script is replaced by a placeholder on both sides, and the rest of the body
 * must then be identical. One word of copy moving anywhere else on the page and
 * this returns null and the page fails.
 *
 * NARROWED 2026-08-13 (`feat/design-expansion`). As written above, this
 * absorbed *any* delta confined to the reveal script, forever — which is not
 * what the other named exemptions do and not what its own header claims. It was
 * about to wave a motion axis through on the three delivered design clients
 * without a word, so it is now pinned to the one migration it was written for.
 *
 * The signature of that migration is the `primed` guard. Before it, the script
 * set `data-reveal-ready` on <html> up front; after it, the attribute is set
 * inside the observer's first callback behind `primed`, which is what stopped
 * 37 above-the-fold elements painting blank. `is:inline` means the guard
 * survives verbatim into the built page, so the built HTML can be asked
 * directly which side of the migration it is on.
 *
 * That makes this one-way, exactly like `onlyColorSchemeAdded`: a baseline
 * taken after the migration already carries `primed`, so `before` matches, this
 * returns null, and the three delivered design clients are fully gated again.
 * Any later reveal-script change — the motion work included — needs its own
 * named, announced allowance, or no delta at all.
 */
const REVEAL_SCRIPT =
  /<script\b[^>]*>(?:(?!<\/script>)[^])*?data-reveal-ready(?:(?!<\/script>)[^])*?<\/script>/;

/** The guard the migration introduced. Absent before it, present after it. */
const PRIMED_GUARD = /\bprimed\b/;

function onlyRevealScriptChanged(before, after) {
  const a = REVEAL_SCRIPT.exec(before);
  const b = REVEAL_SCRIPT.exec(after);
  // Both sides must have one, and it must actually be what differs.
  if (!a || !b || a[0] === b[0]) return null;
  // ...and the difference must be *that* migration, in that direction.
  if (PRIMED_GUARD.test(a[0]) || !PRIMED_GUARD.test(b[0])) return null;
  const strippedBefore = before.replace(REVEAL_SCRIPT, '<script reveal/>');
  const strippedAfter = after.replace(REVEAL_SCRIPT, '<script reveal/>');
  return strippedBefore === strippedAfter ? true : null;
}

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

/**
 * Exemption 3 — `previewCardOrigin`.
 *
 * `og:image` and `twitter:image` move from `seo.siteUrl` to the origin the
 * preview is actually served from, `https://<slug>-preview.pages.dev`. The
 * card file, its path, its dimensions and every other tag stay exactly as
 * they were — only the host in front of the path changes. Issue #25: measured
 * live, 0 of 8 demos advertised a reachable card and 8 of 8 served one
 * correctly at this origin.
 *
 * Narrow in the same three ways the older exemptions are:
 *
 *   - the BASELINE must not already be at the preview origin, so this is a
 *     one-way migration and not a standing licence for the card's host to
 *     drift afterwards;
 *   - both tags must move, both to that exact origin, and the pathname must be
 *     byte-identical on each — an origin change is all this permits;
 *   - with the two values put back, the heads must be identical.
 *
 * A delivered build never reaches here: `cardOrigin` is empty when `noindex`
 * is false, so its card does not move and there is nothing to exempt.
 */
function onlyPreviewCardOriginMoved(before, after, slug) {
  const want = previewOriginFor(slug);
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
    let baseUrl, candUrl;
    try {
      baseUrl = new URL(b[1]);
      candUrl = new URL(a[1]);
    } catch {
      return null;
    }
    if (baseUrl.origin === want) return null; // Not the one-way migration.
    if (candUrl.origin !== want) return null; // Must land on the deploy origin.
    if (candUrl.pathname !== baseUrl.pathname) return null; // Origin only.
    rest = rest.replace(a[0], b[0]);
  }
  return rest;
}

/**
 * Exemption 4 — `deadAnchorLinkDropped`.
 *
 * A nav or footer entry pointing at a section the config does not render is
 * no longer emitted. On `industrial-machine-corp` that is `Reviews → #reviews`
 * — `testimonials: []` is deliberate, so `reviews.enabled` is false and no
 * `#reviews` section exists — and it was ten dead links across five routes and
 * two navs.
 *
 * The narrowness that matters here is the second condition. It is not enough
 * that a nav item disappeared; the item must have been pointing at a section
 * that genuinely is not on the candidate page. So the anchor it names must be
 * absent as an `id` from the candidate. A nav entry quietly deleted from a
 * config, or one whose section still renders, fails this and is a regression
 * like any other.
 *
 * Returns the anchors dropped, or null.
 */
function onlyDeadAnchorLinksDropped(before, after) {
  const ITEM = /<li\b[^>]*>\s*<a href="\/?#([a-z-]+)"[^>]*>[^<]*<\/a>\s*<\/li>/g;

  const byAnchor = new Map();
  for (const match of before.matchAll(ITEM)) {
    if (!byAnchor.has(match[1])) byAnchor.set(match[1], []);
    byAnchor.get(match[1]).push(match[0]);
  }

  let rest = before;
  const dropped = [];
  for (const [anchor, items] of byAnchor) {
    // Still on the candidate page: not dropped, and none of this applies.
    if (items.some((item) => after.includes(item))) continue;
    // Gone because the section is gone — not because an entry was deleted.
    if (new RegExp(`\\sid="${anchor}"`).test(after)) return null;
    for (const item of items) rest = rest.split(item).join('');
    dropped.push(anchor);
  }

  if (dropped.length === 0) return null;
  return rest === after ? dropped : null;
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
/** Pages that took the redesigned-route allowance, reported by name. */
const redesigned = [];
/** Pages whose only body change was the reveal script. */
const revealChanged = [];
/** Pages whose only body change was dropping links to absent sections. */
const deadAnchors = [];

/**
 * The client being compared, taken from the candidate directory's name.
 *
 * `brandCardSwapped` is scoped to four named slugs, so it needs to know which
 * client this is. `dist/<slug>/` is the layout every build produces.
 */
const SLUG = CAND.replace(/[\\/]+$/, '').split(/[\\/]/).pop();

/**
 * Which client a given page belongs to.
 *
 * This gate is run both ways — against a single `dist/<slug>/` and against the
 * whole `dist/` tree — and the slug-scoped exemptions have to work in both.
 * A single-client run is recognised by its own `index.html`; in a tree run the
 * slug is the first path segment, which is exactly what `walk()` produces.
 *
 * Without this, a whole-tree run resolved every slug to the literal string
 * "dist", `previewCardOrigin` computed an origin no page could carry, and 40
 * perfectly good pages reported as regressions. `brandCardSwapped` had the
 * same latent hole and now closes with it.
 */
const SINGLE_CLIENT = existsSync(join(CAND, 'index.html'));
const slugOf = (page) => (SINGLE_CLIENT ? SLUG : page.split('/')[0]);

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

  /*
   * The redesigned-route allowance, applied before anything is compared.
   *
   * It has to come first: the baseline for these five is a legacy page with no
   * `:root` token block, so the emptiness guard below is what fires on them,
   * not the region diff. There is nothing to compare region by region — the
   * page is a different page, deliberately — so the honest thing is to say so
   * by name rather than to grant `html`, `head` and `content` individually and
   * pretend a comparison happened.
   */
  if (redesignedRoute(page, ra, rb)) {
    redesigned.push(page);
    continue;
  }

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

    const swapped = onlyBrandCardSwapped(ra.head, rest, slugOf(page));
    if (swapped !== null) {
      rest = swapped;
      applied.push('brandCardSwapped');
    }

    const rehomed = onlyPreviewCardOriginMoved(ra.head, rest, slugOf(page));
    if (rehomed !== null) {
      rest = rehomed;
      applied.push('previewCardOrigin');
    }

    if (applied.length > 0 && rest === ra.head) {
      moved = moved.filter((k) => k !== 'head');
      for (const name of applied) {
        if (!headExempt.has(name)) headExempt.set(name, []);
        headExempt.get(name).push(page);
      }
    }
  }

  // The named `content` exemptions: the reveal script, and nothing else; or
  // dead anchor links dropped, and nothing else.
  if (moved.includes('content') && onlyRevealScriptChanged(ra.content, rb.content)) {
    moved = moved.filter((k) => k !== 'content');
    revealChanged.push(page);
  }

  if (moved.includes('content')) {
    const anchors = onlyDeadAnchorLinksDropped(ra.content, rb.content);
    if (anchors) {
      moved = moved.filter((k) => k !== 'content');
      deadAnchors.push(`${page} (${anchors.map((a) => `#${a}`).join(', ')})`);
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
    `\nNamed head exemptions taken. Each is a deliberate metadata change, scoped\n` +
      `  to the delta that was measured and to nothing else. cardMetadataAdded and\n` +
      `  brandCardSwapped are trust-seo's; previewCardOrigin is issue #25's:`,
  );
  for (const [name, pages_] of headExempt) {
    console.log(`    + ${name}  ${pages_.length} page(s): ${pages_.join(', ')}`);
  }
}

if (redesigned.length > 0) {
  console.log(
    `\n${redesigned.length} page(s) took the redesigned-route allowance (design-coverage).\n` +
      `  Each moved from BaseLayout into the design system on purpose, so there is no\n` +
      `  region-by-region comparison to make. It applies ONLY where the baseline page\n` +
      `  is legacy and the candidate is a design page, so it expires by itself the\n` +
      `  moment this lands on main. '/' is not eligible and is compared in full:`,
  );
  for (const page of redesigned) console.log(`    + redesignedRoute  ${page}`);
}

if (revealChanged.length > 0) {
  console.log(
    `\n${revealChanged.length} page(s) took the named reveal-script exemption. The inline\n` +
      `  reveal script now reveals anything already on the first screen instead of\n` +
      `  waiting for an observer to reach it. With that script alone replaced by a\n` +
      `  placeholder, the rest of the body is byte-identical on every page below:`,
  );
  for (const page of revealChanged) console.log(`    + revealScriptChanged  ${page}`);
}

if (deadAnchors.length > 0) {
  console.log(
    `\n${deadAnchors.length} page(s) took the named dead-anchor exemption. Each dropped a\n` +
      `  nav or footer link to a section the config does not render — and the anchor it\n` +
      `  named is absent as an id from the candidate page, which is what makes it a dead\n` +
      `  link removed rather than a nav entry deleted. Nothing else in the body moved:`,
  );
  for (const page of deadAnchors) console.log(`    + deadAnchorLinkDropped  ${page}`);
}

if (regressions > 0) {
  console.error(
    `\n✗ ${regressions} page(s) changed what they render. The acceptance is that an\n` +
      `  existing client's site is unaffected by panel work — see the note above.\n`,
  );
  process.exit(1);
}
console.log("✓ No client site changed what it renders.");
