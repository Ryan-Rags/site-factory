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
