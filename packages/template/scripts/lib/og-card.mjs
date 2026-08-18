/**
 * The 1200×630 social card, as markup.
 *
 * ONE implementation, two callers, and they are in different packages:
 *
 *   - `scripts/gen-brand-assets.mjs` draws it for a hand-authored client,
 *     reading the brand out of `clients/<slug>.config.ts`.
 *   - `packages/prospect/src/og-card.ts` draws it for a generated demo,
 *     reading the brand out of the already-projected `SiteConfig` and the
 *     design family the demo actually renders in.
 *
 * Those two arrive at `CardInfo` by completely different routes, which is
 * exactly why the drawing is here rather than in either of them: a card that
 * is laid out twice is one retune away from a client's card and a prospect's
 * card being different products, and nobody would notice until both were on a
 * phone screen side by side.
 *
 * Plain `.mjs` with a `.d.ts` beside it, the arrangement `src/lib/preview-
 * origin.mjs` already uses and for its reason: this has to be readable both by
 * a bare `node scripts/…` script and by TypeScript in another package, and a
 * `.ts` module cannot be the first of those. The prospect package loads it by
 * absolute path through `pathToFileURL`, the same boundary `paths.ts` already
 * crosses for the copy engine.
 *
 * Nothing here fetches, reads a file or launches anything. It returns a
 * string; the caller screenshots it with whatever browser it already has open.
 */

/**
 * The card's fixed size.
 *
 * 1200×630 is the size `Seo.astro` declares in `og:image:width` /
 * `og:image:height`, and `check-metadata.mjs` reads the real PNG header out of
 * `dist/` and fails the build if the declared numbers are not the file's. So
 * this constant, that one and the bytes are held together by a gate rather
 * than by three people remembering the same number.
 */
export const OG_CARD_SIZE = { width: 1200, height: 630 };

/**
 * @typedef {object} CardInfo
 * @property {string} name      the business name, as the card's headline.
 * @property {string} place     "Locality, REGION" — may be empty.
 * @property {string} tagline   one line under the name — may be empty.
 * @property {string} logoDataUri  the mark, already inlined as a data URI.
 * @property {{ base: string, ink: string, inkMuted: string }} palette
 * @property {string} accent    the accent colour of the tone in play.
 */

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * @param {CardInfo} info
 * @returns {string} a complete document, ready to `setContent` and screenshot.
 *
 * The single `body > div` is the screenshot target for both callers — clip to
 * the element rather than the viewport, so the card is 1200×630 because the
 * element is, not because the window happened to be.
 */
export function ogCardHtml(info) {
  const { palette, accent, name, tagline, place, logoDataUri } = info;
  return `<!doctype html><html><body style="margin:0">
<div style="width:1200px;height:630px;box-sizing:border-box;padding:72px;
            background:${palette.base};color:${palette.ink};
            font-family:ui-sans-serif,system-ui,'Segoe UI',Roboto,Arial,sans-serif;
            display:flex;flex-direction:column;justify-content:space-between;
            border-bottom:16px solid ${accent};">
  <div style="display:flex;align-items:center;gap:20px;">
    <img src="${logoDataUri}" width="72" height="72" alt="">
    <span style="font-size:28px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;
                 color:${accent};">${esc(place)}</span>
  </div>
  <div>
    <div style="font-size:76px;line-height:1.05;font-weight:800;letter-spacing:-.02em;">
      ${esc(name)}
    </div>
    <div style="margin-top:24px;font-size:32px;line-height:1.35;max-width:900px;
                color:${palette.inkMuted};">${esc(tagline)}</div>
  </div>
</div></body></html>`;
}
