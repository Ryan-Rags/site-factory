# PLAN-beta-2 — integration of design-polish, lead-flow-2, prospect-parity

Integrator stream. Worktree `D:/sf-integrate-beta-2`, branch `integrate/beta-2` off
`main` (9655c09), claim pushed. Cold-start inputs copied from the main checkout:
`.env`, `.env.deploy`, `data/*.csv`, `worker-demo/wrangler.local.jsonc`. `pnpm install`
green. Per CLAUDE.md the integrator opens ONE PR to main and never merges it.

Merge order, serially, full gates after each:

1. `feat/design-polish` (#14) — 4 commits, 16 files
2. `feat/lead-flow-2` (#13) — 2 commits, 29 files
3. `feat/prospect-parity` (#12) — 12 commits, 127 files (stale PR target ignored;
   the branch is merged)

## Lineage note — read before judging the third merge

`feat/prospect-parity` is not branched off `main`. Its history carries the tail of
`integrate/beta-1` that never reached main: `feat/demo` and `feat/copy`
(`a526aca`, `a1b49f6`, `6fb1dde`, `3a9bdcb`, `00402a0`, `ec89aad`, …). Merging it
therefore also lands `packages/copy` and `packages/prospect` in their entirety —
roughly 11k of the 13.5k lines in its diff against main are that tail, not parity
work. This is expected, but it means the third merge is where nearly all conflict
risk sits, and the PR's conflict log must separate "arrived with the beta-1 tail"
from "parity's own changes".

## Conflict forecast and resolution

Established by reading all three trees; each is confirmed at merge time and logged.

| Path | Branches | Resolution |
|---|---|---|
| `packages/template/package.json` | all three | Union, see below |
| `clients/index.ts` | lead-flow, parity | Union: parity's 8 clients + lead-flow's `zz-fixture-phone-optional` |
| `clients/kh-machine-works.config.ts` | lead-flow (+14), parity (rewrite to `from-copy`) | Parity's rewrite is the base; lead-flow's `forms`/field block re-applied onto it |
| `scripts/build-all.mjs` | lead-flow (+38), parity (+19) | Union |
| `src/types/site.ts` | lead-flow (+53), parity (+139) | Additive union, per precedence |
| `src/pages/index.astro` | lead-flow (+7), parity (+14) | Union |
| `src/components/design/DesignLayout.astro` | design-polish (+48), parity (+3) | design-polish canon; re-apply parity's offline-path line |
| `packages/prospect/src/design.ts` | — | Stale against the scheme model; rewritten, see Ruling P |

`packages/template/package.json` `build` script is a genuine three-way divergence:

- main / design-polish: `astro build && markers && contrast && contact-links`
- lead-flow: `form-fields && astro build && markers && contrast && contact-links`
- parity: `astro build && markers && fabrication && contrast && contact-links`

Resolved as the union, preserving each branch's own position for its gate:
`check-form-fields && astro build && markers && fabrication && contrast && contact-links`.
`scripts` gains `check:switching`, `check:parity` (design-polish), `check:form-fields`
(lead-flow), `check:fabrication` (parity); `dependencies` gains `@site-factory/copy`.

**Two forecast conflicts will not materialise.** `src/styles/design.css` is touched by
lead-flow alone — design-polish puts its scheme tokens in `lib/design.ts`
(`themeMatrixCss`) and `DesignLayout.astro`, not the stylesheet — so the "union of
scheme tokens + `.d-quick`" resolves to a clean apply of lead-flow's 167 lines.
`worker-demo/**` is touched by lead-flow alone, so "worker-demo is lead-flow canon"
needs no arbitration. Both are logged as non-events rather than silently omitted.

## Ruling P — parity's stale port (precedence item, not one of the five)

The brief says parity's `color.ts` port of the design-accent pairs predates schemes.
Confirmed, with a correction worth stating: **the pair maths in `color.ts` is not
stale.** Its `designPairings()` — 17 pairs, same derivations, same 4.5/3.0 thresholds,
same `1e-9` slack — is byte-for-byte equivalent to design-polish's new canonical
`src/design/contrast.mjs` `pairsFor()`. Nothing there needs changing.

What is stale is the **shape** it is fed, in `packages/prospect/src/design.ts`:

```ts
interface PresetFile {
  presets: { id; palette: DesignPalette; accents: […]; fonts: […] }[];
}
```

design-polish restructured `presets.json` so a preset now owns
`defaultScheme` and `schemes: Record<'light'|'dark', { palette, accents }>`. After the
merge, `presetData.palette` is `undefined` and `presetData.accents[0]` is `undefined`
at four sites (`design.ts:46-56, 145, 155-156, 169`) — so `designAccentPasses(undefined, …)`
throws and the accent id silently becomes `""`. This is a hard runtime break of the
demo pipeline, not a cosmetic drift, and it is why the third merge cannot be gated
on typecheck alone.

Fix: make the port scheme-aware — resolve a scheme (the preset's `defaultScheme`
unless chosen), read that tone's `palette` and `accents`, check the prospect's brand
accent against the resolved tone's palette, and emit `theme.scheme` into the generated
design block so the delivered config states its tone explicitly. Contained to
`design.ts`; `color.ts` gains only the doc correction.

The triple-implementation seam — `contrast.mjs` (canon), `check-contrast.mjs`, and
`color.ts`'s port — **stays flagged and is not unified here**, per the brief.

## The five rulings

**1. `color-scheme` on delivered builds — its own commit.**
design-polish deliberately excluded it, and said so in `lib/design.ts`:

> `color-scheme` is declared here and deliberately *not* in the single `:root` block a
> delivered site gets. … Adding it to the delivered block would change how the five
> existing customizer clients and the three delivered demos actually render, and
> byte-identical delivered output is a standing acceptance on this work. It belongs
> there too; that is a one-line change and a deliberate decision to make, not a side
> effect of this one.

Ruling 1 *is* that decision. Implementation: one line in `designTokens()` emitting
`color-scheme: ${theme.scheme}`, plus a rewrite of that comment to record the decision
rather than contradict it. Isolated commit, before/after screenshots of one forge-dark
and one heritage-light page in the PR.

**2. Parity's `packages/copy` one-sentence edit** (`107a7bb`, one-town service area not
naming the town twice): accepted as shipped, no action.

**3. Slug-collision interim.** `findLeadRow()` returns null on a miss and
`ingest/index.ts:110` records the neutral line `lead row: none found in data/*.csv`
among ~20 other step lines — that is the silent degradation the ruling names. Fix:
raise it to a loud `WARNING` carrying its consequence, surfaced in the run summary
(`printSummary`) rather than only in the step log, following the existing
`warning: schema drift —` convention in `cli.ts:132`. placeId-first matching is
explicitly deferred to discovery's CSV.

**4. `deploy-mockups.mjs`:** `listSites()` returns every directory under `dist/`, so
lead-flow's `zz-fixture-phone-optional` build would be published. Add a `zz-` exclusion
with a printed line naming what was skipped (a silent filter is the same class of
problem as ruling 3).

**5. `check-contact-links --all` on spread-based design configs.** Parity already ships
`scripts/lib/base-slug.mjs`, which follows a config's `...spread` to the client that
declares the `business` block, and already wires it into `check-contact-links.mjs`.
The named failure looks **already fixed** by parity. To be verified by running the gate
on the merged tree; if it still fails, fix under ~20 lines, else file as a named
follow-up. Reported either way rather than assumed.

## Gates and acceptance

Full suite after each of the three merges, on the merged state:
`typecheck`, `build:all`, `check:markers`, `check:fabrication`, `check:contrast`
(incl. `--matrix`), `check:overflow`, `check:contact-links --all`, `check:form-fields`,
`check:switching`, `check:parity`. Plus one regenerated pipeline prospect through
`packages/prospect` passing all gates. No deploys (ruling 2 of the parity stream, and
nothing outward-facing from an integration branch).

`check:parity` is **comparative, not a stored-expectations file**: it diffs a baseline
`dist/` against a candidate and gates delivered pages on `html`, `root`, `head`,
`content`. `color-scheme` lands in the `root` region of every delivered design page, so
the ruling-1 commit necessarily moves bytes the gate protects. Handling this is
Decision Brief item 1.

## Decision Brief (draft — carried into the PR)

1. **How `check:parity` absorbs the `color-scheme` bytes.** The acceptance says gate
   expectations update ONLY for these bytes. Recommendation: teach the gate a narrow,
   named allowance — a delivered `root` region may differ **iff** the sole delta is the
   addition of a `color-scheme: <resolved scheme>;` declaration; any other `root` drift
   still fails. Rejected alternative: regenerating the baseline wholesale, which would
   also absorb any unrelated drift landing in the same build and blind the gate for
   good.
2. **Scope of `color-scheme`.** Emitted on design-family pages via `DesignLayout`.
   `/about`, `/services` and `/contact` still render through `BaseLayout` on the legacy
   two-colour model and have no resolved scheme, so nothing is emitted there.
   Recommendation: confirm design pages only; a site whose home page is dark and whose
   contact page has no declaration is a seam worth naming now.
3. **`kh-machine-works.config.ts`.** Parity rewrites it to `from-copy`; lead-flow adds a
   per-client form-field block. Recommendation: parity's rewrite as base, lead-flow's
   block re-applied on top, with the built page checked against `check:form-fields`
   rather than assumed.
4. **The triple-implementation seam** stays flagged; unification is a separate
   follow-up, per the brief. Named in the PR so it is not lost.
5. **Which prospect is regenerated** for the acceptance run — see the question below.

## Open question blocking nothing but the acceptance run

The acceptance calls for "one regenerated pipeline prospect passing all gates". The
pipeline's inputs are real businesses from `data/leads-machine.csv`. Standing guidance
is that non-default config is proven on a throwaway `zz-fixture-*` and never on a
pitchable demo — but a `zz-` fixture will not exercise the ingest→copy→design path this
integration actually changed, and ruling 4 now excludes `zz-*` from publishing. A local
build of a real prospect deploys nothing. Proposed: regenerate `kh-machine-works`
(already a hand-authored client, so no new third-party ingest), build only, no deploy.
Confirm or name a different prospect.

## Not doing

- No merge of this PR (integrator rule).
- No deploys, no Worker changes beyond lead-flow's own, no `.env` writes.
- No unification of the three contrast implementations.
- No placeId-first lead matching.
