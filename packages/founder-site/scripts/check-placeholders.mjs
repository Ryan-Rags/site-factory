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
import { escapeRe, headshot, htmlPages, linkedinUrl, problem, report, requireDist } from './lib.mjs';

requireDist();

/**
 * Two of the four slots are now WIRED: the build renders the real artifact the
 * moment Ryan supplies it, so this gate cannot hold a fixed expectation of
 * either. It reads the same ground truth the build read — the file on disk, the
 * constant in src/site.ts — and asserts the built HTML agrees with it.
 *
 * The point is that filling a slot must not weaken the gate. Unfilled, a
 * missing placeholder fails. Filled, a missing <img> or <a> fails. There is no
 * state in which the slot can quietly be nothing at all, which is the failure
 * "just delete the placeholder when you add the photo" would have produced.
 */
const linkedin = linkedinUrl();
const photo = headshot();

/** Pages wearing the founder footer, and therefore the LinkedIn slot. */
const FOUNDER_ROUTES = ['/', '/sites', '/ai', '/about'];

/** A wired slot expects its placeholder only while it is unfilled. */
const photoSlots = photo.present ? 0 : 1;
const linkedinSlots = linkedin ? 0 : 1;

/** route → token → exact expected count. */
const EXPECTED = {
  '/': { PHOTO_HERE: photoSlots, LINKEDIN_URL: linkedinSlots },
  '/sites': { DEMO_LINK: 5, LINKEDIN_URL: linkedinSlots },
  '/ai': { CASE_STUDY: 3, LINKEDIN_URL: linkedinSlots },
  '/about': { LINKEDIN_URL: linkedinSlots },
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

// --- filled slots must render the real thing -------------------------------
//
// The opposite failure to a dropped placeholder, and the more expensive one: a
// filled constant with nothing in the built HTML ships a hero with a hole in it.

const home = pages.find((p) => p.route === '/');
if (photo.present && home) {
  const img = new RegExp(`<img[^>]*\\ssrc="${escapeRe(photo.src)}"`, 'i');
  if (!img.test(home.html)) {
    problem(
      `/: public${photo.src} exists but the built hero renders no <img src="${photo.src}"> — ` +
        'the photo slot is filled on disk and empty on the page.',
    );
  }
}
if (!photo.present && home && /<img[^>]*class="headshot"/i.test(home.html)) {
  problem(`/: renders the headshot <img> but public${photo.src} does not exist — that is a 404 in the hero.`);
}

if (linkedin) {
  const anchorRe = new RegExp(`href="${escapeRe(linkedin)}"`, 'i');
  for (const route of FOUNDER_ROUTES) {
    const page = pages.find((p) => p.route === route);
    if (page && !anchorRe.test(page.html)) {
      problem(`${route}: LINKEDIN_URL is set but the built footer links nowhere to it.`);
    }
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
console.log(
  `      ${total} placeholder slot(s) across ${pages.length} page(s), all as declared ` +
    `(headshot ${photo.present ? 'FILLED' : 'pending'}, linkedin ${linkedin ? 'FILLED' : 'pending'})`,
);
report('check-placeholders');
