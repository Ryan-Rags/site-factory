/**
 * Holds `dist/<slug>/_headers` to what the built pages actually need.
 *
 * Two distinct jobs, and the second is the one that matters most over time.
 *
 * 1. **Drift.** The policy is re-derived from the built HTML and diffed against
 *    the file on disk. A `_headers` edited by hand, or left behind by an older
 *    build, fails — because a CSP that no longer matches its pages either
 *    breaks the site or quietly permits more than it should, and both failures
 *    are invisible until somebody is standing in front of a customer.
 *
 * 2. **Standing invariants.** Chiefly: `script-src` is hash-only, for good.
 *    `'unsafe-inline'` in `script-src` would silently void the single most
 *    valuable line in the whole policy, and it is exactly the sort of change
 *    that arrives in a hurry with a plausible reason attached. The gate refuses
 *    it outright rather than trusting anyone — including whoever is reading
 *    this — to notice it in a diff.
 *
 * The derivation is imported from `lib/csp.mjs`, the same module the generator
 * uses. Two implementations of "what should this policy be" would eventually
 * disagree, and the gate would then be checking one opinion against another
 * instead of checking the file against the pages.
 *
 * Usage:
 *   node scripts/check-headers.mjs              # the client SITE_CLIENT selected
 *   node scripts/check-headers.mjs <slug>       # one named client
 *   node scripts/check-headers.mjs --all        # every client present in dist/
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DENIED_FEATURES, buildPolicy, measureClient, walkHtml } from './lib/csp.mjs';

const distRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'dist');

/** Headers that must be present on every build, with their required value. */
const REQUIRED_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY',
};

/**
 * Directives that must appear with exactly these values, whatever the pages
 * contain. These are not measured — they are policy, and measurement must not
 * be able to weaken them.
 */
const FIXED_DIRECTIVES = {
  'default-src': "'self'",
  'frame-ancestors': "'none'",
  'form-action': "'self'",
  'base-uri': "'none'",
  'object-src': "'none'",
  'worker-src': "'self'",
  'manifest-src': "'self'",
  'style-src': "'self' 'unsafe-inline'",
};

function parseHeaders(text) {
  // Pages `_headers` format: a path pattern on its own line, then indented
  // `Name: value` lines beneath it.
  const out = new Map();
  let pattern = null;
  for (const raw of text.split('\n')) {
    if (raw.trim() === '' || raw.trimStart().startsWith('#')) continue;
    if (!/^\s/.test(raw)) {
      pattern = raw.trim();
      if (!out.has(pattern)) out.set(pattern, new Map());
      continue;
    }
    const at = raw.indexOf(':');
    if (at < 0 || pattern === null) continue;
    out.get(pattern).set(raw.slice(0, at).trim().toLowerCase(), raw.slice(at + 1).trim());
  }
  return out;
}

const directives = (csp) => {
  const out = new Map();
  for (const part of csp.split(';')) {
    const trimmed = part.trim();
    if (trimmed === '') continue;
    const at = trimmed.indexOf(' ');
    if (at < 0) out.set(trimmed.toLowerCase(), '');
    else out.set(trimmed.slice(0, at).toLowerCase(), trimmed.slice(at + 1).trim());
  }
  return out;
};

function checkClient(slug) {
  const distDir = join(distRoot, slug);
  if (!existsSync(distDir)) {
    console.error(`✗ ${slug}: no dist/${slug}. Run a build first.`);
    return false;
  }
  if (walkHtml(distDir).length === 0) {
    console.error(`✗ ${slug}: no HTML in dist/${slug}.`);
    return false;
  }

  const headersPath = join(distDir, '_headers');
  if (!existsSync(headersPath)) {
    console.error(
      `\n✗ ${slug}: no _headers in dist/${slug}.\n` +
        `    Run scripts/gen-headers.mjs. A site deployed without it goes out with no CSP,\n` +
        `    no nosniff and no framing protection at all.\n`,
    );
    return false;
  }

  const problems = [];
  const blocks = parseHeaders(readFileSync(headersPath, 'utf8'));
  const block = blocks.get('/*');

  if (!block) {
    console.error(`\n✗ ${slug}: _headers has no /* block, so nothing is covered.\n`);
    return false;
  }

  for (const [name, want] of Object.entries(REQUIRED_HEADERS)) {
    const got = block.get(name);
    if (got === undefined) problems.push(`missing header ${name}`);
    else if (got !== want) problems.push(`${name} is "${got}", expected "${want}"`);
  }

  const permissions = block.get('permissions-policy');
  if (permissions === undefined) problems.push('missing header permissions-policy');
  else {
    for (const feature of DENIED_FEATURES) {
      if (!new RegExp(`\\b${feature}=\\(\\)`).test(permissions)) {
        problems.push(`permissions-policy does not deny ${feature}`);
      }
    }
  }

  const csp = block.get('content-security-policy');
  if (csp === undefined) {
    problems.push('missing header content-security-policy');
  } else {
    const got = directives(csp);

    /* --- 2. standing invariants ------------------------------------------ */

    const scriptSrc = got.get('script-src') ?? '';
    // The assertion this gate exists for. Hash-only, permanently.
    for (const banned of ["'unsafe-inline'", "'unsafe-eval'", "'strict-dynamic'", "'unsafe-hashes'"]) {
      if (scriptSrc.includes(banned)) {
        problems.push(
          `script-src contains ${banned}. It is hash-only by standing decision — that is the ` +
            `half of this policy that actually stops XSS, and ${banned} voids it. If an inline ` +
            `script cannot be hashed, fix the script; do not widen the policy.`,
        );
      }
    }
    if (/\*/.test(scriptSrc)) problems.push('script-src contains a wildcard');
    if (!scriptSrc.includes("'self'")) problems.push("script-src is missing 'self'");

    // `'unsafe-inline'` is permitted in exactly one directive and nowhere else.
    for (const [name, value] of got) {
      if (name === 'style-src') continue;
      if (value.includes("'unsafe-inline'")) {
        problems.push(`${name} contains 'unsafe-inline'; only style-src may (see gen-headers.mjs)`);
      }
    }

    for (const [name, want] of Object.entries(FIXED_DIRECTIVES)) {
      const value = got.get(name);
      if (value === undefined) problems.push(`CSP is missing ${name}`);
      else if (value !== want) problems.push(`CSP ${name} is "${value}", expected "${want}"`);
    }

    /* --- 1. drift -------------------------------------------------------- */

    const { merged } = measureClient(distDir);
    const expected = directives(buildPolicy(merged));
    for (const [name, want] of expected) {
      const value = got.get(name);
      if (value === undefined) {
        problems.push(`CSP is missing ${name} (the pages need "${want}")`);
      } else if (value !== want) {
        problems.push(
          `CSP ${name} is stale:\n         file: ${value}\n        pages: ${want}\n` +
            `        Re-run scripts/gen-headers.mjs.`,
        );
      }
    }
    for (const name of got.keys()) {
      if (!expected.has(name)) problems.push(`CSP has ${name}, which this build does not need`);
    }
  }

  if (problems.length === 0) {
    const hashes = (csp.match(/'sha256-/g) ?? []).length;
    console.log(
      `✓ ${slug}: _headers matches the built pages — ${hashes} script hash(es), ` +
        `script-src hash-only, all required headers present.`,
    );
    return true;
  }

  console.error(`\n✗ ${slug}: ${problems.length} header problem(s).\n`);
  for (const p of problems) console.error(`    ${p}`);
  console.error('\n  Do not delete this check.\n');
  return false;
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
