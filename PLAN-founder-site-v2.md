# PLAN — founder-site-v2

Stream: `feat/founder-site-v2` · worktree `D:/sf-founder-site-v2` · off `origin/main` @ 9e91939.
Granted paths: `packages/founder-site/**`, `docs/decisions.md`, `docs/known-issues.md`.

Task prompt ended in "Execute through to PR", which CLAUDE.md counts as pre-approval.
This file records the plan anyway, and the PR that lands the stream deletes it.

---

## 1. Nav — the bug

### Measured before

`/amenity` wears `chrome="amenity"`: the header is a brand wordmark plus one
`mailto:` CTA, and the ONLY route out of the page is a discreet
`A venture of <a href="/">Ryan Raghubans</a>` line in the amenity footer.

So it is not literally a dead end — it is a **one-exit** page, and every other
route is two taps away (`/amenity` → `/` → anywhere). Reported as measured, not
as prompted.

### Fix

- `NAV` in `src/site.ts` becomes the five routes Ryan named — Home · Sites ·
  Alcove · AI · About — replacing the four-item list. Shorter labels also buy
  back the width five items cost at 320px.
- `Header.astro`: both chromes render the same `<nav>`. The amenity chrome keeps
  its own wordmark (`Alcove Markets` → `/amenity`) and its proposal CTA; what it
  gains is the site nav.
- **No new colour values.** `.topbar` is already written against `--base`,
  `--line` and `--ink-muted`, so the `[data-surface='amenity']` token block
  re-skins the nav to the light/brass palette with zero extra CSS. That is the
  "palette-appropriate rendering" — by construction, not by a second rule set.
- The amenity CTA moves into the bar as `.topbar__cta`; it must survive 320px,
  which `check-textfit.mjs` decides, not me.

### The assertion

Ryan named check-live or the fit gate. It goes in **`check-live.mjs`**: that gate
already GETs all five documents, so the link graph is free — no extra requests,
nothing added to the audit budget. It asserts, on the DEPLOYED HTML, that every
route links every other route directly: a 5×5 matrix with an empty diagonal.

Failure-first, per CLAUDE.md: the assertion is written and run against the
**currently deployed** raghubans.com first, where `/amenity` is expected to fail
on four missing edges. That failure is the "before" half of the requirement-4
report, and it is a real measurement rather than a staged one.

Known cost, stated: check-live is post-deploy, so this catches a nav regression
after publish rather than at build. Brief item.

## 2. Biography

Facts are exactly the ones in the task prompt. Nothing is extended, no tenure,
title, date, degree, major, follower count or placing is invented — the standing
rule from PR #59's ruling 4.

**A correction, not just an addition.** The live copy says "I started in
enterprise development — at CED, and then at Prudential" (`/about`) and
"Enterprise development at CED and Prudential turned into three ventures"
(`/`). Both put CED in the past and order it before Prudential. CED is the
**current** day job and Prudential is the previous one, so both lines are
factually wrong today and are rewritten, along with `PAGES.about.description`
which repeats the same ordering.

- `/` hero: `<h1>` is untouched — `check-textfit.mjs` asserts its exact string.
  The duality line lands as a new `.hero__now` paragraph beneath it.
- `/about`: gains the day job, the stack, Prudential + Mad Science as previous,
  Rowan, and Styled by Alhambra. Streaming and sports sections stay.
- "Bergen County web developer" survives verbatim on `/` and `/sites` for exact
  match, reframed both places from Ryan's job title to what site-factory does.
  Currently it reads "I am a Bergen County web developer" — that is the framing
  the prompt forbids.

**Ruling 4 is reversed, and reversal is appended, never edited.** PR #59 landed
"no session writes biography into `/about`". Ryan supplying the facts is what
changes it, so `docs/decisions.md` gets a NEW dated line saying so and scoping
the licence to supplied facts only.

Brief item: Styled by Alhambra as a 4th venture card on `/`, or `/about`-only.
Default is `/about`-only.

## 3. Asset slots

Both slots must build in either state, and the gate must stay honest in both —
an "expected 1, got 0" that flips to "expected 0, got 1" is not a relaxation.

- `public/ryan.jpg`: resolved with `existsSync` at build time. Present → a
  dimensioned `<img>` in the same 4:5 box the placeholder reserves, so CLS stays
  0 either way. Absent → `PHOTO_HERE`, unchanged.
- `LINKEDIN_URL`: a nullable export in `src/site.ts`. Set → a real anchor in the
  footer. Null → `LINKEDIN_URL`, unchanged.
- `check-placeholders.mjs` computes its expectation from that same state and,
  when a slot is filled, asserts the **filled** artifact is there — an `<img>`
  with the right `src`, an `<a>` with the right `href`. A dropped slot fails in
  both directions.
- `check-live.mjs`'s blanket "expected some placeholders" assertion has to move
  the same way; today it would fail the day both slots are filled.
- Ryan supplies both files. Neither is invented here. Both branches are proven
  with a throwaway fixture image that is deleted before commit and never
  committed.

## 4. Verification

`pnpm build` (six gates) · `check-textfit` · `astro check` · deploy to
`raghubans-com` · `check-live` against the deployed origin · Lighthouse mobile,
four categories, five routes, ≥90 treated as the release gate per the README.

Lighthouse is not installed in this repo and is run via `npx -y lighthouse`
against Playwright's Chromium; it is not added as a dependency.

## Lane

**HELD, and not close.** The diff touches `docs/decisions.md` and gate scripts,
and it deploys — three separate green-lane disqualifiers, plus a non-empty Brief.
No self-merge.
