# PLAN — design coverage (stream: design-coverage, branch `feat/design-coverage`)

Worktree `D:/sf-design-coverage`, branched from `main` @ e9654c5. Branch pushed
as the claim before this plan was written. Owned paths: `packages/template/**`
and this plan file. No root `package.json`, no `pnpm-workspace.yaml`, no
lockfile, no `.gitignore`, no `CLAUDE.md`, no `worker/`, no `scripts/deploy/`.
No new dependencies — `puppeteer-core` and `playwright` are already devDeps of
the template package. Finish = push + PR. **No merge**: the diff touches gate
scripts, so the green lane is closed to it whatever the results say.

Five items, in the order the prompt gives them, but built in the order at the
bottom — the gate for item 4 lands first, red, because it is the gate that
decides whether item 3 is done.

---

## What is actually broken today, read from the code

Facts, established by reading, not assumed:

- **Only `/` renders through the design system.** `src/pages/index.astro:47`
  forks on `site.design`; `about.astro`, `services.astro`, `contact.astro`,
  `gallery/[...slug].astro` and `404.astro` have no such fork and render
  through `BaseLayout` for every client. All eight shipped clients carry a
  `design` block, so all eight ship a home page in their family and four or
  five pages in the generic base template — different header, different
  footer, different type, different colours, Tailwind instead of `design.css`.
  The header CTA on every one of them points at `/contact`
  (`clients/design/*.brief.json` → `header.cta.href`), so the single most
  likely click on the demo is the click that leaves the design system.
- **`color-scheme` therefore lands on `/` and nowhere else.**
  `designTokens()` (`src/lib/design.ts:734`) emits it inside the `:root` token
  block, and only `DesignLayout` emits that block. That is Decision Brief #2's
  seam from `PLAN-design-polish.md`: a dark design client's `/contact` draws a
  light scrollbar and light form controls. Routing the other five pages
  through `DesignLayout` closes it as a side effect rather than as a special
  case.
- **The header name is truncated today.** `design.css:230` gives
  `.d-header__name` a fixed `1.0625rem`, `white-space: nowrap`,
  `overflow: hidden` and `text-overflow: ellipsis`. `K-H Machine Works` in
  Forge's uppercase display face at 320px does not fit beside a 36px logo and
  the menu button, so it ellipsises. `Industrial Machine Corporation` is
  worse. The comment above that rule says a long name "must ellipsise rather
  than widen the viewport" — that was the right call against the only
  alternative it had at the time, and it is the rule this stream replaces.
- **The nav is anchors.** Every brief's `header.nav` is `#services`,
  `#reviews`, `#gallery`, `#service-area`, `#faq`, and so is the footer's link
  column. On a page that is not `/`, every one of those becomes a dead anchor
  the moment the route renders design markup — because the sections they name
  are on the home page.
- **Reveal already unobserves on first intersection** (`Reveal.astro:138`), and
  the hero copy is deliberately not `[data-reveal]` (`HeroCopy.astro:23`). So
  half of item 5 may already hold. What is *not* established is whether
  anything inside the initial viewport is pre-hidden at the wider viewports,
  and that is a measurement, not a reading — see item 5.
- **`features.gallery` is `false` in all eight client configs**, so no client
  emits `/gallery` at all today. See the Brief.

---

## 1 · Full-route design rendering

### Shape

One new shell and five new page bodies, all under
`src/components/design/`:

```
DesignPage.astro        DesignHeader → <main id="main"> slot </main> → DesignFooter
                        → StickyCallBar        (what DesignHome does, minus the
                                                home sections)
DesignPageHead.astro    the eyebrow / h1 / intro band, in family tokens
DesignAbout.astro       the `about` collection entry + certifications + coverage
DesignServicesPage.astro  site.services + the `services` collection entries
DesignContact.astro     phone / text / email / address / hours + the full form
DesignGalleryPage.astro   design.sections.gallery.items
DesignNotFound.astro    404, with the way back
```

Each of the five route files gets the same `design ? … : …` fork
`index.astro` already carries, so a client with no `design` block renders
exactly what it renders today. That is the property that keeps
`zz-fixture-phone-optional` — the one legacy client left — byte-identical.

### Where the words come from

Nothing new is written about any business. Each design page renders the same
facts its legacy page renders today, from the same source:

| route | source |
|---|---|
| `/services` | `site.services` + `src/content/services/<slug>/*.md` + `site.pages.services` |
| `/about` | `src/content/about/<slug>/<entry>.md` + `site.certifications` + `business.serviceArea` + `site.about` |
| `/contact` | `business.phone`/`smsHref`/`email`/`address`/`hours` + `site.pages.contact` |
| `/gallery` | `design.sections.gallery.items` |
| `/404` | template copy only — no business claims |

`/gallery` reads the design payload rather than the base template's six
placeholder SVGs (`gallery/[...slug].astro:20`): a design client that turns
the gallery on and gets stock placeholders is fabricated work, and
`check-fabrication.mjs` exists to catch exactly that. `features.gallery` on
with an empty `sections.gallery.items` becomes a build error naming the field.

Markdown rendered through `<Content />` emits bare `<p>`, `<ul>`, `<h2>` and a
design page loads no Tailwind, so `design.css` gains a `.d-prose` block —
tokens only, no literal colour, same rule as everything else in that file.
`/contact` reuses `.d-quick` for the form panel, which today is written for
the compact island layout; the full layout (`contactFormProps()`) needs its
rules extended, not duplicated.

### "Get in touch" belonging to the site

The concrete acceptance is the contact page under a hero the prospect just
looked at: same header lockup, same nav, same footer, same accent on the
submit button, same family texture behind the panel. It gets there by
construction — it is the same header component, the same footer component and
the same stylesheet — rather than by restyling a Tailwind page to match.

### `color-scheme` on every page

Falls out of the above: every route now emits the `:root` token block, so
every route declares the tone. The textfit gate asserts
`getComputedStyle(document.documentElement).colorScheme` equals the resolved
scheme on all six routes, so this cannot silently regress.

### The customizer across routes

`DesignLayout` renders the panel on pitch builds, so the panel now appears on
all six routes. Cross-page navigation carries the cell through
`localStorage` (`persist()` writes it; the no-flash script reads it) rather
than through the query string, because the header CTA is a plain `<a>`. That
path is asserted in the textfit gate: choose a cell on `/`, follow the header
CTA, and the contact page must come up in the same cell — which is the
prospect's actual journey and the thing that would look broken in a demo.

### Parity gate: one named route allowance

`check-delivered-parity.mjs` gains a second named allowance beside
`onlyColorSchemeAdded`, deliberately narrow in the same way:

```
REDESIGNED = services/index.html, about/index.html, contact/index.html,
             gallery/index.html, 404.html
```

The allowance applies to a page **only when all four hold**: the path is in
that list; the baseline page is legacy (no `:root` design block); the
candidate page is a design page (has one); and the client is a design client.
Then `html`, `head` and `content` may move on that page, and every page takes
the allowance is printed by name at the end of the run, exactly as the
`color-scheme` exemption is.

Three properties this shape buys:

- **`/` is still fully gated.** The home page is not in the list, so the whole
  standing acceptance on it is untouched.
- **A legacy client is still fully gated.** `zz-fixture-phone-optional` has no
  `design` block, so its `/contact` fails the allowance's third condition and
  stays byte-locked.
- **The allowance expires by itself.** It requires the *baseline* to be legacy.
  Once this lands on `main`, a later stream comparing against it gets no
  allowance at all on those routes, so this is a one-way migration and not a
  standing licence for those five pages to drift.

---

## 2 · URL and nav audit

### The anchor problem, and the fix

`#services` on `/contact` points at nothing. Every config href is therefore
resolved through one helper before it is rendered:

```ts
resolveHref(href, pathname)   // '#services' + '/contact' → '/#services'
                              // '#services' + '/'        → '#services'
```

applied in `DesignHeader` (desktop nav and the `<details>` menu), `DesignFooter`
(link columns), the hero CTAs, the sticky bar and the page CTAs. On `/` it is
the identity function, which is why home's markup does not move and the parity
gate stays quiet there.

Nav **labels** are untouched and come from the same config array on every
route, so consistency across routes is structural rather than checked.

### The gate

A new `scripts/check-links.mjs`. No browser: it reads `dist/<slug>/` and, for
every emitted page,

1. collects every `href` that is internal (starts `/` or `#`),
2. resolves it to a page in the build (`/contact` → `contact/index.html`) and,
   where it carries a fragment, to an `id` or `name` in that page's markup,
3. fails on anything that resolves to neither,
4. asserts `<link rel="canonical">` is present, absolute and self-referencing
   for the page it is on,
5. asserts every page's nav renders the same label set in the same order.

External links are out of scope: this stream does not make network calls to
verify third-party URLs, and the audit gates are read-only local file reads.

It is cheap and static, so it joins the `pnpm build` chain rather than needing
a preview server. Failure demonstrated first, by pointing a nav entry at an
anchor that does not exist.

---

## 3 · Long names as a design rule

Escalation order, and it is exactly the order the prompt gives:

1. **Fluid size.** `.d-header__name` goes from a fixed `1.0625rem` to
   `clamp(0.875rem, 3.1vw, 1.0625rem)`, so the lockup shrinks with the
   viewport instead of overflowing it.
2. **Tracking reduction steps.** Display tracking is a family token and is
   *negative* in two families and positive in the third, so the step has to
   reduce a positive tracking without loosening a negative one:

   ```css
   letter-spacing: min(var(--d-display-tracking),
                       calc(var(--d-display-tracking) * var(--d-lockup-track, 1)));
   ```

   with `--d-lockup-track` stepping 1 → 0.5 → 0.25 at 430px and 360px. For a
   positive token `min()` picks the reduced value; for a negative one it picks
   the token, unchanged. One expression, no per-family branch.
3. **A two-line lockup.** `white-space: normal`, `overflow-wrap: break-word`,
   `line-height: 1.1`, and the brand anchor's cross-axis alignment set so the
   two lines sit against the logo as a block rather than pushing the bar taller
   than it needs to be.
4. **No ellipsis.** `text-overflow: ellipsis` and `overflow: hidden` come off
   the rule entirely. Nothing truncates, at any width. A name too long for two
   lines takes a third line and **fails `check:textfit` loudly** rather than
   losing characters silently — which is the point of the gate and the reason
   the escalation can end without a truncation step.

**This is CSS only. No markup changes.** That is a deliberate constraint, and
it is what keeps the eight shipped clients byte-identical on their home pages:
`design.css` is inlined but the parity gate's style extraction only picks
blocks containing `--d-base:`, so a rule change in that stylesheet is invisible
to it — correctly, because it changed no page's content. The alternative
considered and rejected was a build-time name-length tier emitted as an inline
custom property; it would cover an arbitrarily long name by construction, and
it would move the `content` region of home for all eight clients. See Brief #4.

**Pixels do move**, on the two clients whose names are ellipsised today, at the
narrow widths. That is the fix, it is what the acceptance screenshots are for,
and it is stated as such in the PR rather than buried.

### The regression case

A new fixture, `zz-fixture-long-name` — invented business, invented facts,
never deployed (`build-all.mjs` skips every `zz-fixture-` slug), and the only
place a deliberately long name is exercised. Needs its own config, a design
brief, and one `about.md` and one service markdown file under its slug. It also
turns `features.gallery` on, so it is the build that proves the `/gallery`
route (see Brief #6).

Its name is chosen to be genuinely awkward — long, with a conjunction and a
trailing "Company" — and long enough that the pre-fix stylesheet truncates it
at every one of the five widths.

---

## 4 · The gate: `check:textfit`

`scripts/check-textfit.mjs`, headless, against a served build, with the same
served-slug guard `check-switching.mjs` carries — `astro preview` walks to the
next free port silently and this repo runs a dozen worktrees at once, so a gate
that cannot prove which build it measured is a gate that can report green on
somebody else's site.

**Coverage.** Viewports `{320, 390, 768, 1024, 1440}`.

- Every offered cell (112 on a pitch build, 1 on a delivered one) × 5
  viewports, on `/`. That is where the hero H1 and the hero buttons are, and
  the header is the same component everywhere, so this is the cell sweep the
  prompt asks for.
- All six routes × 5 viewports on two cells: the client's shipped cell and the
  widest type in the matrix (heritage, uppercase Georgia at +0.05em). That is
  what proves each new page's own headings and buttons.

Cells are selected by URL parameter and the gate asserts `--d-font-display`
matches the cell it asked for, so a mis-resolved parameter cannot make it
measure the shipped cell 112 times and call it a pass. Nothing is capped
silently: the two-cell route sweep is a stated bound, printed in the run
header, not a quiet sample.

**Assertions, per (cell, viewport):**

| # | assertion |
|---|---|
| 1 | header name: `scrollWidth ≤ clientWidth`, `scrollHeight ≤ clientHeight` — no ellipsis and no line-clamp |
| 2 | header name renders on ≤ 2 lines (client rects), and its box sits inside the header bar's box |
| 3 | nav (≥900px): each item is a single line — one client rect per anchor, so no label wraps mid-word |
| 4 | nav does not collide with the lockup: nav's left edge ≥ brand's right edge, and the last item's right edge ≤ viewport |
| 5 | hero H1: `scrollWidth ≤ clientWidth`, `scrollHeight ≤ clientHeight`, box inside the viewport |
| 6 | every `.d-btn` in the header, hero and sticky bar: label unclipped by its own padding box |
| 7 | `colorScheme` on `<html>` equals the cell's scheme (item 1's seam) |

Horizontal page overflow stays `check:overflow`'s job and is not duplicated
here; `check:overflow` gains `/gallery` to its route list.

**Failure first.** The gate is written and committed before the stylesheet is
touched, and run against today's `kh-machine-works` build. The expected red is
assertion 1 on the header name at 320 and 390 — the exact failure the ellipsis
rule was hiding. Whatever it actually prints is what goes in the PR, including
anything it catches that this plan did not predict.

---

## 5 · Reveal behaviour

Two of the three properties look like they already hold, and "looks like" is
not a result. So this item is *measure, then change only what measurement
says* — and it is the one item that could force a change to
`Reveal.astro`, whose inline script lives in `<body>` and is therefore inside
the parity gate's `content` region on every design page including home.

`scripts/check-reveal.mjs` asserts, at all five viewports on all six routes:

1. **Fires once.** Scroll to the bottom, back to the top, back down. No element
   loses `.is-revealed`, and no `[data-reveal]` element's computed opacity ever
   returns below 1 once revealed.
2. **Nothing above the fold is pre-hidden.** A hook injected with
   `evaluateOnNewDocument` records, at `DOMContentLoaded` — i.e. after the
   inline reveal script has run and before first paint — every `[data-reveal]`
   element intersecting the initial viewport and whether it was already
   revealed. Any that was not is a pre-hidden above-the-fold element and a
   failure.
3. **Reduced motion unchanged.** With `prefers-reduced-motion: reduce`
   emulated, every `[data-reveal]` is at opacity 1 with no transition, and the
   counters are painted at their final values.

If (2) comes back red on an existing route, the fix is four lines in
`Reveal.astro` — mark elements already in view as revealed and skip observing
them, in the same tick that sets `data-reveal-ready`, so they never paint
hidden. That would move `content` on every design page including home, which
the route allowance in item 1 does *not* cover, and I will report the
measurement and ask before making it rather than widening the allowance
myself. If (2) is green, the new pages simply keep `data-reveal` off their
first screen and the gate holds that true.

Failure for this gate is demonstrated by temporarily removing the `unobserve`
call and, separately, by adding `data-reveal` to a page-head band — each
turning exactly one of the three assertions red.

---

## Verification

Everything below is run on the merged-with-main state, and reported with its
actual output. Nothing is estimated; anything unmeasurable is reported as
unavailable.

| gate | scope |
|---|---|
| `build:all` | 8 clients, plus `zz-fixture-long-name` built on purpose |
| `astro check` | 0 errors expected; existing JSON-LD hints noted |
| `check:markers`, `check:fabrication`, `check:contact-links`, `check:form-fields` | all clients — the new routes must not introduce an untappable number or an unmarked claim |
| `check:contrast` | unchanged count; no palette moves in this stream |
| `check:overflow` | 320/390 × 6 routes, shipped cell and widest cell |
| `check:switching` | all 112 cells — the panel must survive being on six pages |
| `check:parity` | against `main`'s `dist`, with the route allowance printed by name |
| `check:textfit` | **new** — 112 cells × 5 widths on `/`, plus 6 routes × 5 widths × 2 cells |
| `check:links` | **new** — every internal href and every canonical, all clients |
| `check:reveal` | **new** — 6 routes × 5 widths, plus a reduced-motion pass |

**Acceptance artefacts**, from a new `scripts/capture-coverage.mjs`:

- `kh-machine-works` header at 320, 390, 768, 1024 and 1440 in the widest font
  cell — before and after, so the two-line lockup is visible against the
  ellipsis it replaces;
- `/` and `/contact` side by side in `forge`+`dark` and in `heritage`+`light`.

Lighthouse: the known `NO_LCP` constraint on `DesignLayout` under mobile
emulation is documented in two previous plans and is not something this stream
fixes. I will report accessibility, best-practices and SEO for a new route
(`/contact`) against its legacy self, and the byte delta per route. Performance
stays reported as not demonstrated.

---

## Order of work

1. `check:textfit`, written and run red on today's `kh-machine-works`. Commit
   with the red output recorded.
2. The lockup rule (item 3, `design.css` only). `check:textfit` green on all 8.
   Commit.
3. `zz-fixture-long-name` — config, brief, two markdown files. Red first on the
   long name, then green. Commit.
4. Full-route design rendering (item 1) + `resolveHref` (item 2) + `.d-prose`.
   Commit.
5. `check:links` and `check:reveal`, each failure-first (item 2, item 5).
   Commit.
6. Parity gate route allowance, run against `main`'s dist. Commit.
7. Merge `main` in, full suite on the merged state, capture the acceptance
   screenshots, write the PR. Push.

## Not doing

- No merge and no self-merge: the diff touches gate scripts, so the green lane
  is closed regardless of results, and the Decision Brief is not empty.
- No deploy, no Worker change, no `.env` read, no email path, no new dependency.
- No change to any client's *content*. Not one new sentence about any real
  business; the design routes render facts that already exist in the configs
  and the content collections.
- No change to `/` for any client, in bytes. Pixels change on the header
  lockup at narrow widths, deliberately — see Brief #5.
- No sitemap work: `astro.config.mjs:28` emits no sitemap while `seo.noindex`
  is on, which is every client today.
- No Lighthouse performance claim.

---

## Decision Brief

Numbered, each with a recommendation. Answer only where you disagree.

1. **`/services`, `/about` and `/gallery` stay unlinked from the design nav.**
   The nav is the config's anchor list and the footer column is the same; both
   describe the home page's sections. Adding page links would change home's
   footer markup for eight shipped clients and needs a parity allowance that
   home does not otherwise need. **Recommend:** leave them reachable by URL
   this stream, and add a footer "Pages" column as its own change if you want
   them linked.
2. **Off-home anchors resolve to home** — `#services` on `/contact` becomes
   `/#services` rather than the nav being repointed at the real routes.
   **Recommend** this: labels stay identical across routes, every link
   resolves, and home's markup does not move. The alternative — nav pointing at
   `/services`, `/gallery` etc. — is a different site structure and a bigger
   decision than a coverage stream should make on its own.
3. **Three new gates, not one.** The prompt mandates `check:textfit`; items 2
   and 5 also need proof, and I would rather they had small honest gates
   (`check:links`, `check:reveal`) than assertions bolted onto a gate whose
   name then lies about what it covers. **Recommend** three. Say the word and I
   will fold them in instead.
4. **The lockup rule is pure CSS, so the "never truncated" guarantee is
   enforced by the gate rather than by construction.** A build-time
   name-length tier would guarantee any name by construction and would move
   home's `content` region for eight shipped clients. **Recommend** the CSS
   rule: a name too long for two lines fails `check:textfit` at gate time,
   which is loud, fixable and better than a silently clipped lockup.
5. **Two clients' headers change visually at 320/390.** `K-H Machine Works`
   and `Industrial Machine Corporation` are ellipsised today and will render as
   two-line lockups. Bytes identical, pixels deliberately different.
   **Recommend** accepting it — it is the item-3 fix — with the before/after
   screenshots in the PR as the record.
6. **`/gallery` is proven on the fixture only.** `features.gallery` is `false`
   in all eight client configs, so no client emits that route today. Turning it
   on for a real client needs real photographs and is a content decision.
   **Recommend:** build and gate the route on `zz-fixture-long-name`, and leave
   every client's flag alone.
7. **A `Reveal.astro` change would need an allowance this plan does not
   include.** Only if measurement shows an above-the-fold element pre-hidden
   today. **Recommend:** I report the measurement and stop for your call rather
   than widening the parity allowance to cover home.
8. **`/contact` is never byte-identical between builds anyway** — Astro stamps
   a random island `uid` on the React form. The parity gate already normalises
   it (`deIsland`); noting it so the allowance's scope is not misread as
   covering something it did not need to.
