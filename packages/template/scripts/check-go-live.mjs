/**
 * The preconditions for a site that is asking to be indexed.
 *
 * There is no separate "go-live mode" flag, deliberately. `seo.noindex: false`
 * already is the mode — it flips the meta robots tag, `robots.txt`, and whether
 * `@astrojs/sitemap` is included at all, from one place. A second flag would be
 * a second thing that can disagree with the first, which is exactly what
 * `robots.txt.ts` was written to avoid: "the mockup lock is a single flag
 * rather than two files that can drift apart."
 *
 * What was missing was never a flag. It was a set of preconditions, because
 * flipping that boolean is the single most consequential edit anybody makes in
 * this repository: the moment it lands, a real business's site is handed to a
 * crawler under the client's name, and most of what can be wrong at that moment
 * is invisible in a browser. A placeholder domain still in `siteUrl`. A
 * `robots.txt` advertising a sitemap that was never emitted. A social card that
 * no platform will render.
 *
 * So this gate is inert while `noindex` is true — a mockup is allowed to be a
 * mockup — and demanding the instant it is false.
 *
 * It reads `dist/`, never the config, like every other gate here: the output is
 * what gets crawled.
 *
 * Usage:
 *   node scripts/check-go-live.mjs              # the client SITE_CLIENT selected
 *   node scripts/check-go-live.mjs <slug>       # one named client
 *   node scripts/check-go-live.mjs --all        # every client present in dist/
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const distRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'dist');

/**
 * Placeholder origins that must never reach a live build.
 *
 * `example.invalid` is what an unwritten config carries. A `*.pages.dev` host
 * is a preview URL: canonicals pointing at it would tell Google the preview is
 * the real site, and the client's own domain is the duplicate.
 */
const PLACEHOLDER_HOSTS = [/(^|\.)example\.invalid$/i, /\.pages\.dev$/i];

/** RFC 6761 reserved TLDs. Legitimate for a fixture, never for a client. */
const RESERVED_TLDS = /\.(test|invalid|example|localhost)$/i;

function walkHtml(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walkHtml(full));
    else if (name.endsWith('.html')) out.push(full);
  }
  return out.sort();
}

function checkClient(slug) {
  const distDir = join(distRoot, slug);
  if (!existsSync(distDir)) {
    console.error(`✗ ${slug}: no dist/${slug}. Run a build first.`);
    return false;
  }

  const files = walkHtml(distDir);
  if (files.length === 0) {
    console.error(`✗ ${slug}: no HTML in dist/${slug}.`);
    return false;
  }

  const robotsMeta = (html) => /<meta[^>]+name=["']robots["'][^>]+noindex/i.test(html);
  const noindexPages = files.filter((f) => robotsMeta(readFileSync(f, 'utf8')));

  const robotsPath = join(distDir, 'robots.txt');
  const robots = existsSync(robotsPath) ? readFileSync(robotsPath, 'utf8') : null;

  /* ---------------------------------------------------------------- demo -- */

  if (noindexPages.length === files.length) {
    // A mockup. Assert the lock is whole rather than waving it through: a page
    // that lost its noindex tag while robots.txt still says Disallow is a site
    // half-way to being crawled, which is the failure this pairing prevents.
    const problems = [];
    if (robots === null) problems.push('no robots.txt was emitted');
    else {
      if (!/Disallow:\s*\//i.test(robots)) problems.push('robots.txt does not disallow crawling');
      if (/^\s*Sitemap:/im.test(robots)) {
        problems.push('robots.txt advertises a sitemap on a noindex build');
      }
    }
    const stray = readdirSync(distDir).filter((f) => /^sitemap.*\.xml$/i.test(f));
    if (stray.length > 0) {
      problems.push(`a sitemap was emitted on a noindex build: ${stray.join(', ')}`);
    }

    if (problems.length > 0) {
      console.error(`\n✗ ${slug}: the mockup lock is not whole.\n`);
      for (const p of problems) console.error(`    ${p}`);
      console.error('');
      return false;
    }
    console.log(`✓ ${slug}: noindex build — mockup lock whole, no sitemap, robots disallows.`);
    return true;
  }

  /* ------------------------------------------------------- half-flipped -- */

  if (noindexPages.length > 0) {
    console.error(
      `\n✗ ${slug}: ${noindexPages.length} of ${files.length} pages carry noindex.\n` +
        `    A site is indexable or it is not. A mixture means one of these is wrong,\n` +
        `    and the build cannot tell which:\n`,
    );
    for (const f of noindexPages) console.error(`      ${relative(distDir, f).split('\\').join('/')}`);
    console.error('');
    return false;
  }

  /* ---------------------------------------------------------------- live -- */

  const problems = [];
  const notes = [];

  const canonical = /<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i.exec(
    readFileSync(join(distDir, 'index.html'), 'utf8'),
  )?.[1];

  let origin = null;
  if (!canonical) {
    problems.push('the home page has no canonical, so there is no declared site URL');
  } else {
    let url;
    try {
      url = new URL(canonical);
    } catch {
      problems.push(`the home page canonical is not an absolute URL: ${canonical}`);
    }
    if (url) {
      origin = url.origin;
      if (url.protocol !== 'https:') problems.push(`site URL is ${url.protocol}, not https`);
      if (PLACEHOLDER_HOSTS.some((re) => re.test(url.hostname))) {
        problems.push(
          `site URL is still the placeholder ${url.hostname} — a live build must carry the ` +
            `client's own domain, or canonicals will hand the ranking to a preview host`,
        );
      } else if (RESERVED_TLDS.test(url.hostname)) {
        // Correct for the go-live fixture, and a loud mistake for anything else.
        notes.push(
          `site URL ${url.hostname} is on a reserved TLD that can never be registered — ` +
            `correct for a test fixture, wrong for a client`,
        );
      }
      if (!url.hostname.includes('.')) problems.push(`site URL host ${url.hostname} is not a domain`);
    }
  }

  /* robots.txt and the sitemap must agree with each other and with the disk. */
  if (robots === null) {
    problems.push('no robots.txt was emitted');
  } else {
    if (/Disallow:\s*\/\s*$/im.test(robots)) {
      problems.push('robots.txt still disallows everything on a live build');
    }
    const sitemapLine = /^\s*Sitemap:\s*(\S+)\s*$/im.exec(robots);
    if (!sitemapLine) {
      problems.push(
        'robots.txt names no sitemap — the one place a crawler looks for it without being told',
      );
    } else {
      let sitemapUrl;
      try {
        sitemapUrl = new URL(sitemapLine[1]);
      } catch {
        problems.push(`robots.txt Sitemap is not an absolute URL: ${sitemapLine[1]}`);
      }
      if (sitemapUrl) {
        if (origin && sitemapUrl.origin !== origin) {
          problems.push(
            `robots.txt points at a sitemap on ${sitemapUrl.origin}, not this site's ${origin}`,
          );
        }
        const onDisk = join(distDir, sitemapUrl.pathname.replace(/^\//, ''));
        if (!existsSync(onDisk)) {
          problems.push(
            `robots.txt advertises ${sitemapUrl.pathname}, which was not emitted — a crawler ` +
              `told to fetch a 404 learns nothing about the site`,
          );
        } else {
          // Every URL in the sitemap must be a page that exists, on this origin.
          const xml = readFileSync(onDisk, 'utf8');
          const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
          if (locs.length === 0) problems.push(`${sitemapUrl.pathname} lists no URLs`);
          for (const loc of locs) {
            let u;
            try {
              u = new URL(loc);
            } catch {
              problems.push(`sitemap entry is not an absolute URL: ${loc}`);
              continue;
            }
            if (origin && u.origin !== origin) {
              problems.push(`sitemap lists ${u.origin}${u.pathname}, off this site's origin`);
            }
            // Index files point at other sitemaps; leaf files point at pages.
            const target = /sitemap/i.test(u.pathname)
              ? join(distDir, u.pathname.replace(/^\//, ''))
              : join(distDir, u.pathname.replace(/^\//, ''), 'index.html');
            const alt = join(distDir, `${u.pathname.replace(/^\/|\/$/g, '')}.html`);
            if (!existsSync(target) && !existsSync(alt) && u.pathname !== '/') {
              problems.push(`sitemap lists ${u.pathname}, which is not a page in this build`);
            }
          }
        }
      }
    }
  }

  /* A live build may not carry an unconfirmed value. check-markers.mjs is the
   * authority; this repeats the check so a go-live run is self-contained. */
  const MARKERS = ['[verify with client]', 'PLACEHOLDER'];
  for (const f of files) {
    const html = readFileSync(f, 'utf8');
    for (const m of MARKERS) {
      if (html.includes(m)) {
        problems.push(`${relative(distDir, f).split('\\').join('/')} carries the marker ${m}`);
        break;
      }
    }
  }

  /* The social card has to be one a platform will actually render. */
  const home = readFileSync(join(distDir, 'index.html'), 'utf8');
  const ogImage = /<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i.exec(home)?.[1];
  if (!ogImage) problems.push('no og:image on the home page');
  else if (/\.svg(\?|$)/i.test(ogImage)) {
    problems.push(
      `og:image is an SVG (${ogImage}) — no major platform renders one, so every shared ` +
        `link unfurls blank`,
    );
  }

  /* Security headers ship with a live site or they do not ship. */
  if (!existsSync(join(distDir, '_headers'))) {
    problems.push(
      'no _headers file — a live site goes out with its security headers, not without them. ' +
        'Run scripts/gen-headers.mjs (pnpm build does).',
    );
  }

  for (const n of notes) console.log(`  · ${slug}: ${n}`);

  if (problems.length === 0) {
    console.log(
      `✓ ${slug}: LIVE build cleared for go-live — ${origin}, sitemap named and complete, ` +
        `marker-free, renderable card, headers present.`,
    );
    return true;
  }

  console.error(`\n✗ ${slug}: LIVE build (noindex off) is not ready to go live.\n`);
  for (const p of problems.slice(0, 30)) console.error(`    ${p}`);
  if (problems.length > 30) console.error(`    … and ${problems.length - 30} more`);
  console.error(
    `\n  Fix these, or set seo.noindex back to true until they are fixed.\n` +
      `  See docs/go-live.md for the full runbook. Do not delete this check.\n`,
  );
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
