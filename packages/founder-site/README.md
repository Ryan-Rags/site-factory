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

`pnpm build` runs six gates against `dist/` — never against the `.astro`
sources, because "the source says canonical" and "the deployed page carries a
canonical" are different claims:

| Gate | Guards |
| --- | --- |
| `check-indexable` | robots allows, sitemap emitted + referenced, canonical per route, no `noindex` |
| `check-metadata` | complete, unique, length-budgeted titles/descriptions/OG; og:image actually emitted; no `LocalBusiness` |
| `check-amenity-wording` | the amenity category word never reaches readable text or metadata |
| `check-placeholders` | exact placeholder counts per route; no `*.pages.dev` demo links |
| `check-no-forms` | no forms, no controls, no `<script>`, no inline handlers, no third-party hosts |
| `check-headers` | `_headers` reaches `dist/` with all four directives intact |

Two more need a browser, so they are **not** in `pnpm build` (it must run on a
machine with no Chromium) — run them before deploying:

```sh
node scripts/check-textfit.mjs                      # 320px fit; serves its own dist/
node scripts/check-live.mjs https://<origin>        # post-deploy: 200s, headers, no redirect hops
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

| Token | Where | Fill with |
| --- | --- | --- |
| `PHOTO_HERE` | `/` hero | headshot, 4:5 portrait, ≥800×1000 |
| `DEMO_LINK` | `/sites`, ×5 | live client URL + name + one-line result, as clients sign off |
| `CASE_STUDY` | `/ai`, ×3 | dental voice-agent problem / build / **measured** result |
| `LINKEDIN_URL` | footer, all founder pages | public LinkedIn profile URL |

## Renaming the amenity venture

`AMENITY_BRAND` in `src/site.ts` is the single source. Nothing else spells the
name. Change it there, re-run `pnpm gen:og` (the amenity card has the name baked
into the PNG), rebuild.

## Performance

Lighthouse **mobile**, all four categories, measured against the deployed site —
`100 / 100 / 100 / 100` on all five routes; LCP 0.8–1.0 s, CLS 0, TBT 0 ms. The
Lighthouse run is also this package's contrast check (it caught a 3.02:1 footer
CTA), so treat 90+ across all categories as a release gate, not a nice-to-have.

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
