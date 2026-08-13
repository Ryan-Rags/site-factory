# PLAN-live-smoke — post-deploy verification of the live demo fleet

Stream: `feat/live-smoke` · worktree `D:/sf-live-smoke` · branch pushed as the claim.
Granted paths: root `scripts/`. **`packages/template/**` is read-only to this stream** —
a large stream is in flight there. Every reuse below is an *import* or a *fetch*, never an edit.

---

## 1. What this is for

`deploy:mockups` proves that `/` and `/services/` answered 200. That is a liveness
check, not a correctness check. Everything a prospect actually experiences —
whether the link they were sent unfurls with a picture, whether the form they fill
in reaches anyone, whether the page is protected by the policy the build measured —
is unverified the moment the artifact leaves `dist/`.

Reconnaissance already found the gap is real, not theoretical. One read-only GET to
the live `kh-machine-works-preview.pages.dev/`:

```
200 text/html; charset=utf-8
  content-security-policy = null        ← the build generates one; the deploy has none
  x-content-type-options  = nosniff     ← Cloudflare Pages' own default, not ours
  referrer-policy         = strict-origin-when-cross-origin   ← ditto
  x-frame-options         = null
  permissions-policy      = null
  og:image = https://www.khmachineworks.com/og/kh-machine-works.png
```

Two things fall out of that single request, and they shape the whole design:

**(a) The live build is not the local build.** `packages/template/dist/kh-machine-works/index.html`
in this checkout declares `og:image = …/images/og.svg`; the deployed one declares
`…/og/kh-machine-works.png`. They are different artifacts. So no check in this suite
may derive an expectation from local `dist/` — the suite would then be grading the
wrong build and could report green on a deploy nobody has looked at. **Every
expectation is derived from the live response itself.**

**(b) Two of the four required headers pass live with no `_headers` file at all**,
because Cloudflare Pages supplies `nosniff` and `Referrer-Policy` on `*.pages.dev`
by itself. A live header check that only asserted `check-headers.mjs`'s
`REQUIRED_HEADERS` map would score a CSP-less site 2/4 and read as "mostly fine".
That is the "green ≠ correct" failure mode reproducing *inside the tool built to
prevent it*. The check therefore asserts the **full derived policy**, directive by
directive, and labels each header platform-supplied or build-supplied.

## 2. Shape

One new script, one new package script. Nothing else moves.

```
scripts/live-smoke/
  index.mjs        CLI, client selection, orchestration, exit code
  fleet.mjs        live fetch primitives + the ≤2 nav/sec/site politeness gate
  checks/
    routes.mjs     §3.1  every route, status + content-type + designed 404
    headers.mjs    §3.2  live headers vs the committed generator's derivation
    demo-posture.mjs §3.3 noindex + robots disallow + no sitemap
    og.mjs         §3.4  og:image resolves, is a real PNG, ≥ 1200×630
    offline.mjs    §3.5  SW registers live, second load served from cache
    form.mjs       §3.6  honeypot POST + CORS preflight, zero leads created
    customizer.mjs §3.7  ?theme/scheme/accent/font → data-* on one design client
    lighthouse.mjs §3.8  packages/audit's harness against live /
  report.mjs       §3.9  report.md
  board.mjs        §3.9  one-page HTML screenshot board
```

`pnpm smoke -- --client <slug> | --all` → `node scripts/live-smoke/index.mjs`.
Arg parsing mirrors `verify-offline.mjs` (`--client/-c`, `--all`, `--demo <url>`,
`--help`), because that is the shape already in the operator's fingers.

**Which clients.** `listClients()` from `scripts/mockup/clients.mjs`, minus the
`zz-` prefix — the same exclusion `deploy-mockups.mjs` makes, for the same reason
(fixtures never deploy, ledger 2026-08-12). A slug in the registry whose project
does not answer is reported **`not-deployed`** and is a **failure**, not a skip:
"the client we thought was live isn't" is exactly the class this suite exists to
surface. Brief item 1 flags the one deploy we already know may be absent
(`kts-machine-shop`, configured and registered but not present in local `dist/`).

**Politeness.** One `NavigationBudget(500, 10)` per host, imported from
`@site-factory/audit` — 500 ms minimum interval is the ≤2 nav/sec the task sets, and
the 10-per-site cap is CLAUDE.md's. Browser navigations call `acquire()`; bare
`fetch()` probes (og HEAD, robots, sitemap, the form POST) call `wait()`, which
spaces them without consuming navigation budget — the reading `throttle.ts` already
documents for the broken-link checker. Budget accounting per client, printed in the
report, so the suite can prove it stayed inside its own limit.

**Navigation ledger per client** (cap 10):
routes ×4 (`/`, `/services/`, `/about/`, `/contact/`) — but these are `fetch`, not
navigations, so 0; offline first-load 1; offline reload 1; customizer load 1
(design client only); Lighthouse 1. **Peak 4 navigations**, six to spare.

## 3. The checks

### 3.1 Routes

`GET` each of `/`, `/services/`, `/about/`, `/contact/` — no client in the registry
sets `features.gallery`, so `/gallery/` is deliberately not in the list; if one ever
does, the route set is read from the live `/` page's own nav links rather than
hard-coded a second time. Assert `200` and `content-type: text/html`.

The 404: `GET /definitely-not-a-page`. Assert status `404` **and** that the body is
the template's designed page, identified by its `<h1>` — `That page isn't here.` —
the same marker `verify-offline.mjs` already keys on. A 404 that returns Cloudflare's
generic page passes a status check and fails this one, which is the point.

### 3.2 Security headers — derived, never hand-written

Imported from `packages/template/scripts/lib/csp.mjs` (read-only import):
`measurePage`, `emptyMeasurement`, `mergeMeasurement`, `buildPolicy`, `DENIED_FEATURES`.
This is the module `gen-headers.mjs` writes from and `check-headers.mjs` re-derives
from; a third opinion in this file would be the exact "checking one opinion against
another" failure that module's header warns about.

`measureClient()` is not usable here — it reads a `dist` directory. The live
equivalent is the same union over the same pages: fetch each route's HTML, resolve
the site origin from the live `<link rel="canonical">`, `measurePage` each,
`mergeMeasurement` into one, `buildPolicy`. That reuses the derivation verbatim and
takes its input from the artifact actually being served. Fetching the HTML costs
nothing extra — §3.1 already has it.

Assert, on the live `/` response:

- Every directive `buildPolicy` produced is present in the live CSP with the same value.
- `check-headers.mjs`'s standing invariants, re-asserted live: `script-src`
  hash-only (no `'unsafe-inline'`/`'unsafe-eval'`/`'strict-dynamic'`/`'unsafe-hashes'`/
  wildcard), `'unsafe-inline'` in no directive but `style-src`.
- `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `X-Frame-Options: DENY`, and `Permissions-Policy` denying every `DENIED_FEATURES` entry.
- Each header is reported with its **provenance**: `build` (matches what `_headers`
  would carry), `platform` (present but also present with no `_headers` — the two
  Pages supplies), or `absent`.

Not asserted: HSTS. Ledger 2026-08-12 — it belongs to the zone, not to a project
answering on `*.pages.dev`.

### 3.3 Demo-mode posture

Three assertions, all live, all fatal if wrong:

- `<meta name="robots">` on every route contains `noindex` and `nofollow`.
- `GET /robots.txt` → 200, and contains `Disallow: /` under `User-agent: *`.
- `GET /sitemap-index.xml` and `/sitemap-0.xml` → **404**. A demo that acquired a
  sitemap is a demo asking to be indexed, and `@astrojs/sitemap` is in the template's
  dependencies, so this is a live switch that can flip without anyone noticing.

Rationale for treating "sitemap present" as a failure rather than a note: these
sites carry a real business's name. Indexing a mockup puts a page we authored about
someone else's shop into search results under their name.

### 3.4 og:image — the blank-unfurl class

Read `og:image` (and `twitter:image` if present) from the live `/`. Then:

1. Resolve it. Absolute URLs to a host we do not serve — `example.invalid`, or the
   prospect's own domain — are followed as given, and DNS failure/404 is the finding,
   reported as the URL that failed rather than as "broken".
2. Assert `200` and `content-type: image/png`.
3. Read the first 33 bytes and parse the **PNG IHDR** directly (8-byte signature,
   then width/height as big-endian u32 at offsets 16 and 20). No image library, no
   new dependency, and it proves the bytes are a PNG rather than trusting a
   `Content-Type` header — an SVG served as `image/png` fails here, which is the
   defect ledger 2026-08-12 records ("Facebook, X, LinkedIn, iMessage, WhatsApp and
   Slack all decline to render an SVG `og:image`").
4. Assert `width ≥ 1200 && height ≥ 630`.

Fetched with `Range: bytes=0-32` where the server honours it, falling back to a full
GET; either way one request, and no image is downloaded in full.

### 3.5 Service worker, live

`verify-offline.mjs`'s approach, pointed at the live origin and cut down to what
"smoke" means. A fresh Playwright context per client (a worker registered by one
demo must not serve another's pages), Playwright borrowed from `packages/audit` via
the `createRequire` trick both existing scripts use.

- Load `/` once online; wait for `navigator.serviceWorker.ready` **raced against a
  10 s timeout** — the note in `verify-offline.mjs` is load-bearing: a failed
  registration leaves `ready` pending forever rather than rejecting, so without the
  race the suite hangs instead of reporting.
- Assert the registration is active and its cache has entries.
- Second load: assert it was served from the worker — `performance.getEntriesByType('navigation')[0].deliveryType === 'cache'` is not reliable across
  versions, so the assertion is `response.fromServiceWorker()` on the Playwright
  response plus a non-empty cache, and the page still renders (`<h1>` non-empty,
  brand custom property applied — `verify-offline.mjs`'s own "actually rendered"
  test, which catches a 200 that is visibly broken).

Only run for clients whose live build registers a worker. Detection is live, not
config: the build emits either a register or an unregister script. Absence of `/sw.js`
(404) on a client whose siblings have one is reported; it is not silently skipped.

### 3.6 Form path — one honeypot POST, zero leads

The endpoint is **read out of the live contact page**, not from `.env.deploy`. The
demo Worker URL arrives in the browser as an `<astro-island props="…">` value —
`csp.mjs`'s `measurePage` already parses exactly that attribute to find
`connect-src`. Reading it from the live page means the suite tests the endpoint the
deployed site actually posts to, and needs no secret to run.

**The POST.** `multipart/form-data` with `company` set to a non-empty value.
`worker-demo/src/index.ts` checks the honeypot at step 2 — *before* the prospect-id
gate, before the rate limiter, before the KV write and before Resend — and returns
`200 {ok:true}` and discards. So one request proves method gating, origin gating,
CORS and the live Worker being reachable and answering, while creating no KV record,
no email and no rate-limit consumption. Assert `200` and a body of exactly `{"ok":true}`.

`Origin: https://<slug>-preview.pages.dev` is sent, which also exercises the suffix
allowlist in `lib/http.ts`. The `prospectId` field is sent as the real slug so the
request is shaped like a real one; the honeypot short-circuits before it is read.

**Never** a realistic-looking lead: no name, no phone, no email, no message field is
populated at all. The only populated fields are `company` (the honeypot) and
`prospectId`. One POST per client per run, hard-capped in code, not by convention.

**Preflight.** `OPTIONS` with `Origin: https://<slug>-preview.pages.dev` and
`Access-Control-Request-Method: POST`. Assert `204`, `Access-Control-Allow-Origin`
echoing that exact origin, `Allow-Methods` containing `POST`, and `Vary: Origin`.
Plus one negative: `OPTIONS` with `Origin: https://evil-preview.pages.dev.attacker.com`
must come back with **no** `Access-Control-Allow-Origin` — the dot-boundary case
`lib/http.ts` documents. Three requests total per client, all `wait()`-spaced.

### 3.7 Customizer sanity — one client, small sample

Smoke, not `check-switching.mjs`'s full matrix. One design client with
`features.customizer: true` (`kh-machine-works`; `ks-welding-{forge,heritage,precision}`
are deliberately customizer-free per their configs).

Load `/?theme=…&scheme=…&accent=…&font=…` for **three** cells and assert, per cell,
that `data-theme` / `data-scheme` / `data-accent` / `data-font` on `<html>` equal what
was asked for, and that `--d-accent` resolved to a non-empty value. Cells are read
from `packages/template/src/design/presets.json` (read-only) so the sample cannot
pass by agreeing with the renderer — `check-switching.mjs`'s rule.

Plus one illegal-URL cell (`?theme=brutalist&accent=chartreuse`) asserting the page
landed on *some* legal cell rather than stamping the attribute.

One navigation, reusing the §3.5 page — the `?` variants are same-document reloads
against a warm service worker. Budgeted as 1 acquire, spaced regardless.

### 3.8 Lighthouse, live

`packages/audit`'s harness, unmodified and imported: `freePort()`, then
`chromium.launch({ args: ['--remote-debugging-port=' + port] })`, then
`runLighthouse(url, port)`. The launch flag is not optional — `port.ts` and
known-issues #3 both record what happens without it (every LH-derived value silently
reads `unavailable`), and ledger 2026-08-12 made `debugPort` required for that reason.
The suite asserts the port it launched with is the port it audits on, and prints it.

Report **all four** categories. Thresholds:

| Category | Live-smoke bar |
|---|---|
| accessibility | ≥ 90, fail below |
| best-practices | ≥ 90, fail below |
| seo | reported, **not** a bar — see below |
| performance | may read `unavailable`, **only** via the known-issue rule below |

`seo` is reported without a bar because these builds are `noindex` by design: the
`is-crawlable` deduction is the demo lock doing its job, and known-issues #2 records
`main` scoring 69 for precisely that reason. A bar there would fail every client for
being correctly configured.

**The known-issue rule, stated precisely.** `performance` reading `undefined`, or the
run erroring, is a **failure** unless the LHR shows the *specific* signature
known-issues #2 documents: `audits['largest-contentful-paint'].errorMessage`
containing `NO_LCP` while the other performance audits scored. In that case the suite
records `performance: unavailable (known: NO_LCP, docs/known-issues.md #2)` and does
not fail. **Any other** cause of an absent performance score fails. A known issue
never fails smoke; an unknown one always does — which means the rule has to
discriminate by signature, not by category name.

The reference to `#2` is checked at startup: if `docs/known-issues.md` no longer
contains a `NO_LCP` entry, the allowance is refused and an absent performance score
fails. A waiver outliving its issue is how a suite goes quietly blind.

### 3.9 Artifacts

`outreach/smoke/<timestamp>/` — `outreach/` is already gitignored and is where the
other client-facing artifacts go (`pitchDirFor`). Timestamp `YYYY-MM-DDTHH-mm-ssZ`.

**`report.md`** — a fleet table (client × the eight checks, ✓/✗/`unavailable`), then
one section per client listing every assertion with its measured value, then a
"Findings" section grouping failures by class so two clients broken the same way read
as one problem. Every measured value is printed even when it passed, so the report is
evidence and not just a verdict. Navigation budget used per host is printed.

**`board.html`** — every client × every route at 390 px, full-page, as one scrolling
page. Screenshots go in `shots/<slug>-<route>.png` and the board embeds them by
relative `<img src>` (not base64: the board is opened from disk, and a 32-shot base64
page is a file nobody wants to diff or open). Grid of columns per client, rows per
route, each cell captioned `slug · route · status`, and a red border on any cell whose
route check failed — so a scan down the page finds the broken ones without reading the
markdown. Viewport 390×844 is the one `shoot.mjs` and `verify-offline.mjs` already use.

Screenshots reuse the §3.5 browser context per client — no additional navigations
beyond the ones already budgeted, since the routes are visited anyway.

`report.json` is written alongside, for anything downstream that wants the numbers.

## 4. Exit code

Non-zero if any client fails any check. `--client` audits one; `--all` audits the
fleet and still exits non-zero on a single failure. A `not-deployed` client fails.

## 5. Acceptance

Run `pnpm smoke -- --all` against the **currently deployed** demos. Those predate
`feat/trust-seo`'s merge, so the suite is expected to report:

- **og:image broken on four clients** — reconnaissance already shows the live
  `kh-machine-works` pointing its card at `https://www.khmachineworks.com/og/…png`, a
  domain we do not serve. Which four, and with what error each, is measured, not
  predicted here.
- **Security headers absent fleet-wide** — measured: no CSP, no `X-Frame-Options`,
  no `Permissions-Policy` on the live `/`. The two headers that *are* present come
  from Cloudflare Pages, and the report says so rather than counting them as ours.

Detecting those two known-stale defects on the live fleet is the acceptance
evidence. A suite that reported green here would be the thing being replaced. Both
the report and the board are attached to the PR, pinned to a SHA per CLAUDE.md.

Also verified before I call it done:

- The suite is proved to **fail** as well as pass: each check is run once against a
  deliberately-wrong input (a served fixture with no `_headers`, a 404 og:image, a
  sitemap present) so a green is known to mean something. Recorded in the PR.
- `pnpm typecheck` and `pnpm test` green on the merged-with-main state.
- No client site is modified; no `packages/template/**` file is written.

## 6. Decision Brief — carried to the PR

1. **`kts-machine-shop` is registered and configured but absent from local `dist/`.**
   If its Pages project does not answer, the suite reports `not-deployed` and exits
   non-zero. That is the behaviour I think is right — a client on the registry that
   is not live is a finding — but it makes an `--all` run red for a reason that is
   not a defect in any deployed site. **Recommendation:** keep it fatal, and report
   `not-deployed` as its own class in the findings section so it cannot be confused
   with a broken deploy.
2. **`seo` has no threshold.** Justified above, but it means the one category most
   affected by `feat/trust-seo`'s work is reported and never enforced. **Recommendation:**
   leave it unenforced while every demo is `noindex`; revisit when the go-live fixture
   path is the thing being smoked, where 100 is already demonstrated.
3. **The honeypot POST tests the *demo* Worker, not the single-tenant `worker/`.**
   A real client's deployment posts elsewhere and this suite has never touched that
   path. **Recommendation:** state the limit in the report header rather than let a
   green imply coverage it does not have.
4. **Header provenance is a judgement I am making, not a measurement.** Calling
   `nosniff` "platform" rests on knowing Cloudflare Pages supplies it; I verified it
   is absent from the repo (no `public/_headers`, no `astro.config` header hook) and
   present live, which is strong but is inference. **Recommendation:** label it
   `platform (inferred: not produced by this repo)` in the report, so the claim is
   the one actually supported.

## 7. Not doing

- No fix for anything found. This stream builds the instrument and reports; the
  og:image and header findings belong to whoever owns the redeploy.
- No `packages/template/**` edit, including no new gate there.
- No full switching matrix live — that is `check-switching.mjs`'s job on a local build.
- No offline route-by-route sweep — `verify-offline.mjs` owns that; §3.5 is the
  registration-and-cache smoke of it.
- No deploy, no redeploy, no Worker change.
