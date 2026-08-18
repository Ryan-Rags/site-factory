# PLAN — calling-week hardening

Branch `ops/calling-week-hardening`, worktree `D:/sf-calling-week-hardening`, off `main` @ 9e91939.

Scope: protection for the 50 demos being dialled this week. No Places spend, no new
product features. **HELD expected** — the diff touches gate scripts, `worker`-adjacent
deploy paths, `packages/template/src/`, and it deploys.

Granted paths (from the task): `packages/template/scripts/**`,
`packages/template/src/components/LocalBusinessJsonLd.astro`,
`packages/template/src/lib/preview-origin.*`, `packages/template/site.config.ts`,
`scripts/deploy/**`, `scripts/live-smoke/**`, `packages/prospect/src/**`,
`docs/**`, and GitHub issue bodies.

---

## Measured before writing anything

`https://c3m-…-preview-rr.pages.dev/` answers 200 and stamps **six** absolute URLs at
`…-preview.pages.dev`, which does not resolve:

| tag | origin stamped |
|---|---|
| `link[rel=canonical]` | `…-preview.pages.dev` ✗ |
| `og:url` | `…-preview.pages.dev` ✗ |
| `og:image` | `…-preview.pages.dev` ✗ |
| `twitter:image` | `…-preview.pages.dev` ✗ |
| JSON-LD `image` | `…-preview.pages.dev` ✗ |
| JSON-LD `logo` | `…-preview.pages.dev` ✗ |
| JSON-LD `url` / `@id` | `…-preview.pages.dev` ✗ |

Cause: `run.ts` derives `siteUrl` from `projectNameFor(slug)` *before* `deploy.ts`
learns the name was substituted. Known-issues #13, and #35 for the JSON-LD half.

**Second defect found while measuring, larger and not in this task's six items:**
`og:image` on that demo is `/images/og.svg` — `gen-brand-assets.mjs` reads
`clients/<slug>.config.ts`, which no generated demo has, so **all 50 demos ship an SVG
card**. Every platform in the ledger of 2026-08-12 declines to render an SVG `og:image`.
Fixing the origin therefore makes the card *reachable* but does not make the link
unfurl a picture. Item 1 is delivered and reported to that boundary; the fix is
Decision Brief item 1 with a recommendation, plus one issue.

---

## 1. c3m — rebuild + redeploy on its real serving origin

Mechanism, which items 1 and 2 share: **`PREVIEW_ORIGIN`**, an explicit operator
override read by `previewOriginFor()` in `src/lib/preview-origin.mjs`.

- Unset (every existing build): derives `https://<slug>-preview.pages.dev`. Byte-identical.
- Set: that origin is used by `site.config.ts`'s `cardOrigin`, by `check-metadata.mjs`
  and by `check-delivered-parity.mjs` — one function, so build and gate cannot disagree.
- Validated as a bare `https://` origin with no path; `build-all.mjs` **refuses to run**
  while it is set, because one origin across a batch of eight is the obvious footgun.
- `run.ts` honours it for `seo.siteUrl` too, so canonical / `og:url` / JSON-LD `url`
  move with the card. This is option 3 of known-issues #13, chosen deliberately;
  option 1 (reserve the project name *before* the build) is Brief item 2.

Then: `pnpm demo --id c3m-… --skip-ingest` with `PREVIEW_ORIGIN` set to the `-rr` host,
redeploy to the existing `-rr` project, and re-probe all six tags live.

## 2. Durable post-deploy assertion — `check-stamped-origins.mjs`

New gate in `packages/template/scripts/`, called by **both** deploy paths
(`scripts/deploy/deploy-mockups.mjs` imports it; `packages/prospect/src/deploy.ts`
spawns it) after the deploy, with the *resolved* project origin.

Two rules, and the split is the judgment call (Brief item 3):

1. **Any stamped absolute URL whose host is `*.pages.dev` must equal the serving
   origin.** That is our hosting, so naming a different one is always a defect. Catches
   all six c3m tags.
2. **Asset URLs — `og:image`, `twitter:image`, JSON-LD `image`, JSON-LD `logo` — must
   return 200 at the serving origin.**

A stamped identity URL on a non-`pages.dev` host (`example.invalid`, a client's own
domain) is **left alone**: the ledger of 2026-08-13 rules the canonical and `og:url` are
identity claims that keep `seo.siteUrl`. A blanket "must match the serving origin"
would fail all eight hand-authored demos by design.

Also in this item, closing #35: `LocalBusinessJsonLd.astro` resolves `image` and `logo`
against `cardOrigin` with `Seo.astro`'s fallback — same `noindex` trigger, `@id` and
`url` untouched — and `check-schema.mjs` asserts it, per that issue's fix sketch.

Failure-first: the gate is demonstrated red against the *current* c3m artifact before
either fix lands. Evidence in `docs/evidence/`.

Closes the known-issues #13 entry and issue #35.

## 3. #37 — `check:overflow` gains the served-slug guard

Lift the identical block from `check-textfit` / `check-reveal` / `check-switching` into
`scripts/lib/served-slug.mjs` and call it from all four, so a fifth gate cannot be
written without it. The other three keep byte-identical behaviour. Demonstrated red by
pointing `PREVIEW_URL` at another client's preview first.
Not touched: their `ks-welding` defaults — that is #43, a different issue.

## 4. #56 — live-smoke sees prospect demos

- Slug resolution becomes `clients/index.ts ∪ prospects/known.json`, the bijection ruled
  on 2026-08-17 and already implemented in `check-form-fields.mjs`.
- Origin resolution prefers `prospects/<slug>/demo.json`'s `liveUrl` over
  `https://<slug>-preview.pages.dev` — deriving a demo URL from a slug is exactly what
  known-issues #13 says is wrong for c3m.
- `--client` repeatable, so a sample is one run and one politeness ledger.
- Then: smoke a 5-prospect sample + the c3m rebuild against the live fleet.
  Budget held at 1 navigation/sec/host, 10/site; these are six distinct hosts.

## 5. #57 — `findLeadRow` gains the dual spelling

`slugsFor` is exported from `ingest/leads.ts` and used by `findLeadRow`, exactly as
`findPlaceId` already uses it. Read path only; nothing is renamed, no deployed URL moves.
Proof on the 14 `&`-slugs, plus a `zz-fixture-*.csv` in gitignored `data/` for the
either-spelling case, since a fixture is what may carry invented names.

## 6. #42 — issue body path pointer

The body cites `scripts/make-compare.mjs`; the file is
`packages/template/scripts/make-compare.mjs`. Same for its `clients/index.ts` and
`src/content/` pointers. Body edit only — the issue stays open and parked on the freeze.

---

## Gates

`pnpm -r typecheck` · `pnpm -r build` · template `build:all` · `check:parity` (delivered
clients byte-identical; the three `noindex` demo clients' JSON-LD *does* move, which is
the #35 fix and is called out) · `check:schema` · `check:metadata` · `check:form-fields`
· `check:overflow` with the new guard, red then green · the new
`check-stamped-origins.mjs`, red on the pre-fix c3m artifact then green · `pnpm smoke`
on the six live sites.

## Not doing

- Reserve-before-build (known-issues #13 option 1) — Brief.
- PNG social cards for generated demos — Brief + issue.
- #43's stale default slugs, #42's actual deletion (frozen), anything Places.
