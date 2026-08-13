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
emulation. The 90+ mobile bar has never been demonstrated, in either direction.

---

## 3. `packages/shortlist/src/cli.ts` opens no debugging port, so Lighthouse cannot attach

**Status:** open, flagged before the first live sweep.
**Found by:** `test/localhost-sites`, [PR #18](https://github.com/Ryan-Rags/site-factory/pull/18) Brief 2.

`packages/audit`'s own CLI launches Chromium with `--remote-debugging-port=<free
port>`; `packages/shortlist`'s calls plain `chromium.launch()` and passes the
default 9222. The run does not crash — every Lighthouse-derived check reads
`unavailable`, is excluded from neglect by design, and neglect is quietly
computed over the probe-based checks alone. Silent degradation, and it would
otherwise ship into a live sweep.

**Fix:** two lines, plus a test asserting that an audited site decides at least
one Lighthouse-derived check.
