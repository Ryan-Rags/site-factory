/**
 * Schema lint: the structured data must be valid, and it must be *true*.
 *
 * Validity is the easy half and the half every linter does — does it parse, is
 * `@context` right, are the required properties present. This gate does that,
 * and then does the half that actually protects the client: it checks the graph
 * against the page it sits on.
 *
 * Structured data is read by a search engine as a factual claim made by the
 * business. A graph that disagrees with the page it is on is not a formatting
 * mistake, it is a claim nobody can support — and the penalty is not a warning,
 * it is a manual action against the whole domain. So:
 *
 *   - every `FAQPage` question must actually appear on the page;
 *   - every `areaServed` town must actually appear on the page;
 *   - the `telephone` must be a number the page actually dials;
 *   - review markup must attach to the same entity as the business.
 *
 * All of it read from `dist/`, never the config, because the output is what
 * gets crawled.
 *
 * Deliberately offline. A lint that calls Google's validator is a lint that
 * fails on a train, and this one runs in `pnpm build`.
 *
 * Usage:
 *   node scripts/check-schema.mjs              # the client SITE_CLIENT selected
 *   node scripts/check-schema.mjs <slug>       # one named client
 *   node scripts/check-schema.mjs --all        # every client present in dist/
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { previewOriginFor } from '../src/lib/preview-origin.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const distRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'dist');

/** The unconfirmed-value markers. Same list as check-markers.mjs. */
const MARKERS = ['[verify with client]', 'PLACEHOLDER'];

/**
 * Types this factory emits, top level and nested. An unlisted type is either a
 * typo — `LocalBussiness` is silently ignored by every consumer — or a new
 * feature that nobody linted.
 */
const KNOWN_TYPES = new Set([
  'LocalBusiness',
  'FAQPage',
  'Question',
  'Answer',
  'PostalAddress',
  'GeoCoordinates',
  'OpeningHoursSpecification',
  'Offer',
  'Service',
  'Place',
  'AggregateRating',
  'Review',
  'Rating',
  'Person',
]);

/** Required properties, by type. Only what a consumer genuinely needs. */
const REQUIRED = {
  LocalBusiness: ['name', 'url', 'telephone', 'address', 'image'],
  PostalAddress: ['addressLocality', 'addressRegion', 'addressCountry'],
  FAQPage: ['mainEntity'],
  Question: ['name', 'acceptedAnswer'],
  Answer: ['text'],
  Review: ['author', 'reviewRating', 'reviewBody'],
  AggregateRating: ['ratingValue', 'reviewCount'],
};

function walkHtml(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walkHtml(full));
    else if (name.endsWith('.html')) out.push(full);
  }
  return out.sort();
}

/**
 * The page's visible text, near enough to compare claims against.
 *
 * Scripts and styles are dropped first — otherwise the JSON-LD would satisfy
 * every "does the page say this?" check by quoting itself, which would make all
 * four of the truth checks below unconditionally pass.
 */
function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/** Walk every node in a graph, yielding `[node, path]`. */
function* nodes(value, path = '$') {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) yield* nodes(value[i], `${path}[${i}]`);
    return;
  }
  if (value && typeof value === 'object') {
    yield [value, path];
    for (const [k, v] of Object.entries(value)) yield* nodes(v, `${path}.${k}`);
  }
}

function checkClient(slug) {
  const distDir = join(distRoot, slug);
  if (!existsSync(distDir)) {
    console.error(`✗ ${slug}: no dist/${slug}. Run a build first.`);
    return false;
  }

  const problems = [];
  let blockCount = 0;
  const files = walkHtml(distDir);

  /**
   * Markers follow the rule check-markers.mjs already set, rather than a
   * second, stricter one: fine while `noindex`, disqualifying once live. A
   * mockup exists precisely to carry values nobody has confirmed yet, and a
   * gate that contradicted that policy would be wrong about the policy, not
   * about the build.
   */
  const noindex = files.every((f) =>
    /<meta[^>]+name=["']robots["'][^>]+noindex/i.test(readFileSync(f, 'utf8')),
  );

  /**
   * The whole site's visible text.
   *
   * `areaServed` is a property of the *business*, not of the page it happens to
   * be printed on. The `LocalBusiness` node is emitted site-wide under one
   * `@id` — that is how a consumer is meant to merge it — so demanding that
   * every town appear on every page is a category error, and the first draft of
   * this gate made it: it reported 22 "failures" across two clients for pages
   * that simply were not the service-area page.
   *
   * What is worth enforcing is the real rule from LocalBusinessJsonLd.astro:
   * the towns the graph claims must be towns the site actually commits to
   * somewhere. `FAQPage` is genuinely different and stays per-page — it is a
   * claim *about the page*, so its questions must be on it.
   */
  const siteText = files.map((f) => visibleText(readFileSync(f, 'utf8'))).join(' ');

  for (const file of files) {
    const page = relative(distDir, file).split('\\').join('/');
    const say = (msg) => problems.push(`${page}: ${msg}`);
    const html = readFileSync(file, 'utf8');
    const text = visibleText(html);

    const origin = (() => {
      const href = /<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i.exec(html)?.[1];
      try {
        return href ? new URL(href).origin : null;
      } catch {
        return null;
      }
    })();

    const blocks = [
      ...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
    ];

    const graphs = [];
    for (const [, raw] of blocks) {
      blockCount += 1;
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        say(`JSON-LD does not parse: ${err.message}`);
        continue;
      }
      graphs.push(parsed);
    }

    for (const graph of graphs) {
      if (graph['@context'] !== 'https://schema.org') {
        say(`@context is ${JSON.stringify(graph['@context'])}, expected "https://schema.org"`);
      }

      for (const [node, path] of nodes(graph)) {
        const type = node['@type'];
        if (type !== undefined) {
          const list = Array.isArray(type) ? type : [type];
          for (const t of list) {
            if (!KNOWN_TYPES.has(t)) say(`${path}: unknown @type "${t}" (typo, or needs linting)`);
          }
          for (const t of list) {
            for (const req of REQUIRED[t] ?? []) {
              const v = node[req];
              if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) {
                say(`${path}: ${t} is missing required property "${req}"`);
              }
            }
          }
        }

        for (const [k, v] of Object.entries(node)) {
          if (typeof v !== 'string') continue;
          if (v.trim() === '') say(`${path}.${k} is an empty string — omit the property instead`);
          if (!noindex) {
            for (const marker of MARKERS) {
              if (v.includes(marker)) say(`${path}.${k} carries the marker ${marker}`);
            }
          }
          /*
           * Anything meant to be a URL must be one, and must be ours — but
           * "ours" is two different origins, and conflating them is what issue
           * #35 was about.
           *
           * `url` and `@id` are identity claims and belong on the canonical
           * origin, which is this site's own address. `image` and `logo` are
           * fetched by a crawler on another machine, so on a `noindex` build
           * they belong at the origin serving that build — which for a mockup
           * is a Pages host and NOT the canonical origin. Requiring all four to
           * match the canonical was the rule that kept the graph's two fetched
           * URLs pointed at `example.invalid`, a host that resolves nowhere,
           * on five of the eight clients.
           *
           * On a delivered build `cardOrigin` is empty, `previewOriginFor` is
           * not consulted, and all four are compared against the canonical
           * exactly as before.
           */
          if (['url', '@id', 'image', 'logo'].includes(k)) {
            let u;
            try {
              u = new URL(v);
            } catch {
              say(`${path}.${k} is not an absolute URL: ${v}`);
              continue;
            }
            const fetched = k === 'image' || k === 'logo';
            const want = fetched && noindex ? previewOriginFor(slug) : origin;
            if (want && u.origin !== want) {
              say(
                `${path}.${k} points at ${u.origin}, not ${want}` +
                  (fetched && noindex
                    ? ' — the origin this preview is served from. A crawler fetches this URL, ' +
                      'so it has to name a host that serves the file (issue #35).'
                    : " — this site's own address."),
              );
            }
          }
        }
      }

      /* --- claims that must match the page ------------------------------- */

      if (graph['@type'] === 'FAQPage') {
        for (const q of graph.mainEntity ?? []) {
          const name = String(q?.name ?? '').trim();
          if (name && !text.includes(name.toLowerCase())) {
            say(`FAQPage asks "${name.slice(0, 60)}…" but the page does not`);
          }
        }
      }

      if (graph['@type'] === 'LocalBusiness') {
        /* --- the graph's two fetched fields must be present at all ------- */
        /*
         * Their ORIGIN is checked in the per-key loop above, which knows the
         * asset/identity split. What that loop cannot see is a field that is
         * absent — it iterates the keys the graph actually has.
         *
         * Fail-closed on a preview, per the ruling of 2026-08-12: a graph with
         * no `image` is a graph whose card origin nobody checked, and the whole
         * defect behind issue #35 was a check that looked at a mockup and found
         * nothing to say.
         */
        if (noindex) {
          for (const field of ['image', 'logo']) {
            const value = graph[field];
            if (typeof value !== 'string' || value === '') {
              say(
                `LocalBusiness.${field} is missing on a noindex build, so nothing checks that ` +
                  `the graph cites a host that serves the file (issue #35)`,
              );
            }
          }
        }

        for (const area of graph.areaServed ?? []) {
          const name = String(area?.name ?? '').trim();
          if (name && !siteText.includes(name.toLowerCase())) {
            say(`areaServed names "${name}" but the site never mentions it anywhere`);
          }
        }

        const phone = String(graph.telephone ?? '').trim();
        if (phone) {
          // Compare digits: the graph writes "(201) 867-2338", the link writes
          // "tel:+12018672338".
          const digits = (s) => s.replace(/\D/g, '');
          const dialled = [...html.matchAll(/href=["']tel:([^"']+)["']/gi)].map((m) => digits(m[1]));
          if (dialled.length > 0 && !dialled.some((d) => d.endsWith(digits(phone)))) {
            say(`telephone ${phone} is not a number any link on this page dials`);
          }
        }

        /* --- review markup ---------------------------------------------- */
        const agg = graph.aggregateRating;
        const reviews = graph.review ?? [];
        if (agg || reviews.length > 0) {
          if (!graph['@id']) {
            say(
              'review markup sits on a LocalBusiness with no @id — the rating attaches to a ' +
                'nameless second entity instead of the business, and the rich result cannot be awarded',
            );
          }
          if (agg) {
            const rv = Number(agg.ratingValue);
            const rc = Number(agg.reviewCount);
            if (!Number.isFinite(rv) || rv < 1 || rv > 5) {
              say(`aggregateRating.ratingValue ${agg.ratingValue} is not a rating between 1 and 5`);
            }
            if (!Number.isInteger(rc) || rc < 1) {
              say(`aggregateRating.reviewCount ${agg.reviewCount} is not a positive whole number`);
            }
            if (Number.isFinite(rc) && rc < reviews.length) {
              say(`aggregateRating.reviewCount (${rc}) is below the ${reviews.length} reviews marked up`);
            }
          }
          for (const r of reviews) {
            const body = String(r?.reviewBody ?? '').trim();
            if (body && !text.includes(body.toLowerCase().slice(0, 40))) {
              say(`a Review is marked up whose text does not appear on the page`);
            }
            const rating = Number(r?.reviewRating?.ratingValue);
            const best = Number(r?.reviewRating?.bestRating ?? 5);
            if (!Number.isFinite(rating) || rating < 1 || rating > best) {
              say(`a Review has ratingValue ${r?.reviewRating?.ratingValue}, outside 1..${best}`);
            }
          }
        }
      }
    }

    // Two nodes claiming the same identity must not claim different types.
    const byId = new Map();
    for (const graph of graphs) {
      for (const [node] of nodes(graph)) {
        if (!node['@id'] || !node['@type']) continue;
        const prev = byId.get(node['@id']);
        if (prev && prev !== node['@type']) {
          say(`@id ${node['@id']} is both a ${prev} and a ${node['@type']}`);
        }
        byId.set(node['@id'], node['@type']);
      }
    }
  }

  if (problems.length === 0) {
    console.log(`✓ ${slug}: ${blockCount} JSON-LD block(s) valid, and consistent with the pages.`);
    return true;
  }

  console.error(`\n✗ ${slug}: ${problems.length} structured-data problem(s).\n`);
  for (const p of problems.slice(0, 40)) console.error(`    ${p}`);
  if (problems.length > 40) console.error(`    … and ${problems.length - 40} more`);
  console.error(
    '\n  Structured data is read as a factual claim by the business. Fix the graph, or fix\n' +
      '  the page it disagrees with. Do not delete this check.\n',
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
