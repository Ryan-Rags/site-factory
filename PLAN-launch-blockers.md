# PLAN — fix/launch-blockers

Last stream before feature freeze. Worktree `D:\sf-launch-blockers`, branch
`fix/launch-blockers` off `origin/main@df1accd` (includes PR #32). No remote
branch of this name existed; the claim is pushed with the first commit.

Scope is fixed and pre-ruled. This plan states *how*, not *whether*.

---

## 1. og:image origin on preview builds — issue #25 / known-issues #4

**Trigger predicate:** `site.seo.noindex`. Not a new env var — an unset variable
would silently reproduce the defect on the next `build:all`, and `noindex` is
already the mockup lock, already read back off the built HTML by
`check-metadata.mjs`. Delivered / go-live builds (`noindex: false`, e.g.
`zz-fixture-go-live`) are untouched and keep `seo.siteUrl`.

- `site.config.ts` — export `previewOrigin`: `https://<clientSlug>-preview.pages.dev`
  when `site.seo.noindex`, else `''`. Same slug→project rule as
  `deploy-mockups.mjs` (`PROJECT_SUFFIX`).
- `Seo.astro` — `og:image` and `twitter:image` resolve against `previewOrigin`
  when set, else `Astro.site ?? seo.siteUrl`. **Only those two tags.** Canonical
  and `og:url` keep `siteUrl`; moving them is a different change and is not
  asked for.
- `check-metadata.mjs` — demo-mode assertion: on a `noindex` build the `og:image`
  origin must equal `https://<slug>-preview.pages.dev`. Fail-closed per the
  2026-08-12 ruling: any og:image it cannot parse, or whose origin it cannot
  resolve, fails rather than skips. Pathname/size/agreement checks unchanged.
- **Failure-first**: assertion committed and shown red against the current build
  first, then the override lands green. Both runs quoted in the PR.

Known limit, stated not fixed: `deploy-mockups.mjs` falls back to
`<slug>-preview-rr` if a project name is held elsewhere. No client is on that
path today; if one ever is, this gate goes red rather than quiet — which is the
correct direction.

## 2. industrial-machine-corp — both PR #32 Brief-1 defects

Grant: may move `/` for this client, under narrow named parity allowances.

**2a — dead `Reviews` nav item.** Fix the rule. `deriveDesign` cannot do it
(it never sees the nav-to-section mapping for a full payload like
`ks-welding.design.json`), so the filter goes in `src/lib/design.ts` next to
`sectionOrder()` and `resolveHref()`: a nav/footer entry whose href is an
in-page anchor naming a section that `sectionOrder()` excludes is dropped.
Applied in `DesignHeader.astro` (both navs — desktop and the `<details>` panel;
PR #32 records those two drifting apart once already) and `DesignFooter.astro`
for the same reason. Anchor→section map derived from the section components' own
ids, not hand-written twice. Seven clients render byte-identical because they
drop nothing; imc drops exactly one entry × 2 navs × 6 routes.
`check-links.mjs` already asserts this and is already red — it is the gate, and
it is what takes `build:all` from 7/8 to 8/8.

**2b — 190px sideways scroll on `/` at 320 and 390.** Cause located:
`design-life.css` `.d-services__grid--list .d-service { flex-direction: row }`
makes the card's icon, `<h3>`, `<p>` and `.d-service__link` siblings in a *row*
— the copy has no column wrapper — so they lay out side by side to 510px. imc is
the only client with `services.variant: "list"`. Fix in CSS (wrap the copy in a
flex column at the CSS level / constrain the row), not in the config, and not by
widening `overflow-x: hidden`. Measured, not assumed: `check:overflow` red at
320/390 on `/` first, then green, all six routes, against a served build of this
client with the served-slug guard.

## 3. Customizer panel dismissal

`Esc` is already implemented (`Customizer.astro` keydown → `open(false)`); it
will be re-measured rather than assumed, and reported as found. Missing is
outside-click dismissal. Add a `pointerdown` document listener that closes when
the target is outside both panel and toggle, does not `preventDefault`, and
never calls `apply()`/`persist()` — dismissal must leave `data-theme|scheme|
accent|font` and the query string exactly as they were.

Gate: assertions land in `check-switching.mjs` (the panel's existing browser
gate, which already reads both document state and the URL). Failure-first: the
outside-click assertion red on today's build, then green.

## 4. `docs/known-issues.md` duplicate `## 4` — **needs your call**

The two `## 4` entries are the *same* defect, recorded twice: `20a1f7b` (PR #22,
the ops redeploy) filed `## 4`, and `ef98f75` (PR #23, live-smoke) filed a second
`## 4` above it. Item 1 of this stream fixes that defect, and the file's own rule
says a fixed entry is deleted by the PR that fixes it — so both entries are due
for deletion regardless of numbering. Separately, the two code comments that cite
an entry by number cite **#3** (`scripts/live-smoke/browser.mjs:10`,
`scripts/live-smoke/checks/lighthouse.mjs:84`), which a `#4`→`#5` renumber does
not touch. Several others cite #2; none cite #4.

**Recommendation:** delete both `## 4` entries as fixed, and extend the existing
`#3` tombstone comment to record that #4 was filed twice, that the duplicate
should have been #5, and that neither number is reused — so the next entry is #6.
The append-only ruling of 2026-08-12 is then satisfied without renumbering a live
entry, and no code comment needs to change.

**If you want the literal instruction instead** — renumber the PR #23 entry to
`## 5` and keep both — say so and I will do that and leave the defect entries in
place, but they will then describe a defect that no longer reproduces. Tell me
also which two code comments you meant; I can only find #3's.

Everything else in this plan is independent of the answer, so I will build 1–3
and 5 and hold only this item.

## 5. Gates, on the merged state

Merge `origin/main` into the branch first, then the full suite on the merged
state:

- `build:all` — **must be 8/8** (7/8 today, on 2a).
- `astro check`, `check:contrast`, `check:form-fields`, `check:injection`,
  `check:csp-runtime`, and the per-client chain, all via `build:all`.
- `check:parity` against a real `main` baseline `dist`. Expected new named
  allowances, each announced and each scoped to the measured delta:
  `previewCardOrigin` (head; og:image + twitter:image origin only, path
  unchanged, noindex builds only — every page of all 8 clients) and one
  content-region allowance for imc's dropped nav entry. Whether 2b's CSS-only
  fix moves a gated region at all will be measured, not assumed.
- Browser gates on served builds: `check:overflow` (all six routes × 320/390,
  imc and at least one control client), `check:switching` incl. the new
  dismissal assertions, `check:textfit`, `check:reveal`.
- `check-metadata.mjs` red-then-green transcript for item 1.

**HELD.** Green lane fails on: gate scripts touched (`check-metadata.mjs`,
`check-switching.mjs`, `check-delivered-parity.mjs`), `docs/**`, and a non-empty
Decision Brief. Stop at the PR. PR body closes #25, lists paths, every gate with
its result, and the Brief. `docs/decisions.md` gains this stream's rulings; this
plan file is deleted by the same PR.

## Order of work

1 (assertion red) → 2b → 2a → 3 → 1 (override green) → 4 → merge main → 5.
2b first among the imc pair, per PR #32's own recommendation: it is the one a
prospect can see on a phone.
