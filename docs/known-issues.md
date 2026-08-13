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
| american-machine-specialty | **99** | 96 | 100 | 69 |
| industrial-machine-corp | **99** | 96 | 100 | 69 |
| kh-machine-works | **100** | 96 | 100 | 69 |
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

**Reproduce:** `pnpm smoke -- --client ks-welding`, and read the
`lighthouse performance` row of the generated `report.md`.

---

## 4. Every demo advertises its `og:image` on a domain the demo is not served from

**Status:** open. **Owner:** whoever owns `src/components/Seo.astro` and the
demo deploy path. **Found by:** `feat/live-smoke`, measured against the fleet
redeployed from `main@c301f2c`.

`Seo.astro` builds the card URL as `new URL(site.brand.ogImage, Astro.site ??
site.seo.siteUrl)`, and `astro.config.mjs` sets `site: site.seo.siteUrl`. So the
tag's origin is always `seo.siteUrl`. On a demo build that is the *prospect's*
domain, while the demo is served from `https://<slug>-preview.pages.dev`:

| og:image origin | clients |
|---|---|
| `https://example.invalid` (the prospect has no site) | 6 |
| the prospect's own real domain, which 404s the path | 2 |
| the origin actually serving the demo | 0 |

**The PNG itself is fine.** At the deploy origin the same path answers `200
image/png, 1200×630` on all eight. Nothing is missing and nothing is malformed —
the card is simply advertised at an address no crawler can fetch it from, so
every link shared for a demo unfurls with no image.

**Why no local gate catches it, by design.** `check-metadata.mjs` takes
`new URL(ogImage).pathname` and asserts the *path* exists in `dist/<slug>` at
the right size and format. That is exactly right for a delivered build, where
`siteUrl` **is** the origin the site is served from, and structurally blind on a
demo, where it is not. The check is not wrong; it is measuring a build, and this
is a property of a deployment.

**Reproduce:** `pnpm smoke -- --client kh-machine-works`; the `og:image` section
of the generated `report.md` shows the declared URL, its status, and the same
path measured at the deploy origin.

**Fix sketch (not done here — this stream builds the instrument and reports):**
give the demo build an origin override so `Seo.astro` resolves the card against
the Pages origin when `seo.noindex` is set, the same way `DEMO_FORM_ENDPOINT`
already overrides the form target for exactly this class of demo-vs-delivered
difference. Anything that leaves `seo.siteUrl` as the card's origin on a demo
reproduces this.

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

---

## 4. Every preview demo unfurls with no social card — `og:image` is rooted at `seo.siteUrl`, not at the deploy origin

**Status:** open. **Owner:** a post-coverage `packages/template` stream.
**Found by:** the ops redeploy of 2026-08-12, by checking the live fleet rather
than the built artifact. **Pre-existing** — not caused by that session, which
changed no code.

The card *file* is correct everywhere and always has been: a real PNG,
1200 × 630, matching its declared `og:image:width` / `og:image:height`, 31–36 KB,
and present on the deploy. What is wrong is the **origin in the tag**.
`og:image` is emitted as an absolute URL rooted at `seo.siteUrl`. On a
`*.pages.dev` preview that origin is not the origin serving the page, so every
prospect demo link shared into Facebook, X, LinkedIn, iMessage, WhatsApp or
Slack arrives with no image — the same end state as the SVG card ruled out on
2026-08-12, reached through the origin instead of the file format.

This is the pitch surface. A preview URL exists to be sent to somebody.

**Measured live, all eight deployed demos, 2026-08-12.** "On deploy origin" is
the same pathname requested from the host actually serving the page:

| Client | Origin in `og:image` | At declared URL | Same path on deploy origin |
|---|---|---|---|
| american-machine-specialty | `https://americanmachinespecialty.com` | **404** | 200, PNG 1200×630, 36 KB |
| industrial-machine-corp | `https://example.invalid` | **ENOTFOUND** | 200, PNG 1200×630, 36 KB |
| kh-machine-works | `https://www.khmachineworks.com` | **404** | 200, PNG 1200×630, 31 KB |
| ks-welding | `https://example.invalid` | **ENOTFOUND** | 200, PNG 1200×630, 34 KB |
| ks-welding-forge | `https://example.invalid` | **ENOTFOUND** | 200, PNG 1200×630, 34 KB |
| ks-welding-heritage | `https://example.invalid` | **ENOTFOUND** | 200, PNG 1200×630, 34 KB |
| ks-welding-precision | `https://example.invalid` | **ENOTFOUND** | 200, PNG 1200×630, 34 KB |
| kts-machine-shop | `https://example.invalid` | **ENOTFOUND** | 200, PNG 1200×630, 34 KB |

0 / 8 reachable at the declared URL; 8 / 8 reachable on the deploy origin.
`twitter:image` carries the same value, so it is wrong identically and the
existing agreement check between the two passes while both are unreachable.

**Security headers were green on all eight in the same run** — `nosniff`,
`strict-origin-when-cross-origin`, `x-frame-options: DENY`, and a hash-only CSP
with `default-src`, `frame-ancestors`, `form-action`, `base-uri` and
`object-src` all present. Cloudflare Pages is serving the generated `_headers`.
Recorded here so the next session does not re-measure it.

**Why no gate catches it, and why that is not a bug in the gate.**
`check-metadata.mjs` resolves the tag with `new URL(ogImage).pathname` and
asserts the file exists under `dist/<slug>` — it **discards the origin by
design**. For a delivered site that is exactly right: the site is served from
its own `siteUrl`, so origin and deploy origin are the same string and checking
the pathname is checking the whole URL. For a preview the two diverge, and the
gate is structurally blind to the difference rather than failing to look. No
amount of artifact inspection can see it, because the artifact is correct — only
the pairing of artifact with host is wrong.

It also sits directly on the sanctioned `example.invalid` path: the ruling of
2026-08-12 permits `example.invalid` in `siteUrl` while a client is noindex, and
`check-go-live.mjs` refuses to let one go live carrying it. That ruling settled
go-live. It did not consider that a noindex mockup is still *sent to people*,
and that its social card resolves against the same placeholder.

**Reproduce:**

```sh
DEMO_FORM_ENDPOINT=<endpoint> pnpm --filter @site-factory/template build:all
pnpm deploy:mockups
curl -sI "$(curl -s https://ks-welding-preview.pages.dev/ \
  | grep -o 'property="og:image" content="[^"]*"' | cut -d'"' -f4)"
# -> DNS failure for example.invalid; the same pathname on
#    https://ks-welding-preview.pages.dev/og/ks-welding.png returns 200.
```

**Fix sketch.** Two halves, and the second is what stops it recurring:

1. A build-time origin override. A preview build roots `og:image` and
   `twitter:image` at the known per-slug deploy origin
   (`https://<slug>-preview.pages.dev`) instead of at `seo.siteUrl`. The origin
   is derivable from the slug by the same rule `deploy-mockups.mjs` already
   uses to name the project, so nothing new has to be configured per client,
   and a delivered build — where `siteUrl` *is* the deploy origin — is
   unaffected.
2. `check-metadata.mjs` gains a demo-mode assertion that the `og:image` origin
   equals the deploy origin, so the pairing is checked rather than just the
   pathname. Per the 2026-08-12 fail-closed ruling it must fail on any shape it
   cannot resolve, not skip.

Land it failure-first: the assertion red against today's build, then the
override green.

**Not fixed in the session that found it** — that was an ops session with a
deploy grant and no template-code grant, and the fix belongs to a stream that
owns `packages/template`. This entry is the durable record.
