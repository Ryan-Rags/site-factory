# PLAN — founder-site v3: content depth + polish

Branch `feat/founder-site-v3`, worktree `D:/sf-founder-site-v3`, off `origin/main`
@ 84dd70f. Parallel-safe with `feat/prospect-brand-cards`: this stream does not
touch `packages/prospect/**` or the 50-demo fleet.

## 0. Rulings (asked and answered before any copy)

Two `AskUserQuestion` dialogs (the tool caps at four questions; six rulings were
required). All six answered — no omissions from unanswered rulings.

| # | Ruling | Answer |
| --- | --- | --- |
| a | Employer naming | **Name CED explicitly.** |
| b | Years claim | **"Coding since 2018" + "four years professional."** Ryan: "if we should add it just put 4 years since that's true." The four years includes the first IT-tech role, so the copy says *professional*, never *four years building software*. |
| c | Styled by Alhambra | **Named**, one-liner: "a consumer AI app for fashion and styling." |
| d | Public numbers | **59 sites built** (measured), **Lighthouse 100s** (gate-backed), **23.2K TikTok**. |
| e | Sports level | **High school track & cross country**; soccer and basketball **recreationally, still**. Not "three sports" — the current copy overstates the level and mislabels XC as field. |
| f | Rental/operator angle on /about | **In.** No specifics supplied, so no unit count, no location, no dates — the angle only, stated as operator experience. |

## 1. Facts ledger

Everything below traces to Ryan's task prompt or the dialogs above. Nothing is
extended, and no number appears that he did not stand behind.

- Remote full-stack developer at **CED**, internal warehouse-operations
  software; React, TypeScript, C#/.NET. **He** is in Bergen County; the job is
  remote. Every line implying CED runs from Bergen County is a defect to fix.
- Prior: software development at **Prudential**; part-time STEM instructor at
  **Mad Science**; first role IT tech (AD/helpdesk) — counted in "four years
  professional", not described as software work.
- **Rowan University**.
- LLC spanning site-factory, **Alcove Markets**, applied-AI voice agents (dental
  case study pending), **Styled by Alhambra**.
- /sites story: he built the factory — county-wide discovery, prospect scoring,
  AI-assisted generation behind hard quality gates, 59 live sites at 100s.
- /about: former streamer and gaming content creator (23.2K TikTok); HS track &
  XC, rec soccer and basketball; Bergen County native; rental-property operator.

## 2. Work items

### 2.1 Copy + fixes (`src/pages/**`, `src/site.ts`)

- `/` and `/about`: "**Remote** full-stack developer at CED… based in Bergen
  County, NJ." Kill "Everything runs from Bergen County" ambiguity — restate as
  the ventures running from here, the day job being remote.
- `/sites`: the founder-engineering story, replacing the thin studio pitch.
  "I didn't just build websites; I built the factory."
- `/about`: correct the sports section (HS track & XC, rec soccer/basketball),
  add the audience number, add the operator angle, keep Mad Science and
  Prudential, add the Alhambra one-liner and the years claim.
- `PAGES` metadata re-written where the page's subject moved; title ≤70,
  description 70–165, unique — `check-metadata.mjs` enforces.

### 2.2 /amenity CTA correctness + visual alignment

- Every CTA becomes `mailto:vending@raghubans.com?subject=<urlencoded>` —
  header, hero, footer, closing. Subjects are per-CTA and name the venture.
- **New assertion in `check-live.mjs`**: every `mailto:` on every served page
  parses, carries a non-empty URL-encoded subject where one is intended, and
  addresses the inbox that page is allowed to use. Landed failure-first.
- Visual: keep the light/brass surface. Drop the divergent display font and
  align `--section-y` / type scale to the founder rhythm, so /amenity reads as
  one site with a lighter room. **Not** restyled dark. Chrome is already shared
  (one bar, both palettes) — footer grid aligned to match.

### 2.3 /sites portfolio grid — five invented showcase demos

Through the existing pipeline, using its documented `manual` source: a
hand-authored config in `packages/template/clients/`, ingested by
`pnpm demo -- --prospect <id> --skip-places --skip-website`, which writes
`prospects/<id>/prospect.json` — the record `check-fabrication.mjs` resolves
every claim against. That is why the pipeline is the route and a bare
`astro build` is not.

| Family | Trade | Fictional business |
| --- | --- | --- |
| forge | metal fabrication | Ironvale Welding & Fabrication |
| precision | HVAC | Northmark Heating & Air |
| heritage | masonry & hardscape | Elderbrook Masonry |
| meridian | dental practice | Halcott Dental Studio |
| apex | electrical contracting | Voltway Electric |

Fabrication discipline, following the `zz-fixture-*` idiom already in the repo:
555-01xx numbers (reserved for fiction), `example.invalid` domains, invented
towns, and a visible demonstration-site disclosure carried by `legalName` so it
prints in the footer of every page. No real entity, no real address, no real
review.

Deploy: `PREVIEW_ORIGIN=https://portfolio-<slug>.pages.dev` makes the pipeline
publish to exactly `portfolio-<slug>` without editing `packages/prospect`.
**Deploy grant is these five projects plus `raghubans-com`.** No
`--emit-known` — that rewrites `worker-demo` config and is out of grant.

`check-placeholders.mjs` currently refuses **every** `*.pages.dev` href from the
indexed site. That rule is right for client and prospect demos and wrong for
these, so it narrows to: `portfolio-*.pages.dev` allowed, every other
`pages.dev` host still refused. Landed failure-first.

Client/prospect demos carrying real business names stay unlinked — no override
was given.

### 2.4 Animation — calm register, zero JS

The template's reveal ships a ~700-byte `IntersectionObserver`. This site's
`check-no-forms.mjs` fails on **any** `<script>`, and `_headers` deliberately
ships no `script-src` CSP because there is nothing to protect. Rather than
relax both, the calm register is ported as **CSS-only scroll-driven animation**:
`animation-timeline: view()` inside `@supports`, at calm's own values (900ms,
0.5rem travel, `cubic-bezier(0.33, 1, 0.68, 1)`, stagger 1.5).

- Nothing is pre-hidden: the base rule is the final state, the animation only
  exists inside `@supports`, and an element already in view at load resolves its
  range as complete. No support (Firefox today) = still, fully visible.
- `prefers-reduced-motion: reduce` collapses to still.
- No hero element is revealed — the LCP element must never start at opacity 0.
- **New gate `check-motion.mjs`**: no `[data-reveal]` in the hero, no bare
  `opacity: 0` outside `@supports`, reduced-motion block present, still no
  scripts. Landed failure-first.

Report before/after mobile LCP and CLS; all four Lighthouse categories stay 100.

### 2.5 Verification

Full gate suite on the merged-with-main state, `check-textfit` at 320 **and**
390 on every changed page, redeploy `raghubans-com`, `check-live` against the
alias.

## 3. Lane

**HELD.** Touches gate scripts, `packages/template/clients/**` (outside granted
paths), deploys five new Pages projects and redeploys production, and the
Decision Brief will not be empty. No self-merge.

## 4. Cross-boundary edits (to be listed in the PR)

- `packages/template/clients/portfolio-*.config.ts` + `clients/index.ts` — the
  five showcase configs. Additive; no existing client's bytes move.
- `packages/founder-site/scripts/check-placeholders.mjs`,
  `check-live.mjs` — gate scripts.
