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

**Status:** open. **Owner:** whoever owns `packages/shortlist` / `packages/discover`.
**Found by:** the ops session of 2026-08-14, on the first live county sweep.
**Cost when it fired:** 250 billable Enterprise calls, zero rows written.

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
