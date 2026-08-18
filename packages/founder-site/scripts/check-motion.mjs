/**
 * The scroll reveal is decoration, and decoration on this site has to prove it
 * cannot hurt anybody.
 *
 * Three things can go wrong with a reveal, and only the first one is obvious:
 *
 *   IT HIDES CONTENT.      An `opacity: 0` that a browser applies but never
 *                          animates away leaves a permanently blank block. The
 *                          template hit exactly this and needed a whole
 *                          `data-reveal-ready` handshake to dig out of it. The
 *                          equivalent failure here is an `opacity: 0` that
 *                          escapes the `@supports` guard, so a browser with no
 *                          scroll-driven animations applies the starting state
 *                          and has nothing to move it.
 *   IT COSTS THE LCP.      The hero holds the largest contentful paint on every
 *                          page here. A reveal on it trades a measured
 *                          Lighthouse number for a fade, and the trade is
 *                          invisible in review because the page still looks
 *                          right on a fast laptop.
 *   IT SMUGGLES IN A SCRIPT. `check-no-forms.mjs` already refuses every
 *                          `<script>`, but it refuses them for CSP reasons and
 *                          would keep passing if the motion moved to JS by some
 *                          route it does not model. The motion's own gate
 *                          should state the motion's own claim.
 *
 * Runs against `dist/`, like every gate in this package — the stylesheet is
 * inlined into each document, so what is checked is the bytes a reader gets.
 *
 *   node scripts/check-motion.mjs
 */
import { htmlPages, problem, report, requireDist } from './lib.mjs';

requireDist();

/** The class the pages mark up, and the keyframes it animates. */
const REVEAL_CLASS = 'reveal';
const KEYFRAMES = 'reveal-calm';

/** Every `<style>` body in a document, concatenated. */
function styles(html) {
  return [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n');
}

/**
 * The hero section's markup.
 *
 * Sliced from the opening tag to the first `</section>` after it. That is exact
 * here rather than approximate: no page nests a `<section>` inside the hero,
 * and `check-motion` failing loudly on a page that started to would be the
 * correct outcome anyway.
 */
function heroMarkup(html) {
  const open = /<section[^>]*\bclass="[^"]*\bhero\b[^"]*"[^>]*>/i.exec(html);
  if (!open) return null;
  const from = open.index + open[0].length;
  const end = html.indexOf('</section>', from);
  return html.slice(from, end === -1 ? html.length : end);
}

/**
 * Strip every `@supports (animation-timeline…)` block, brace-balanced.
 *
 * A regex cannot do this: the block contains nested `@media` and rule blocks,
 * so `\{[\s\S]*?\}` stops at the first inner brace and `\{[\s\S]*\}` swallows
 * the rest of the sheet. Both failures point the same way — the gate reports
 * green — which is the direction a gate must never fail in.
 */
function withoutSupportsGuard(css) {
  let out = '';
  let i = 0;
  while (i < css.length) {
    const at = css.indexOf('@supports', i);
    if (at === -1) {
      out += css.slice(i);
      break;
    }
    const braceAt = css.indexOf('{', at);
    if (braceAt === -1) {
      out += css.slice(i);
      break;
    }
    const head = css.slice(at, braceAt);
    if (!/animation-timeline/i.test(head)) {
      // Some other @supports: keep it, and keep scanning past its header.
      out += css.slice(i, braceAt + 1);
      i = braceAt + 1;
      continue;
    }
    out += css.slice(i, at);
    let depth = 1;
    let j = braceAt + 1;
    for (; j < css.length && depth > 0; j += 1) {
      if (css[j] === '{') depth += 1;
      else if (css[j] === '}') depth -= 1;
    }
    i = j;
  }
  return out;
}

/**
 * The body of the brace-balanced block that starts at `from`, or `null`.
 *
 * Brace-balanced rather than regex for the same reason `withoutSupportsGuard`
 * is: the built stylesheet is MINIFIED, so there are no newlines to anchor to
 * and `@keyframes x{from{…}to{…}}` contains nested blocks. The first cut of
 * this file used `\{[\s\S]*?\n\s*\}`, which matched nothing at all against the
 * minified bytes — so the opacity assertion below silently passed on a
 * stylesheet that did animate opacity. Caught by demonstrating the failure
 * before trusting the gate.
 */
function balancedBlock(css, from) {
  const open = css.indexOf('{', from);
  if (open === -1) return null;
  let depth = 1;
  for (let i = open + 1; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  return null;
}

/** Declaration blocks whose selector mentions `.reveal`, as `[selector, body]`. */
function revealRules(css) {
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    const selector = m[1].trim();
    if (new RegExp(`\\.${REVEAL_CLASS}\\b`).test(selector)) out.push([selector, m[2]]);
  }
  return out;
}

const pages = htmlPages();
let revealedPages = 0;

for (const page of pages) {
  const css = styles(page.html);
  const usesReveal = new RegExp(`class="[^"]*\\b${REVEAL_CLASS}\\b`).test(page.html);

  // --- 1. the hero is never revealed ---------------------------------------
  const hero = heroMarkup(page.html);
  if (hero === null) {
    problem(`${page.route}: no <section class="hero"> — the LCP assertion below is blind.`);
  } else if (new RegExp(`class="[^"]*\\b${REVEAL_CLASS}\\b`).test(hero)) {
    problem(
      `${page.route}: an element inside the hero carries .${REVEAL_CLASS}. The hero holds this ` +
        'page\'s LCP element; revealing it starts the largest paint at opacity 0.',
    );
  }

  if (!usesReveal) continue;
  revealedPages += 1;

  // --- 2. nothing is pre-hidden outside the @supports guard ----------------
  //
  // The keyframes legitimately contain `opacity: 0` and are harmless on their
  // own: a keyframe applies nothing until an animation references it, and the
  // only rules that do live inside the guard. So the guard AND the keyframes
  // come out, and whatever `.reveal` rule is left must not hide anything.
  let unguarded = withoutSupportsGuard(css);
  const stripAt = unguarded.search(new RegExp(`@keyframes\\s+${KEYFRAMES}\\b`, 'i'));
  if (stripAt !== -1) {
    const body = balancedBlock(unguarded, stripAt);
    if (body !== null) unguarded = unguarded.replace(`{${body}}`, '');
  }
  for (const [selector, body] of revealRules(unguarded)) {
    if (/opacity\s*:\s*0(?!\.\d*[1-9])/i.test(body) && !/!important/i.test(body)) {
      problem(
        `${page.route}: "${selector}" sets opacity 0 outside the @supports ` +
          '(animation-timeline) guard. A browser without scroll-driven animations would ' +
          'apply it and never animate it away — the block would be blank forever.',
      );
    }
  }

  // --- 2b. the reveal animates NO opacity ---------------------------------
  //
  // MEASURED, not stylistic. A scroll-linked animation has no discrete states:
  // at rest, an element straddling the fold sits part-way through its range, so
  // an opacity keyframe renders its text at a blended colour. Lighthouse's axe
  // pass reads the whole DOM at scroll 0 and priced the fade at five
  // accessibility points on two pages:
  //
  //   /sites    3 × `.prose > p` at 3.35:1 (#616468 on #08090a)
  //   /amenity  1 × `.prose > p` at 3.59:1 (#87827a on #faf8f5)
  //
  // A shorter range does not fix it, it only moves which element gets caught.
  // `transform` cannot change a computed colour, so the reveal stays
  // transform-only and this is what stops it drifting back.
  const kfAt = css.search(new RegExp(`@keyframes\\s+${KEYFRAMES}\\b`, 'i'));
  const keyframeBody = kfAt === -1 ? null : balancedBlock(css, kfAt);
  if (keyframeBody !== null && /(^|[;{\s])opacity\s*:/i.test(keyframeBody)) {
    problem(
      `${page.route}: the ${KEYFRAMES} keyframes animate opacity. On a scroll-linked timeline ` +
        'an element at rest can sit mid-fade, which blends its text colour and costs contrast ' +
        '(measured: 3.35:1 on /sites, 3.59:1 on /amenity, accessibility 100 → 95). ' +
        'Reveal with transform only.',
    );
  }

  // --- 3. the guard and the keyframes are actually present ----------------
  if (!/@supports\s*\([^)]*animation-timeline/i.test(css)) {
    problem(`${page.route}: uses .${REVEAL_CLASS} but ships no @supports (animation-timeline) guard.`);
  }
  if (!new RegExp(`@keyframes\\s+${KEYFRAMES}\\b`).test(css)) {
    problem(`${page.route}: uses .${REVEAL_CLASS} but the ${KEYFRAMES} keyframes are missing.`);
  }

  // --- 4. reduced motion collapses to still --------------------------------
  //
  // Stated as "there is a reduce block that neutralises .reveal", because the
  // guard being nested inside `no-preference` is a property of how the sheet
  // is written today and a future edit could move it out.
  const reduce = [...css.matchAll(/@media[^{]*prefers-reduced-motion\s*:\s*reduce[^{]*\{([\s\S]*?)\n\s*\}\s*\n/gi)]
    .map((m) => m[1])
    .join('\n');
  const collapses =
    /prefers-reduced-motion\s*:\s*no-preference/i.test(css) ||
    new RegExp(`\\.${REVEAL_CLASS}[^{]*\\{[^}]*animation\\s*:\\s*none`, 'i').test(reduce);
  if (!collapses) {
    problem(
      `${page.route}: nothing collapses .${REVEAL_CLASS} under prefers-reduced-motion: reduce.`,
    );
  }

  // --- 5. the motion is CSS, and stays CSS ---------------------------------
  if (/<script\b/i.test(page.html)) {
    problem(`${page.route}: ships a <script>. This site's reveal is CSS-only by construction.`);
  }
}

console.log(
  `      ${pages.length} page(s) checked, ${revealedPages} carrying reveals: ` +
    'no hero reveal, nothing pre-hidden, reduced motion collapses, no script',
);
report('check-motion');
