# PLAN — demo (per-prospect demo pipeline)

Branch `feat/demo`, worktree `D:/sf-demo`. **Plan gate: not approved yet. No
code written.** Seven questions below are blocking; Q1 and Q2 cannot be
guessed past.

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

## 8. Gate

`pnpm install && pnpm -r build && pnpm -r typecheck` green; acceptance run
green; branch asserted `feat/demo`; pushed. **Not merged** — as instructed. No
PR opened unless you ask.

---

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
