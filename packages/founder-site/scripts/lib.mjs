/**
 * Shared plumbing for this package's build gates.
 *
 * Every gate reads the BUILT ARTIFACT out of dist/ and nothing else. None of
 * them look at the .astro sources. That is the whole point: "the source says
 * canonical" and "the deployed page carries a canonical" are different claims,
 * and only the second one is worth a gate.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
export const distDir = join(pkgRoot, 'dist');

export function requireDist() {
  if (!existsSync(distDir)) {
    fail('dist/ does not exist — run `pnpm build` (these gates run after astro build).');
  }
  return distDir;
}

/** Every built HTML document, as `{ route, file, html }`. */
export function htmlPages() {
  const out = [];
  walk(distDir);
  return out.sort((a, b) => a.route.localeCompare(b.route));

  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.html')) {
        out.push({
          route: routeOf(full),
          file: relative(pkgRoot, full),
          html: readFileSync(full, 'utf8'),
        });
      }
    }
  }
}

/** `dist/sites/index.html` → `/sites`; `dist/index.html` → `/`. */
function routeOf(file) {
  const rel = relative(distDir, file).split(sep).join('/');
  const stripped = rel.replace(/(^|\/)index\.html$/, '');
  return stripped === '' ? '/' : `/${stripped.replace(/\.html$/, '')}`;
}

/**
 * The amenity mailbox's local part, read out of src/site.ts rather than spelled
 * here. This gate exists to keep one specific word off one specific page; if it
 * carried its own copy of that word it could drift from the address the page
 * actually links to, and then it would be guarding nothing.
 */
export function forbiddenAmenityWord() {
  const src = readFileSync(join(pkgRoot, 'src', 'site.ts'), 'utf8');
  const m = /EMAIL_AMENITY\s*=\s*'([^'@]+)@/.exec(src);
  if (!m) fail('could not read EMAIL_AMENITY out of src/site.ts — the wording gate is blind.');
  return m[1].toLowerCase();
}

/** SITE_URL, likewise read from the single source. */
export function siteUrl() {
  const src = readFileSync(join(pkgRoot, 'src', 'site.ts'), 'utf8');
  const m = /SITE_URL\s*=\s*'([^']+)'/.exec(src);
  if (!m) fail('could not read SITE_URL out of src/site.ts.');
  return m[1];
}

/**
 * The two operator-filled asset slots, read from the SAME ground truth the
 * build reads: the file on disk, and the constant in src/site.ts.
 *
 * A gate that took "is the photo filled in?" as a parameter, or as its own
 * copy of the answer, would be asserting against its own assumption rather than
 * against the build. Reading the source of truth is what lets one gate cover
 * both states — an unfilled slot must render its placeholder, and a filled one
 * must render the real artifact. Neither is allowed to be silently missing.
 */
export function linkedinUrl() {
  const src = readFileSync(join(pkgRoot, 'src', 'site.ts'), 'utf8');
  const m = /LINKEDIN_URL:\s*string\s*\|\s*null\s*=\s*(?:'([^']*)'|null)/.exec(src);
  if (!m) fail('could not read LINKEDIN_URL out of src/site.ts — the placeholder gate is blind.');
  return m[1] && m[1].length > 0 ? m[1] : null;
}

/** The public path of the headshot, and whether Ryan has dropped the file in. */
export function headshot() {
  const src = readFileSync(join(pkgRoot, 'src', 'site.ts'), 'utf8');
  const m = /HEADSHOT_SRC\s*=\s*'([^']+)'/.exec(src);
  if (!m) fail('could not read HEADSHOT_SRC out of src/site.ts — the placeholder gate is blind.');
  return { src: m[1], present: existsSync(join(pkgRoot, 'public', m[1].replace(/^\//, ''))) };
}

/**
 * Visible text: markup, <head>, comments and attribute values removed.
 *
 * Attributes matter here — `href="mailto:…"` is exactly the place the amenity
 * address is ALLOWED to appear, so an attribute-blind strip would report a
 * violation on every correctly-built page. Dropping attributes wholesale also
 * means this function cannot see alt/title/aria text, which the metadata gate
 * checks separately.
 */
export function visibleText(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<head[\s\S]*?<\/head>/gi, ' ')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** All `<head>` markup, attributes intact. */
export function head(html) {
  const m = /<head[^>]*>([\s\S]*?)<\/head>/i.exec(html);
  return m ? m[1] : '';
}

/**
 * Attributes of one tag, lowercased keys, entity-decoded values.
 *
 * Written as a parser rather than a regex per attribute because the values here
 * legitimately contain the other quote character — "the practice's own numbers"
 * inside a double-quoted `content=` is valid HTML that a `[^"']*` character
 * class silently truncates. That truncation would have made every length and
 * wording check below measure a prefix of the real string.
 */
export function attrs(tag) {
  const out = {};
  const re = /([a-zA-Z_:][-\w:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let m;
  while ((m = re.exec(tag)) !== null) {
    out[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return out;
}

/**
 * Decode the entities Astro emits. Lengths must be measured on decoded text:
 * `&amp;` occupies five bytes in the file and one character in a search result,
 * and a title budget is about the search result.
 */
export function decodeEntities(s) {
  return s
    .replace(/&(?:amp|#38|#x26);/gi, '&')
    .replace(/&(?:lt|#60|#x3c);/gi, '<')
    .replace(/&(?:gt|#62|#x3e);/gi, '>')
    .replace(/&(?:quot|#34|#x22);/gi, '"')
    .replace(/&(?:apos|#39|#x27);/gi, "'")
    .replace(/&(?:nbsp|#160);/gi, ' ');
}

/** The decoded `content` of the meta tag whose `attr` equals `value`. */
export function metaContent(html, attr, value) {
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    if (a[attr.toLowerCase()] === value && a.content !== undefined) return a.content;
  }
  return null;
}

/** The decoded text of the document's <title>. */
export function titleOf(html) {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return m ? decodeEntities(m[1]).trim() : '';
}

export function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const problems = [];

export function problem(msg) {
  problems.push(msg);
}

export function fail(msg) {
  console.error(`FAIL  ${msg}`);
  process.exit(1);
}

/** Report every problem at once — one run should surface the whole list. */
export function report(gateName) {
  if (problems.length > 0) {
    console.error(`FAIL  ${gateName}: ${problems.length} problem(s)`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(`ok    ${gateName}`);
}
