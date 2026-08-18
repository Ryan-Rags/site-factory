# @site-factory/founder-site

Ryan's public founder/credibility site for **raghubans.com**.

This is **not** a client demo and it does not go through the client pipeline. It
has no client config, no copy pack, no fabrication or marker gates, no
`LocalBusiness` JSON-LD and no contact-form Worker. Design values were copied in
from the template's `apex` preset as literals; there is **zero runtime coupling to
`packages/template`**.

## Who reads it

Luxury-apartment property managers who received a cold email and are checking
whether the sender is a real operator. They open it on a phone. It has to read
"established founder", not "personal blog" — which is why several template
defaults are deliberately inverted here.

## It is its own pnpm workspace root

The repo root's `pnpm-workspace.yaml` enumerates its members and has no
`packages/*` glob, so this package carries an empty `packages: []` of its own to
terminate pnpm's upward search. Install and build from **inside this directory**:

```sh
cd packages/founder-site
pnpm install
pnpm build
```

Root-level `pnpm -r build` does not include it, by design.

## Inversions from the client-template defaults

Each one is enforced by a gate, because a default that a copy-paste would get
wrong is not safe as a comment.

| Client mockups | This site | Gate |
| --- | --- | --- |
| `noindex`, `Disallow: /`, no sitemap | indexed; robots allows; sitemap emitted + linked; canonical everywhere | `check-indexable.mjs` |
| `LocalBusiness` JSON-LD | none — a person is not a storefront | `check-metadata.mjs` |
| contact form → Worker → KV | `mailto:` only | `check-no-forms.mjs` |
| CSP with per-page script hashes | `frame-ancestors 'none'` only; no client JS to protect | `check-headers.mjs`, `check-no-forms.mjs` |
| `NO_LCP` under mobile emulation | measures a real performance number | Lighthouse, below |

## Gates

`pnpm build` runs seven gates against `dist/` — never against the `.astro`
sources, because "the source says canonical" and "the deployed page carries a
canonical" are different claims:

| Gate | Guards |
| --- | --- |
| `check-indexable` | robots allows, sitemap emitted + referenced, canonical per route, no `noindex` |
| `check-metadata` | complete, unique, length-budgeted titles/descriptions/OG; og:image actually emitted; no `LocalBusiness` |
| `check-amenity-wording` | the amenity category word never reaches readable text or metadata |
| `check-placeholders` | placeholder counts per route **for the current slot state**, the filled artifact when a slot is filled; no `*.pages.dev` demo links |
| `check-no-forms` | no forms, no controls, no `<script>`, no inline handlers, no third-party hosts |
| `check-motion` | no reveal on any hero (the LCP element), nothing pre-hidden outside the `@supports` guard, the reveal keyframes animate no opacity, reduced motion collapses to still, motion stays CSS |
| `check-headers` | `_headers` reaches `dist/` with all four directives intact |

Two more need a browser, so they are **not** in `pnpm build` (it must run on a
machine with no Chromium) — run them before deploying:

```sh
node scripts/check-textfit.mjs                      # 320px AND 390px fit; serves its own dist/
node scripts/check-live.mjs https://<origin>        # post-deploy: 200s, headers, no redirect hops, one-tap nav, CTA resolution
```

Every gate was landed failure-first; the transcript is in
`docs/evidence/founder-site-gate-failures.md`.

## Social cards

`pnpm gen:og` renders `public/og/*.png` (1200×630) with Playwright — a
devDependency only; nothing it produces is a runtime dependency. Not part of
`pnpm build`: it needs a browser and writes into `public/`. Run it when a page
title or the brand changes, and commit the PNGs.

## Placeholders

Rendered **visibly in-page** on purpose — a placeholder that only shows up in a
diff is one that ships. `check-placeholders.mjs` asserts the exact count of each,
so a slot cannot be silently dropped instead of filled.

| Token | Where | Fill with | How |
| --- | --- | --- | --- |
| `PHOTO_HERE` | `/` hero | headshot, 4:5 portrait, ≥800×1000 | **wired** — drop the file at `public/ryan.jpg` |
| `LINKEDIN_URL` | footer, all founder pages | public LinkedIn profile URL | **wired** — set `LINKEDIN_URL` in `src/site.ts` |
| `DEMO_LINK` | `/sites`, ×1 | the first signed client's live URL, name and a one-line result | edit `sites.astro` |
| `CASE_STUDY` | `/ai`, ×3 | dental voice-agent problem / build / **measured** result | edit `ai.astro` |

The two **wired** slots need no code change. Drop `public/ryan.jpg` in, or set
`LINKEDIN_URL` to a string, and the next build renders the real thing and stops
rendering the placeholder. Leave them and the build still succeeds — that is the
point, and both states are gated:

```sh
      13 placeholder slot(s) across 5 page(s), all as declared (headshot pending, linkedin pending)
      8 placeholder slot(s) across 5 page(s), all as declared (headshot FILLED, linkedin FILLED)
```

Filling a slot must not weaken the gate. Unfilled, a missing placeholder fails.
Filled, a missing `<img>` or `<a>` fails. `check-placeholders.mjs` reads the same
ground truth the build reads — the file on disk, the constant in `site.ts` — so
there is no state in which a slot is quietly nothing at all.

> `src/assets.ts` resolves `public/ryan.jpg` from **`process.cwd()`**, not from
> `import.meta.url`. Vite SSR-bundles that module before Astro runs it, so
> `import.meta.url` is the bundled chunk's path and the relative hop misses
> `public/` entirely — the file exists and the page renders the placeholder
> anyway. The gate is what caught it; do not "simplify" it back.

## Navigation: every route is one tap from every other

One bar, on every page, in both palettes: **Home · Sites · Alcove · AI · About**.

`/amenity` used to be the exception — brand wordmark, one CTA, no site nav, on
the theory that it should read as a separate company to a property manager
arriving from a cold email. Measured on the deployed site, the cost of that was
that its only route out was one discreet line in its own footer, so the other
three routes were two taps away and the page read as a dead end.

What survives of the separation is everything that still earns its keep: the
amenity wordmark, the amenity CTA, and the whole `[data-surface='amenity']`
token block. The nav is deliberately **not** restyled for that surface —
`.topbar` is written against `--base`, `--line` and `--ink-muted`, so the
light/brass tokens re-skin it automatically. A second rule set would be a second
thing to keep in sync.

`check-live.mjs` asserts reachability on the **deployed** HTML: a 5×5 matrix
with an empty diagonal, built from the documents it was already fetching, so it
costs no extra requests. It is stated as reachability rather than as "the nav
component is present" because the second one passes on a nav that renders zero
links.

> Known gap: this is a post-deploy gate, so a nav regression is caught after
> publish rather than at build. See `docs/known-issues.md`.

## Motion: the calm register, and no JavaScript

The reveal is **CSS-only scroll-driven animation** — `animation-timeline: view()`
inside `@supports`, at the `calm` preset's own literals (0.5rem travel,
`cubic-bezier(0.33, 1, 0.68, 1)`, stagger as a per-item range offset).

It is a port of the design system's **treatment**, deliberately not of its
**mechanism**. `packages/template` reveals with a ~700-byte inline
IntersectionObserver; here `check-no-forms.mjs` fails the build on any
`<script>` and `_headers` ships no `script-src` CSP because there has never been
a script to protect. Relaxing both, permanently, to buy a decoration is a bad
trade on the page that exists to prove competence.

**The reveal animates `transform` only, and that is measured.** A scroll-linked
fade has no discrete states: at rest an element straddling the fold sits at
whatever fraction of its range its position implies, so its text renders at a
blended colour. Lighthouse priced the fade exactly:

| Page | Element | Contrast | Needs |
| --- | --- | --- | --- |
| `/sites` | 3 × `.prose > p` | 3.35:1 (`#616468` on `#08090a`) | 4.5:1 |
| `/amenity` | 1 × `.prose > p` | 3.59:1 (`#87827a` on `#faf8f5`) | 4.5:1 |

Accessibility 100 → 95 on both. A shorter range does not fix that, it only moves
which element gets caught mid-fade. `transform` cannot change a computed colour,
so the rise survived and the fade did not — and `check-motion.mjs` asserts the
keyframes stay opacity-free so it cannot drift back.

Nothing is ever pre-hidden, for three independent reasons: the base `.reveal`
rule is the final state (so a browser without scroll-driven animations — Firefox
today — renders the complete page and simply does not animate), no hero element
carries `.reveal`, and `prefers-reduced-motion: reduce` never enters the block.

## The /sites portfolio grid

`/sites` links five **demonstration builds of invented businesses**, one per
design family, at `portfolio-*.pages.dev`. They exist because the page needed to
show the families without linking a client's site or a prospect's private pitch.

`check-placeholders.mjs` enforces that distinction by host: every
`*.pages.dev` link is refused **except** the `portfolio-` prefix, tested against
`URL.hostname` so neither a path nor a suffix can smuggle it in. A
`<slug>-preview.pages.dev` link still fails, because that is a pitch about a
named real business that has not signed.

See `packages/template/clients/portfolio-*.config.ts` for the fabrication
discipline those five are built under.

## Renaming the amenity venture

`AMENITY_BRAND` in `src/site.ts` is the single source. Nothing else spells the
name. Change it there, re-run `pnpm gen:og` (the amenity card has the name baked
into the PNG), rebuild.

## Performance

Lighthouse **mobile**, all four categories. The Lighthouse run is also this
package's contrast check (it caught a 3.02:1 footer CTA), so treat 90+ across
all categories as a release gate, not a nice-to-have.

**Which origin you measure changes the score, and only one of the three is the
site.** Measured 2026-08-18, same artifact on all three:

| Origin | perf | a11y | best-practices | SEO | LCP |
| --- | --- | --- | --- | --- | --- |
| `raghubans.com` (production) | 99–100 | 100 | 100 | **92** | 1.5 s |
| `raghubans-com.pages.dev` (alias) | 100 | 100 | 100 | 100 | 0.8 s |
| `<hash>.raghubans-com.pages.dev` (immutable) | 100 | 100 | 100 | **66** | 0.8 s |

Both outliers are the platform, not the build:

- **SEO 92 on the apex** is one audit, `robots-txt`, one error: `Unknown
  directive` on the `Content-Signal:` line that **Cloudflare's managed
  robots.txt prepends at the zone**. Our `robots.txt` is byte-identical on all
  three origins and passes on the other two. Not fixable from this package —
  zones are out of scope here. See `docs/known-issues.md`.
- **SEO 66 on an immutable deployment URL** is `is-crawlable`: Cloudflare serves
  preview deployments with `x-robots-tag: noindex`. Expected, and the reason a
  preview URL is a fine place to verify the *artifact* and a useless place to
  measure SEO.
- **LCP 1.5 s on the apex vs 0.8 s on pages.dev** is the apex's network path
  (FCP moves with it); CLS 0 and TBT 0 ms everywhere.

So: verify the artifact on the immutable URL, measure performance and SEO on the
alias, and read the apex's SEO score knowing one point of it belongs to the
zone.

No webfonts, no client JS, one inlined stylesheet per page.

## Deploy

Static build → Cloudflare Pages project **`raghubans-com`**.

```sh
pnpm build
node scripts/check-textfit.mjs
npx wrangler pages deploy dist --project-name raghubans-com --branch main
node scripts/check-live.mjs https://raghubans-com.pages.dev
```

> **When attaching raghubans.com in Pages, existing MX/SPF/DKIM/DMARC records must remain untouched — email lives on this domain.**

DNS, zones and custom domains are Ryan's to attach; nothing in this package
touches them.
