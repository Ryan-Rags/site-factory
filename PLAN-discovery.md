# PLAN-discovery — county-wide discovery + scoring → ranked call list

Stream: `feat/discovery` · worktree `D:/sf-discovery` · branch pushed as the claim.
Status: **approved and built.** See the addendum immediately below — one ruling
during implementation replaced the two-pass design this plan proposed.

---

## ADDENDUM — the two-pass survivor design is dead (ruled during step 1)

The gate this plan promised in §4 landed red, as intended. It named **four**
offenders rather than the two §1.1 predicted:

```
places.websiteUri, places.nationalPhoneNumber, places.rating, places.userRatingCount
```

`websiteUri` and `nationalPhoneNumber` are **Enterprise**, not Pro. §1.1's tier
table was wrong about them. That kills the two-pass design outright, because the
survivor filter in §3.5 is defined on exactly those two fields — website status
decides opportunity, and a lead with no phone cannot go on a call list — so a Pro
sweep would have had nothing to filter on, and Details would have had to run
against every deduplicated business in the county to learn who has no website.

Once the call is Enterprise for `websiteUri`, `rating` and `userRatingCount` ride
along at **no marginal cost**. Ruling: **one Enterprise sweep, no second pass.**

What that changes in the sections below:

- **§1.1** — the tier table stands as corrected; the "discovery = Pro" claim does not.
- **§3.1** — unchanged.
- **§3.5** — scoring weights unchanged and approved. The **survivor pass and
  `--details-cap` are removed entirely**; the 0.5 neutral rating is now the rare
  path (Google returning no rating at all) rather than the common one.
- **§3.7** — budget defaults are **250 total / 250 Enterprise**, not 400/150.
- **§4** — the gate asserts the invariant that protects money now: mask equality
  byte-for-byte, the Enterprise + Atmosphere class banned outright, every field
  priced. The red run stands in history as the failure-first record.
- **§6 item 2** — sidecar approved; ids are read from the sweep's own results at
  zero extra calls, so "zero Places calls beyond the sweep" holds.
- **Acceptance**, restated: (a) zero Places calls beyond the sweep; (b) zero
  Enterprise + Atmosphere fields anywhere in this package; (c) the emitted mask
  equals the declared sweep mask exactly.

Backlog, noted and **not built**: a refresh-run optimisation — an Essentials/Pro
sweep to detect new place ids, with Enterprise calls only on the deltas.

---

## 0. Two things to settle before anything else

### 0.1 The stale claim does not exist

`feat/discovery-scoring` is **not** on the remote. Full list of `origin/*`:

```
chore/ignore-all-lead-csvs   feat/copy              feat/demo
feat/demo-support            feat/design-coverage   feat/design-families
feat/design-polish           feat/lead-flow-2       feat/mockup
feat/pipeline                feat/prospect-parity   feat/trust-seo
fix/beta-2-repair            integrate/beta-1       integrate/beta-2   main
```

There is also no local branch or worktree by that name. **Nothing to delete.** No dead-session
artefact is being built on.

### 0.2 `docs/decisions.md` does not exist — anywhere

Task item 3 says the placeId-first matching work "closes the slug-collision interim in
docs/decisions.md". That file is not in the working tree, not on any branch, and not in history
(`git log --all --diff-filter=A -- '**/decisions.md'` → empty). `docs/` contains only
`docs/evidence/beta-2-color-scheme/`.

The slug-collision interim I can actually find is in **two** places:

- [PLAN-pipeline.md:274-283](PLAN-pipeline.md#L274-L283) — the backlog entry. It commits to a
  check "that warns when a lead's slug matches no registered client config — decided, not a
  maybe", and records the scale argument: "a majority of registered US businesses carry a legal
  suffix, so the collision class is the norm, not an edge case."
- [packages/prospect/src/ingest/leads.ts:22-25](packages/prospect/src/ingest/leads.ts#L22-L25) —
  the code comment pointing at that backlog, and the current behaviour: `findLeadRow` matches on
  `slugify(row.name) === id` and a miss surfaces as "no lead row".

I have planned against those two as the source of record. **Q1 below asks you to confirm** that is
what you meant, or to point me at the real file if `docs/decisions.md` is something you have
locally / meant to write.

---

## 1. What I found in the code that changes the shape of this work

### 1.1 The Enterprise-tier leak already exists, in `packages/discover`

[packages/discover/src/places.ts:15-24](packages/discover/src/places.ts#L15-L24):

```ts
export const FIELD_MASK = [
  "places.id", "places.displayName", "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.rating",              // ← Enterprise SKU
  "places.userRatingCount",     // ← Enterprise SKU
  "places.formattedAddress", "nextPageToken",
].join(",");
```

A Places (New) request bills at the **highest tier any requested field belongs to**. `rating` and
`userRatingCount` are Text Search **Enterprise**. So today, *every* `pnpm discover` Text Search —
including every paging follow-up — is billed Enterprise, and the acceptance criterion "zero
Enterprise-tier calls outside the survivor pass" fails against `main` as it stands.

This is the defect your field-mask discipline is describing, and it is pre-existing rather than
something this stream would introduce. Fixing it is in scope. Two consumers are affected and both
need handling:

1. `placeToLead` writes `rating` / `review_count` into `data/businesses.csv` from search results.
   Once those fields leave the discovery mask, those two columns go **empty** for new rows. That is
   correct — unmeasured is "unavailable", never estimated — but it *is* a behaviour change to the
   existing `pnpm discover` CLI, and `packages/audit`'s `scoreSite` reads `row.rating` /
   `row.review_count` and will fall to its documented `neutral-no-rating-data` multiplier.
2. `packages/prospect/src/ingest/places.ts` → `resolvePlaceId` calls `searchText` and reads only
   `.id` and `.displayName`. Unaffected by the removal, and it gets **cheaper**.

The mask also lacks `places.types`, which item 1 asks for. `types` is Pro-tier, same as
`websiteUri` / `nationalPhoneNumber`, so adding it costs nothing extra.

Proposed tiers, named explicitly in code:

| Pass | Mask | SKU |
|---|---|---|
| Discovery (Text Search) | `places.id`, `places.displayName`, `places.formattedAddress`, `places.types`, `places.websiteUri`, `places.nationalPhoneNumber`, `nextPageToken` | **Pro** |
| Survivor (Place Details) | `id`, `rating`, `userRatingCount` | **Enterprise** |

Note the survivor mask is deliberately *not*
`packages/prospect/src/ingest/places.ts`'s `DETAILS_FIELD_MASK`, which also asks for `reviews` and
`photos` — those are Enterprise **+ Atmosphere**, a tier above what this stream needs. I am not
touching that constant; the demo pipeline genuinely needs those fields.

### 1.2 `packages/discover` cannot import the classifier — it would be a dependency cycle

Item 2 says reuse `packages/prospect`'s classifier. `classifyWebsite` is exported from
[packages/prospect/src/index.ts:52-59](packages/prospect/src/index.ts#L52-L59) and is a **pure
function** over a `SiteSignals` object — no browser, no network. Ideal for reuse.

But `packages/prospect` already depends on `@site-factory/discover`. Putting this stream's code in
`packages/discover` and importing prospect creates a cycle.

**Therefore: a new package, `packages/shortlist`**, depending on `discover` + `prospect` + `audit`.
Split of responsibility:

- `packages/discover` — owns the Places client. Gets the tiered field masks, a Details call, and
  the usage counter. (It already owns `CallBudget`, the CSV reader/writer, `slugify`, `normalizeUrl`.)
- `packages/shortlist` — **new**. County sweep, website status, audit orchestration, scoring, CSV
  emit, the `pnpm shortlist` printer.

A second wrinkle: `classifyWebsite` is pure, but the thing that *builds* `SiteSignals` is
`readPage` inside `packages/prospect/src/ingest/website.ts`, which is **not exported**, and
`ingestWebsite` around it spends up to 5 navigations per site harvesting name/phone/address/logo.
At county scale that is enormously more work than needed — I only need the home page, and only for
the classification signals.

I plan to write a **home-page-only signals collector** in `packages/shortlist` that produces the
`SiteSignals` prospect already defines, and hand it to prospect's exported `classifyWebsite`. The
*judgement* — every parking-host, for-sale-text and content-threshold rule — stays in prospect's
one implementation and is not duplicated. Only the "load one page, read the DOM" step is written
fresh, because the existing one is not exported and is the wrong size for this job. Flagging it
explicitly since it sits near the "never author a parallel second implementation" line; I read it
as on the right side, but say so if you disagree — the alternative is exporting `readPage` from
prospect, which is a cross-boundary edit to a package I do not own.

### 1.3 The call budget is an order of magnitude too small

`MAX_CALLS_PER_RUN = 200` ([places.ts:28](packages/discover/src/places.ts#L28)). County-wide:
70 towns × 3 copy-pack niches = **210 queries** before a single paging follow-up. The default cap
would abort the run partway through. `--budget` needs to be per-tier and the default raised — see §4.

### 1.4 `data/leads-machine.csv` has no placeIds

Both real rows have an **empty** `place_id` column. So placeId-first matching matches nothing on
day one and falls straight to the slug fallback + loud WARNING for 100% of rows. That is the
designed behaviour, but it means the interim is not actually *closed* until the CSV is backfilled.
I propose a `--backfill-place-ids` mode (§3.4) so it can be.

### 1.5 The client registry has no placeId field, and adding one is a forbidden path

`packages/template/clients/*.config.ts` carry no `placeId`. Adding one means changing `SiteConfig`
in `packages/template/src/types/**` — named explicitly in CLAUDE.md's green-lane exclusion list,
and outside my grant. **Q2** proposes a sidecar instead.

### 1.6 A full county-wide audit is not feasible in one run

`auditOne` ([packages/audit/src/run.ts:33](packages/audit/src/run.ts#L33)) is 3 navigations
including a Lighthouse run, ~30–60s per site wall-clock. A county sweep across 3 niches will
surface several hundred live sites. That is many hours. **Q3** proposes a cap.

---

## 2. Ownership requested

| Path | Basis |
|---|---|
| `packages/shortlist/**` | new, mine |
| `packages/discover/**` | owner for this stream (Places client, masks, usage counter, budget) |
| `PLAN-discovery.md` | this file |
| `data/prospects-scored.csv` | output, gitignored by `/data/*.csv` |

**Cross-boundary edits — each HOLDs the PR, all listed in the PR body:**

| Path | Why necessary | Minimal? |
|---|---|---|
| root `package.json` | item 6 requires `pnpm shortlist`; a workspace script has exactly one home | +1 line |
| `pnpm-workspace.yaml` | a new package is invisible to pnpm otherwise | +1 line |

Both are on CLAUDE.md's green-lane exclusion list. **This PR is HELD**, as you expected. I will not
self-merge.

Not touched: `clients/**`, `packages/template/src/types/**`, `worker/`, `worker-demo/`,
`scripts/deploy/**`, any gate script, `.gitignore`, `CLAUDE.md`, anything reading `.env*` beyond
`packages/discover`'s existing `env.ts` (unchanged).

---

## 3. Design

### 3.1 Sweep (Pro tier only)

For each (niche, town) in 8 niches × 70 towns, filtered by `--niche`:

- `textQuery` = `"<niche query> in <Town>, NJ"`, plus a `locationBias` circle on the town centroid.
  Centroids are **not** in `bergen.ts` (it is names only), so v1 uses the text query alone — no
  invented coordinates. `bergen.ts` is imported read-only for the 70 names, and
  `checkBergenList()` is called at startup so a truncated list fails loudly.
- One page (20 results) per query by default; `--pages N` allows follow-ups. Existing 1s
  inter-page delay retained.
- Dedupe by `placeId` across towns — a Fair Lawn shop surfacing in the Paterson query is one row.

Niches. Copy-pack availability comes from `packages/copy`'s `niches` registry via prospect's
exported `nicheIdFor()` — not a hand-copied list, so it cannot drift:

| Query | `copyPack` |
|---|---|
| machine shop | `machine-shop` |
| welding fabrication | `welding-fabrication` |
| general contractor | `general-contractor` |
| HVAC contractor / electrician / plumber / roofer / auto repair | *(empty — no pack)* |

The acceptance run is the **three copy-pack niches only**. The other five are wired and reachable
via `--niche` but are not part of the county run, and score with `copyPack` empty.

### 3.2 Website status

`websiteUri` empty → `none`, zero navigations. Otherwise one home-page GET → `SiteSignals` →
prospect's `classifyWebsite` → `live | parked | dead`. 1 nav/sec/domain, 1 nav/site (well inside
the 10 cap), shared `NavigationBudget` from `packages/audit`. `parked`/`dead` score as
no-website per item 2.

### 3.3 Audit (live sites only)

`auditOne` reused unchanged, `NavigationBudget` respected. Capped — see Q3. Live sites not reached
by the cap carry `websiteStatus=live`, an explicit `auditStatus=not-audited`, and a reason string
saying so. They are **never** scored as "decent site" by default; unmeasured is unavailable.

### 3.4 Identity — placeId first

Resolution order for every discovered row:

1. **placeId** vs `place_id` in every `data/*.csv`, and vs the sidecar client map (Q2). Silent, exact.
2. **Slug fallback** — `slugify(name)` vs `slugify(row.name)` / client slug, for rows with no
   placeId. Emits the loud WARNING, naming the row and why the fallback was used.
3. No match → `status=NEW`.

`--backfill-place-ids` (opt-in, off by default): for rows in `data/*.csv` matched by slug fallback,
write the discovered `place_id` back into that row and nothing else. Turns each fallback into a
permanent exact match. It rewrites a shared-schema file, so it is opt-in and prints a diff summary
before writing.

### 3.5 Scoring — **weights below need your approval (Q4)**

```
score = round(100 × opportunity × viability)
```

**Opportunity** — how badly they need us. Strict tiers, so `>>` in the task means what it says:

| Website status | opportunity |
|---|---|
| `none` | 1.00 |
| `dead` | 0.95 |
| `parked` | 0.90 |
| `live`, audited | `0.10 + 0.55 × neglect` → **0.10 … 0.65** |
| `live`, not audited (cap) | 0.10, with the reason recorded |

`neglect` is reused verbatim from `packages/audit`'s `scoreSite` — share of *decided* check weight
that failed, `unavailable` checks excluded. The worst possible live site (0.65) still ranks below
the best parked one (0.90). A clean live site floors at 0.10 rather than 0 so viability can still
order the tail.

**Viability** — worth calling at all. Shape borrowed from audit's `scoreSite` (floor 0.25, range
0.75) so the two scores stay legible against each other:

```
viability = 0.25 + 0.75 × (0.60 × ratingComponent
                         + 0.20 × phonePresent
                         + 0.20 × copyPackAvailable)
```

- `ratingComponent` = `(rating / 5) × clamp01( log10(1+reviews) / log10(101) )`, saturating at 100
  reviews — audit's existing curve, not a new one.
- Not in the survivor pass → `ratingComponent = 0.5` **neutral**, and the reason string says
  `"rating unavailable — not in this run's survivor pass"`. Mirrors audit's documented
  `neutral-no-rating-data` precedent. Never a fabricated 0 or 5.
- `phonePresent` — binary. This is a *call list*; no phone is close to disqualifying, and 0.20 of
  viability is the sharpest lever short of exclusion.
- `copyPackAvailable` — binary, from the registry. A pack means a demo can actually be built today.

**Survivor pass** (the only Enterprise calls): rows that clear `opportunity ≥ 0.60` **and** have a
phone, ranked by provisional score, capped by `--details-cap` (default 150). Rationale: rating only
changes the ordering of people we would already call — buying it for a clean live site with no
phone is money for a row that will never be dialled.

**Top-3 reasons**: the three largest contributors to the final score, each a plain sentence, e.g.
`no website at all`, `4.6★ from 128 reviews`, `machine-shop copy pack ready`. Ranked by actual
contribution, computed — not a fixed template.

### 3.6 Output

`data/prospects-scored.csv`, gitignored. Machine-owned columns **only**:

```
placeId,name,niche,town,phone,website,websiteStatus,score,reasons,copyPack,status
```

`status` is always `NEW` on write. If the file exists, rows are merged by `placeId`: machine columns
are refreshed, and **any column not in the list above is preserved byte-for-byte**. That is how
human tracking columns you add by hand survive a re-run — this stream never writes them and never
drops them.

Run summary prints the **top 25** with one-line rationales, plus the per-tier usage table.

### 3.7 Usage counter

Every call logs `{ endpoint, fieldMask, tier, niche, town, resultCount }`. Tier is derived from the
mask by a table of which fields belong to which SKU — so if someone adds an Enterprise field to the
discovery mask later, the counter reports it as Enterprise rather than staying quiet.

End of run, to console and to `data/usage-<runId>.json` (gitignored):

```
Places usage — run 2026-08-12T…
  Text Search  Pro          210 calls   (masks: 1 distinct)
  Place Details Enterprise  147 calls   (masks: 1 distinct)
  Text Search  Enterprise     0 calls   ← must be 0
  Total                     357 calls
```

That is the shape you reconcile against the console's metrics page.

`--budget` is per-tier: `--budget 400` sets the total, `--budget-enterprise 150` the Enterprise
sub-cap. Conservative defaults: **total 400, enterprise 150**. Exceeding either aborts before the
call, reusing `CallBudget`'s existing throw-before-spend behaviour.

### 3.8 `pnpm shortlist`

```
pnpm shortlist -- --top 10 --niche machine-shop
```

Reads `data/prospects-scored.csv`, filters, sorts, and **prints** the demo batch command. Zero
network calls, zero writes, does not execute anything. Output shaped to `packages/prospect`'s real
CLI (`pnpm demo -- --prospect <id>`, `--prospect` is repeatable).

---

## 4. Gates

Run on the merged-with-main state, re-run if the PR goes stale:

| Gate | Command |
|---|---|
| Build | `pnpm build` |
| Typecheck | `pnpm typecheck` (TS strict) |
| Tests | `pnpm test` |
| Existing-client regression | `pnpm verify:offline:all` — must be byte-identical |

`packages/discover` has **no** `test` script today; `packages/shortlist` will ship one, and I will
add one to `discover` (its own `package.json`, within my grant).

**New gate, failure demonstrated first** per CLAUDE.md: `enterprise-fields-in-discovery-mask`.
Asserts the discovery Text Search mask contains no Enterprise-tier field. I will commit it
**failing against the current `FIELD_MASK`** — which does contain `places.rating` and
`places.userRatingCount` (§1.1) — and the fix in the following commit. The PR will show both.

Other tests: tier derivation per mask; budget abort before spend; `classifyWebsite` wiring for each
of none/parked/dead/live; scoring boundaries (parked outranks worst-live); reason ranking;
placeId-vs-slug resolution incl. the WARNING; CSV merge preserving unknown human columns; `shortlist`
printing without executing.

All network is stubbed via the existing `FetchLike` seam. **No live API calls from any test.**

---

## 5. The live run — custody (Q5)

Acceptance asks for "one real county-wide run … usage counter reconciles against the console".
A real run spends your key against a real quota. My standing instruction is that secret custody
stays with you: I prove gating with stubs, you run the live test.

Proposed split:

- **Me:** build it; prove every path against recorded fixtures; run `--dry-run` end-to-end (zero
  network) over all 70 towns × 3 niches to prove sweep, dedupe, scoring, CSV and summary; report
  the exact projected call counts per tier.
- **You:** run the live sweep, screenshot the console metrics page, and I reconcile the counter
  against it and fix any drift.

I have copied `.env` into the worktree per the cold-start rule and have not read or echoed the key
value. Say the word if you would rather I execute the live run instead — it is your key and your
call, and I will do it if you say so.

---

## 6. Decision Brief

1. **`docs/decisions.md` does not exist.** I planned against
   [PLAN-pipeline.md:274-283](PLAN-pipeline.md#L274-L283) and
   [ingest/leads.ts:22-25](packages/prospect/src/ingest/leads.ts#L22-L25) as the record of the
   slug-collision interim. **Recommendation:** confirm those are what you meant; I will note in the
   PR that placeId-first matching closes the PLAN-pipeline.md backlog item, and leave the
   `docs/decisions.md` reference for you to correct. *Blocking — it decides what "closes the
   interim" means.*

2. **Client registry placeId.** Item 3 wants placeId matching against the client registry, but
   configs have no such field and adding one edits `packages/template/src/types/**` — a forbidden
   path. **Recommendation:** a sidecar `packages/shortlist/client-place-ids.json` mapping client
   slug → placeId, owned by this stream, no template change. Reviewable in one file, and it
   promotes into `SiteConfig` later if you ever want it there. *Blocking — the alternative needs a
   grant I do not have.*

3. **Audit cap.** Full `auditOne` across every live site is many hours (§1.6).
   **Recommendation:** `--audit-cap`, default **60**, spent on the highest provisional-opportunity
   live sites first. Uncapped remainder is marked `not-audited` and floors at 0.10 opportunity
   rather than being scored as decent. Raise it with `--audit-cap 0` for unlimited when you have a
   night to spare. *Blocking — it changes what the acceptance run actually measures.*

4. **Scoring weights (§3.5).** The tier boundaries, the 0.60/0.20/0.20 viability split, the 0.5
   neutral for unmeasured rating, and the `opportunity ≥ 0.60 + has phone` survivor filter.
   **Recommendation:** approve as proposed; they reuse audit's existing curve and floor/range so the
   two scores stay comparable. *Blocking — you asked to approve these explicitly.*

5. **The pre-existing Enterprise leak (§1.1).** Fixing it empties the `rating` / `review_count`
   columns for new `pnpm discover` rows. **Recommendation:** fix it — the acceptance criterion
   cannot be met otherwise — and accept the empty columns as correct (unmeasured = unavailable).
   Existing rows are untouched. *Non-blocking; I will proceed on this recommendation unless you say
   otherwise.*

6. **Home-page signals collector (§1.2).** Reuses prospect's `classifyWebsite` judgement but writes
   a fresh one-navigation page reader, because `readPage` is unexported and `ingestWebsite` is
   5 navigations of harvesting this stream does not need. **Recommendation:** proceed as described;
   the alternative is a cross-boundary export from `packages/prospect`. *Non-blocking; flagged
   because it sits near the no-duplicate-implementations line.*

7. **Live run custody (§5).** **Recommendation:** you run it, I reconcile. *Blocking on acceptance
   only — I can build and prove everything else first.*

---

## 7. Sequence

1. `packages/discover`: tiered masks + `places.types`, Details call, tier-derivation table, usage
   counter, per-tier budget. **Failing gate committed first**, then the fix.
2. `packages/shortlist` scaffold; workspace + root script wiring (the two cross-boundary lines).
3. Sweep + dedupe + `--dry-run` fixture path.
4. Website status via prospect's classifier.
5. Audit orchestration under the cap.
6. Identity resolution + WARNING + `--backfill-place-ids`.
7. Scoring + reasons.
8. CSV emit with human-column preservation; top-25 summary.
9. `pnpm shortlist` printer.
10. Full dry run over 70×3; projected call counts reported.
11. Merge main in, full gate suite on the merged state, open HELD PR.

Steps 3–9 depend on Q1–Q4. Step 1 depends only on Q5's recommendation and can start immediately on
approval.
