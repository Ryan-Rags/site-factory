/**
 * Every internal link on every built page must go somewhere.
 *
 * The bug this exists for is specific and was shipping. Every design client's
 * nav is a list of in-page anchors — `#services`, `#reviews`, `#gallery`,
 * `#service-area`, `#faq` — because the nav was written when `/` was the only
 * route rendering design markup. The moment that same header renders on
 * `/contact`, `#services` names a section three pages away: the browser finds
 * no such id, does nothing, and the visitor gets a nav item that silently
 * refuses to work. Nothing failed. Nothing logged. The link is just dead.
 *
 * `resolveHref()` in `src/lib/design.ts` is the fix; this is what holds it.
 *
 * WHAT THIS DOES NOT DO, deliberately. Canonicals are `check-metadata.mjs`'s
 * job and it does them better than the original plan for this gate intended —
 * exactly one per page, absolute, right origin, self-referencing path, and
 * agreeing with `og:url`. A second implementation here would be a second
 * opinion to keep in step, so the canonical assertion was dropped from this
 * gate rather than written twice.
 *
 * Nor does it touch external URLs. Verifying somebody else's link means a
 * network call, and the audit rules in CLAUDE.md make these gates read-only
 * local file reads. An external link that rots is a real problem and not this
 * gate's.
 *
 * WHAT IT ASSERTS, per client:
 *
 *   1. every internal href resolves to a page the build actually emitted;
 *   2. every fragment resolves to an `id` or `name` on the page it lands on —
 *      including same-page `#anchor` links, which is the dead-nav case;
 *   3. every page renders the same nav labels, in the same order. The nav is
 *      one config array shared by every route, so this is structural — but it
 *      is structural only while nobody hand-writes a second one.
 *
 * Static: it reads `dist/` and makes no network call and starts no browser, so
 * it is cheap enough to run per client in the build chain rather than needing a
 * preview server.
 *
 * Usage:
 *   node scripts/check-links.mjs              # the client SITE_CLIENT selected
 *   node scripts/check-links.mjs <slug>       # one named client
 *   node scripts/check-links.mjs --all        # every client present in dist/
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, '..');
const distRoot = join(pkgRoot, 'dist');

/* --------------------------------------------------------------- selection */

const args = process.argv.slice(2);
const wantAll = args.includes('--all');
const named = args.find((a) => !a.startsWith('--'));
const slug = named ?? process.env['SITE_CLIENT'] ?? 'ks-welding';

if (!existsSync(distRoot)) {
  console.error(`✗ no dist/ — nothing to check. Run a build first.`);
  process.exit(1);
}

const slugs = wantAll
  ? readdirSync(distRoot).filter((d) => statSync(join(distRoot, d)).isDirectory())
  : [slug];

/* ------------------------------------------------------------------- walk */

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry.endsWith('.html')) out.push(full);
  }
  return out;
}

/**
 * The URL path a built file answers to.
 *
 *   index.html            -> /
 *   contact/index.html    -> /contact
 *   404.html              -> /404
 *
 * Both spellings of a directory index are recorded (`/contact` and
 * `/contact/`), because a config may reasonably write either and a trailing
 * slash is not a broken link.
 */
function routesFor(rel) {
  const path = rel.split('\\').join('/');
  if (path === 'index.html') return ['/'];
  if (path.endsWith('/index.html')) {
    const base = `/${path.slice(0, -'/index.html'.length)}`;
    return [base, `${base}/`];
  }
  return [`/${path.slice(0, -'.html'.length)}`];
}

/**
 * Anchor targets on a page: every `id`, plus every legacy `name` on an `<a>`.
 *
 * Regex rather than a parser, like every other gate here. The risk with a
 * regex is a false *pass* — an id it fails to see becomes a reported dead
 * link, which is loud — so the failure mode points the safe way.
 */
function targetsIn(html) {
  const out = new Set();
  for (const m of html.matchAll(/\sid=["']([^"']+)["']/g)) out.add(m[1]);
  for (const m of html.matchAll(/<a[^>]+\sname=["']([^"']+)["']/g)) out.add(m[1]);
  return out;
}

/** Every href on the page, with enough context to name it in a message. */
function hrefsIn(html) {
  return [...html.matchAll(/<a\b[^>]*?\shref=["']([^"']*)["'][^>]*>([^]*?)<\/a>/g)].map((m) => ({
    href: m[1],
    // Tags stripped so the label reads as the visitor sees it, not as markup.
    text: m[2].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 40),
  }));
}

/**
 * The header nav's labels, in document order.
 *
 * The design header's nav is `.d-header__nav`; the base template's is a
 * different component with a different class, and a build that has neither is
 * reported as unchecked rather than silently passing.
 */
function navLabels(html) {
  const block = /<nav[^>]*class=["'][^"']*d-header__nav[^"']*["'][^>]*>([^]*?)<\/nav>/.exec(html);
  if (!block) return null;
  return [...block[1].matchAll(/<a\b[^>]*>([^]*?)<\/a>/g)].map((m) =>
    m[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(),
  );
}

/* ----------------------------------------------------------------- report */

let failures = 0;
let checked = 0;

const fail = (where, message) => {
  failures++;
  console.error(`  ✗ ${where}: ${message}`);
};

/* -------------------------------------------------------------------- run */

for (const s of slugs) {
  const dir = join(distRoot, s);
  if (!existsSync(dir)) {
    console.error(`✗ ${s}: no dist/${s} — build it first.`);
    failures++;
    continue;
  }

  const files = walk(dir);
  if (files.length === 0) {
    console.error(`✗ ${s}: no HTML in dist/${s}.`);
    failures++;
    continue;
  }

  // Every route this build answers to, and what can be anchored on each.
  const pages = new Map();
  for (const file of files) {
    const rel = relative(dir, file);
    const html = readFileSync(file, 'utf8');
    const targets = targetsIn(html);
    for (const route of routesFor(rel)) pages.set(route, { rel, targets, html });
  }

  for (const file of files) {
    const rel = relative(dir, file).split('\\').join('/');
    const html = readFileSync(file, 'utf8');
    const [selfRoute] = routesFor(relative(dir, file));

    for (const { href, text } of hrefsIn(html)) {
      // Off-site, or not a navigation at all. `tel:`, `mailto:` and `sms:` are
      // `check-contact-links.mjs`'s territory and are proved there.
      if (
        href === '' ||
        /^[a-z][a-z0-9+.-]*:/i.test(href) ||
        href.startsWith('//')
      ) {
        continue;
      }
      if (!href.startsWith('/') && !href.startsWith('#')) {
        fail(`${s}/${rel}`, `relative href "${href}" — internal links are root-relative here`);
        continue;
      }

      checked++;
      const [rawPath, fragment] = href.split('#');
      // A bare `#fragment` is a link into the page it is written on.
      const targetRoute = rawPath === '' ? selfRoute : rawPath;

      const page = pages.get(targetRoute) ?? pages.get(targetRoute.replace(/\/$/, ''));
      if (!page) {
        fail(
          `${s}/${rel}`,
          `"${text}" links to ${href} — this build emits no page at ${targetRoute}`,
        );
        continue;
      }

      if (fragment !== undefined && fragment !== '' && !page.targets.has(fragment)) {
        fail(
          `${s}/${rel}`,
          `"${text}" links to ${href} but ${page.rel.split('\\').join('/')} has no ` +
            `id or name "${fragment}" — this link does nothing when clicked`,
        );
      }
    }
  }

  // 3 — the nav reads the same on every page that has one.
  const navs = [];
  for (const file of files) {
    const labels = navLabels(readFileSync(file, 'utf8'));
    if (labels !== null) navs.push({ rel: relative(dir, file).split('\\').join('/'), labels });
  }
  if (navs.length > 1) {
    const [first, ...rest] = navs;
    for (const nav of rest) {
      checked++;
      if (nav.labels.join('|') !== first.labels.join('|')) {
        fail(
          `${s}/${nav.rel}`,
          `nav reads [${nav.labels.join(', ')}] but ${first.rel} reads ` +
            `[${first.labels.join(', ')}] — the nav is one config array and must render alike`,
        );
      }
    }
  }

  const navNote =
    navs.length > 1
      ? `${navs.length} pages share one nav`
      : 'no design header nav on this build, so nav consistency is not checked';
  console.log(`  ${s}: ${files.length} page(s), ${navNote}`);
}

console.log();
if (failures > 0) {
  console.error(
    `✗ ${failures} broken internal link(s) or nav inconsistenc(ies) of ${checked} checked.\n` +
      `  A nav item that resolves to nothing is a nav item the visitor taps and\n` +
      `  nothing happens. See resolveHref() in src/lib/design.ts.\n`,
  );
  process.exit(1);
}
console.log(`✓ ${checked} internal link(s) and nav check(s) passed — everything resolves.`);
