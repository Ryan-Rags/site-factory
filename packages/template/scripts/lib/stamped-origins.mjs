/**
 * Every absolute URL a built page stamps into its own head, with what kind of
 * claim each one is making.
 *
 * A built page carries two different sorts of absolute URL and they fail in
 * two different ways:
 *
 *   ASSET    — `og:image`, `twitter:image`, and the JSON-LD graph's `image`
 *              and `logo`. Something on somebody else's machine is going to
 *              FETCH these. If the host in the tag does not serve the file,
 *              the link arrives blank and nothing local can tell.
 *
 *   IDENTITY — the canonical, `og:url`, and the graph's `url` and `@id`.
 *              Nobody fetches these to render the page; they are a statement
 *              about where this business lives. The ledger of 2026-08-13 rules
 *              that they keep `seo.siteUrl` even on a mockup, because pointing
 *              them at a pages.dev subdomain would tell crawlers a prospect's
 *              business lives there.
 *
 * The reason both are collected here rather than only the fetchable half:
 * `check-metadata.mjs` already guards the card, and c3m still shipped six
 * wrong URLs. Its `seo.siteUrl` *was* a pages.dev host — the one the deploy
 * did not end up using — so the identity claims were wrong too, and no gate
 * that only looks at cards can see that. See `docs/known-issues.md` #13.
 *
 * Parsing, not rendering: this reads built bytes, the same discipline
 * `check-metadata.mjs` and `check-markers.mjs` keep. A tag this cannot parse
 * is reported by its caller as unparseable rather than skipped.
 */

export const ASSET = 'asset';
export const IDENTITY = 'identity';

/**
 * The two asset tags an unfurler actually fetches to draw a preview.
 *
 * Split out from the other assets because ONE RULE APPLIES TO THESE AND NOT TO
 * THE REST: the bytes behind them have to be a format the platforms will
 * render. Facebook, X, LinkedIn, iMessage, WhatsApp and Slack all decline SVG,
 * so a card that answers 200 with `image/svg+xml` is a link that unfurls blank
 * — measured on 6 of 6 demos, issue #61.
 *
 * THE EXEMPTION IS DELIBERATE AND MUST NOT BE "FIXED". The JSON-LD graph's
 * `image` and `logo` are ASSET too, and `logo` is `/images/logo.svg` on all
 * nine hand-authored clients BY DESIGN — it is a mark in a structured-data
 * graph, not a preview card, and nothing unfurls it. Widening the raster rule
 * to every asset would turn all nine clients red for shipping exactly what
 * they are supposed to ship, and a gate that is red in normal operation is a
 * gate somebody switches off. Same reasoning as the asset/identity split
 * above; ruled on PR #64's Brief.
 */
export const CARD_LABELS = new Set(['og:image', 'twitter:image']);

/** Content types a social platform will actually draw a card from. */
export const DRAWABLE_CARD_TYPES = new Set(['image/png', 'image/jpeg']);

/**
 * `<meta>` content by `property=` or `name=`, in either attribute order.
 *
 * The key is interpolated into the pattern unescaped, which is safe because
 * every caller passes a literal from the list below — `og:image`, `og:url`,
 * `twitter:image` — and none of those carries a regex metacharacter. Escaping
 * would be defending against a caller that does not exist.
 */
function meta(html, key) {
  const pattern = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*>`, 'i');
  const tag = pattern.exec(html)?.[0];
  return tag ? (/content=["']([^"']*)["']/i.exec(tag)?.[1] ?? null) : null;
}

function canonical(html) {
  return (
    /<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i.exec(html)?.[1] ??
    /<link[^>]+href=["']([^"']+)["'][^>]*rel=["']canonical["']/i.exec(html)?.[1] ??
    null
  );
}

/**
 * The `LocalBusiness` node's four absolute URLs.
 *
 * Every `application/ld+json` block is parsed rather than the first, because
 * `BaseLayout` emits a second `FAQPage` script on the page carrying the FAQ
 * and the order is a template detail this should not depend on. A block that
 * does not parse is returned as a problem: an unparseable graph is a defect in
 * its own right, and silently skipping it is how a broken graph ships.
 */
function jsonLd(html) {
  const urls = [];
  const unparseable = [];
  for (const m of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    let doc;
    try {
      doc = JSON.parse(m[1]);
    } catch (err) {
      unparseable.push(err.message);
      continue;
    }
    for (const node of Array.isArray(doc) ? doc : [doc]) {
      if (node?.['@type'] !== 'LocalBusiness') continue;
      for (const [key, kind] of [
        ['image', ASSET],
        ['logo', ASSET],
        ['url', IDENTITY],
        ['@id', IDENTITY],
      ]) {
        if (typeof node[key] === 'string') urls.push({ label: `json-ld ${key}`, url: node[key], kind });
      }
    }
  }
  return { urls, unparseable };
}

/**
 * @returns `{ stamped, unparseable }` — every absolute URL this page declares,
 *   and the parse errors of any JSON-LD block that could not be read.
 *
 * A tag that is absent contributes nothing here. Absence is
 * `check-metadata.mjs`'s business — it fails closed on a missing card, and
 * duplicating that would give two gates one rule to disagree about.
 */
export function stampedUrls(html) {
  const { urls, unparseable } = jsonLd(html);
  const stamped = [
    { label: 'canonical', url: canonical(html), kind: IDENTITY },
    { label: 'og:url', url: meta(html, 'og:url'), kind: IDENTITY },
    { label: 'og:image', url: meta(html, 'og:image'), kind: ASSET },
    { label: 'twitter:image', url: meta(html, 'twitter:image'), kind: ASSET },
    ...urls,
  ].filter((entry) => typeof entry.url === 'string' && entry.url !== '');
  return { stamped, unparseable };
}

/** Cloudflare Pages hosting — ours, as opposed to a client's own domain. */
export function isPagesHost(origin) {
  try {
    return new URL(origin).hostname.endsWith('.pages.dev');
  } catch {
    return false;
  }
}
