/**
 * Keeps the injection surface at zero.
 *
 * The audit in `docs/injection-surface.md` establishes a strong property: no
 * visitor-supplied string is rendered into any page, because there is no sink
 * that could render one. Not "the sinks are escaped" — there are no sinks.
 *
 * That property is worth far more than the effort of maintaining it, and it is
 * exactly the kind of property that decays silently: one `innerHTML` added in a
 * hurry, one new query parameter read without resolving it, one `set:html`
 * pointed at something that is no longer build-time data. This gate is what
 * makes the audit a standing guarantee rather than a snapshot of one afternoon.
 *
 * It is grep-level, as commissioned, and honest about the limit: it can prove
 * that no *sink* exists, and it can force a human to re-read any expression
 * interpolated into markup. It cannot prove that the customizer's allowlist
 * resolution is correct. That is proved at runtime instead, by the fuzz probe
 * in `check-csp-runtime.mjs`, which loads a page with a script payload in every
 * accepted parameter and asserts the payload reaches neither the DOM nor the
 * JavaScript engine. The two checks are complementary and neither replaces the
 * other.
 *
 * Usage:
 *   node scripts/check-injection.mjs            # fail on any violation
 *   node scripts/check-injection.mjs --list     # print the current manifest
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { walkSource, isCommentLine, matchBraces, lineOf } from './lib/source-scan.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const pkgRoot = join(here, '..');
const srcRoot = join(pkgRoot, 'src');

/** Repo-relative, forward-slashed, so failures read the same on every platform. */
const rel = (f) => relative(pkgRoot, f).split('\\').join('/');

const failures = [];
function fail(rule, detail, hint) {
  failures.push({ rule, detail, hint });
}

/* ------------------------------------------------------------------ 1 --
 * Sinks that are banned outright.
 *
 * Every one of these is at zero today. The gate's job is to keep it there, so
 * the rule is absolute rather than case-by-case: there is no legitimate use of
 * any of them in a static brochure site, and "just this once" is how the
 * property is lost. If one is ever genuinely needed, that is a conversation and
 * a re-audit, not a quiet commit.
 */
const BANNED_SINKS = [
  { pattern: /\binnerHTML\b/, name: 'innerHTML' },
  { pattern: /\bouterHTML\b/, name: 'outerHTML' },
  { pattern: /\binsertAdjacentHTML\b/, name: 'insertAdjacentHTML' },
  { pattern: /\bdocument\s*\.\s*write(?:ln)?\s*\(/, name: 'document.write' },
  { pattern: /\bdangerouslySetInnerHTML\b/, name: 'dangerouslySetInnerHTML' },
  { pattern: /(?<![.\w])eval\s*\(/, name: 'eval()' },
  { pattern: /\bnew\s+Function\s*\(/, name: 'new Function()' },
  { pattern: /\bhref\s*=\s*["']\s*javascript:/i, name: 'javascript: href' },
  { pattern: /\bsrcdoc\b/, name: 'iframe srcdoc' },
];

const SOURCE_EXT = /\.(astro|tsx?|jsx?|mjs)$/;
const sourceFiles = walkSource(srcRoot, SOURCE_EXT);

for (const file of sourceFiles) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    if (isCommentLine(line)) return;
    for (const sink of BANNED_SINKS) {
      if (sink.pattern.test(line)) {
        fail(
          'banned-sink',
          `${rel(file)}:${i + 1}  ${sink.name}`,
          'There is no HTML sink in this template and there must not be one. ' +
            'If this is genuinely required, re-run the audit in docs/injection-surface.md first.',
        );
      }
    }
  });
}

/* ------------------------------------------------------------------ 2 --
 * `set:html` and `define:vars` — reviewed, not banned.
 *
 * Both are legitimate here and both are load-bearing: `set:html` is how the
 * JSON-LD graphs and the per-client CSS token block reach the page, and
 * `define:vars` is how the customizer receives its preset matrix. Banning them
 * would mean rewriting working code to no benefit.
 *
 * So instead each call site is pinned by a hash of the *expression* it
 * interpolates. Reformatting the file or moving the line changes nothing;
 * changing what is passed in changes the hash and fails the gate until a human
 * has re-read it and recorded why the new expression is still build-time data.
 *
 * That is the whole point: the danger is never `set:html` itself, it is
 * `set:html` whose argument quietly started carrying something a visitor
 * controls.
 */
/**
 * The reviewed call sites, keyed by expression hash.
 *
 * Regenerate the hashes with `node scripts/check-injection.mjs --list` and add
 * the new entry *with a justification you actually believe*. An entry whose
 * `why` does not explain where the data comes from is not a review.
 */
const REVIEWED = new Map([
  [
    'bd2c5ff067a3',
    {
      site: 'LocalBusinessJsonLd.astro:114 — LocalBusiness graph',
      why: 'JSON.stringify of a graph assembled entirely from site.config.ts (business, brand, seo, services, serviceAreas). No runtime value reaches it, and JSON.stringify cannot emit a markup-terminating sequence from these inputs.',
    },
  ],
  [
    '500eece9d9c3',
    {
      site: 'LocalBusinessJsonLd.astro:117 — FAQPage graph',
      why: 'JSON.stringify of site.faq, which is build-time config authored by @site-factory/copy.',
    },
  ],
  [
    '37f4d848a366',
    {
      site: 'Customizer.astro:424 — define:vars={{ config }}',
      why: 'The preset matrix: clientSlug, the configured form endpoint and mailto, and the offered preset/scheme/accent/font ids derived from the design config. All build-time. This is the data the customizer resolves visitor input *against* — it is the allowlist, not a value taken from the visitor.',
    },
  ],
  [
    '0b7701e0ab0f',
    {
      site: 'DesignLayout.astro:159 — <style is:global> design tokens',
      why: 'designTokens()/themeMatrixCss() over the design config: colours, fonts and metrics. Pure functions of build-time config.',
    },
  ],
  [
    'c035c19e9d8c',
    {
      site: 'DesignLayout.astro:164 — @font-face block',
      why: 'Font family/src/weight from the design config, each interpolated through JSON.stringify. Build-time.',
    },
  ],
  [
    'e82365ba825d',
    {
      site: 'DesignLayout.astro:179 — the no-flash resolver script',
      why: 'A script whose *code* is fixed and whose only interpolated values are offeredIds(design) and the client defaults — both build-time. It reads four URL parameters at runtime, but resolves each against that embedded allowlist before use and never writes any of them to markup; see rule 5 and the fuzz probe in check-csp-runtime.mjs.',
    },
  ],
  [
    'bc784b93b216',
    {
      site: 'design/Faq.astro:60 — FAQPage graph',
      why: 'JSON.stringify of the design config FAQ items. Build-time.',
    },
  ],
  [
    'b3e6f071e140',
    {
      site: 'design/Reviews.astro:138 — review graph',
      why: 'JSON.stringify of the reviews block, emitted only when canEmitReviewJsonLd() holds — aggregate present and every item status "verified". Build-time config, and gated on attribution rather than on availability.',
    },
  ],
  [
    '6a09f42cad11',
    {
      site: 'BaseLayout.astro:58 — <style is:global> brand tokens',
      why: 'The two brand colours and the font faces from site.config.ts, interpolated into a CSS custom-property block. Build-time config only.',
    },
  ],
]);

const INTERPOLATORS = [/set:html\s*=\s*\{/g, /define:vars\s*=\s*\{/g];

/** Every interpolation site in the tree, with a stable hash of its expression. */
function collectInterpolations() {
  const sites = [];
  for (const file of sourceFiles) {
    const text = readFileSync(file, 'utf8');
    for (const re of INTERPOLATORS) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text)) !== null) {
        const open = m.index + m[0].length - 1;
        const end = matchBraces(text, open);
        if (end === -1) {
          fail(
            'unparsable-expression',
            `${rel(file)}:${lineOf(text, open)}`,
            'The braces of this set:html/define:vars expression do not balance, so the gate ' +
              'cannot hash what it interpolates. Fix the source, or fix scripts/lib/source-scan.mjs.',
          );
          continue;
        }
        // Whitespace-normalised so reindenting a multi-line expression does not
        // look like a change of meaning. Anything that alters which values are
        // interpolated still alters the hash.
        const expr = text.slice(open, end).replace(/\s+/g, ' ').trim();
        sites.push({
          file: rel(file),
          line: lineOf(text, open),
          directive: m[0].startsWith('define') ? 'define:vars' : 'set:html',
          // Scoped to the file, not just the expression. Three sites currently
          // interpolate the identical text `JSON.stringify(jsonLd)`; hashing the
          // expression alone would let a fourth — in a new file, over a `jsonLd`
          // built from something else entirely — inherit their review and pass
          // unexamined. The cost is that moving a file needs a re-review, which
          // is the right default anyway.
          // `␟` (unit-separator glyph) rather than a raw NUL: a literal
          // control byte here makes this very file binary to grep and diff,
          // which is a poor property for a gate people are meant to read.
          hash: createHash('sha256').update(`${rel(file)}␟${expr}`).digest('hex').slice(0, 12),
          expr,
        });
      }
    }
  }
  return sites;
}

const sites = collectInterpolations();

if (process.argv.includes('--list')) {
  console.log(`\n${sites.length} interpolation site(s) in src/:\n`);
  for (const s of sites) {
    const known = REVIEWED.has(s.hash) ? 'reviewed' : 'UNREVIEWED';
    console.log(`  ${s.hash}  ${known.padEnd(10)} ${s.file}:${s.line}  ${s.directive}`);
    console.log(`      ${s.expr.length > 140 ? `${s.expr.slice(0, 140)}…` : s.expr}\n`);
  }
  process.exit(0);
}

for (const s of sites) {
  if (!REVIEWED.has(s.hash)) {
    fail(
      'unreviewed-interpolation',
      `${s.file}:${s.line}  ${s.directive}  hash ${s.hash}`,
      'This expression is interpolated into markup and has not been reviewed, or it has ' +
        'changed since it was. Read it, satisfy yourself it can only ever carry build-time ' +
        'data, then add the hash to REVIEWED in this file with a justification. ' +
        'Run with --list to see it.',
    );
  }
}

// A reviewed entry whose site has disappeared is stale. Not a security failure,
// but a manifest that accumulates dead entries is a manifest nobody trusts.
const liveHashes = new Set(sites.map((s) => s.hash));
for (const [hash, entry] of REVIEWED) {
  if (!liveHashes.has(hash)) {
    fail(
      'stale-manifest-entry',
      `${hash}  ${entry.site}`,
      'This reviewed interpolation no longer exists in src/. Delete the entry.',
    );
  }
}

/* ------------------------------------------------------------------ 3 --
 * The build must stay static.
 *
 * The audit's conclusion depends on it. Server rendering would introduce a
 * class of sink — request headers, path parameters, form bodies rendered into a
 * response — that nothing in this gate or in the audit considered. Adding an
 * adapter is a legitimate thing to want; doing it without redoing the audit is
 * not.
 */
const astroConfig = readFileSync(join(pkgRoot, 'astro.config.mjs'), 'utf8');
if (!/output:\s*['"]static['"]/.test(astroConfig)) {
  fail(
    'not-static',
    'astro.config.mjs no longer declares output: "static"',
    'docs/injection-surface.md concludes what it concludes because nothing is rendered ' +
      'per-request. Redo the audit before changing this.',
  );
}
if (/^\s*adapter\s*:/m.test(astroConfig)) {
  fail(
    'adapter-present',
    'astro.config.mjs declares an adapter',
    'An adapter means server-rendered responses, which is a new injection surface. ' +
      'Redo the audit before changing this.',
  );
}

/* ------------------------------------------------------------------ 4 --
 * No request reflection.
 *
 * `Astro.url.pathname` is fine and is used for canonicals — at build time it is
 * the page's own path, not anything a visitor sends. These three are different:
 * they only carry meaning under SSR, so their appearance means either dead code
 * or the beginning of the surface rule 3 exists to prevent.
 */
const REFLECTION = [/Astro\s*\.\s*request\b/, /Astro\s*\.\s*url\s*\.\s*searchParams\b/, /Astro\s*\.\s*params\b/];
for (const file of sourceFiles) {
  const text = readFileSync(file, 'utf8');
  text.split('\n').forEach((line, i) => {
    if (isCommentLine(line)) return;
    for (const re of REFLECTION) {
      if (re.test(line)) {
        fail(
          'request-reflection',
          `${rel(file)}:${i + 1}  ${line.trim().slice(0, 100)}`,
          'Reading the request implies per-request rendering. See rule 3.',
        );
      }
    }
  });
}

/* ------------------------------------------------------------------ 5 --
 * The query-parameter surface is bounded.
 *
 * Four parameters are read by shipped JavaScript, all of them the customizer's,
 * and every one is resolved against an allowlist before it is used — an unknown
 * value is replaced by the client's default, never stamped. A fifth parameter
 * would be a new path from a visitor-supplied string into the page, and it must
 * not appear without somebody deciding it is safe.
 *
 * Scoping: only files that touch the query string are examined, and only
 * through variables bound to it. That matters — `ContactForm.tsx` calls
 * `data.get('name')` on a `FormData`, which is not this surface, and a looser
 * pattern would flag it forever.
 *
 * Both halves of the scoping below were widened after the failure demo caught
 * them failing open; see `scripts/demo/injection-failures.sh`. The lesson each
 * time was the same: a *narrow trigger* is as dangerous as a narrow match,
 * because it makes the gate skip the file in silence rather than complain. So
 * the trigger is now deliberately broad and the gate fails closed on anything
 * it cannot follow.
 */
const ALLOWED_PARAMS = new Set(['theme', 'scheme', 'accent', 'font']);

/** Anything that could be a read of the query string, however spelled. */
const QUERY_SURFACE = /URLSearchParams|searchParams|location\s*\.\s*search/;

/**
 * Ways the query string gets bound to a name.
 *
 * `new URLSearchParams(…)` was the only one recognised at first, and the demo
 * proved that `new URL(location.href).searchParams` slipped straight past both
 * this and the trigger above.
 */
const BINDERS = [
  /(\w+)\s*=\s*new\s+URLSearchParams\s*\(/g,
  /(\w+)\s*=\s*new\s+URL\s*\([^)]*\)\s*\.\s*searchParams/g,
  /(\w+)\s*=\s*[\w.]*location\s*\.\s*search\b/g,
];

for (const file of sourceFiles) {
  const text = readFileSync(file, 'utf8');
  if (!QUERY_SURFACE.test(text)) continue;

  // No requirement that a declaration keyword sit next to the name. The first
  // draft required `var|let|const` immediately before the identifier and was
  // therefore blind to the one file that matters: DesignLayout's no-flash
  // script declares
  //   var d=document.documentElement,q=new URLSearchParams(location.search),s={};
  // where `q` is the second declarator in a comma list. The gate reported green
  // on a deliberately planted `?ref` parameter until this was widened.
  const binders = BINDERS.flatMap((re) => {
    re.lastIndex = 0;
    return [...text.matchAll(re)]
      // `t = new URLSearchParams(…).get('x')` binds a *string*, not the params
      // object. Without this the demo's rule-5c mutation bound `t`, satisfied
      // the "has a binder" test, and the gate went green while an unallowlisted
      // key was read one line away.
      .filter((m) => !/^\s*\.\s*(?:get|has|getAll)\s*\(/.test(text.slice(m.index + m[0].length)))
      .map((m) => m[1]);
  });

  // Reads that never bind at all: `new URLSearchParams(location.search).get('x')`
  // and `new URL(href).searchParams.get('x')`. Checked directly rather than via
  // a binder, because there is no name to check them against.
  const directReads = [
    ...text.matchAll(
      /(?:new\s+URLSearchParams\s*\([^)]*\)|\.\s*searchParams)\s*\.\s*(?:get|has|getAll)\s*\(\s*['"]([^'"]+)['"]/g,
    ),
  ];
  for (const m of directReads) {
    if (!ALLOWED_PARAMS.has(m[1])) {
      fail(
        'unbounded-query-param',
        `${rel(file)}:${lineOf(text, m.index)}  reads ?${m[1]} (unbound)`,
        `Only ${[...ALLOWED_PARAMS].join(', ')} may be read from the URL.`,
      );
    }
  }

  if (binders.length === 0 && directReads.length === 0) {
    fail(
      'unreadable-param-surface',
      `${rel(file)} touches the query string in a shape this gate cannot follow`,
      'The parameter surface here cannot be bounded by inspection, so it is treated as ' +
        'unbounded. Bind it to a variable (e.g. `const q = new URLSearchParams(location.search)`) ' +
        'so rule 5 can see which keys are read, or extend BINDERS.',
    );
    continue;
  }

  for (const name of binders) {
    const re = new RegExp(`\\b${name}\\s*\\.\\s*(?:get|has|getAll)\\s*\\(\\s*['"]([^'"]+)['"]`, 'g');
    let m;
    while ((m = re.exec(text)) !== null) {
      if (!ALLOWED_PARAMS.has(m[1])) {
        fail(
          'unbounded-query-param',
          `${rel(file)}:${lineOf(text, m.index)}  reads ?${m[1]}`,
          `Only ${[...ALLOWED_PARAMS].join(', ')} may be read from the URL, and only through the ` +
            'allowlist resolver. A new parameter is a new path from a visitor-supplied string ' +
            'into the page — audit it, prove it is resolved, then widen ALLOWED_PARAMS.',
        );
      }
    }
  }
}

/* ------------------------------------------------------------------ report -- */

if (failures.length === 0) {
  console.log(
    `✓ injection surface: ${sourceFiles.length} source files, no sinks, ` +
      `${sites.length} reviewed interpolation(s), query surface bounded.`,
  );
  process.exit(0);
}

console.error(`\n✗ injection surface: ${failures.length} violation(s).\n`);
const byRule = new Map();
for (const f of failures) {
  if (!byRule.has(f.rule)) byRule.set(f.rule, []);
  byRule.get(f.rule).push(f);
}
for (const [rule, items] of byRule) {
  console.error(`  [${rule}]`);
  for (const item of items) console.error(`    ${item.detail}`);
  console.error(`    → ${items[0].hint}\n`);
}
console.error('  See docs/injection-surface.md. Do not delete this check.\n');
process.exit(1);
