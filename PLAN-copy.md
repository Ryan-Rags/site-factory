# PLAN-copy — the copywriting engine

Stream: `feat/copy`. New worktree, new package `packages/copy`.
Status: **built and verified on `feat/copy`. Not merged, no PR opened.**

## Rulings received (2026-08-11)

- **Q1 — (a).** One marker spelling, `[verify with client]`. No third variant.
  The constant moved to `@site-factory/copy` and `src/types/site.ts`
  re-exports it, so there is one definition and every existing import still
  resolves. The legacy `PLACEHOLDER` is retired from every config;
  `check-markers.mjs` still refuses it so a resurrected old config cannot go
  live.
- **Q2 — Reading A.** No filler copy anywhere. Markers remain only where a
  fact is genuinely unknown, and `packages/copy/REPORT.md` lists every one
  beside the single question that clears it.
- **Q3 — approved.** `clients/EQUIVALENCE.md` carries a dated note closing the
  byte-equivalence lock and saying what replaced it. K-H was regenerated.
- **Q4 — approved, plus the rule.** This package never calls Places. `geo` is
  optional on the config, emitted in JSON-LD only when present, and populated
  by nobody here — a `Geo` cannot be constructed without a `source`.
- **Q5 — noted.** Every `site.ts` change is additive and optional. Shared
  files touched are listed at the bottom of this file for the merge grant.

## What shipped

`packages/copy` — 3 niche packs, the generators, the fabrication guard, Bergen
County's 70 municipalities, 5 prospect records, a CLI (`check` / `report` /
`emit` / `show`), and a generated `REPORT.md`.

`packages/template` — additive-optional `faq`, `serviceAreas`, `business.geo`,
`pages.home.title` / `metaDescription`, `about.voiceNotes`; `Faq.astro` and
`ServiceAreas.astro`; `LocalBusinessJsonLd` extended with `geo`, a coherent
`areaServed` and a page-scoped `FAQPage` block; all five configs regenerated;
all twenty markdown content files regenerated; `check-fabrication.mjs` wired
into `pnpm build`.

### Result across the five mockups

| Client | FAQ | Town sections | Markers before → after |
| --- | ---: | ---: | --- |
| kh-machine-works | 8 | 0 (Hudson County, not Bergen) | 8 → 3 |
| kts-machine-shop | 8 | 8 | 2 → 3 |
| american-machine-specialty | 8 | 8 | 8 → 8 (6 are the `updates` block) |
| industrial-machine-corp | 6 | 6 | 5 → 1 |
| ks-welding | 8 | 8 | 3 → 3 |

Marker counts are occurrences in built HTML rather than config fields, so they
move with how often a marked value renders. Every one that remains is a
testimonial attribution, a certification, or the unbuilt `updates` block —
none of which copywriting can resolve. IMC's six-question FAQ is the honest
output for a business we hold three facts about; its six dropped questions are
in the report.

### Verification run

- `pnpm install && pnpm -r build && pnpm -r typecheck` — green; `astro check`
  reports 0 errors, 0 warnings, 0 hints.
- `pnpm build:all` — five clients built.
- `check-markers.mjs --all` — five pass.
- `check-fabrication.mjs --all` — five pass, every claim traced to a source.
- `node dist/cli.js check` — five generated, no unsourced claims.

Known-broken and **not** caused by this branch: `pnpm check:contrast` fails on
`main` too — it greps `site.config.ts` for `theme.colors`, which has lived in
`clients/<slug>.config.ts` since the multi-client refactor. `check:overflow`
needs a running `pnpm preview` and was not run.

### Shared files touched — for the merge grant

`pnpm-workspace.yaml` (one new package entry) and root `package.json` (three
`copy:*` scripts). Both are unavoidable for a new workspace package.
`packages/template/**` belongs to `feat/template` and is touched throughout.

## What this is

A niche-aware copywriting engine for local service businesses. It takes
(a) a niche pack, (b) whatever we actually know about a prospect, and emits
the copy and SEO surface of a `SiteConfig` — headlines, service descriptions,
trust blocks, an 8-question FAQ, Bergen County town-by-town service-area
sections, per-page title/meta, image alt text, and LocalBusiness JSON-LD.

Niches at launch: `machine-shop`, `welding-fabrication`, `general-contractor`.

## Non-negotiable: the fabrication boundary

Every string the engine emits is one of three kinds, and the type system
enforces which:

- **Derived** — composed only from confirmed facts on the prospect record
  (name, town, phone, hours, services, founding year). Safe to publish.
- **Generic-true** — true of any shop in the niche and making no claim about
  *this* one ("Bring the part in or send a photo and we'll tell you what it
  takes"). Safe to publish. Never states a credential, a tolerance, a
  turnaround time, a year, or a count.
- **Unconfirmed** — a strong claim we cannot source. Emitted as a marker, never
  as prose. The engine has no code path that turns an unsourced claim into an
  assertion; a claim without an `evidence` field will not compile.

FAQ answers are the sharp edge here. "Do you work weekends?" has a real answer
only if hours are confirmed. The FAQ generator therefore selects questions
whose answers the prospect record can actually support, and drops the rest —
it does not pad to eight with hedged non-answers. If a niche pack cannot fill
eight from the record, that is reported as a gap, not smoothed over.

## Open questions — I need answers on 1 and 2 before writing code

**1. Marker spelling.** You asked for `[CONFIRM WITH OWNER]`. The repo already
has two markers — `[verify with client]` (current) and `PLACEHOLDER` (legacy,
K-H only) — and `scripts/check-markers.mjs` is the gate that stops a marked
build going live. A third spelling that the gate does not know about is a
marker that silently ships. Options:

  - **(a) Reuse `VERIFY_MARKER`** (`[verify with client]`) for engine output.
    Nothing changes in the gate. Recommended.
  - **(b) Add `[CONFIRM WITH OWNER]` as a third marker** and register it in
    `check-markers.mjs`. Costs one line in a shared-ish file, gives you the
    exact wording you asked for.
  - **(c)** `[CONFIRM WITH OWNER]` replaces `[verify with client]` repo-wide —
    a rename touching all five configs. Most churn, cleanest end state.

I lean (b): your wording, gate stays honest. Say which.

**2. "Zero placeholder text remaining" vs. the marker rule.** These pull
against each other and I will not guess which you meant.

  - Reading A — *no filler*: no lorem, no "Serving the tri-state area since
    [YEAR]", no generic stock paragraph. Markers may remain where a fact is
    genuinely unknown, because that is what markers are for. Achievable now.
  - Reading B — *literally zero markers in built output*: requires either
    inventing the missing facts (violates the hard rule and your own
    instruction) or dropping every section whose facts we lack. K-H currently
    carries 8 markers and KTS 2; all 8 of K-H's are certifications,
    testimonial attributions, and deploy-time infra values — none of which
    copywriting can resolve.

I will build to **Reading A**, with a report listing every remaining marker,
per client, and what would clear it. Tell me if you meant B and I will scope
the section-dropping instead.

**3. K-H's byte-equivalence lock.** `clients/EQUIVALENCE.md` pins K-H's built
output as the multi-client refactor's proof. Regenerating K-H's copy breaks
that lock by design. I will amend `EQUIVALENCE.md` with a dated note recording
that the lock ends here and why, rather than deleting the file. Flag if you'd
rather K-H be excluded from the regeneration.

**4. Geo in JSON-LD.** You asked for `geo`. `LocalBusinessJsonLd.astro`
deliberately omits it because we hold no verified coordinates, and inventing
lat/long is fabricating structured data. I will make `geo` an optional
config field emitted only when present, and populate it for the five mockups
**only** from the Places API (`location`, official API, key from `.env`) if
you want a run made — otherwise all five ship without `geo` and the field sits
ready. Default if you don't answer: no Places call, no geo.

**5. Ownership.** `packages/copy` is a new dir owned by no stream, and this
touches `packages/template` (schema + components), which `feat/template` owns.
You said commit-don't-merge, so no merge-time grant is needed today — but the
eventual merge will need `feat/template` paths granted. Noted, not assumed.

## Inputs

There is no stored prospect corpus in the repo — `audit/out/` holds
screenshots, `outreach/` holds before/after PNGs, `data/leads-machine.csv`
holds lead rows. So the engine's input is a typed record I define, and the
five mockups' records are built from what the existing configs already cite
(each carries inline provenance) plus the lead CSV. No new crawling, no
scraping, no Google property touched.

```ts
interface SourceMaterial {
  existingCopy?: { url: string; retrievedAt: string; text: string }[];
  profile?: { name; phone; address; hours; rating; reviewCount; placeId };
  confirmed: Fact[];   // each carries `evidence: string`
}
```

`Fact` without `evidence` is a type error. That is the fabrication guard.

## Deliverables

**A. `packages/copy`** — new workspace package, TS strict, no runtime deps.

```
packages/copy/src/
  types.ts           SourceMaterial, Fact, CopyOutput, marker helpers
  niches/
    machine-shop.ts
    welding-fabrication.ts
    general-contractor.ts
    index.ts         registry, same static-import pattern as clients/index.ts
  generate/
    headline.ts      what + where + trust formulas
    services.ts      service descriptions from niche taxonomy + confirmed list
    trust.ts         trust strip + certifications, marker-gated
    faq.ts           8-question bank, answerability-filtered
    serviceArea.ts   Bergen County town sections
    seo.ts           titles, metas, alt text, JSON-LD fragment
  bergen.ts          the 70 Bergen County municipalities + adjacency
  cli.ts             `pnpm copy --client <slug>` → writes/diffs config + md
```

Headline formula: `{what} + {where} + {trust}`, where `trust` is drawn only
from confirmed facts (founding year, walk-in policy, no-minimum-order) and
falls back to a generic-true clause when none is available — never to a
credential.

**B. Template schema additions** (`packages/template/src/types/site.ts`) —
all optional, so the five existing configs keep compiling as I migrate them:

- `faq?: FaqItem[]`
- `serviceAreaDetail?: TownSection[]` (town, blurb, nearby landmarks-free copy)
- `business.geo?: { latitude: number; longitude: number; source: string }`
- `seo.pages?` per-page title/description overrides
- `about.voiceNotes?` — where the prospect's own phrasing was preserved, with
  the source line, so a reviewer can check we kept their voice and not ours.

**C. Components** — `Faq.astro` (with FAQPage JSON-LD), `ServiceAreas.astro`,
extended `LocalBusinessJsonLd.astro` (geo + `areaServed` from town sections).
FAQ renders as real `<details>`; no JS.

**D. Regenerated copy for all five mockups** — configs + `src/content/`
markdown rewritten through the engine. K-H, KTS, AMS, Industrial, K&S.
Their real history and voice preserved: the About prose is rewritten for
clarity but every fact in it must trace to an existing cited line.

**E. `packages/copy/REPORT.md`** — per client: what changed, every remaining
marker with the question that clears it, and every fact and its source.

## Verification

1. `pnpm install && pnpm -r build && pnpm -r typecheck` green.
2. `node scripts/check-markers.mjs --all` — all five still pass.
3. New: `scripts/check-fabrication.mjs` — greps built output for the patterns
   that are always fabrication (a year, a "% satisfied", "certified",
   "licensed", "insured", "years of experience", "family-owned") and asserts
   each one traces to a confirmed fact for that client or sits behind a
   marker. This is the acceptance test that matters more than marker count.
4. Contrast + overflow checks unchanged, still green.
5. Screenshot all five before/after so the regeneration is reviewable.

## Sequence

1. Branch + worktree `feat/copy`. 2. Types and fabrication guard. 3. Bergen
data. 4. Three niche packs. 5. Generators. 6. Schema + components. 7.
Regenerate the five. 8. Checks, report, screenshots. 9. Commit, push. **No
merge**, no PR.

---

**STOP — approval needed.** Answer Q1 and Q2 (Q3–Q5 have stated defaults I
will take if you skip them) and I'll build it.
