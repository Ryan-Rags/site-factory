# PLAN-prospect-parity

Stream: `feat/prospect-parity` · worktree `D:/sf-prospect-parity` · base `integrate/beta-1`

Goal: a pipeline-generated demo is structurally indistinguishable from the five
hand-authored clients. Today it is not, and the pipeline says so itself — its
own `checkSchemaDrift()` warns on three `SiteConfig` keys it never emits.

---

## 0. Base branch — a decision, stated

`packages/copy` and `packages/prospect` do not exist on `main`. They exist only
on `integrate/beta-1` (copy came in at `6fb1dde`, prospect at `a1b49f6`). This
stream therefore forks `integrate/beta-1`, not `main`, and its PR targets
`integrate/beta-1`. There was no other branch that could carry the work.

## 1. What the drift check is actually warning about

`packages/template/src/types/site.ts` declares nineteen top-level keys.
`packages/prospect/src/site-config.ts` mirrors sixteen. The three it does not
emit, all optional, all warned about on every run:

| key | who consumes it | what its absence costs a generated demo |
|---|---|---|
| `design?` | `src/pages/index.astro` — `site.design` selects `DesignLayout` + `DesignHome` | the demo renders through the *legacy* `BaseLayout` composition. All five hand-authored clients carry `design`. This is the single largest structural difference between generated and hand-authored. |
| `faq?` | `Faq.astro`, `FAQPage` JSON-LD | no FAQ section, no FAQ structured data |
| `serviceAreas?` | `ServiceAreas.astro` | no town-by-town section |

Verified: all five carry it — `kh-machine-works`, `kts-machine-shop`,
`american-machine-specialty`, `industrial-machine-corp` via
`designFor(slug, base)`; `ks-welding` (and its three family variants) via
`ksWeldingDesign` / `inFamily(...)`. A generated config that omits `design` is
not "the same site with less content", it is a different page composition.

There is a fourth, quieter drift the shallow check cannot see: the mirror's
`pages.home` lacks `title?` and `metaDescription?`, both of which the real
`PageCopy` grew for the copy engine. `index.astro` already reads
`site.pages.home.title`. Fixed in step 3.

## 2. Preset mapping — the repo contradicts itself, and the task is right

`packages/template/src/types/design.ts` documents the three families:

- `forge` — "Machine shops, welding, fabrication."
- `precision` — "Contractors, HVAC, electrical."
- `heritage` — "Legacy shops, 'family owned since' trades."

`packages/prospect/src/niches.ts` maps the opposite way: `machine shop` →
`precision`, `weld|fabricat` → `forge`, `contractor|roof` → `heritage`. So the
pipeline has been picking the family the template's own docs assign to a
different trade. Wortmann's `prospect.json` currently reads
`preset: "precision"` for a machine shop.

The task's mapping is the template's documented intent, so `NICHE_STYLES` gets
corrected rather than the task being questioned. **Consequence to be aware of:
Wortmann's preset changes `precision` → `forge` on the acceptance re-run.** The
colour pairings in that table stay as they are — preset and palette are
separate axes in `DesignConfig`, and the pairings were chosen on their own
merits and each clears WCAG AA.

`heritage` needs a signal `NICHE_STYLES` does not currently have: it is not a
trade, it is a *legacy/family* property of a particular business. Rule, in
precedence order:

1. explicit `--preset` — unchanged;
2. legacy/family signal present and sourced → `heritage`. The signal is a
   sourced `foundedYear` older than 40 years, or a sourced `family-run`
   trait, or a legal name containing `& Sons`/`Brothers`/`Bros`. Never an
   unsourced guess — an unavailable `foundedYear` is not a signal;
3. niche match on the corrected table;
4. `DEFAULT_STYLE`.

Every branch records its reason in `preset.note`, which already flows to the
manifest and the run summary.

## 3. Wire `packages/copy` into `packages/prospect`

New file `packages/prospect/src/record.ts`: `ProspectConfig` → `ProspectRecord`.

The two type systems say the same thing differently and the mapping is
mechanical, which is the point — every `Fact` gets its evidence from the
`Field` that produced it, so nothing crosses the boundary without a source:

```
known(v, source, retrievedAt, note)  →  fact(v, `${note ?? source} (${source}, retrieved ${retrievedAt})`)
unavailable(reason)                  →  field omitted, or unconfirmed(field, question)
```

- `niche`: `ProspectConfig.niche` is free text; `NicheId` is a closed set of
  three. A `nicheIdFor(text)` matcher maps machine/CNC/tool-and-die →
  `machine-shop`, weld/fabricat/metal → `welding-fabrication`,
  contractor/construction/roof/carpent → `general-contractor`. **No match →
  no copy pack → the engine is not called at all** (step 3b).
- `serviceTowns` / `wider`: `partitionTowns()` from `@site-factory/copy`
  splits the sourced `serviceArea` into Bergen municipalities and everything
  else. Home town first, matching the hand-authored records.
- `traits`, `certifications`, `people`, `voice`: empty for an ingested
  prospect. Nothing is inferred. The copy engine already handles absence by
  not raising the subject.
- `existingCopy`: only populated when `websiteStatus === 'live'` (step 4).

Then `generate(record)` supplies, in `project.ts`:
`site.faq`, `site.serviceAreas` (`{heading, intro, towns, widerLine?}`), and
per-page SEO — `seo.defaultDescription`, `pages.{home,services,about,contact}`
including the two newly-mirrored `pages.home` fields.

Seeded prospects (the five) keep taking their copy from the seed exactly as
today. The engine only fills what the seed does not carry.

### 3b. Graceful degradation, and what "never emit filler" means here

A niche with no pack (`plumbing`, `bakery`, anything outside the three) gets
**no** `faq` and **no** `serviceAreas` key at all — an absent optional field
renders nothing, which is the template's documented behaviour. It does *not*
get a generic FAQ, a stub question, or a town paragraph assembled locally.
The run summary and `demo.json` say why, in one line each:

```
copy: no copy pack for niche "plumbing" — no FAQ and no service-area section
      were emitted. Write packages/copy/src/niches/plumbing.ts to change that.
```

Same for a pack that exists but whose record answers nothing: `faq()` already
returns fewer items and reports `droppedQuestions`, and an empty item list
means the key is omitted rather than emitted empty.

New `demo.json` fields: `copyPack: NicheId | null`, `copyNotes: string[]`,
`droppedQuestions`, `seoWarnings`.

## 4. `websiteStatus` — parked and dead domains

New on `ProspectConfig`:

```ts
websiteStatus: Field<'live' | 'parked' | 'dead' | 'none'>
```

Classified in `ingest/website.ts`, in the page evaluator plus a Node-side
judgement (same split the file already uses — the browser collects, Node
decides):

- **none** — no `currentSiteUrl` from any source.
- **dead** — navigation failed, or a non-OK response, or DNS/connection error.
- **parked** — any of: a known registrar/parking host in the final URL or in
  a meta-refresh target (`sedoparking`, `afternic`, `dan.com`, `hugedomains`,
  `expireddomains`, `bodis`, `parkingcrew`, `above.com`, `namecheap`'s park
  host, `godaddy` park host); body text matching
  `/(domain|this domain) (is|may be) for sale|buy this domain|inquire about this domain|domain parking|expired domain/i`;
  a `<title>` that is the bare domain plus a sale phrase; a meta-refresh
  whose target is off-origin; or near-zero real content — fewer than ~40
  words of prose outside nav, and no `tel:`/`mailto:` link, and no
  `LocalBusiness`/`Organization` JSON-LD.
- **live** — none of the above.

**`parked` and `dead` are treated exactly as `none` for content derivation.**
`ingestWebsite` returns *no* `Contribution` at all in those cases — no name,
no phone, no address, no services, and **no logo for palette extraction**.
Wortmann's `#027d1f/#7b02a5` palette was lifted off an ExpiredDomains parking
page; that is not their brand, and the same rule that discards the junk
services has to discard the colours. `brand.createdByUs` then correctly
becomes `true` and the summary says so.

`currentSiteUrl` is still *recorded* (it is a true fact about the listing) but
the classification travels beside it. The `before` screenshot is still
captured — a parking page is genuinely what a customer sees today — and the
comparison card labels it. Where it must *not* count is Lighthouse: a parked
page scores well precisely because it is empty, so
`scripts/pitch/compare.mjs` routes `parked`/`dead` down its existing
`status: 'no-site'` path rather than scoring them as a competitor site. That
is the "flagged for scoring" hook.

Fixture: `prospects/wortmann-machine-works/` on disk (gitignored). A committed
regression test needs a fixture that is *not* client data — so the parked
classifier is factored as a pure function over collected page facts, and the
committed test feeds it hand-written fact objects reproducing the Wortmann
parking page's shape (title, the `ExpiredDomains.com` JSON-LD name, the two
junk headings). No third-party business data enters git.

## 5. `GOOGLE_PLACES_API_KEY`

Read order everywhere: `GOOGLE_PLACES_API_KEY`, then `GOOGLE_MAPS_API_KEY`
with a one-line deprecation warning printed once per process:

```
warning: GOOGLE_MAPS_API_KEY is deprecated and will be removed after this
         release. Rename it to GOOGLE_PLACES_API_KEY in your .env.
```

Sites: `packages/discover/src/env.ts`, `packages/prospect/src/ingest/index.ts`,
`.env.example`, and the `README.md` / `PLAN.md` mentions. **Ownership note:**
`packages/discover` belongs to `feat/pipeline` and `.env.example`/`README.md`
are shared root files. The task instructs this change explicitly, which I am
treating as the grant; it is listed in the PR description regardless.

`.env` itself is untouched — the fallback means Ryan's existing `.env` keeps
working, and renaming it is his call.

## 6. Emit the design block

New `packages/prospect/src/design.ts`, mirroring what
`clients/design/derive.ts` does for the four brief-based clients: a generated
*brief* composed with the config's own confirmed content, emitted inline as
`site.design` in the generated JSON. No file is written into
`packages/template/clients/design/` — generated third-party data stays out of
the repo, exactly as `SITE_CONFIG_FILE` exists to allow.

- `theme.preset` — step 2's mapping.
- `theme.accent` — `"brand"` when the extracted brand colour clears the gate,
  else the preset's first curated swatch (`forge:ember`,
  `precision:blueprint`, `heritage:brick`).
- `theme.brandAccent` — `{id: 'brand', label, accent, onAccent, sourceNote}`,
  offered **only** when the extracted colour passes, and **dropped entirely
  when it fails** — `presets.ts` is explicit that a nudged colour is not their
  colour. Never offered when `brand.createdByUs` is true: a palette we
  invented is not a brand accent.
- `theme.fontPairing` — the preset's first pairing (`condensed-caps`,
  `engineered`, `old-serif`).
- `sections.hero` — variant `split` (the documented safest default; the image
  never sits behind text). Headline/subhead/CTAs/image read from the already-
  projected `SiteConfig`, as `deriveDesign` does. Eyebrow = `Town, State`,
  which is sourced. Badges from confirmed service titles only, or omitted.
- `sections.services` / `reviews` — derived from `site.services` /
  `site.testimonials`, carrying `status` and `sourceNote` across unchanged so
  a placeholder testimonial stays labelled a placeholder.
- `sections.stats` — `enabled: false` unless there are sourced numbers
  (`foundedYear`, confirmed service count, review count). This is the section
  most likely to become invented ("15 years", "500 jobs"), so the default is off.
- `sections.faq` — the copy engine's items, or `enabled: false`.
- `sections.serviceArea` — the copy engine's towns, or `enabled: false`.
- `sections.gallery` / `beforeAfter` — stock placeholders whose alt and intro
  say they are placeholders and carry `[verify with client]`, matching what
  the four briefs already do. `beforeAfter.verified: false`.
- `sections.openNow` — enabled only when hours are sourced.
- `header`, `footer`, `order` — static, from the section set actually enabled.

### 6b. The contrast gate the pipeline cannot reach

`scripts/check-contrast.mjs` matrix mode enumerates `clients/design/*.json` to
find `brandAccent`s. It cannot see a payload handed to the build through
`SITE_CONFIG_FILE`. `packages/prospect/src/color.ts` already ports the
*legacy* gate for exactly this reason; step 6 adds the design-accent pairs
(`accent`/`onAccent` and the `--d-accent-strong` derivation, per preset
palette) to that same file, read from `presets.json` rather than re-stated.

Editing the gate script itself is out of bounds for this stream (merge policy
v2 §3), so this is duplication, and it is a maintenance liability worth naming
in the PR: two implementations of one rule can diverge.

## 7. Close the drift

`MIRRORED_KEYS` gains `design: optional`, `faq: optional`,
`serviceAreas: optional` — **after** the pipeline actually emits all three, not
before. Adding a key to that map without emitting it would silence the warning
and keep the hole, which is the failure mode the check exists to catch.

## 8. Timing

`runProspect` records per-stage wall-clock (ingest / project / build /
shots / deploy / cards) into `demo.json` as `timings` and prints a total in
the run summary, so "both timed" is a property of the artifact rather than
something read off a terminal.

---

## Acceptance

1. `pnpm -r typecheck` and `pnpm -r build` green.
2. `pnpm --filter @site-factory/template build:all` green — the five
   hand-authored sites unchanged, including `kh-machine-works`'s byte-locked
   equivalence proof.
3. Unit test: the parked classifier over hand-written Wortmann-shaped facts →
   `parked`.
4. Wortmann end-to-end: junk services gone; `websiteStatus: parked`; no
   website-sourced fields; `brandCreatedByUs: true`; `design` present with
   preset `forge`; FAQ present (machine-shop pack) and service areas present;
   `check-markers`/`check-fabrication`/`check-contrast`/`check-contact-links`
   green on the generated build; timings recorded.
5. One fresh prospect with a live site, same bar, `websiteStatus: live`.
6. `pnpm demo -- --list` then a run: **zero** drift warnings.

## What I need from you before I start

**Q1 — Deploys.** The acceptance runs are `--skip-deploy` unless you say
otherwise. Deploying a demo to `*.pages.dev` under a real business's name is
outward-facing and I will not do it without you saying so. Do you want the two
acceptance runs deployed, or built-and-shot only?

**Q2 — Which fresh prospect?** `data/businesses.csv` has twelve candidates
with live sites. My pick is **Chase Machine Co Inc** (`chasemachineco.com`,
Lyndhurst NJ — Bergen County, so the copy engine's town sections are real
rather than a wider-area line, and it is not one of the five). Confirm or name
another. Note this spends Places API quota and crawls their site read-only at
1 page/sec, ≤5 pages.

**Q3 — Scope of §6.** Emitting a full `DesignConfig` is the largest single
piece here and it changes what a generated demo *looks like* (design-family
composition instead of the legacy one, on the home page only — the other
pages render through `BaseLayout` either way, same as the hand-authored five).
That is what "indistinguishable in structure" requires as I read it. Say so if
you meant only `theme.preset` + `faq` + `serviceAreas`, and §6 shrinks to a
one-liner — but then `design?` stays in the drift report and acceptance
criterion 6 cannot be met honestly.

## Shared files this stream will touch

`packages/prospect/package.json` (adds `@site-factory/copy`), `pnpm-lock.yaml`
(consequence of that), `.env.example`, `README.md`, `PLAN.md`,
`packages/discover/src/env.ts` (owned by `feat/pipeline`),
`scripts/pitch/compare.mjs`.

Merge policy v2 §2 excludes `pnpm-lock.yaml` and `.gitignore`-class root files
from self-merge, so **this stream stops at the PR** regardless of gate results.

## Deliberately not doing

- Not editing `packages/template/src/**` or `clients/**`. The design payload
  is emitted into the generated JSON, never into the template's tree.
- Not editing any gate script.
- Not touching `.env`.
- Not writing generated content into `packages/template/src/content/` beyond
  the existing build-time temporaries that `content.ts` already cleans up.
