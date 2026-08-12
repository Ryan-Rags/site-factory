# PLAN-demo-support — the demo support layer

Branch: `feat/demo-support`, worktree `D:/sf-demo-support`. Commit only;
**no merge**, no PR (per the task prompt).

> Named `demo-support`, not `demo`: a separate stream already holds
> `feat/demo` + `PLAN-demo.md` for the per-prospect demo *pipeline* (ingest →
> generate → deploy → QR leave-behind), still waiting on its own questions.
> Different work; taking that branch name would have collided with it.

Goal: make an in-store phone demo feel like a live business site — a form that
really emails me, tap-to-call and tap-to-text everywhere, a hard number to open
with ("your site 38, this one 96"), and pages that still load when the shop has
no signal.

## What already exists (read, not assumed)

| Thing | State |
|---|---|
| `packages/template/worker/` | Full contact-form Worker: origin gate, honeypot, server-side validation, Turnstile short-circuit, KV-before-email, Resend send. **Single-tenant**: one `MAIL_TO`, one enumerated `ALLOWED_ORIGINS`, placeholder ids that cannot deploy. |
| `ContactForm.tsx` | `worker` / `mailto` modes, validation, file preview. Success state is a static card — no animation. |
| `tel:` links | Header (desktop + mobile), Hero, CtaBand, Footer, contact, 404. Driven by `business.phoneHref`. |
| `sms:` links | **None anywhere.** No config field for a textable number. |
| Lighthouse | `packages/audit/src/lighthouse.ts` runs 4 categories over CDP against a *prospect's* site, inside `NavigationBudget` (1 nav/sec/domain, 10/site). No before/after comparison, no pitch output. |
| Screenshots | `packages/audit/src/probe.ts` shoots `before-*`; `scripts/mockup/shoot.mjs` shoots `after-*` at matching viewports into `outreach/<slug>/`. |
| Deploy | `scripts/deploy/deploy-mockups.mjs` → one Pages project per client, `https://<slug>-preview.pages.dev`, verifies `/` and `/services/`. |
| Offline | Nothing. No service worker. Static Pages caching only — a cold nav on a dead connection fails. |

## Ownership note (flagged, not assumed away)

This work spans `packages/template/**` (feat/template) **and** `scripts/**` +
`packages/audit/**` (feat/pipeline / mockup). The stream rules govern *merging*,
and this branch does not merge, so the split is safe for now — but whoever
merges later will need a grant covering both. Called out here rather than
silently crossing the line.

---

## 1. Shared Worker form endpoint (multi-tenant, prospect-tagged)

One Worker, one URL, every demo site posts to it. New directory
`packages/template/worker-demo/` — a **sibling** of the existing single-tenant
Worker, not a rewrite of it. Reason: the committed Worker is the artifact a real
client eventually gets (their inbox, their origin, their Resend domain). The
demo endpoint has the opposite requirements (my inbox, N origins, tagging). Two
files, each honest about its job, beats one Worker with a mode flag threaded
through every branch.

Shared logic (validation, honeypot, CORS, Resend call) moves to
`worker-demo/src/lib/*.ts` and the demo Worker imports it. The existing Worker
is left byte-identical this pass; de-duplicating it is backlog.

Behaviour:

- `POST /` with the same `FormData` shape, plus a new hidden `prospectId` field
  the template emits from `clientSlug`.
- **Origin gate**: exact matches from `ALLOWED_ORIGINS` *plus* an
  `ALLOWED_ORIGIN_SUFFIXES` var (default `-preview.pages.dev`). Per-client Pages
  projects are created on demand, so an enumerated list would need editing on
  every new prospect. Suffix match is `new URL(origin).hostname.endsWith(sfx)`
  over **https only** — no substring matching, no wildcards in the middle.
- **prospectId validation**: must match `/^[a-z0-9][a-z0-9-]{1,63}$/` and must be
  a slug in the committed client registry. An unknown id is a 422, not a silent
  accept — otherwise the endpoint is an open relay into my inbox.
- Email to me:
  - subject `[DEMO] <Business Name> — <visitor name>`
  - `X-Entity-Ref-ID`-style tag line + `prospectId` and demo URL in the body
  - Resend `tags: [{ name: 'prospect', value: prospectId }]` so the dashboard
    filters by prospect
  - `reply_to` the visitor when they gave an email
- KV backup keyed `demo:<prospectId>:<iso>:<uuid>` **before** the send, same as
  today. Failure to email still returns 502 — I will not show a prospect a
  success animation for a lead that did not arrive.
- Rate limit: KV counter per `prospectId` per hour (default 20). A demo form has
  no legitimate reason to fire more than that, and it caps the damage if a URL
  leaks.

Config: `wrangler.jsonc` with placeholder ids, exactly the existing convention —
`MAIL_TO`, `MAIL_FROM`, `ALLOWED_ORIGINS`, `ALLOWED_ORIGIN_SUFFIXES`,
`MAX_UPLOAD_MB`, `PROSPECT_RATE_PER_HOUR`. `RESEND_API_KEY` stays a
`wrangler secret`. **No key, inbox, or client data committed.**

Template side: `forms.workerEndpoint` set to the demo Worker URL for the demo
builds, and `ContactForm` gains a hidden `prospectId` input. No client config
carries a secret.

### Success animation

Replaces the static success card, in `ContactForm.tsx` + a keyframes block in
`global.css`. Pure CSS, no library, no new dependency:

1. form fades and collapses (140 ms)
2. ring scales in, checkmark path draws via `stroke-dashoffset` (420 ms)
3. headline + "we'll call you back on ⟨their number⟩" rise and fade in (staggered)
4. subtle one-shot ripple behind the ring

`@media (prefers-reduced-motion: reduce)` collapses all of it to an instant
cross-fade. The success card keeps `role="status" aria-live="polite"` so the
animation is decoration over an already-accessible state, not a replacement for
it. Offline (see §4) the submit shows an explicit "no connection — this would
have sent" state rather than faking the animation.

## 2. Click-to-call and click-to-text everywhere

New optional field on `Business`:

```ts
/** Digits-only E.164 number that can receive SMS. Optional and unset by
 *  default: a text link to a landline goes nowhere, which is worse than no
 *  link at all in front of a prospect. */
smsHref?: string;
/** Optional prefilled SMS body. */
smsBody?: string;
```

Rendered as a "Text us" action **only when `smsHref` is set** — `Header` (desktop
nav + mobile sheet), `Hero`, `CtaBand`, `Footer`, `contact`, `404`. Uses the
cross-platform form `sms:<num>?&body=<encoded>` (the `?&` is the iOS/Android
compatible spelling). Existing `tel:` links stay as they are; I will audit every
page for a phone number rendered as plain text and make it a `tel:` anchor.

New `scripts/check-contact-links.mjs`, in the same family as
`check-markers.mjs` / `check-overflow.mjs`: greps built HTML and fails if a page
renders a phone number that is not inside a `tel:` anchor, or an `sms:` href
whose number is not the configured `smsHref`.

**Open question A — see below.** I will not invent textable numbers for the five
existing prospects.

## 3. Lighthouse before/after pitch asset

New `scripts/pitch/compare.mjs` + `scripts/pitch/render.mjs`.

```
node scripts/pitch/compare.mjs --client kts-machine-shop [--demo <url>] [--live <url>]
node scripts/pitch/compare.mjs --all
```

- **Live URL** from the lead CSV row (`packages/discover` readers), overridable.
- **Demo URL** defaults to `https://<slug>-preview.pages.dev`, overridable.
- Reuses `packages/audit`'s Chromium + `runLighthouse()` over CDP — same
  categories, same Moto G4 mobile emulation, so the two numbers are comparable.
  Reusing it rather than re-implementing also means the prospect's site is hit
  through the existing `NavigationBudget`: read-only GET, ≤1 nav/sec/domain,
  ≤10/site. Our own demo URL is not rate-limited but gets the same treatment.
- Screenshots at the same two viewports the audit uses, into
  `outreach/<slug>/pitch/`.

Outputs (all under `outreach/<slug>/pitch/`, which is gitignored):

| File | Contents |
|---|---|
| `scores.json` | Both runs, all four categories, timestamps, URLs, run errors |
| `headline.txt` | The one-liner: `Your site: 38/100. New site: 96/100.` |
| `compare-live-mobile.png` etc. | Four shots, matched viewports |
| `pitch-card.html` | Optional single-file side-by-side card for showing on the phone |

**Never fabricated.** A Lighthouse run that fails writes `"unavailable"` into
`scores.json` and the headline degrades to
`Your site: unavailable (site would not load). New site: 96/100.` — which is its
own sales point and is at least true. A prospect with no website at all
(`url` empty, e.g. Ivywood in the sample CSV) gets
`You have no site today. New site: 96/100.`

Wired into `package.json` as `pnpm pitch` / `pnpm pitch:all`.

## 4. Offline / bad-reception verification

Two halves, because verifying the current build would just prove it fails.

**(a) Make it work.** A ~60-line service worker, emitted by a new
`packages/template/src/pages/sw.js.ts` endpoint so the precache list is built
from the real route set at build time:

- precache: every HTML route, the inlined-CSS pages, `/images/*`, favicon, fonts
- HTML: network-first with a cache fallback (fresh when there is signal, instant
  and offline-capable when there is not)
- assets: cache-first
- versioned cache name from the build id; old caches deleted on `activate`
- registered from `BaseLayout` behind a new `features.offline` flag, **default
  on for demo builds**. Off ⇒ no SW registration, no behaviour change at all.
- POSTs are never intercepted. Offline submit surfaces the explicit offline
  message from §1 rather than a fake success.

This adds a second piece of JavaScript to a site whose README brags about having
one. That claim gets updated rather than quietly falsified.

**(b) Verify it.** New `scripts/pitch/verify-offline.mjs`:

1. launch Chromium, load the deployed demo (or a local `dist` server with
   `--local`)
2. wait for `navigator.serviceWorker.ready` + precache settle
3. `context.setOffline(true)`
4. cold-navigate **every route** (`/`, `/services`, `/about`, `/gallery`,
   `/contact`, plus a 404 probe) and assert: 200-equivalent render, the H1 is
   present, computed styles show the brand colour applied (proves CSS came from
   cache, not a naked HTML fallback), hero image has non-zero `naturalWidth`
5. reload each once more to catch a SW that only works on the visited page
6. write `outreach/<slug>/pitch/offline.json` and print a per-route table;
   exit non-zero on any failure

`pnpm verify:offline -- --client <slug>` / `--all`.

---

## Files touched

**New**
```
packages/template/worker-demo/{src/index.ts,src/lib/*.ts,wrangler.jsonc,README.md}
packages/template/src/pages/sw.js.ts
packages/template/src/components/ContactActions.astro      # tel + sms pair
packages/template/scripts/check-contact-links.mjs
scripts/pitch/{compare.mjs,render.mjs,verify-offline.mjs,paths.mjs}
PLAN-demo.md
```

**Modified**
```
packages/template/src/types/site.ts          # smsHref, smsBody, features.offline
packages/template/src/components/{Header,Hero,CtaBand,Footer}.astro
packages/template/src/pages/{contact,404}.astro
packages/template/src/components/ContactForm.tsx   # prospectId, success animation, offline state
packages/template/src/layouts/BaseLayout.astro     # SW registration behind the flag
packages/template/src/styles/global.css            # success keyframes
packages/template/clients/*.config.ts              # features.offline; smsHref per answer A
packages/template/package.json, README.md
package.json                                        # pitch / verify:offline scripts
.gitignore                                          # outreach/**/pitch stays ignored
```

`.env.example` gains nothing — the Worker's secrets live in Cloudflare, not
`.env`.

## Verification before commit

- `pnpm install && pnpm -r build && pnpm -r typecheck` green
- `wrangler deploy --dry-run` clean on `worker-demo` (its own typecheck)
- `check-markers`, `check-contrast`, `check-overflow`, `check-contact-links` green on all 5 clients
- offline verification green on at least one deployed demo, screenshotted
- assert branch is `feat/demo` before committing; push; report SHA

## Decisions (answered 2026-08-11, before any code)

- **A — SMS:** wire the components, leave `smsHref` unset for all five prospects.
  No demo shows a text link that goes nowhere; turning it on is one line.
- **B — Resend:** `MAIL_FROM = onboarding@resend.dev`, `MAIL_TO` my address. Free
  tier, zero DNS. README documents the swap to a verified domain.
- **C — Worker:** committed code with PLACEHOLDER ids only. Nothing is deployed
  to Cloudflare by me.
- **D — Service worker:** approved, behind `features.offline`.

## Questions asked before writing code

**A. Click-to-text numbers.** None of the five prospect configs record a number
confirmed to receive SMS, and every one looks like a landline. Options:
 1. *(recommended)* Wire the components, leave `smsHref` unset for all five, and
    document the one-line switch. Nothing textable is claimed that I cannot back.
 2. Set `smsHref` = the existing `phoneHref` for all five so the link is visible
    in the demo, accepting that a text may go nowhere.
 3. You give me numbers per prospect.

**B. Resend sender.** Resend's free tier only sends from a domain you have
verified (or `onboarding@resend.dev`, which delivers **only** to your own
account address). Is `styledbyalhambra.com` verified in Resend? If not I will
default `MAIL_FROM` to `onboarding@resend.dev` and `MAIL_TO` to your address, and
note the swap in the README.

**C. Deploying the demo Worker.** Should I stop at committed code with placeholder
ids (repo convention), or also create the KV namespace and deploy it to your
Cloudflare account so the form is live for a real in-store demo? Deploying is
outward-facing, so I am not doing it unasked.

**D. Service worker scope.** Confirm you are happy adding a service worker to
prospect demos. It is what makes §4 pass, but it means a demo can serve a stale
page after you rebuild — mitigated by the versioned cache and network-first
HTML, not eliminated. If you would rather not, §4 shrinks to "verify HTTP cache
behaviour and report honestly that a cold offline nav fails".

---

# Results

Everything below was run, not reasoned about. Commands are reproducible from
the repo root unless stated.

## 1. Shared Worker form endpoint — built, exercised locally, **not deployed**

`packages/template/worker-demo/`, placeholder ids, per answer C. Bundles clean:

```
$ wrangler deploy --dry-run          # in worker-demo/
Total Upload: 30.43 KiB / gzip: 8.12 KiB
--dry-run: exiting now.
```

Note the limit of that check honestly: `--dry-run` bundles with esbuild, it is
not a full `tsc` typecheck. A real typecheck needs `@cloudflare/workers-types`,
which would mean a new devDependency and a lockfile change — a shared file this
branch has no grant for.

Then run for real against `wrangler dev --local` and probed with curl:

| Case | Expected | Got |
|---|---|---|
| Origin `https://attacker.example` | 403 | 403 `origin_not_allowed` |
| Origin `https://evil-preview.pages.dev.attacker.com` | 403 | 403 `origin_not_allowed` |
| Origin `http://kh-preview.pages.dev` (no TLS) | 403 | 403 `origin_not_allowed` |
| `prospectId=not-a-client` | 422 | 422 `unknown_prospect` |
| no `prospectId` | 422 | 422 `unknown_prospect` |
| 2-character message | 422 | 422 `validation_failed {message}` |
| honeypot `company` filled | 200 (bot believes it worked) | 200 `{ok:true}` |
| valid, no `RESEND_API_KEY` | 502, lead kept in KV | 502 `delivery_failed` |
| 21st submission in an hour | 429 | 429 `rate_limited` |
| different prospect, same hour | unaffected | 502 (i.e. past the limiter) |

KV backup confirmed by listing the local namespace:

```
demo:kh-machine-works:2026-08-11T22:30:07.502Z:08c31734-…
demo:kh-machine-works:2026-08-11T22:30:07.627Z:618a3f86-…
```

**Success animation** — CSS only, no library, no new dependency. Card rises,
ring draws, tick draws, one ripple, then three text rows stagger in (~900ms
end to end). `prefers-reduced-motion` collapses it to the finished state:
the global reduce block already zeroes durations, and this change also zeroes
the *delays*, which that block does not touch — without that the sequence
would still have played out over a second for someone who asked for no motion.

End to end through a stub endpoint, driven by Playwright:

```
POSTs received     : 1
prospectId         : kts-machine-shop
prospectName       : KTS Machine Shop
success card shown : yes
offline state shown: yes          ← submitted again with the connection cut
POSTs after offline: 1 (must still be 1)
```

The offline case is a distinct state, not an error: "No signal right now. Your
message hasn't been sent" plus a call button. It never shows the success
animation for a message that did not leave the phone.

## 2. Click-to-call and click-to-text — wired, and now enforced

`tel:` links were already in six places; they now all route through
`telHref()`. `sms:` links are new, in Header (both menus), Hero, CtaBand,
Footer, contact and 404, via `TextUsLink.astro`.

Per answer A, `smsHref` is unset for all five prospects, so no text link
renders today. Proven both ways: with `smsHref` temporarily set on KTS the
build emitted 13 `sms:` links across the site with the prefilled body encoded
correctly; with it removed the new gate failed the stale build on every page
(`sms: link to "+1…" but business.smsHref is not set`), then passed once
rebuilt.

`scripts/check-contact-links.mjs` runs inside `pnpm build` and enforces four
rules — at least one `tel:` per page, no `tel:` to any other number, no number
rendered as untappable text, no `sms:` link without a configured `smsHref`.
All five clients pass.

Two things it deliberately does **not** flag, both found by it flagging them
first: JSON-LD `telephone` (structured data, not something anyone taps) and the
number inside `<astro-island props="…">` (serialised props, never rendered).

## 3. Lighthouse comparison — run against a real prospect site

```
$ node scripts/pitch/compare.mjs --client kh-machine-works --local
  current site: screenshot ... ok
  current site: lighthouse ... perf 71 a11y 87
  new site:     lighthouse ... perf 100 a11y 100
  Your site: 71/100. New site: 100/100.
```

Writes `outreach/<slug>/pitch/` (gitignored): `headline.txt`, `scores.json`,
`pitch-card.html`, and both mobile screenshots. The no-website case is not an
error — `kts-machine-shop` produced *"You have no website today. New site:
100/100."*

Two corrections the run itself forced, both in the direction of not flattering
our own side:

- **`networkidle` was too strict.** The first run reported K-H's real site as
  *"would not load"* — it loads fine, but never reaches network idle inside
  30s. Reporting a live site as dead would have overstated the comparison in
  our favour. Now `waitUntil: 'load'` with a 45s budget, matching
  `packages/audit`'s probe, with idle as a best-effort extra.
- **Our own SEO score is depressed by the mockup lock.** `seo.noindex: true`
  makes Lighthouse score our demo's SEO at 69 against their 100. That is a
  deliberate temporary state, not a property of the finished site, so the card
  now detects it and says so in a footnote rather than either hiding it or
  letting the number stand unexplained.

`--local` prints a warning every time: a site served from 127.0.0.1 has no
network in front of it and scores near 100 regardless. Real pitch numbers come
from the deployed demo URL.

Rate limiting is `packages/audit`'s `NavigationBudget`, unchanged: read-only
GETs, ≤1 navigation/sec/domain, and this script uses two of the ten per site.

## 4. Offline — implemented, then verified route by route

`5/5 demo(s) verified offline`, every client, every route:

```
=== kh-machine-works ===
  worker active, 20 entries in site-factory:kh-machine-works:86d9b94fb257
  offline
  /            ok
  /services    ok
  /about       ok
  /contact     ok
  /gallery     not built for this client (404 served from cache) — ok
  (unknown URL) ok — site 404 from cache
```

Each route is checked for four things, not just a 200: an `<h1>` with text, the
brand custom property applied (proves the real document, since the stylesheet
is inlined), at least one image with non-zero `naturalWidth`, and no failed
requests — then reloaded, to catch a worker that only serves the page it was
registered on.

**The negative test matters more than the positive one.** Deleting `sw.js`
from a build made the verifier hang forever instead of failing: with no
registration, `navigator.serviceWorker.ready` never resolves *and never
rejects*. A verifier that hangs on the exact condition it exists to catch is
worse than no verifier. Fixed with a 10s race; re-run against the same broken
build it now reports `✗ no active service worker` in seconds.

## Gate

```
pnpm install                    ok
pnpm -r build                   ok
pnpm -r typecheck               ok  (astro check: 0 errors, 0 warnings, 0 hints)
pnpm build:all                  5/5 clients built and checked
check-markers --all             5/5 (noindex builds, markers fine)
check-contact-links --all       5/5
verify-offline --all --local    5/5
```

Branch asserted `feat/demo-support` before committing. Not merged, no PR.

## Left undone, deliberately

- **Nothing deployed.** No Worker, no KV namespace, no Pages deploy — answer C.
  `MAIL_TO` is a placeholder; the form cannot email anyone until you fill it in
  and deploy. Everything else is ready for that one step.
- **`worker-demo/src/lib/validate.ts` duplicates `worker/src/index.ts`'s
  `validate()`.** The two must not disagree about what a valid enquiry is, and
  only a comment enforces that today. Filed in `worker-demo/README.md`; not
  fixed here because the single-client Worker was deliberately left untouched.
- **No `sms:` link ships**, per answer A. One line per client turns it on.
- **The Worker has no automated test suite.** It was exercised by hand against
  `wrangler dev`, and the transcript is in this file, but nothing re-runs that
  on a future change.
