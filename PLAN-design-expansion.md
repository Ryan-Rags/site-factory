# PLAN-design-expansion

**Stream:** `feat/design-expansion`
**Base:** `main@6d56d02` — "Fix/launch blockers (#38)", the merged launch-blockers work.
**Worktree:** `D:/sf-design-expansion`. **Claim:** branch pushed 2026-08-13.
**Lane:** **held, by construction.** Item 1 edits
`packages/template/src/types/design.ts`, which green-lane condition 2 names
explicitly. No self-merge is available to this stream and none is sought.

---

## Read this first: the item list is reconstructed, not recovered

The task said "replan all eight items." **No `PLAN-design-expansion.md` exists**
— not on any of the 29 branches, not in any worktree on disk, not in the
scratchpad, not in git history. The word `calm` appears exactly once in the
repo, in `packages/prospect/src/niches.ts:96`, as prose in a rationale string.

The eight items below are therefore **reconstructed from the state of the
merged base**, not restored from the original plan. They are the eight things
the base actually demands of a design-expansion stream, and each is grounded in
a file and a measurement. But the mapping to the original eight is unverified.
**Brief 1 asks Ryan to correct the list before any code is written.** The items
are deliberately written to be individually replaceable.

What *is* recovered rather than guessed: `calm` is a **new, fourth family**.
`DESIGN_FAMILIES` at the base is `['forge', 'precision', 'heritage']`
(`src/types/design.ts:462`), and `check:contrast` prints `3 presets × 2 schemes`
on every build. There is no calm to expand; there is a calm to add.

---

## §0 — Calm's reveal contract

Written here, in full, **before** item 3 parameterizes the gate — per the
ruling. The gate is to be shaped by this contract; this contract is not to be
back-derived from whatever the gate turns out to tolerate.

### Why the contract has to exist before the gate moves

Today the reveal is family-agnostic and its timing is a literal in two places
that do not know about each other:

- `src/styles/design.css:1554` — `opacity`/`transform` over **620ms**, with
  `transition-delay: var(--d-reveal-delay, 0ms)`, staggered to a **160ms**
  ceiling.
- `scripts/check-reveal.mjs:~190` — an **800ms** settle before sampling,
  commented as *"derived, not guessed: `design.css` transitions opacity over
  620ms with a `--d-reveal-delay` of up to 160ms, so 800ms is the point after
  which nothing can still be in flight."*

That 800ms is correct **only for a family whose reveal is 620+160**. A fourth
family with a slower reveal makes the gate sample mid-fade and report settled
elements as regressions — the exact failure its own comment records having
already happened once ("thirteen elements falling back to opacity 0.97 — every
one of them simply still mid-fade"). A gate that reports a transition in
progress as a regression is worse than no gate.

So the contract is a **declaration each family owes**, and the gate reads it.

### The contract calm declares

Calm is the clinical/wellness family — dental, medical, physio, chiro. Its
motion is slower and shorter-travelled than forge's, because the register is
reassurance rather than force:

| Property | forge / precision / heritage (today) | **calm** |
| --- | --- | --- |
| `--d-reveal-duration` | 620ms | **900ms** |
| `--d-reveal-delay` ceiling | 160ms | **240ms** |
| `--d-reveal-travel` | `translateY(1rem)` | **`translateY(0.5rem)`** |
| easing | `cubic-bezier(0.22, 0.61, 0.36, 1)` | **`cubic-bezier(0.33, 1, 0.68, 1)`** |
| observer `rootMargin` | `0px 0px -12% 0px` | **unchanged** |
| observer `threshold` | `0.05` | **unchanged** |
| derived settle | 800ms | **1200ms** (900 + 240, rounded up past the last frame) |

**The three invariants are family-independent and calm does not get to weaken
any of them.** They are the reason the decoration is permitted at all:

1. **Fires once.** Scroll down, up, down: nothing loses `.is-revealed`, no
   revealed element's opacity drops below 1 again.
2. **Nothing inside the first screen is pre-hidden at `DOMContentLoaded`.**
   `data-reveal-ready` is still set *inside the observer's first callback*, so
   by the time anything can be hidden everything visible is already revealed.
   A slower transition does not license a blank first screen — it makes one
   worse. This is the ruling of 2026-08-13 (PR #32) and it is not reopened.
3. **Reduced motion is the whole page, immediately.** Opacity 1, no transform,
   no transition, counters painted at final values.

A family that declares a duration but leaves an invariant unmet fails the gate.
The contract governs *timing*, never *whether content arrives*.

### How it is declared

The three timings become custom properties on the family's token block, with
the existing values written explicitly for the three current families rather
than left as CSS defaults — so no family relies on a literal that lives in a
selector it does not own, and the gate has one place to read.

Machine-readable, because the gate is Node and cannot parse CSS: a
`reveal` block per preset in `src/design/presets.json`, which
`check-contrast.mjs` already reads and which item 3's gate will read for its
settle window. `src/design/presets.ts` gains the type. One source, two
consumers, no drift.

---

## The eight items

### 1. `calm` joins `DesignFamily`
`src/types/design.ts` — `DESIGN_FAMILIES` becomes four. `src/design/presets.json`
gains a `calm` preset: light and dark schemes, seven accents each, the `reveal`
block from §0. `design.css` gains a `[data-theme='calm']` cosmetic block
alongside the three that exist at `:1365`, `:1423` and the heritage block.
**Type-level, so this stream is held-lane from its first commit.**

### 2. Calm's palette clears AA on every cell it creates
`check:contrast` goes from `3 presets × 2 schemes, 42 palettes, 112 combinations`
to `4 × 2`, and the 764 passing checks grow with it. Every new cell clears WCAG
AA. Per the standing rule in `check-contrast.mjs:333` — *fix the palette, do not
lower the threshold*. Clinical palettes are the ones that tempt pastel, and
pastel is what fails AA; the niches table already records that trap at
`niches.ts` for the pet-grooming row.

### 3. `check-reveal.mjs` reads the contract instead of a constant
The 800ms literal is replaced by a settle window **derived per family** from the
`reveal` block §0 defines. The gate resolves the served build's family (it
already resolves the served *slug* from the manifest, at `:~130`) and picks that
family's window. **A family that declares no `reveal` block fails the gate
rather than silently inheriting 800ms** — an unparameterized gate that quietly
defaults is how this goes blind, and the base already carries a ruling that a
waiver outliving its issue is how a suite goes quietly blind (PR #22).
**Order is fixed: §0 lands first, then this.**

### 4. Failure demonstrated before the fix
`CLAUDE.md`: *a new gate lands with its failure demonstrated first, then the
fix.* This gate is not new but its contract is, so the same rule applies —
calm's 900ms reveal is shown making the **unmodified** 800ms gate report
mid-fade elements as regressions, that transcript is captured under
`docs/evidence/`, and only then does item 3 land. Without this the
parameterization is a change nobody can show was necessary.

### 5. `niches.ts` points the clinical row at calm
`packages/prospect/src/niches.ts:90-96` — the `dental / dentist / orthodont /
medical / clinic / physio / chiro` row moves `precision` → `calm`. That file's
own header records that this column was **already wrong once**, mapping trades
to a different family's descriptions, and that the template's family
descriptions are the authority. Adding a family the template describes as
clinical and leaving the clinical row on `precision` would reintroduce exactly
that defect. `heritage`'s deliberate absence from the table is untouched.

### 6. The customizer and the switching gate carry four
The preset list the customizer offers, and `check:switching`, both go to four
families × 2 schemes. `check-switching.mjs` landed in PR #38 and is 130 lines
old; this is the first time it meets a family it was not written against.

### 7. A fixture proves calm end-to-end; no shipped client moves
`zz-fixture-calm`, built and gated like any client. **No existing client's
`theme.preset` changes** — per the standing rule that non-default config is
proved on a throwaway fixture, never on a pitchable demo. Item 5 changes what
*future generated* demos get; it does not restyle a demo already sent.

### 8. The eight delivered clients stay byte-identical
`check:delivered-parity` proves the expansion is additive. `CLAUDE.md`:
*existing clients render byte-identical unless the task says otherwise; any
drift is a defect in this work.* Adding a fourth `[data-theme]` block must not
perturb the three that exist — and the base's parity script now carries two
named allowances from PR #38, so any drift here has to be distinguished from
those rather than absorbed by them.

---

## Gates

Full suite on the merged state, per policy: `pnpm -r build` → `build:all`
(8/8 + the calm fixture), `check:contrast`, `check:reveal` (per-family),
`check:switching`, `check:delivered-parity`, `check:links`, `check:overflow`,
`check:textfit`, `check:metadata`, `check:schema`, `check:csp-runtime`.

Baseline recorded at `6d56d02` before any edit: **8/8 clients built and
checked, 109 internal link/nav checks passing, 764 contrast checks passing,
`3 presets × 2 schemes`.**

Two browser gates (`check:reveal`, `check:overflow`) need a served build on a
known port. Issue #37 records `check:overflow` having no served-slug guard and a
third recorded port collision; `check:reveal` **does** have the guard. This
stream sets `PREVIEW_URL` explicitly and confirms the served slug before
trusting any run. It does not fix #37 — wrong scope.

---

## Decision Brief

1. **The item list is reconstructed. Confirm or replace it.** No plan file
   survives anywhere; §"Read this first" documents the search. Items are written
   to be individually swappable. **Recommendation: confirm items 1, 3, 4, 7 and
   8 — they are forced by the base regardless of what the original eight said —
   and correct 2, 5 and 6 if the original scoped them differently.**

2. **Calm's numbers are a proposal, not a measurement.** 900ms / 240ms /
   0.5rem is a defensible clinical register, but no one has watched it. The
   *contract mechanism* is what item 3 depends on; the specific numbers can move
   without disturbing it. **Recommendation: accept the mechanism now, and treat
   the three numbers as adjustable until seen on the fixture — a change to them
   after that is a one-line edit to `presets.json`, not a replan.**

3. **Does calm ship a `[data-theme='calm']` cosmetic block, or only a palette?**
   The three current families each carry a distinct block — forge's badges,
   precision's card rules, heritage's stat borders. A palette-only family would
   be the first that is only colour. **Recommendation: ship the block. A family
   that is only a palette is an accent set, and the customizer already has
   seven of those per scheme.**

4. **Item 5 changes what future generated demos look like.** Any prospect
   generated after this merges gets calm where they would have got precision.
   Nothing already sent changes. **Recommendation: land it — the niches header
   makes the template's descriptions authoritative and this follows them — but
   Ryan should know the pitch deck's clinical example will look different after
   this than before it.**

5. **Scope check: `worker/`, `worker-demo/`, `scripts/deploy/**` and every
   `clients/**` config are out of scope and untouched.** No deploy, no outward
   -facing change, no new dependency. Stated so the held-lane review has it in
   one line.

---

**STOP.** Awaiting approval on the Brief — Brief 1 in particular — before any
code is written.
