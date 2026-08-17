/**
 * Placeholders are load-bearing until Ryan fills them, so their presence is
 * asserted rather than assumed.
 *
 * Two failure modes, opposite directions:
 *
 *   Dropped  — a refactor removes the DEMO_LINK cards and /sites silently ships
 *              an empty demo grid that reads as "no work to show".
 *   Escaped  — a placeholder token leaks onto a page that should not have one.
 *
 * The DEMO_LINK count is exact (five) because the spec says five cards, and a
 * grid that quietly became four is exactly the kind of drift nobody notices.
 *
 * This gate also enforces the rule that /sites links NO live client or prospect
 * demo. Those builds are private, noindex pitches; an indexed page linking one
 * would both expose the pitch and pull it into a crawl.
 */
import { htmlPages, problem, report, requireDist } from './lib.mjs';

requireDist();

/** route → token → exact expected count. */
const EXPECTED = {
  '/': { PHOTO_HERE: 1, LINKEDIN_URL: 1 },
  '/sites': { DEMO_LINK: 5, LINKEDIN_URL: 1 },
  '/ai': { CASE_STUDY: 3, LINKEDIN_URL: 1 },
  '/about': { LINKEDIN_URL: 1 },
  // Amenity wears its own chrome, so it carries no founder-footer placeholder.
  '/amenity': {},
};

const ALL_TOKENS = ['PHOTO_HERE', 'DEMO_LINK', 'CASE_STUDY', 'LINKEDIN_URL'];

const pages = htmlPages();

for (const page of pages) {
  const expected = EXPECTED[page.route];
  if (!expected) {
    problem(`${page.route}: no placeholder expectation declared — add one to EXPECTED.`);
    continue;
  }

  for (const token of ALL_TOKENS) {
    // Count the marker attribute, not loose text: `data-placeholder="TOKEN"` is
    // emitted once per rendered Placeholder component, so this counts slots
    // rather than incidental mentions in prose.
    const count = (page.html.match(new RegExp(`data-placeholder="${token}"`, 'g')) ?? []).length;
    const want = expected[token] ?? 0;
    if (count !== want) {
      problem(`${page.route}: ${count} ${token} slot(s), expected ${want}.`);
    }
  }
}

for (const route of Object.keys(EXPECTED)) {
  if (!pages.some((p) => p.route === route)) {
    problem(`${route} is declared in EXPECTED but was not built.`);
  }
}

// No live demo links from the indexed site. pages.dev is where every prospect
// mockup in this repo is published, so it is the specific host to refuse.
for (const page of pages) {
  for (const m of page.html.matchAll(/href=["'](https?:\/\/[^"']+)["']/gi)) {
    const url = m[1];
    if (/\.pages\.dev/i.test(url)) {
      problem(
        `${page.route}: links ${url} — prospect/client demos are private noindex builds and ` +
          'must not be linked from an indexed page.',
      );
    }
  }
}

const total = pages.reduce(
  (n, p) => n + (p.html.match(/data-placeholder="/g) ?? []).length,
  0,
);
console.log(`      ${total} placeholder slot(s) across ${pages.length} page(s), all as declared`);
report('check-placeholders');
