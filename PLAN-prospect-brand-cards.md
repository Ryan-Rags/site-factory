# PLAN — prospect brand cards (#61)

Branch `feat/prospect-brand-cards`, worktree `D:/sf-prospect-brand-cards`, off
`b893fed` (main post-#63). **HELD is expected**: gate scripts, the prospect
deploy path, and 50 outward-facing redeploys.

Closes #61.

---

## The defect, restated from measurement

All 50 generated demos stamp `brand.ogImage = '/images/og.svg'` — the
template's placeholder, set in `project.ts`'s `STOCK.og`. #63 fixed the
*address* (the tag now names the serving origin); the *bytes* are still an SVG,
and every unfurler declines SVG. Measured 6 of 6 in the first prospect smoke.

The 8 hand-authored clients do not have this problem, because
`gen-brand-assets.mjs` renders them a real 1200×630 PNG at `/og/<slug>.png`.
That script resolves a client from `clients/<slug>.config.ts`, which a
generated demo does not have and will never get — ingested third-party data
does not go in the repo.

---

## 1. One card, two callers

`gen-brand-assets.mjs` already knows how to draw the card. Rather than
duplicate `ogHtml()` into the prospect package, extract it:

- **new** `packages/template/scripts/lib/og-card.mjs` — `ogCardHtml(info)` and
  `OG_CARD_SIZE = { width: 1200, height: 630 }`, plus a `.d.ts` beside it, the
  same arrangement `src/lib/preview-origin.mjs` uses for the same reason
  (readable by a bare `node scripts/…` gate *and* by TypeScript).
- `gen-brand-assets.mjs` imports it. Pure refactor: the emitted HTML string
  must be character-identical, proven by diffing the rendered HTML before and
  after, and by regenerating one client card into a scratch dir and
  byte-comparing it against its committed PNG.

**The nine committed client cards are not regenerated and not re-committed.**
Existing clients render byte-identical; a regenerated PNG that differed for
Chromium reasons would be drift introduced by this work.

The prospect package loads the module by absolute path
(`pathToFileURL(join(templateDir, 'scripts', 'lib', 'og-card.mjs'))`), which is
exactly the `copyDistEntry` precedent already in `paths.ts`.

## 2. Rendering a prospect's card

**new** `packages/prospect/src/og-card.ts`:

    renderOgCard(browser, { site, design, logoFile }, outFile): Promise<void>

- Draws through `shootHtml()` from `browser.ts` — the Chromium `runProspect`
  already has open. No new dependency, no second process, no second browser
  launch per prospect. (Issue #61's sketch proposed spawning
  `gen-brand-assets.mjs` per prospect; 50 extra Chromium launches to redraw
  markup we can call directly is the worse half of that trade, and sharing the
  markup keeps the "one implementation" property the sketch was protecting.)
- Content, all of it already through `project.ts`'s sourcing rules:
  business **name**, **town** (`locality, region`), tagline, logo.
- Palette: **the tone the demo actually renders in**. `buildDesign` has already
  chosen `{ preset, scheme, accent, brandAccent? }` and written it to
  `site.design.theme`. A new exported `resolveTone()` in `design.ts` turns that
  triple into `{ palette, accent, onAccent }` out of `presets.json` —
  re-deriving the rotation here would be a second opinion about a decision
  already made.
- Logo: whatever `site.brand.logo` is — their file when they supplied one, the
  template's `logo.svg` otherwise. Same source of truth as the page.
- Output: `prospects/<slug>/cards/og.png`, beside the two existing cards.

## 3. Wiring it into the build

`check-metadata.mjs` runs *inside* `pnpm -C packages/template build` and
requires `og:image`'s path to exist under `dist/<slug>/`. So the PNG cannot be
copied in afterwards the way `prospect-assets/` is — it has to be in `public/`
before `astro build` runs.

**new** `packages/prospect/src/brand-card.ts`, modelled directly on
`content.ts`'s `ContentHandle`:

    stageBrandCard(slug, pngFile) -> { staged: boolean, cleanup(): void }

- Copies the card to `packages/template/public/og/<slug>.png` before the build;
  `cleanup()` removes exactly what it wrote, in a `finally`, including when the
  build throws — the same contract `ensureContent` keeps.
- **Refuses to overwrite an existing file.** `public/og/` holds nine committed
  client cards; a prospect slug colliding with one leaves the client's card
  alone and the run reports it rather than clobbering it.
- Nothing generated is left in the template package, and nothing derived from a
  third party's business reaches the repo.

`project.ts` gains `ProjectOptions.ogImage?: string`, used in place of
`STOCK.og`. Absent, today's behaviour is unchanged by code path — the eight
hand-authored clients never pass it.

`run.ts` orders it: project → render card → stage → build → cleanup.
`/og/<slug>.png` is also the path `check-metadata.mjs` already calls "this
client's generated brand card", so its existing note becomes agreement rather
than a warning.

## 4. The gate, failure-first

`check-stamped-origins.mjs` today asserts an asset **200s**. c3m's SVG 200s.
The gate must also assert the card is a format that unfurls:

- `lib/stamped-origins.mjs`: mark `og:image` and `twitter:image` as **cards**.
- New rule 3: a *card* asset's `content-type` must be one platforms render —
  `image/png`, `image/jpeg`, `image/gif`, `image/webp`. `image/svg+xml` is
  named in the failure text.
- **Scoped to the two card tags, not to every asset.** JSON-LD `logo` is
  `/images/logo.svg` on all nine clients and legitimately stays SVG; a blanket
  rule would fail every client by design, which is how a gate gets switched off
  — the same reasoning that shaped #63's asset/identity split.
- `--offline` skips it: it is a fetched property.

**Order of landing:** gate first, demonstrated red on c3m's *current* artifact
(built at pre-fix code, byte-equal to what is live now, graded against
`https://c3m-…-preview-rr.pages.dev`), with the live `curl -I` showing
`image/svg+xml` alongside it. Then the fix, then green.

## 5. Rebuild and redeploy the 50

- 49 with derived origins; **c3m separately** with
  `PREVIEW_ORIGIN=https://c3m-of-nj-home-renovation-affordable-handyman-preview-rr.pages.dev`,
  which moves both the stamp and the deploy target (#63).
- `pnpm demo -- --prospect <slug> --skip-ingest` per slug. No Places spend, no
  re-ingest — the 2026-08-16 records are reused as they stand.
- **Third-party navigations: zero, deliberately.** `captureBefore` only reuses
  `audit/out/`, which is empty here, so a plain re-run would re-shoot the 30
  prospects who have a live site. That is 60 avoidable GETs, and it risks a
  *worse* leave-behind: a site that is down today turns an existing "before"
  into "none". `shots.ts` gains reuse of `prospects/<slug>/shots/before-*.png`
  when they are already on disk, reported honestly as its own source rather
  than as `audit-cache`. Brief item.
- Every deploy runs #63's post-deploy gate with the resolved origin, so a
  substituted project name is caught per prospect rather than at the end.

## 6. Acceptance

| what | how |
| --- | --- |
| gate red before | `check-stamped-origins` exits 1 on the pre-fix c3m artifact, naming `image/svg+xml` |
| gate green after | same command, same origin, exit 0 |
| the 50 | 50/50 rebuilt and redeployed, no project name substituted except c3m's known `-rr` |
| card bytes | `curl -sI` per sample: `200`, `content-type: image/png`; dimensions read from the PNG header, `1200×630` |
| live smoke | `pnpm smoke --client …` on 5 samples + c3m: `og-image` and `og-image-origin` pass |
| call sheet | every `demoUrl` in `data/call-sheet.csv` still resolves to the project it names — no URL moved |
| clients | `build:all` 8/8; nine committed client cards untouched |
| full suite | `pnpm -r typecheck`, `pnpm -r build`, `build:all`, `check:schema/metadata/form-fields`, `check:overflow`, re-run on the merged-with-main state |
| unfurl | one real unfurl screenshot if a free renderer can be reached; otherwise stated as not done, never described as if it were |

## 7. Paths

Granted by this task: `packages/prospect/**`, `packages/template/scripts/**`,
`packages/template/public/og/**` (staging only, nothing committed), `docs/**`,
`PLAN-prospect-brand-cards.md`.

Cross-boundary, flagged in the PR: `packages/template/scripts/lib/` and
`gen-brand-assets.mjs` (shared with the client card path);
`check-stamped-origins.mjs` and `lib/stamped-origins.mjs` (**gate scripts**).

## 8. Not doing

- Not regenerating the nine client cards.
- Not touching `features.offline` (#62) — a separate, ruled decision.
- Not extending the SVG rule to JSON-LD `logo`.
- Nothing Places, no re-ingest, no new dependency.
