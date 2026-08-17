/**
 * Complete, per-page, non-duplicated head metadata.
 *
 * The duplicate check is the one that earns its keep. Missing metadata is
 * obvious the first time anyone looks at a page; four pages quietly sharing one
 * description because a layout supplied a fallback is not, and it is the single
 * most common way a small site's search presence goes flat.
 *
 * Also asserts the referenced OG image was actually emitted — an og:image 404 is
 * invisible locally and is the first thing a recipient sees when a link unfurls
 * in mail or iMessage.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { distDir, htmlPages, metaContent, problem, report, requireDist, titleOf } from './lib.mjs';

requireDist();

/** Bounds are search-result truncation, not style. Outside them is a warning-as-failure. */
const TITLE_MAX = 70;
const DESC_MIN = 70;
const DESC_MAX = 165;

const REQUIRED_META = [
  ['property', 'og:type'],
  ['property', 'og:site_name'],
  ['property', 'og:title'],
  ['property', 'og:description'],
  ['property', 'og:url'],
  ['property', 'og:image'],
  ['property', 'og:image:alt'],
  ['name', 'twitter:card'],
  ['name', 'twitter:title'],
  ['name', 'twitter:description'],
  ['name', 'twitter:image'],
];

const pages = htmlPages();
if (pages.length === 0) problem('no HTML pages in dist/.');

const seenTitles = new Map();
const seenDescs = new Map();

for (const page of pages) {
  const title = titleOf(page.html);
  if (!title) {
    problem(`${page.route}: empty or missing <title>.`);
  } else {
    if (title.length > TITLE_MAX) {
      problem(`${page.route}: <title> is ${title.length} chars (max ${TITLE_MAX}) — "${title}".`);
    }
    const prior = seenTitles.get(title);
    if (prior) problem(`${page.route}: <title> duplicates ${prior}.`);
    else seenTitles.set(title, page.route);
  }

  const desc = metaContent(page.html, 'name', 'description');
  if (!desc) {
    problem(`${page.route}: no meta description.`);
  } else {
    if (desc.length < DESC_MIN || desc.length > DESC_MAX) {
      problem(
        `${page.route}: meta description is ${desc.length} chars (want ${DESC_MIN}-${DESC_MAX}).`,
      );
    }
    const prior = seenDescs.get(desc);
    if (prior) problem(`${page.route}: meta description duplicates ${prior}.`);
    else seenDescs.set(desc, page.route);
  }

  for (const [attr, name] of REQUIRED_META) {
    const value = metaContent(page.html, attr, name);
    if (!value) problem(`${page.route}: missing ${name}.`);
  }

  const ogImage = metaContent(page.html, 'property', 'og:image');
  if (ogImage) {
    if (!/^https:\/\//.test(ogImage)) {
      problem(`${page.route}: og:image "${ogImage}" is not an absolute https URL — crawlers need one.`);
    } else {
      const local = new URL(ogImage).pathname.replace(/^\//, '');
      if (!existsSync(join(distDir, local))) {
        problem(`${page.route}: og:image points at ${local}, which is not in dist/.`);
      }
    }
  }

  // A LocalBusiness graph on a personal brochure would be a claim about a
  // business that does not have a storefront. Explicitly out of scope here.
  if (/"@type"\s*:\s*"LocalBusiness"/.test(page.html)) {
    problem(`${page.route}: emits LocalBusiness JSON-LD — this site is not a local business.`);
  }
}

console.log(`      checked ${pages.length} page(s), ${seenTitles.size} distinct title(s)`);
report('check-metadata');
