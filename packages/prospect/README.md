# @site-factory/prospect

One command turns a prospect into a personalised demo site, a live URL, and two
printable cards.

```bash
pnpm demo -- --prospect kh-machine-works
pnpm demo -- --all                        # every prospect this repo knows about
pnpm demo -- --prospect acme-welding --skip-deploy
```

## What it does, in order

1. **Ingest** — fills `prospects/<id>/prospect.json` from four sources, in
   precedence order: the hand-authored client config (`manual`), files you
   dropped in `prospects/<id>/assets/` (`folder`), the Google Places API
   (`places`), and the prospect's own website (`website`).
2. **Project** — turns that into the template's `SiteConfig`, written to
   `prospects/<id>/site.config.json`.
3. **Build** — `SITE_CONFIG_FILE=… SITE_CLIENT=<id> pnpm -C packages/template build`,
   so the marker gate runs on generated output too.
4. **Shoot** — the new site at 1440×900 and 390×844, and their current site at
   the same two viewports (reusing `audit/out/<id>/` if the audit has been
   there).
5. **Deploy** — one Cloudflare Pages project per prospect,
   `https://<id>-preview.pages.dev`, verified on `/` and `/services/`.
6. **Cards** — `cards/qr-card.png` (3.5×5in at 300dpi) and
   `cards/before-after.png` (2400×1350).
7. **Manifest** — `prospects/<id>/demo.json`, plus a summary printed to stdout
   listing every field no source could fill.

## The drop-box: `prospects/<id>/assets/`

Classification is by filename, and nothing else:

| Filename | Treated as |
| --- | --- |
| `logo.*` | the logo — used for the site *and* for palette extraction |
| anything else that decodes as an image | a photo, used for the hero, story and service images |
| anything that is not an image | ignored, and reported as ignored |

Supported: `.svg .png .jpg .jpeg .webp .avif .gif`.

## Brand colours

If there is a logo, the palette is extracted from it (dominant non-neutral
colour, plus the most distinct second colour) and darkened only as far as WCAG
AA requires. Failing that, photos are tried. Failing that, a per-niche palette
of **ours** is generated, hue-shifted by a hash of the slug so two shops in one
trade do not get identical demos — and `brand.createdByUs` is set, which the
run summary prints in capitals. Never pitch a generated palette as their brand.

## What it will not do

- **Fabricate.** Every field is a value with a source or an explicit
  `unavailable` with a reason. Missing services, hours, reviews or a phone
  number produce a thinner site, never an invented one.
- **Publish.** Generated configs are always `seo.noindex: true`.
- **Scrape Google.** Places data comes from the official API, keyed from
  `.env`. No key means the Places fields stay unavailable and the run
  continues.
- **Touch the template's tree.** Content markdown generated for a prospect that
  has none is written before the build and removed after it; an existing file
  is never overwritten.

Rate limits on third-party navigation are the repo's: at most one page
navigation per second per domain, and this package takes at most five per site.
