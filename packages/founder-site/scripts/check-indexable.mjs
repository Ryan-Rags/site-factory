/**
 * This site must be INDEXED. Every other build in this repo must not be, so the
 * default that a copy-paste would inherit is the wrong one — which is precisely
 * why this is a gate and not a note in a README.
 *
 * Asserts, against dist/:
 *   1. robots.txt exists, does not Disallow the site, and names a sitemap.
 *   2. The sitemap it names was actually emitted.
 *   3. Every page carries <link rel="sitemap"> pointing at that same file.
 *   4. Every page carries a canonical on the production origin, matching its
 *      own route.
 *   5. No page carries a robots `noindex`/`nofollow` in meta or in _headers.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  distDir,
  head,
  htmlPages,
  metaContent,
  problem,
  report,
  requireDist,
  siteUrl,
} from './lib.mjs';

requireDist();

const origin = siteUrl();
const robotsPath = join(distDir, 'robots.txt');

if (!existsSync(robotsPath)) {
  problem('dist/robots.txt is missing — the site would be crawled on default rules.');
}

let sitemapRef = null;
if (existsSync(robotsPath)) {
  const robots = readFileSync(robotsPath, 'utf8');

  // A bare `Disallow:` (empty value) means "allow everything" and is fine. Only
  // a path-bearing Disallow blocks anything.
  const blocking = [...robots.matchAll(/^\s*Disallow:\s*(\S+)\s*$/gim)].map((m) => m[1]);
  if (blocking.length > 0) {
    problem(`robots.txt blocks crawling: Disallow ${blocking.join(', ')} — this site is indexed.`);
  }
  if (!/^\s*Allow:\s*\/\s*$/im.test(robots)) {
    problem('robots.txt has no explicit `Allow: /` — state the intent rather than relying on it.');
  }

  const m = /^\s*Sitemap:\s*(\S+)\s*$/im.exec(robots);
  if (!m) {
    problem('robots.txt names no Sitemap.');
  } else {
    sitemapRef = m[1];
    if (!sitemapRef.startsWith(`${origin}/`)) {
      problem(`robots.txt Sitemap ${sitemapRef} is not on ${origin}.`);
    }
    const localName = sitemapRef.slice(origin.length + 1);
    if (!existsSync(join(distDir, localName))) {
      problem(
        `robots.txt points at ${localName}, which the build did not emit. ` +
          'Either the sitemap integration is disabled or the filename moved.',
      );
    }
  }
}

const pages = htmlPages();
if (pages.length === 0) problem('no HTML pages in dist/.');

const expectedSitemapHref = sitemapRef ? new URL(sitemapRef).pathname : '/sitemap-index.xml';

for (const page of pages) {
  const h = head(page.html);

  const robotsMeta = metaContent(page.html, 'name', 'robots');
  if (robotsMeta && /noindex|nofollow|none/i.test(robotsMeta)) {
    problem(`${page.route}: <meta name="robots" content="${robotsMeta}"> — must not be present.`);
  }

  const canonical = /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i.exec(h);
  if (!canonical) {
    problem(`${page.route}: no <link rel="canonical">.`);
  } else {
    const want = new URL(page.route, origin).href;
    // URL() renders the root as `https://host/`; both spellings are correct.
    const got = canonical[1];
    if (got !== want && got !== want.replace(/\/$/, '')) {
      problem(`${page.route}: canonical is ${got}, expected ${want}.`);
    }
  }

  const sitemapLink = /<link[^>]*rel=["']sitemap["'][^>]*href=["']([^"']+)["']/i.exec(h);
  if (!sitemapLink) {
    problem(`${page.route}: no <link rel="sitemap">.`);
  } else if (sitemapLink[1] !== expectedSitemapHref) {
    problem(
      `${page.route}: <link rel="sitemap"> is ${sitemapLink[1]}, but robots.txt names ${expectedSitemapHref}.`,
    );
  }
}

const headersPath = join(distDir, '_headers');
if (existsSync(headersPath)) {
  const headers = readFileSync(headersPath, 'utf8');
  if (/X-Robots-Tag/i.test(headers)) {
    problem('_headers sets X-Robots-Tag — that would override the pages and de-index the site.');
  }
}

console.log(`      checked ${pages.length} page(s): ${pages.map((p) => p.route).join(', ')}`);
report('check-indexable');
