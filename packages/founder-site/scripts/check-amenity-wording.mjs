/**
 * The amenity page's category word must never be readable.
 *
 * /amenity sells to luxury-apartment property managers. The word for the
 * category this business is technically in reads as "machine in a laundry room"
 * to that audience, and the whole page is positioned to avoid it. But the
 * contact mailbox's local part IS that word, so the risk is not a copywriting
 * slip — it is someone rendering the address as link text, or dropping the
 * founder footer onto the page, or writing it into a title.
 *
 * So: on /amenity the word may appear ONLY inside a `mailto:` href. Anywhere a
 * human or a crawler reads text, it fails the build.
 *
 * Site-wide, the same word is forbidden in <title>, meta description and all
 * OG/Twitter text on EVERY page — including the founder pages, which are allowed
 * to print the address in the footer but must not put it in metadata, because
 * metadata is what shows up in a search result and in a link unfurl.
 */
import {
  attrs,
  forbiddenAmenityWord,
  head,
  htmlPages,
  problem,
  report,
  requireDist,
  titleOf,
  visibleText,
} from './lib.mjs';

requireDist();

const word = forbiddenAmenityWord();
const wordRe = new RegExp(word, 'i');

const AMENITY_ROUTE = '/amenity';
const pages = htmlPages();

if (!pages.some((p) => p.route === AMENITY_ROUTE)) {
  problem(`${AMENITY_ROUTE} was not built — this gate has nothing to check.`);
}

for (const page of pages) {
  const isAmenity = page.route === AMENITY_ROUTE;

  if (isAmenity) {
    const text = visibleText(page.html);
    if (wordRe.test(text)) {
      const at = text.search(wordRe);
      problem(
        `${page.route}: visible copy contains "${word}" — ` +
          `…${text.slice(Math.max(0, at - 60), at + 60)}… ` +
          '(the address belongs in a mailto: href, never as text).',
      );
    }

    // Every occurrence anywhere on the page must be inside a mailto: href.
    // Strip those, then anything left is a leak — an alt, an aria-label, a
    // title attribute, a data attribute, a visible string.
    const withoutMailto = page.html.replace(
      new RegExp(`href=["']mailto:${word}@[^"']*["']`, 'gi'),
      'href="mailto:REDACTED"',
    );
    if (wordRe.test(withoutMailto)) {
      const at = withoutMailto.search(wordRe);
      problem(
        `${page.route}: "${word}" appears outside a mailto: href — ` +
          `…${withoutMailto.slice(Math.max(0, at - 80), at + 80)}…`,
      );
    }
  }

  // Metadata rule, all pages.
  if (wordRe.test(titleOf(page.html))) {
    problem(`${page.route}: <title> contains "${word}".`);
  }

  for (const m of head(page.html).matchAll(/<meta\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    if (a.content === undefined) continue;
    // Only tags whose content is rendered to a human: the description, and the
    // OG/Twitter text a link unfurl shows.
    const key = a.name ?? a.property ?? '';
    const isRendered = key === 'description' || /^(og|twitter):/i.test(key);
    if (isRendered && wordRe.test(a.content)) {
      problem(`${page.route}: metadata "${key}" contains "${word}" — "${a.content}"`);
    }
  }
}

console.log(`      forbidden word "${word}" clear across ${pages.length} page(s)`);
report('check-amenity-wording');
