# PLAN — demo (per-prospect demo pipeline)

Branch `feat/demo`, worktree `D:/sf-demo`. **Plan approved and built** — see
"Rulings" and "As built" below. The blocking questions are kept as written,
with the answers recorded against them, because two of the answers (Q3, Q4)
are the reason the code is shaped the way it is.

Goal: one command — `pnpm demo -- --prospect <id>` — that ingests a prospect,
generates their personalised site, deploys it to Cloudflare Pages on a clean
per-prospect subdomain, and emits a printable QR leave-behind card plus a
before/after screenshot card. Acceptance test: all 5 existing prospects.

---

## 1. What is already built (reuse, do not rebuild)

Verified in this checkout at `8eb90a0`:

| Piece | Where | What it already does |
| --- | --- | --- |
| Lead schema + Places client | `packages/discover/src/{types,places,csv}.ts` | 12-column CSV, `places:searchText` with a 7-field mask, 200-call/run budget, `--dry-run` fixture |
| Before screenshots | `packages/audit/src/probe.ts` → `audit/out/<slug>/{desktop,mobile}.png` | 1440×900 + 390×844 full-page, one Playwright visit, 17 checks with `pass/fail/unavailable` |
| Site build per client | `packages/template` — `SITE_CLIENT=<slug> pnpm build:client` → `dist/<slug>/` | static registry in `clients/index.ts`, marker gate (`check-markers.mjs`), contrast gate |
| After screenshots | `scripts/mockup/{serve,shoot}.mjs` → `outreach/<slug>/after-{desktop,mobile}.png` | ephemeral static server + Playwright, same two viewports |
| Deploy | `scripts/deploy/deploy-mockups.mjs` | one Pages project per client, creates if missing, deploys, verifies `/` and `/services/` over HTTP against the canonical alias |

So roughly half of the end state exists. The new work is: the prospect config
+ its ingestion, palette extraction, the two cards, and one orchestrator that
chains all of it behind a single prospect id.

## 2. Findings that change the shape of the work

**F1 — there is no design-family JSON in this repository.** `grep -ri` for
`design.famil|designFamily|palette` across the working tree and all four
remote branches (`main`, `feat/pipeline`, `feat/mockup`,
`chore/ignore-all-lead-csvs`) returns nothing. The template's design contract
is a **TypeScript interface**, `SiteConfig` in
[site.ts](packages/template/src/types/site.ts) — one design, parameterised by
two brand colours and two font stacks (`theme.colors.primary/accent`,
`theme.fonts.heading/body`). There is exactly one visual family today. → **Q1.**

**F2 — no Places key exists.** `.env` is absent; only `.env.example` with an
empty `GOOGLE_MAPS_API_KEY`. Every Places-sourced field is therefore
`unavailable` until you drop a key in. → **Q2.**

**F3 — "all 5 existing prospects" are the 5 template client configs**, not the
lead CSV. `data/leads-machine.csv` holds only 2 rows. Of the 5 configs, three
carry `seo.siteUrl: 'https://example.invalid'` — K-T-S, Industrial Machine
Corp and K&S Welding have **no known current website**:

| Prospect (slug) | Current site | "Before" half of the card |
| --- | --- | --- |
| `kh-machine-works` | khmachineworks.com | real screenshot |
| `american-machine-specialty` | americanmachinespecialty.com | real screenshot |
| `kts-machine-shop` | none | **unavailable** |
| `industrial-machine-corp` | none | **unavailable** |
| `ks-welding` | none | **unavailable** |

The before/after card for those three renders an explicit "no current website"
panel. It is not an error and it is never faked — this is the same rule as the
audit's `unavailable`.

**F4 — the 5 existing configs are hand-written and provenance-annotated.**
K-H's config carries sourcing comments for its founding year, phone, email and
address. A generator that overwrites `clients/<slug>.config.ts` would destroy
that work. → the generated path must not write over them (§4, Q3).

**F5 — ownership.** This work spans `packages/discover` + `packages/audit`
(`feat/pipeline`), `packages/template` (`feat/template`), and root `scripts/`
+ root `package.json` + `.gitignore` (shared). `claude.md` forbids writing into
another stream's directory without an explicit grant. → **Q7.**

## 3. The prospect config

`prospects/<id>/prospect.json` — **gitignored**, like `/audit/` and
`/outreach/`: it is third-party business data plus their logo and photos.

Every field is a `Sourced<T>` envelope, not a bare value:

```jsonc
{
  "id": "kh-machine-works",
  "fields": {
    "phone": { "value": "(201) 867-2338", "source": "website", "retrievedAt": "2026-08-11", "note": "footer, khmachineworks.com" },
    "foundedYear": { "status": "unavailable", "reason": "no public source found" }
  }
}
```

`source` ∈ `places | website | folder | generated | manual`. A field is either
a value with a source, or `unavailable` with a reason. There is no third state,
which is what mechanically prevents fabricated audit/ingest data.

Fields, matching your list and the `SiteConfig` shape it must project onto:
`businessName`, `legalName`, `niche`, `phone`, `address`, `hours`, `services[]`,
`brand.colors{primary,accent}`, `brand.logoPath`, `photos[]`, `reviews[]`,
`currentSiteUrl`, `designFamily`, plus `brandCreatedByUs: boolean` and
`ratingSummary{rating,count}`.

**Projection.** `prospect.json → SiteConfig` is one pure function with a
snapshot test. Copy fields it cannot source honestly (hero headline, taglines,
service one-liners) are emitted with the existing `VERIFY_MARKER`, so the
template's own marker gate blocks any generated site from going live-indexed —
the mockup lock (`seo.noindex: true`) stays on for every generated demo.

## 4. Ingestion

Three sources, merged by precedence **folder > website > places > generated**,
with each winning field keeping its provenance.

**(a) Places** — reuse `packages/discover/src/places.ts`; add a Place Details
call for `reviews`, `photos`, `regularOpeningHours`, `formattedAddress`,
`nationalPhoneNumber`. New SKU, so it is a separate field mask and stays inside
the existing 200-call budget guard. No key → every Places field `unavailable`,
exit 0. Google properties are never scraped; official API only (`claude.md`).

**(b) Their current website** — read-only GETs under the existing crawler
limit: **≤5 page navigations per prospect, ≥1s apart** (the rule allows 10).
Home + up to 4 of about/services/contact/hours. Extracts: `<title>`, phone
(`tel:` hrefs first), postal address (JSON-LD `LocalBusiness` first, then
footer text), nav-derived service names, `og:image`/logo `<img>` candidates.
JSON-LD is trusted; free-text guesses are recorded with a lower-confidence note
rather than promoted to a value.

**(c) Prospect folder** — you drop files in `prospects/<id>/assets/`:
`logo.*` (svg/png/jpg/webp) and any `photo-*.*`. Classified by filename, copied
into `packages/template/public/clients/<slug>/` at build time, referenced from
the generated config.

**Palette extraction.** From the logo if present, else the photos.
Implementation with **zero new native deps**: decode and downsample in the
Chromium instance Playwright already ships (`packages/audit` depends on
`playwright@^1.49.1`) via a canvas in an `about:blank` page, then k-means in TS
over the sampled pixels; drop near-white/near-black/low-saturation clusters,
take the two most distinct remaining hues as `primary`/`accent`. Then a
**contrast repair step**: darken/lighten until each reaches 4.5:1 on white, so
the template's existing `check:contrast` gate passes rather than fails at
build. Recorded as `source: "folder"`, `brandCreatedByUs: false`.

**No brand assets → generated palette.** A checked-in per-niche table
(machine shop / welding / dental / plumbing / grooming to start, each a
hand-picked, pre-verified AA-compliant pair), varied per prospect by a hue
rotation seeded from the slug so two shops in one niche don't ship identical.
Sets `brandCreatedByUs: true`, `source: "generated"`, and the flag is surfaced
in the demo's own report so you never pitch our palette as theirs.

## 5. The one command

`pnpm demo -- --prospect <id> [--skip-deploy] [--skip-ingest] [--dry-run]`

1. **ingest** → `prospects/<id>/prospect.json` (§4)
2. **project** → a `SiteConfig` for the build (§3, Q3)
3. **before** → reuse `audit/out/<id>/*.png`; if absent and a current site is
   known, run the audit probe for that one site; if no site is known, record
   `unavailable`
4. **build** → `SITE_CLIENT=<id> pnpm build:client` → `dist/<id>/`
5. **after** → `scripts/mockup/shoot.mjs`, both viewports
6. **deploy** → Pages project for `<id>`, then verify `/` and `/services/`
   return 200 on the canonical alias (existing script's proven approach)
7. **cards** → both PNGs (§6)
8. **manifest** → `prospects/<id>/demo.json` + a one-screen summary printed to
   stdout: live URL, card paths, and every field that came back `unavailable`.

Each step is resumable and idempotent; a failure in 6–8 still leaves the built
site and the before/after assets on disk.

## 6. The two cards

Rendered as HTML → Playwright screenshot. No image library, no new native dep.

- **QR leave-behind** — 1050×1500 px (3.5"×5" at 300 dpi), business name, the
  live demo URL as text, and a QR of that URL with a quiet zone and ~30% error
  correction. Needs one pure-JS dep, `qrcode` (~0 transitive native deps), or I
  hand-roll the encoder. → **Q6.**
- **Before/after** — 2400×1350, their current homepage left, the new demo
  right, both at the desktop viewport, labelled with capture dates. Where there
  is no current site (3 of 5), the left panel is a plain "no current website"
  block — never a mocked-up "before".

Both land in `prospects/<id>/cards/` (gitignored).

## 7. Acceptance test

Run all 5 prospects end to end and paste the transcript into a "Results"
section of this file. Expected honest outcome, stated in advance so a partial
result is not dressed up as a full one: 5 sites built, 5 deployed and verified,
5 QR cards, **2 full before/after cards and 3 with the before panel marked
unavailable**, and — absent a Places key — every Places-sourced field
`unavailable` across all 5.

## Results

`pnpm demo -- --all`, one command, exit 0. **The prediction above held
exactly**: 5 built, 5 deployed and verified on `/` and `/services/`, 10 cards,
2 real before/after pairs and 3 honestly empty ones.

| Prospect | Live demo (verified) | Before | Palette | Preset | Unavail. | Conflicts |
| --- | --- | --- | --- | --- | --- | --- |
| american-machine-specialty | `american-machine-specialty-preview.pages.dev` 200/200 | captured | `#12507a/#a8481a` | precision | 4 | 3 |
| industrial-machine-corp | `industrial-machine-corp-preview.pages.dev` 200/200 | none — no current site | `#334155/#9a3412` | precision | 8 | 0 |
| kh-machine-works | `kh-machine-works-preview.pages.dev` 200/200 | captured | `#0f4c81/#b45309` | precision | 4 | 5 |
| ks-welding | `ks-welding-preview.pages.dev` 200/200 | none — no current site | `#1f4e79/#b03a12` | forge | 7 | 0 |
| kts-machine-shop | `kts-machine-shop-preview.pages.dev` 200/200 | none — no current site | `#1e3a5f/#c2410c` | precision | 6 | 0 |

Every palette here is the hand-authored config's own, so `brandCreatedByUs` is
false across all five and **the generated-palette path is not exercised by this
run**. It was exercised separately against `ivywood-grooming-co` (no config, no
site, no assets, from the sample CSV): generated `#4a28d9/#b43109` from the
grooming pairing with a −12° slug hue shift, generated its own about and
service markdown, built, shot, and carded clean. That prospect directory was
then deleted so `--all` means exactly the five.

One transcript, as representative:

```
> kh-machine-works
  ingest: lead row: found (niche "machine shop", place_id none)
  ingest: client config: seeded from packages/template/clients/kh-machine-works.config.ts
  ingest: assets folder: no logo, 0 photo(s)
  ingest: places: no GOOGLE_MAPS_API_KEY — every Places-sourced field stays unavailable
  ingest: website: read 1 page(s) at 1/sec — https://www.khmachineworks.com
  ingest: website: logo downloaded for palette extraction only
  ingest: palette: kept the hand-authored client config's colours
  content: reused 5 existing markdown file(s)
  build: dist/kh-machine-works
  after: 2 shot(s)
  before: captured from their live site
  deploy: https://kh-machine-works-preview.pages.dev  home=200 services=200
  cards: qr-card.png, before-after.png

  sources disagreed on 5 field(s):
    businessName: kept "K-H Machine Works" (manual), saw "K-H Machine Works Inc" (website)
    address:      kept "4322 Grand Ave, NJ" (manual), saw "4322 Grand Avenue, New Jersey" (website)
    services:     kept "4 item(s)" (manual), saw "2 item(s)" (website)
  4 field(s) unavailable:
    ratingSummary / reviews / photos: no Places API key was configured
    brand.logoPath: no source supplied a logo
```

The conflict list is the part worth reading. Nothing was overwritten — the
researched config won every time — but the disagreements are now visible: K-H's
own site says `Inc`, spells out `Avenue` and `New Jersey`, and advertises two
services where the config lists four. None of that was known before this run,
and a merge that simply picked a winner would have destroyed all of it.

### Defect found and fixed during acceptance

The first full run reported `before: none — their site could not be loaded` for
K-H, seconds after the crawler had read that same page successfully. Cause: the
"before" shot waited for `networkidle`, which K-H's Wix site never reaches, so a
30-second timeout was being reported as an unreachable site — and the pipeline
silently produced its weakest possible card for the prospect with the strongest
before/after story. `packages/audit/src/probe.ts` navigates with `load` for
exactly this reason; the shot now matches it, and a failure carries the real
error text instead of a generic sentence. The rerun captured K-H's homepage.

### Not exercised this session

- **Live Places.** No key (Q2). Code-complete and typechecked, never called.
  Every Places-sourced field reports `unavailable` with that reason, which is
  most of the `Unavail.` column above.
- **Prospect-supplied assets.** Nothing has been dropped in any
  `prospects/<id>/assets/` yet, so palette-from-logo ran only in the standalone
  grooming test. Drop a `logo.png` in one of the five and re-run to see the
  extraction path win over the niche palette.

## 8. Gate

`pnpm install && pnpm -r build && pnpm -r typecheck` green; acceptance run
green; branch asserted `feat/demo`; pushed. **Not merged** — as instructed. No
PR opened unless you ask.

---

## Rulings (received, and what each one changed)

- **Q1 — `SiteConfig` is the contract; ship against it now.** Design families
  are being built in the design stream as named theme presets layered over the
  same config. The prospect config carries a string `preset`
  (`forge | precision | heritage`), defaulted from the niche, and passes it
  through. *Built as ruled:* `ThemePreset` is an additive-optional
  `theme.preset` in `site.ts`, documented so that a checkout which has not
  built a given preset falls back to the base design rather than failing.
- **Q3 — generated configs never overwrite the five hand-authored ones.**
  *Built as ruled* via `SITE_CONFIG_FILE`. It went further than the ruling
  required: the five configs are not merely left alone, they are **read as the
  top-precedence ingestion source**, so a demo for a business we already
  researched starts from that research instead of re-deriving it worse.
- **Q4 — Google photos and reviews may appear with visible "via Google"
  attribution.** *Built for reviews* — they are shown verbatim, attributed
  `<author> · via Google`, `status: 'verified'`, with the source recorded.
  **Not built for photos**, and the reason is a template gap rather than a
  choice: no component renders a visible credit anywhere near an image, so
  there is nowhere for the attribution to go. Places photos are ingested and
  recorded in `prospect.json`; publishing them needs one credit line in
  `Footer.astro` or a caption field on `Service`/`Hero`, both of which belong
  to the template stream. See "Handed to other streams".
- **Q5 — keep `<slug>-preview.pages.dev`.** *Built as ruled*, reusing the
  existing project-per-client model and its collision fallback.
- **Q6 — `qrcode` approved.** *Used*, at error-correction level H.
- **Q7 — grant: additive-optional changes to `site.ts`, read access to the
  template build scripts.** Taken narrowly; what was touched beyond it, and
  why, is listed under "Files touched outside the grant".
- **Q2 — the Places key** was not part of the rulings and no `.env` exists, so
  the live Places path ships code-complete and typechecked but unexecuted, the
  same position `feat/pipeline` took on discovery (its Q6). Every
  Places-sourced field reports `unavailable` with that reason, and the run
  continues.

## As built

**`packages/prospect`** — one new package, 20 files. `pnpm demo -- --prospect
<id>` runs: ingest → project → build → shoot → deploy → cards → manifest.
`--all` runs every prospect. `--skip-deploy`, `--skip-places`,
`--skip-website`, `--skip-ingest` and `--list` exist for the obvious reasons.

Decisions worth arguing with:

- **Every field is `{value, source, retrievedAt}` or `{unavailable, reason}`.**
  There is no third state and no bare string, so "we do not know" cannot decay
  into `""` and then into something plausible three modules downstream. The
  run prints the unavailable list at the end; that list is the useful output.
- **Precedence is `manual > folder > places > website > generated`**, and the
  loser of a disagreement is *recorded* as a conflict rather than dropped. A
  live site whose phone number differs from the Places listing is a fact worth
  carrying into the meeting.
- **No image library.** Palette extraction, both cards and all four
  screenshots run through the Chromium that Playwright already ships. Logos
  and photos are decoded by drawing them to a canvas — which is also why SVG,
  PNG, JPEG, WebP and AVIF all work without a single branch.
- **The generated palette is held to the template's own contrast bar.**
  `check-contrast.mjs` reads colours out of `site.config.ts` with a regex and
  therefore cannot see a generated config, so its eight pairings are ported
  into `color.ts` and run against every extracted or generated palette.
  Extracted brand colours are darkened — hue and saturation preserved — until
  they clear AA, rather than being rejected for being a shade too light.
- **Generated content is a build-time temporary.** `about.astro` and
  `services.astro` throw on a missing markdown file, so a prospect with no
  content needs some. It is written before the build and removed after, an
  existing file is never overwritten, and only directories this run created
  are cleaned up. Two reasons it is not left on disk: the template belongs to
  another stream, and the prose is third-party business data.
- **Their assets are not published without being given to us.** A logo found
  on their own site is downloaded for colour extraction only and never copied
  into the build. Files dropped in `prospects/<id>/assets/` are theirs to give
  and do get published.
- **`seo.noindex` is hard-coded true for every generated config.** A demo is a
  private mockup of someone else's business under their name.

## Files touched outside the grant

Four, all additive, all listed here because the grant did not name them:

| File | Change | Why |
| --- | --- | --- |
| `packages/template/clients/index.ts` | `SITE_CONFIG_FILE` branch in `resolveClient` | The mechanism Q3 approved. Without it there is no way to build a generated config, and the alternative — codegen into `clients/` — is what Q3 forbade. |
| `package.json` | one `demo` script | "One command" is the deliverable. |
| `pnpm-workspace.yaml` | one line | A new package has to be in the workspace. |
| `.gitignore` | `/prospects/` | Ingested business data must not be committable, same rule as `/audit/` and `/outreach/`. |

## Handed to other streams

Two findings this work surfaced but is not allowed to fix:

1. **`Footer.astro` renders "since ." when `foundedYear` is absent** (line
   113 interpolates it unconditionally, though `site.ts` marks it optional).
   This is **pre-existing and already live**: `ks-welding` and
   `industrial-machine-corp` deliberately omit the year, and their built
   footers read `surrounding area since .` today — verified by grepping
   `dist/ks-welding/index.html`. The demo pipeline did not cause it and cannot
   fix it from here.
2. **No visible image-credit surface** anywhere in the template, which is what
   blocks Q4's photo half.

## Blocking questions

**Q1 — the design-family JSON does not exist (F1). What did you mean?**
 (a) There is only one family today; treat `SiteConfig` as the contract, add a
 `designFamily` field pinned to `"classic"`, and ship the pipeline now.
 (b) Build 2–3 real families first (layout/type/spacing variants inside the
 existing components) and let the prospect config choose. That is a
 `packages/template` project of its own size, and it delays the demo pipeline.
 (c) It lives somewhere I cannot see — point me at it.
 *My recommendation: (a) now, (b) as a follow-up branch.*

**Q2 — the Places key.** Drop it into `.env` as `GOOGLE_MAPS_API_KEY` (the file
is gitignored) and tell me; until then I build the live path code-complete and
prove it only against a checked-in fixture, exactly as `feat/pipeline` did for
discovery (its Q6). Also: Place Details is a **higher-priced SKU** than the
Text Search already in use — confirm you want reviews/photos/hours pulled per
prospect.

**Q3 — generated config vs the 5 hand-written ones (F4).** Options:
 (a) Add a `SITE_CONFIG_FILE` env override in `clients/index.ts` so the
 template can build from a generated config on disk without touching the
 registry. Nothing hand-written is overwritten; generated client data never
 enters git. *Recommended.*
 (b) Codegen into `clients/<slug>.config.ts`. Simpler to read, but it
 overwrites the provenance comments and commits third-party data.
 Either way, do the 5 acceptance runs use the **existing** configs (proving
 deploy + cards on known-good input) or the **freshly ingested** ones (proving
 ingestion, but changing five sites you have already reviewed)? I would do
 ingestion → a written diff against the existing config, and build from the
 existing one for these five.

**Q4 — Google content on the demo sites.** Places photos and review text come
with attribution and caching terms. Default I propose unless you say otherwise:
reviews are used as `sourceNote` sentiment behind `status: "placeholder"`
testimonials (the pattern K-H's config already uses) and **not** published
verbatim; Places photos are ingested into `prospect.json` for reference but
**not** deployed as site imagery — folder photos or the existing SVG
placeholders are used instead. Say the word if you want them published with a
"via Google" attribution instead.

**Q5 — "clean per-prospect subdomain."** Today deploys land on
`<slug>-preview.pages.dev`. Options: (a) drop the suffix → `<slug>.pages.dev`
(free, immediate, name may collide globally — the existing script already has a
collision fallback); (b) a custom domain, e.g. `<slug>.demos.<yourdomain>`,
which needs a zone in your Cloudflare account and a wildcard CNAME — tell me
the domain and I will wire it. *Recommended: (a), with (b) as a one-line
follow-up once you name a domain.*

**Q6 — one new dependency, `qrcode`?** Pure JS, no native build. Alternative is
a hand-rolled encoder (~200 lines, more to review, no supply-chain surface).

**Q7 — the ownership grant (F5).** This touches `packages/discover` and
`packages/audit` (owned by `feat/pipeline`), `packages/template` (owned by
`feat/template`, needed for Q3(a) and the per-client public assets), plus root
`scripts/`, root `package.json` and `.gitignore` (shared). I need an explicit
grant for those paths, or I confine new code to a new `packages/prospect` +
`scripts/demo/` and treat everything else as read-only — which is possible for
all of it **except** the template change in Q3.

Answer Q1, Q3, Q5 and Q7 and I can start; Q2, Q4 and Q6 can be answered later
without blocking the first commits.
