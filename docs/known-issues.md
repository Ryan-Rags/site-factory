# Known issues

Open defects and unmeasured properties that a session should know about before
it spends time rediscovering them. One entry per issue: what is wrong, how to
reproduce it, what has been ruled out, and who owns the fix.

Settled *rules* go in [`decisions.md`](decisions.md), not here. An entry that
gets fixed is deleted by the PR that fixes it, and the fix — if it settled
anything durable — becomes a line in the ledger.

---

## 1. Turnstile is unsafe to enable for a client — React hydration race

**Status:** open. **Owner:** whoever owns `ContactForm.tsx` / `contact.astro`.
**Found by:** `feat/trust-seo`, [PR #17](https://github.com/Ryan-Rags/site-factory/pull/17).
**Pre-existing** — reproduces on unmodified `main` at `e9654c5`; nothing in that
stream caused it.

`contact.astro` loads Turnstile's `api.js` at page level with `defer`. The
`.cf-turnstile` container it renders into lives inside `ContactForm.tsx`, which
Astro mounts as a **`client:visible`** island. Turnstile therefore mutates a DOM
node React is about to hydrate, and the two race.

When React loses, it throws hydration errors (`#418` ×4 and `#423`, "switched to
client rendering") and the client re-render **wipes the widget**. The end state
is a `.cf-turnstile` div with no iframe and — the part that matters — **no
`input[name="cf-turnstile-response"]`**. The form submits with no token, and any
Worker that verifies the token rejects every submission from that visitor.

Roughly **one run in five**. It fires **no `securitypolicyviolation` event**,
which is why `check-csp-runtime.mjs` also listens for `pageerror`: a violation
listener alone reports the page clean.

**It is not the CSP.** Same build, five trials each, headers the only variable:

```
WITH generated CSP:  ok ok ok ok ok
WITHOUT any headers: ok BAD ok ok ok
```

The failure occurs *without* the CSP and did not recur with it. An earlier
single-sample comparison pointed the other way and was wrong.

**Reproduce:** add Cloudflare's public "always passes" test site key
(`1x00000000000000000000AA` — not a secret, not account-bound) to
`zz-fixture-phone-optional`'s `forms.turnstileSiteKey`, build it, serve it, and
load `/contact/` repeatedly, asserting on the presence of
`input[name="cf-turnstile-response"]`.

**Fix sketch:** load `api.js` with `?render=explicit` and call
`turnstile.render()` from a `useEffect` after hydration, instead of letting
`api.js` auto-scan for a container React owns. That removes the race rather than
narrowing it.

**Consequence accepted today.** The test key was removed from the go-live
fixture rather than kept, so the Turnstile CSP path is proved by recorded
measurement and a reproducible command rather than by a standing gate — keeping
it would import a one-in-five third-party flake into a gate that runs on every
`build:all`, and a gate that goes red intermittently teaches people to re-run it
instead of read it. Re-add the key the moment this is fixed; it then becomes a
permanent regression test for both. See the ledger entries of 2026-08-12 for the
enable-block ruling.

**Also proved while chasing this, and worth not re-deriving:** with a site key
set, the first version of `gen-headers.mjs` emitted `frame-src 'none'` because
Turnstile injects its widget iframe at *runtime* and static measurement never
sees it — a policy that loads the script and then blocks the widget it exists to
draw. The rule now is that a host trusted to execute script is also trusted to
frame. Measured with the key set: `script-src 'self' <hashes>
https://challenges.cloudflare.com`, `frame-src https://challenges.cloudflare.com`;
with no key, `frame-src 'none'` and no external script host. Zero
`securitypolicyviolation` events at runtime under the generated policy.

---

## 2. Lighthouse reports `NO_LCP` for any `DesignLayout` page under mobile device emulation

**Status:** open, and it is why **mobile performance is not demonstrated**.
**Found by:** `feat/design-families`; re-measured unchanged by `feat/design-polish`
([PR #14](https://github.com/Ryan-Rags/site-factory/pull/14)).

Lighthouse cannot produce a performance score for a design-family home page in
this environment: its LCP audit reports `NO_LCP` on Lighthouse 11 and 12 alike.
Every other performance audit scores 1/1.

| Metric | Value | Audit score |
|---|---|---|
| First Contentful Paint | 1.0 s | 1 |
| Speed Index | 1.0 s | 1 |
| Total Blocking Time | 0 ms | 1 |
| Cumulative Layout Shift | 0.036 | 1 |
| Time to Interactive | 1.0 s | 1 |
| Largest Contentful Paint | — | **`NO_LCP`** |

**The repro, narrowed to a precise boundary with a direct Chrome probe:**

| Viewport | LCP reported |
|---|---|
| 1280 desktop | yes — `H1.d-hero__title`, 344 ms |
| 412 × 823 | yes — `H1.d-hero__title` |
| 412 × 823 with touch emulation | yes |
| **412 × 823 with `isMobile: true`** | **no candidates at all** |

So Chrome reports a healthy LCP on the same page at the same width and stops
reporting one the moment mobile **device** emulation is switched on — which is
exactly the mode Lighthouse mobile runs in. It is specific to `DesignLayout`:
`/about` on the same server, in the same emulation mode, reports LCP normally.

**Ruled out:** hero motion (a build with `motion: none` behaves identically), the
customizer (a build without it behaves identically), the hero variant (all three
identical), quirks mode, and the `left: -9999px` skip link.

**Fixed along the way, both worth having on their own:** an HTML comment sitting
above `<!doctype html>` put the page in quirks mode, and an Astro comment above
`<html>` silently dropped `<html>`, `<head>` and `<body>` from every design page.
Neither was the cause.

**Baseline for anyone re-measuring:** `main` reports the same `NO_LCP`, so a
branch that also reports it has not regressed anything. Note that
`PLAN-design-families.md` recorded SEO **93** for this audit while `main` scores
**69** on the Lighthouse installed here — that difference is the tool version,
not the work. SEO 69 on a mockup is the `is-crawlable` deduction, i.e. the
`noindex` lock doing its job; the go-live fixture, the one config with
`noindex: false`, scores 100 / 100 / 100 / 100.

**Still open:** finding what in `DesignLayout` suppresses LCP under device
emulation.

**Measured live, 2026-08-12 (`feat/live-smoke`).** The 90+ mobile bar has now
been demonstrated on three of the eight deployed demos, against
`https://<slug>-preview.pages.dev/` with the same mobile emulation, on
Lighthouse 12.8.2:

| Client | performance | accessibility | best-practices | seo |
|---|---|---|---|---|
| american-machine-specialty | **100** | 96 | 100 | 69 |
| industrial-machine-corp | **99** | 100 | 100 | 69 |
| kh-machine-works | **98** | 96 | 100 | 69 |
| ks-welding, ks-welding-{forge,heritage,precision}, kts-machine-shop | `NO_LCP` | 96–100 | 100 | 69 |

So the defect is **not** universal to `DesignLayout` under device emulation, and
it is not the network either — three design-family home pages served over the
same path score. What separates the two groups is not yet known.

**The live presentation differs from the table above in one respect**, and it
matters because `scripts/live-smoke` keys its waiver on the signature: on
Lighthouse 12.8.2 the LCP failure surfaces as a thrown `LanternError: NO_LCP`
out of `@paulirish/trace_engine`, and **`total-blocking-time` also fails to
score** — where this entry records every other performance audit at 1/1. Both
are lantern-simulated metrics off the same graph, so one cause with two
casualties is the likely reading, but that is inference. Until it is settled,
live-smoke refuses the waiver on this signature and reports the run as a
failure, which is the conservative half of "a known issue never fails smoke; an
unknown one always does".

### Addendum, 2026-08-12 — the inference above is now a measurement

Read this in preference to the paragraph it follows; that paragraph is left in
place because the ledger is append-only in spirit and because the reasoning it
records is what the measurement was taken to settle.

**Corrected first: three cells of the table above were mis-transcribed.** The
table and the instrument output landed in the same commit
([`ef98f75`](https://github.com/Ryan-Rags/site-factory/commit/ef98f7532ab24f3b9f721670cf6b1fe8fe5b5909))
and disagree. The run itself is authoritative —
[`docs/evidence/live-smoke/report.md`@ef98f75](https://github.com/Ryan-Rags/site-factory/blob/ef98f7532ab24f3b9f721670cf6b1fe8fe5b5909/docs/evidence/live-smoke/report.md),
per-client `Scores (mobile, port …)` lines — and the table above has been set to
match it. What changed: `american-machine-specialty` performance 99 → **100**,
`kh-machine-works` performance 100 → **98**, `industrial-machine-corp`
accessibility 96 → **100**. Nothing else moved, and no conclusion depends on the
difference: all three are ≥ 90 either way. Anyone quoting "99 / 99 / 100" for
these three is quoting the mis-transcription.

**(a) `total-blocking-time` is unscored on all five red clients, and always
together with `NO_LCP`.** This is now read off the instrument rather than
inferred. `isKnownNoLcp` returns early with `no NO_LCP error on the LCP audit`
whenever the LCP audit carries no `NO_LCP` error message, so a client can only
reach the `other performance audits also failed to score: …` branch if the
`NO_LCP` error was present. All five red clients reached that branch, and each
named exactly one audit:

```
ks-welding            other performance audits also failed to score: total-blocking-time
ks-welding-forge      other performance audits also failed to score: total-blocking-time
ks-welding-heritage   other performance audits also failed to score: total-blocking-time
ks-welding-precision  other performance audits also failed to score: total-blocking-time
kts-machine-shop      other performance audits also failed to score: total-blocking-time
```

So on Lighthouse **12.8.2** (resolved in `pnpm-lock.yaml`; `packages/audit`
declares `^12.3.0`) the live shape is `NO_LCP` **and** `total-blocking-time`
unscored, five for five, with every other weighted performance audit scoring.
`total-blocking-time` is the only companion casualty observed. Why the two fall
together is still unproven — the lantern-graph reading remains a hypothesis, and
this entry's **Still open** line covers it.

**(b) The 90+ mobile bar is demonstrable on `DesignLayout`.** 100, 99 and 98 on
three deployed design-family home pages, under the same mobile emulation, same
Lighthouse, same deploy path as the five that fail. The defect is
**page-specific, not layout-universal** — which is what makes it a defect worth
localising rather than a property of the layout.

**What this authorises, and its exact boundary.** The waiver signature may be
widened to accept `total-blocking-time` as unscored **only when the LCP audit
carries the `NO_LCP` error message in the same LHR**. Every other refusal stands
unchanged and is not up for reinterpretation:

- LCP absent for any other reason (`PROTOCOL_TIMEOUT`, and anything else) —
  refused.
- `total-blocking-time` unscored *without* `NO_LCP` — refused.
- Any *third* weighted performance audit unscored — refused, `NO_LCP` present or
  not.
- `docs/known-issues.md` no longer carrying a `NO_LCP` entry — refused, as
  before.

Same issue, fuller fingerprint. Nothing about the waiver's reach is inferred
from the fact that a red run is inconvenient.

**Not done in this entry's PR:** the widening itself. It is a change to
`scripts/live-smoke/checks/lighthouse.mjs` and its selftest — gate-script code,
not documentation — so `pnpm smoke -- --all` stays red on the five until that
lands, and this addendum is the evidence and the boundary that stream builds to.

**Landed 2026-08-13 in [PR #34](https://github.com/Ryan-Rags/site-factory/pull/34)** — `scripts/live-smoke/checks/lighthouse.mjs` and its selftest now accept the measured pair at exactly the boundary above, and no wider; the paragraph before this one is superseded on that one point only.

**Reproduce:** `pnpm smoke -- --client ks-welding`, and read the
`lighthouse performance` row of the generated `report.md`.

---

<!--
  #3 — "packages/shortlist opens no debugging port, so Lighthouse cannot attach"
  (found by test/localhost-sites, PR #18 Brief 2) was fixed and is deleted; see
  the ledger entry of 2026-08-12. Numbers are never reused or renumbered: code
  comments cite these entries by number, so a gap is cheaper than a shifted
  reference. The last text of #3 is readable at
  https://github.com/Ryan-Rags/site-factory/blob/ef98f7532ab24f3b9f721670cf6b1fe8fe5b5909/docs/known-issues.md

  #4 — the og:image origin defect — was fixed by PR #38 (issue #25) and is
  deleted, and it takes TWO numbers with it, because it was filed twice under
  the same one:

    * PR #22 filed "Every preview demo unfurls with no social card" as #4,
      from the ops redeploy of 2026-08-12.
    * PR #23 filed "Every demo advertises its og:image on a domain the demo is
      not served from" ALSO as #4, from feat/live-smoke, inserting it above the
      first. Same defect, same measurement, second write-up.

  The duplicate should have been #5. It is recorded as having been #5 rather
  than renumbered in place, because renumbering a live entry is the one thing
  the 2026-08-12 append-only ruling forbids — and because the deletion makes
  the question moot in every way except this note. NEITHER 4 NOR 5 IS EVER
  REUSED. The next entry filed here is #6.

  No code cites #4 or #5. The only numbered citations in the tree are to #2
  (scripts/live-smoke/checks/lighthouse.mjs, its selftest, and
  packages/audit/src/lighthouse.ts) and to #3 (scripts/live-smoke/browser.mjs,
  scripts/live-smoke/checks/lighthouse.mjs), and none of them moved.

  The last text of both #4 entries is readable at
  https://github.com/Ryan-Rags/site-factory/blob/df1accdd23af21b5062f25751bd1acacca8e7b76/docs/known-issues.md
-->

---

## 6. The served-slug guard cannot tell two worktrees apart

**Status:** open. **Owner:** whoever next touches the browser gates' preamble.
**Found by:** `feat/design-expansion`, while running `check:switching` and
`check:reveal`. **Pre-existing** — the guard has always had this shape.

Every browser gate confirms the served build before measuring, per the ruling
of 2026-08-13 (PR #40). It does so by reading the client slug out of the built
page's manifest link:

```js
const manifest = document.querySelector('link[rel="manifest"]')?.getAttribute('href') ?? '';
return /\/icons\/([^/]+)\//.exec(manifest)?.[1] ?? null;
```

That proves *which client* is being served. It does not prove *which worktree*
built it, and the slug is identical across all of them.

**Repro.** Two worktrees of this repo, both with a `ks-welding` build:

```
cd D:/worktree-a/packages/template && SITE_CLIENT=ks-welding pnpm exec astro preview --port 4321
cd D:/worktree-b/packages/template && SITE_CLIENT=ks-welding pnpm exec astro preview --port 4321
#   → "Port 4321 is in use, trying another one..."  → binds 4322, silently
cd D:/worktree-b/packages/template && SITE_CLIENT=ks-welding PREVIEW_URL=http://localhost:4321 pnpm check:switching
#   → guard passes. It is grading worktree A.
```

Observed here with live previews from `D:\sf-design-coverage` and
`D:\sf-baseline-main` still holding 4321–4327 from earlier sessions, so
`astro preview` walked this worktree's server up to 4327 while `PREVIEW_URL`
still said 4321.

**What saved this stream** was not the guard: every run was cross-checked
against content that only exists on this branch — 272 cells rather than 112,
the three motion sweeps, the `8s` transition visible in the served CSS. That is
a habit, not a mechanism, and the next session will not know to do it.

**Fix sketch.** Stamp a build identity the guard can compare — the short git
SHA and worktree path are both already available at build time — into a `<meta>`
tag on every page, and have the guard compare that rather than the slug. Or,
narrower and cheaper: have the gates start and own their own preview on an
ephemeral port, which the 2026-08-13 ruling already names as structurally
satisfying the requirement.

**Ruled out:** killing stray previews before a run. It is what was done here,
and it is a person remembering, which is the thing the guard exists to replace.

Related: issue #37 (the `check:overflow` served-slug backfill).

---

## 7. A fixture left in `dist/` fails `build:all`

**Status:** open. **Owner:** whoever owns `build-all.mjs` / `check-csp-runtime.mjs`.
**Found by:** `feat/design-expansion`, after building `zz-fixture-motion`.
**Pre-existing** — `zz-fixture-long-name` reproduces it identically.

`build-all.mjs` deliberately skips every `zz-fixture-` slug, so a fixture is
never built by a batch and never reaches a deploy. But the last step of the
same script runs `check-csp-runtime.mjs --all`, and that discovers its work by
listing directories:

```js
slugs = readdirSync(distRoot).filter((d) => statSync(join(distRoot, d)).isDirectory());
```

So a fixture built earlier on purpose is still sitting in `dist/`, is swept,
has no `_headers` (nothing generated one for it), and fails the batch.

**Repro.**

```
cd packages/template
SITE_CLIENT=zz-fixture-motion pnpm exec astro build   # the documented way to build a fixture
pnpm build:all
#   → ✗ zz-fixture-motion: no _headers. Run scripts/gen-headers.mjs first.
#   → 7/8 clients built and checked.   (exit 1)
```

**Workaround:** `rm -rf dist/zz-fixture-*` before `build:all`. Used throughout
this stream.

**Fix sketch.** `check-csp-runtime.mjs --all` should sweep the same set
`build-all.mjs` builds rather than whatever is on disk — either by being handed
the slug list, or by applying the same `zz-fixture-` exclusion. The exclusion
already exists in one file and is the kind of rule that belongs in one place.

**Not fixed here:** wrong scope. This stream added the fixture that surfaced
it; it did not cause it, and changing what a gate script sweeps is a change to
the batch's contract.

## 8. `--pages 1` is not one Places call per cell, and a budget stop destroys the run

**Status:** RESOLVED — (b) by PR #49, (a) by PR #50. Kept for the diagnosis,
because the first explanation was wrong in an instructive way.
**Found by:** the ops session of 2026-08-14, on the first live county sweep.
**Cost when it fired:** 250 billable Enterprise calls and zero rows written;
then 800 more on the retry, 730 of them spent by a single cell.

**Correction, 2026-08-14 (PR #50).** Part (a) below says a cell costs "~3.6
calls". That was an average, and it described nothing that ever happened. The
usage records of the second run settle it: **69 of 70 cells cost exactly one
call**, and one cell — `welding and fabrication in Allendale, NJ` — spent **730**
in an uncapped paging loop, because `while (out.length < max)` had no request
ceiling and that query kept answering with a thin page and a fresh
`nextPageToken`. The original 210-call projection was right all along; the
runaway is what made it look wrong. `searchTextDetailed` now takes `maxCalls`,
defaulted to the pages needed to reach `max`, so `--pages N` means at most N
calls per cell — hard, and proved by a regression test that keeps handing the
loop tokens it must ignore.

Two defects, one run. They compound, which is why they are filed together.

**(a) The projection is wrong.** `cli.ts` prints and budgets
`niches × towns × pages` — 3 × 70 × 1 = 210 — and `sweep.ts`'s header states
"with `--pages 1` that is 210 billable calls". Neither is true live. `--pages`
sets a *result* target, not a call count: `pages: 1` becomes `max = PAGE_SIZE ×
pages = 20`, and `searchTextDetailed` then loops `while (out.length < max)`,
following `nextPageToken` until it has twenty results. The live API returns far
fewer than twenty per page for most Bergen towns but still returns a token, so a
cell costs **~3.6 calls, not 1**. A full 210-cell sweep needs roughly **750**.

The dry run cannot catch this: the checked-in fixture carries no `nextPageToken`,
so every fixture cell costs exactly one call and the projection looks exact.

**(b) The stop destroys what was bought.** `sweep()` rethrows on budget
exhaustion, and `cli.ts` writes `prospects-scored.csv` and the usage JSON only
*after* `sweep()` returns. So the ceiling — which exists to stop spending —
also discards every result already paid for. The run below completed all 70
towns of `machine-shop` and wrote nothing at all.

**Repro.**

```
pnpm sweep            # defaults: 3 niches × 70 towns, budget 250
#   → swept 70/210 (machine-shop/Wyckoff)
#   → Places budget exhausted: 250 calls/run. Nothing further was requested.
#   → exit 1;  data/prospects-scored.csv absent, data/usage-*.json absent
```

**Fix sketch.** (b) first and independently, because it is the one that loses
data: catch the exhaustion in `cli.ts`, write the partial CSV and the usage JSON,
and report the run as partial — the same rule PR #48 applied to the customizer
check. For (a), make the cost honest rather than the guess: either cap a cell at
one page (`max = PAGE_SIZE`, which is what "one call per cell" actually means)
and let `--pages` mean pages, or keep the result target and project
`niches × towns × pages × observed-calls-per-page` with the ~3.6 measured here.
The two are different products — twenty results per town versus one page per
town — and which one the shortlist wants is a ruling, not a refactor.

**Not fixed here:** outside this stream's granted paths, and (a) needs that
ruling before any code is right.

**Fixed in PR #50.** The ruling landed: `--pages N` is a hard call cap, and the
projection is `cells × pages` exactly. `MEASURED_CALLS_PER_CELL` is deleted.

## 9. Text Search returned a bakery for "machine shop", and the sweep believed it

**Status:** RESOLVED by PR #50. Kept because the failure is not obvious and the
gate that now prevents it can only be understood against it.
**Found by:** the ops session of 2026-08-14, reading its own top 25.

Places Text Search is relevance-ranked, not category-filtered. `"machine shop in
Park Ridge, NJ"` returns a bakery, and the sweep stamped `nicheLabel` from the
**query string** rather than from the result — so the bakery was written to the
call list as a machine shop. **Not one of that run's top 25 was a machine shop.**
Three were a bakery, a coffee shop and a Japanese restaurant:

```
  3. [100] Maia's Bakery — Park Ridge · none · machine shop
  4. [ 99] Euphoria smoke shop NJ — Cliffside Park · none · machine shop
 10. [ 95] The Dell Coffee Co — Oradell · none · machine shop
 25. [ 87] Little Japan USA — Edgewater · dead · machine shop
```

The scorer compounded it rather than catching it: its strongest signal is "no
website + many reviews", which is the exact profile of a beloved local bakery.
The errors did not merely survive the ranking, they *won* it.

`places.types` was in the field mask from the first sweep — fetched, billed at
Enterprise, stored on `SweepResult`, and read by nothing.

**Repro (pre-fix).**

```
pnpm sweep -- --niche machine-shop --town "Park Ridge"
#   → a bakery, in the CSV, with niche="machine shop"
```

**Fix.** `conformance.ts` classifies each result's `types` against a per-niche
allowlist built from a live probe (117 results, 6 calls), plus a denylist for
the food/leisure/retail types that contradict every trade here. `types` and
`nicheMatch` are persisted as columns, so a call list can be re-filtered without
buying the data again. A mismatch is **withheld from the shortlist, never
deleted** — a no-website bakery is a real prospect for a different pitch, and
`--include-mismatches` lists them.

**Residual, accepted:** welding's allowlist admits bare `service`, which is also
what a clinic or a restaurant carries, because excluding it would reject
`ks-welding` — an actual client. The denylist is what keeps that breadth honest,
and welding rows deserve a glance before a batch. The five non-copy-pack niches
have unprobed, plausible-only allowlists; nothing rests on them until probed.

---

## 10. Two slugification rules disagree about `&`, and 14 of the 50 demos are filed under the losing one

**Status:** open, worked around. **Tracked as** [#57](https://github.com/Ryan-Rags/site-factory/issues/57).
**Owner:** whoever owns `slugify` in `packages/discover`.
**Found by:** `ops/batch-2-readiness`, PR #58, while keying design variety on the
place id.

`slugify` in `@site-factory/discover` **drops** `&`. The 2026-08-16 batch of 50
**expanded** it to `and`. So the same business has two possible slugs:

```
"A&A Bergen Home Improvements"
  slugify(name)          -> a-a-bergen-home-improvements
  the batch's filename   -> a-and-a-bergen-home-improvements
```

14 of the 50 names carry an ampersand, so any lookup keyed on `slugify(name)`
misses exactly those 14. That is the second realised form of the slug-collision
hazard the comments in `packages/prospect/src/ingest/leads.ts` warn about — and it
is silent, because a miss is indistinguishable from a prospect nobody discovered.

**Repro.**

```
node -e "import('@site-factory/discover').then(({slugify})=>console.log(slugify('A&A Bergen Home Improvements')))"
#   → a-a-bergen-home-improvements
ls prospects/ | grep bergen-home
#   → a-and-a-bergen-home-improvements
```

**Workaround in place.** `findPlaceId` matches both spellings, so the backfill
found 50 of 50. Before that it found 36.

**Why the slugs were not renamed instead:** 33 of these demos are deployed at
`https://<slug>-preview.pages.dev` and those URLs are printed on the call sheet
Ryan calls from. Renaming to satisfy `slugify` would move 33 live URLs to fix a
cosmetic disagreement.

**What a real fix looks like:** one slugifier, chosen deliberately (expanding `&`
reads better in a URL), applied at the point a prospect record is created, with
the existing 50 left alone or migrated deliberately with their Pages projects.
Not this stream's to pick.

---

## 11. `live-smoke` and `check-form-fields` resolve slugs through `clients/index.ts`, so neither can see a prospect demo

**Status:** CLOSED 2026-08-18 by `ops/calling-week-hardening`.
**Was tracked as** [#56](https://github.com/Ryan-Rags/site-factory/issues/56).
**Found by:** PR #54 (Brief item 5, unruled); half fixed by PR #58, the rest here.

Two tools assumed a client config is the only deployable thing, while
`pnpm demo` deploys from gitignored `prospects/`.

- `check-form-fields.mjs` — **fixed** in PR #58: its bijection is now
  `clients/index.ts ∪ prospects/known.json`.
- `scripts/live-smoke/` — **fixed** here, by the same union, in
  `scripts/live-smoke/slugs.mjs`. `--client` now accepts a generated demo and
  is repeatable, so a sample runs under one politeness ledger. 58 slugs are
  smokeable where 8 were.

**And the origin no longer comes from the slug.** `originFor()` reads
`prospects/<slug>/demo.json`'s `liveUrl` — what wrangler actually returned —
and falls back to `https://<slug>-preview.pages.dev` only when there is no
manifest, saying which it used. Deriving the URL is what recorded a live site
as dead during the fleet sweep; see #13 below.

**Repro.**

```
pnpm smoke -- --client ztm-construction-llc
#   → Unknown client "ztm-construction-llc"
```

**Consequence.** The 50 have deploy-time home/services 200 checks and, for two
samples, the hand-run form-path probes recorded in
`docs/evidence/r1-form-path-smoke.txt`. They have no LCP, no metadata and no
contrast verification against the *live* origin — only against `dist/`.

**Fixed by** `scripts/live-smoke/slugs.mjs`: `prospects/known.json` (committed,
slugs only) supplies the second half of the deployable set, and
`prospects/<slug>/demo.json` supplies the origin. Nothing about a prospect
entered the repo.

---

## 12. The Worker's honeypot check runs before the `KNOWN_PROSPECTS` check, so a honeypot probe cannot prove admission

**Status:** open, low severity. **Owner:** whoever owns `worker-demo/src/index.ts`.
**Found by:** PR #58, while designing the form-path smoke Ryan asked for.

Order of operations in the lead path is honeypot, *then* prospect id. A POST with
the `company` field filled therefore answers `200 {ok:true}` for **any** slug,
registered or not — nothing is stored and nothing is mailed, so there is no
security consequence, but "the honeypot method" cannot be used to verify that a
demo's slug is admitted.

**Repro.**

```
curl -sX POST "$DEMO_FORM_ENDPOINT" -F prospectId=not-a-real-slug -F company=bot
#   → {"ok":true}
```

**Workaround in place.** The smoke uses a registered slug with a deliberately
incomplete payload and asserts `422 validation_failed`: reaching field validation
proves the slug cleared the registry, and costs no email and no KV lead. See
`docs/evidence/r1-form-path-smoke.txt`.

**Fix sketch.** Move the honeypot check below the prospect-id gate. Cheap, but it
makes the endpoint marginally chattier to an unknown caller, which is why it is a
judgment call rather than an obvious fix.

---

## 13. A substituted Pages project name leaves the demo advertising a host that does not resolve

**Status:** CLOSED 2026-08-18 by `ops/calling-week-hardening` — the one affected
demo is rebuilt and redeployed on its real origin, and the class is now caught
at the deploy. **Owner:** spans `packages/prospect/src/deploy.ts` and
`packages/template/src/lib/preview-origin.mjs`.
**Found by:** `ops/batch-2-readiness`, PR #58, on the live fleet sweep.

`previewOriginFor(slug)` returns `https://<slug>-preview.pages.dev` and the build
stamps it into `canonical`, `og:url` and `og:image` on every noindex build. But
`deploy.ts` appends a `-rr` collision suffix when the project name is already
taken in another account — **after** the build has run, so the built HTML cannot
know. The demo is then served from one host and advertises another.

Measured on `c3m-of-nj-home-renovation-affordable-handyman`:

```
served at:  https://c3m-of-nj-home-renovation-affordable-handyman-preview-rr.pages.dev   200
advertises: https://c3m-of-nj-home-renovation-affordable-handyman-preview.pages.dev      does not resolve
```

**Consequence.** That demo's link unfurls blank in every messaging app — the exact
defect [issue #25](https://github.com/Ryan-Rags/site-factory/issues/25) fixed for
the eight clients, reappearing through a path that fix did not cover. Its
canonical also points at nothing. The demo itself works: the page serves, the
contact form posts, and the call sheet carries the correct `-rr` URL because it
reads the manifest's `liveUrl` rather than deriving it.

**Why `check-metadata.mjs` passed it.** The gate asserts the card origin equals
`previewOriginFor(slug)`. Build and gate agree with each other and both are wrong
about where the site ended up — there is nothing in the build that knows about
substitution. That is the reason the new gate takes the origin as an argument
rather than deriving it: a check that derives the same value the build derived
can only ever confirm the build's own opinion.

**Measured, both sides.** Before: 8 stamped URLs on 5 pages, all on the dead
host — `docs/evidence/stamped-origins-red.md`. After: all 8 on the `-rr` host,
both assets answering 200 — `docs/evidence/stamped-origins-green.md`.

**Anything deriving a demo URL from a slug is wrong for this one demo.** The
sweep in `docs/evidence/r1-r2-r3-live-fleet.txt` reads manifests for that reason;
a first attempt guessed `<slug>-preview.pages.dev` and recorded the site as dead.

**Fixed as option 3 of the three sketched below, plus the detection that makes it
safe.** `scripts/check-stamped-origins.mjs` runs in both deploy paths, after the
deploy, taking the *resolved* project origin as an input — the one thing no
other check does, which is why build and gate could agree with each other and
both be wrong. Every absolute URL on a `*.pages.dev` host must equal that
origin, and every asset URL must answer 200. `PREVIEW_ORIGIN` is the operator's
correction, printed by the failure itself, and it moves both the identity claims
(`run.ts`'s `siteUrl`) and the fetched assets (`cardOrigin`).

The three options as they stood, for the record:
1. `ensureProject` reserves the name *before* the build, and the resolved project
   name is passed to the build as the preview origin. Correct, and the largest change.
   **Still the better end state — see the Decision Brief of the PR that closed this.**
2. Never substitute: fail the deploy on a collision and make the operator choose a
   slug. Loud, cheap, and costs a demo until someone intervenes.
3. Detect substitution after the fact and rebuild + redeploy that one slug with an
   origin override. Cheapest to add, and leaves a wrong artifact briefly live.
   **Chosen**, because the detection is worth more than the prevention: it catches
   a wrong artifact whatever caused it, where option 1 only closes the one cause
   already recorded.

---
## 14. A Cloudflare Pages alias serves stale redirects after an output-format change

**Status:** operational, self-clearing. Affects verification, not the artifact.

`packages/founder-site` first deployed with Astro's default *directory* output
(`dist/sites/index.html`), so Pages answered `/sites` with a `308` to `/sites/`.
The build then moved to `build.format: 'file'` (see `docs/decisions.md`,
2026-08-17) so that the no-trailing-slash canonical resolves to a document.

After redeploying, the **immutable deployment URL served every route `200`, while
the production alias kept returning the old `308` for some routes and not
others** — routes expired from the edge cache independently, so a verification
run caught `/ai` and `/about` green and `/sites` and `/amenity` still redirecting.
A cache-busting query string did not help; the redirect is cached per path.

**Repro.**

```
# deploy with directory output, request a route, then redeploy with file output
curl -o /dev/null -w "%{http_code}\n" https://raghubans-com.pages.dev/amenity   # 308
curl -o /dev/null -w "%{http_code}\n" https://<hash>.raghubans-com.pages.dev/amenity  # 200
```

**Why it matters.** Two of ten requests in the same pass also returned a
transient `522` on assets that were definitely present. Either symptom read as a
real defect in the build, and neither was. A post-deploy check that trusts the
first response from a production alias will report both.

**How it is handled.** `scripts/check-live.mjs` retries 5xx up to three times
with a backoff, but deliberately does **not** tolerate a `3xx` on a canonical
route — that is the defect it exists to catch. The correct response to a stale
`308` is to verify against the immutable deployment URL to confirm the artifact,
then re-run against the alias once the edge cache expires (it cleared inside a
few minutes here).

**Residual, accepted:** there is no cache purge in this workflow, because purging
Pages requires zone-level access and this stream is explicitly barred from
touching DNS or zones. Waiting is the whole mitigation.

## founder-site: the one-tap nav assertion is post-deploy only

**Status:** open, accepted. **Surface:** `packages/founder-site`.

`check-live.mjs` asserts every route links every other route directly, on the
deployed HTML. It is not in `pnpm build`, so a nav regression is caught *after*
publish rather than at build time.

**Repro.** Delete an entry from `NAV` in `src/site.ts`, run `pnpm build` — six
gates green. The failure appears only on the next `node scripts/check-live.mjs
<origin>`.

**Why it is where it is.** The task placed it in check-live or the fit gate, and
check-live already fetches all five documents, so the link graph costs no extra
requests and stays inside the repo's audit budget. It also measures the thing
that actually matters — what a visitor is served — rather than what `dist/`
contains.

**Fix sketch if it ever bites:** the same graph over `dist/` is ~15 lines using
`htmlPages()` from `lib.mjs` and would run in `pnpm build` with no browser. Worth
doing the first time a regression reaches production; not worth two copies of the
rule before then.

## founder-site: Cloudflare's managed robots.txt blocks named AI crawlers at the zone

**Status:** open, **needs Ryan's decision**. **Surface:** `raghubans.com` zone.

The apex domain serves a Cloudflare-injected block ahead of our `robots.txt`.
It allows `User-agent: *` and carries `Content-Signal:
search=yes,ai-train=no,use=reference`, then disallows Amazonbot,
Applebot-Extended, Bytespider, CCBot, ClaudeBot, Google-Extended, GPTBot,
meta-externalagent and CloudflareBrowserRenderingCrawler.

**Repro.**

```sh
curl -s https://raghubans.com/robots.txt | head -40    # managed block present
curl -s https://raghubans-com.pages.dev/robots.txt     # ours only, no block
```

**Why it matters.** Search indexing — the thing this site exists for — is
unaffected. What is affected is whether an AI assistant asked "who is Ryan
Raghubans?" may read the page, and this site's audience increasingly asks
exactly that. It is a zone setting, deliberate or default-on, and this package
is barred from touching zones. Raised as a Brief item on PR feat/founder-site-v2.

**Not a code defect.** `check-live.mjs` was narrowed to assert only the
`User-agent: *` group, which is the claim the gate exists to make.

## Every deployed demo ships all nine hand-authored clients' social cards

**Status:** open. **Surface:** every build — the 8 client mockups and all 50
generated demos.

`packages/template/public/` is copied wholesale into every `dist/`, and
`public/og/` holds nine committed client cards. So a prospect's demo serves
`ks-welding.png`, `kh-machine-works.png` and seven more, each a 1200x630 image
carrying another business's name and town. Nothing links to them and no gate
looks at them.

**Repro** (after any demo build):

```sh
ls packages/template/dist/<any-prospect-slug>/og/
# 10 files: this demo's card, plus all nine clients'
curl -sI https://<slug>-preview.pages.dev/og/ks-welding.png   # 200 image/png
```

**Why it matters.** It is enumerable client data on a URL we hand to a
prospect: anyone shown a demo can list the other businesses we build for. Not
contact data, so not a CLAUDE.md breach, but it is the same category and it is
one directory listing away from being embarrassing on a sales call.

**Predates this work** — the cards have shipped this way since
`gen-brand-assets.mjs` landed. PR feat/prospect-brand-cards makes it more
visible rather than worse, by putting each demo's own card in the same
directory.

**Fix sketch.** Two options, neither taken here because both touch the build
for every client and this stream's grant did not cover it:

1. Move the per-client cards out of `public/` and have the build copy only the
   card belonging to `SITE_CLIENT` into `dist/<slug>/og/`. Cleanest; changes
   where nine committed files live.
2. Emit a `_headers` or `_redirects` rule denying `/og/*` except the current
   slug. Cheaper, but it hides the files rather than not shipping them.

**Related, same mechanism.** A run killed between `stageBrandCard` and its
`finally` leaves one demo's card in `public/og/`, and the next build ships it
too. The cleanup is idempotent and runs on the throw path, so this needs an
actual process kill; the recovery is `git status` in
`packages/template/public/og/` and deleting anything untracked.
