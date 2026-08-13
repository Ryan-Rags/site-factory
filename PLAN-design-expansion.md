# PLAN-design-expansion

**Stream:** `feat/design-expansion`
**Base:** `main@6d56d02` → to be re-merged from `main@b0b2660` ("docs: the post-YES
client intake (#39)") before the first commit.
**Worktree:** `D:/sf-design-expansion`. **Claim:** branch pushed 2026-08-13.
**Lane:** **held, by construction.** Item 1 edits
`packages/template/src/types/design.ts`, named explicitly by green-lane
condition 2. No self-merge is available to this stream and none is sought.

**This file replaces the reconstructed list.** Brief 1 is ruled: `calm` is not a
family, it is one of three motion presets. Everything below is the ruled scope,
re-derived against the code rather than restated.

---

## What I verified before planning

Five mechanisms decide how most of this stream has to be built. Each was read
out of the base, not assumed, and each changes an item below.

**1. `design.css` is inlined into every page — but the parity gate does not
compare it.** `astro.config.mjs:22` sets `build: { inlineStylesheets: 'always' }`,
so all 2,126 lines of `design.css` land in the `<head>` of all eight delivered
clients on every route. `check-delivered-parity.mjs` nonetheless survives that:
`regions()` (`:351`) replaces every `<style>` in the `head` region with
`<style/>`, and the `root` region is only the single attribute-less `:root {…}`
block from `designTokens()`. So **growing `design.css` does not break parity** —
which is the only reason two new families and a motion axis are additive at all.
It does grow the delivered page weight, which is item 8's byte-delta report.

**2. The reveal stagger is inline style in the body, so `calm` cannot change
it.** Eight components emit `style="--d-reveal-delay: ${i * 90}ms"` directly on
`[data-reveal]` elements (`DesignServices.astro:42`, `Reviews.astro:128`,
`Stats.astro:56`, `Faq.astro:47`, `Gallery.astro:30`, `DesignGalleryPage.astro:44`,
`DesignAbout.astro:59`, `ServiceArea.astro:67`). Those are in the compared
`content` region. **Calm's 240ms ceiling therefore has to be a multiplier
applied in CSS** — `transition-delay: calc(var(--d-reveal-delay, 0ms) *
var(--d-motion-stagger, 1))` — never an edit to those literals. With the
multiplier defaulting to `1`, lively is byte-identical and behaviour-identical.

**3. The byte-identity mechanism is attribute absence, and it has a specific
home.** `check-delivered-parity.mjs:406` gates `['html', 'root', 'head',
'content']` on delivered pages — `html` included. `DesignLayout.astro:130`
already stamps `data-scheme` on pitch builds only, for exactly this reason.
**`data-motion` must follow `data-scheme`, not `data-theme`**: pitch-only, absent
on delivered. Absent attribute → CSS var fallbacks → today's 620/160/1rem.

**4. A parity exemption is lying in wait to absorb this stream's script
changes.** `onlyRevealScriptChanged()` (`check-delivered-parity.mjs:150`) passes
any delta confined to the `data-reveal-ready` script. `still` genuinely needs
script changes — CSS can stop a transition but cannot stop the carousel's
`setInterval` or paint a counter at its final value — so that exemption would
wave the motion work straight through on the three delivered design clients.
That is precisely the failure the file's own header warns about. Item 3 closes
it before touching `Reveal.astro`.

**5. `--d-accent-strong` gets *paler* on dark, not richer.** `accentTokens()`
(`lib/design.ts:796`) mixes the accent 80% toward `ink` on dark palettes and
toward `#000` on light ones — deliberately, because mixing toward black on a
carbon base lands at 3.5:1. So the accent-strong route in item 7 works on light
schemes and inverts on dark. The washed pink has a different cause, below.

---

## §0 — The reveal contract, re-keyed per motion preset

Your §0 mechanism, approved and re-keyed. Written here in full **before** the
item that parameterizes the gate: the gate is shaped by the contract, not the
contract back-derived from what the gate tolerates.

Today the timing is a literal in two places that do not know about each other —
`design.css:1554` (620ms, `--d-reveal-delay` to a 160ms ceiling) and
`check-reveal.mjs:199` (an 800ms settle, commented as derived from those two
numbers). That 800ms is correct only for a 620+160 reveal. Calm's 900ms makes
the unmodified gate sample mid-fade and report settled elements as regressions
— the exact failure its own comment records having already happened once.

### The three contracts

Declared as a **top-level `motion` array in `presets.json`** — top-level, not
nested inside a preset, because that is what orthogonality looks like in the
data as well as in the selectors.

| | **still** | **calm** | **lively** (default) |
| --- | --- | --- | --- |
| `reveal.duration` | `0ms` | **900ms** | **620ms** |
| `reveal.stagger` (× the inline delay) | `0` | **1.5** (→ 240ms ceiling) | **1** (→ 160ms) |
| `reveal.travel` | `0` | **0.5rem** | **1rem** |
| `reveal.easing` | `linear` | `cubic-bezier(0.33, 1, 0.68, 1)` | `cubic-bezier(0.22, 0.61, 0.36, 1)` |
| `reveal.settle` (what the gate waits) | **0ms** | **1200ms** | **800ms** |
| `counters` | `paint` | `animate` | `animate` |
| `carousel` | `off` | `auto` | `auto` |
| observer `rootMargin` / `threshold` | unchanged | unchanged | unchanged |

`lively` restates today's exact numbers rather than leaving them as CSS
defaults, so no preset relies on a literal living in a selector it does not own.
`still` is degenerate by design: everything at final state immediately, no
transitions, counters painted, carousel still. Calm's four numbers are the
**accepted starting proposal**, adjustable on the fixture — a change to them
afterwards is a one-line `presets.json` edit, not a replan.

### The three invariants, preset-independent

None of the three presets may weaken any of these. They are why the decoration
is permitted at all.

1. **Fires once.** Down, up, down: nothing loses `.is-revealed`, no revealed
   element's opacity drops below 1 again.
2. **Nothing inside the first screen is pre-hidden at `DOMContentLoaded`.**
   `data-reveal-ready` stays set *inside the observer's first callback*. A
   slower preset does not license a blank first screen — it makes one worse.
   Ruling of 2026-08-13 (PR #32); not reopened.
3. **`prefers-reduced-motion` is the whole page, immediately** — and now
   collapses to `still` explicitly rather than by a parallel media query.

A preset that declares a duration but leaves an invariant unmet fails the gate.
The contract governs *timing*, never *whether content arrives*.

**A motion preset with no `reveal` block fails the gate rather than inheriting
800ms.** A gate that quietly defaults is how a suite goes blind — the base
already carries that ruling from PR #22.

---

## The items

### 1. Two new families; `DESIGN_FAMILIES` → five

`src/types/design.ts:44,462` — `DesignFamily` and `DESIGN_FAMILIES` gain
`meridian` and `apex`. `src/design/presets.ts:33` — `PresetId` follows.
`packages/prospect/src/niches.ts` imports `ThemePreset`, so the union crosses a
package boundary; both build.

**meridian** — warm off-white daylight base, sky / leaf / clay accents, humanist
sans, dusk-blue dark scheme. `defaultScheme: light`, `radius: soft`, `density:
comfortable`, hero order leading `full-bleed` (photography-forward). For
roofing, landscaping and exterior trades.

**apex** — near-black / near-white extremes, geometric grotesk, hairline rules,
one electric accent. `defaultScheme: dark`, `radius: sharp`, `density: compact`.
Auto and tech-adjacent.

Each ships **light + dark and its own `[data-theme]` cosmetic block** alongside
the three at `design.css:1365` (forge badges), `:1423` (precision card rules)
and `:1484` (heritage stat borders). Brief-3 reasoning stands: a palette-only
family is an accent set, and the customizer already offers seven of those.

**Type-level, so this stream is held-lane from its first commit.**

### 2. Depth across all five families

8 accents per family per scheme (the existing three go 7 → 8); +1 font pairing
per family — forge 3→4, precision 2→3, heritage 3→4, meridian and apex ship 3
each. Every addition passes **contrast AND `check:textfit`**: a pairing that
truncates or wraps a real business name fails, full stop, and the fixtures
`zz-fixture-long-name` and `ks-welding` are the names it must survive.

`check:contrast` goes from `3 presets × 2 schemes, 42 palettes, 112
combinations` to `5 × 2, 80 palettes, 272 combinations`; the 764 passing checks
grow to roughly 1,440. Per the standing rule at `check-contrast.mjs:333` —
**fix the palette, do not lower the threshold.**

Note for the two new families: `pairsFor()` requires the accent itself to clear
**4.5:1 against both `base` and `surface`**, because the accent is body-sized
text in eyebrows, stat figures and card links. On apex's near-black that is the
binding constraint on how saturated an "electric" accent can be, and it is the
same constraint that produced item 7's washed pink.

### 3. `check-reveal.mjs` reads the contract; the exemption is closed first

Three changes, in this order:

1. **Close the absorbing exemption.** Before `Reveal.astro` is touched, narrow
   `onlyRevealScriptChanged()` to the single migration it was written for, so
   the motion changes cannot be waved through on the three delivered design
   clients. They then need their own named, announced allowance — or no delta
   at all.
2. **Parameterize the gate.** The 800ms literal is replaced by the settle window
   derived from the served page's `data-motion` (absent → lively). The gate
   already resolves the served slug from the manifest; it gains the attribute
   read next to it. **No contract → fail.**
3. **Run as a SUM, never a product.** `cells + 3 × a representative route set` —
   the motion axis costs `3 × 6 routes = 18` page loads, not `3 × 272 cells`.

**Hard assertion (orthogonality, proven not asserted):** no emitted selector may
combine `data-motion` with `data-theme`, `data-scheme`, `data-accent` or
`data-font`. Checked statically in both directions — over `themeMatrixCss()`
output (no block's selector may contain `data-motion`) and over `design.css`
(no `[data-motion=…]` rule's selector may contain any of the other four). Cheap,
exact, and it is what licenses the SUM.

### 4. Failure demonstrated first

Per `CLAUDE.md`. Calm's 900ms reveal is shown making the **unmodified** 800ms
gate report mid-fade elements as regressions; transcript captured under
`docs/evidence/`; only then does item 3 land. Same discipline for item 7's
single-line assertion: the header CTA wrap is shown failing the new assertion on
the current build at the width that wraps, before the fix.

### 5. The motion axis

`data-motion ∈ {still, calm, lively}` on `<html>`, **pitch builds only** (finding
3). Implemented as four custom properties consumed by the reveal rules with
fallbacks equal to today's literals:

```
transition: opacity var(--d-motion-duration, 620ms) var(--d-motion-ease, …),
            transform var(--d-motion-duration, 620ms) var(--d-motion-ease, …);
transition-delay: calc(var(--d-reveal-delay, 0ms) * var(--d-motion-stagger, 1));
transform: translateY(var(--d-motion-travel, 1rem));
```

Absent attribute → fallbacks → today's exact behaviour → the eight delivered
clients unchanged. That is the byte-identity mechanism, and item 8 is its proof.

`Reveal.astro` reads the attribute for the two things CSS cannot do: under
`still`, counters paint at final values and the carousel timer never starts.
`prefers-reduced-motion` collapses to `still` — one code path, not two.

**The panel detects reduced motion and says so honestly**, in the fieldset:
"Your device is set to reduce motion, so this preview is showing *Still*." The
controls **stay enabled** — the prospect's own visitors still get the pick, and
disabling them would hide a choice that is being made on their behalf.

### 6. Customizer and `check:switching` to five families

A fifth `<fieldset>`, built like the four that exist — real `<input
type="radio">` in a `<legend>`-labelled group, so arrow-key navigation and
screen-reader announcement come from the platform. `motion` joins the URL
parameter set, the `sf-theme` localStorage payload and the `noFlash` resolver in
`DesignLayout.astro:110`, where it resolves against a flat id list rather than a
per-preset one — orthogonality again.

**#38's dismissal, URL and persistence behaviour survives untouched**, and is
asserted rather than assumed: dismissal still leaves the URL alone (the URL is
the artefact the prospect sends back), a shared link still round-trips, and a
stale or hand-edited value still falls back rather than stamping a cell with no
CSS behind it.

`check:switching` goes 112 → 272 cells. It is 130 lines old and this is the
first time it meets families it was not written against.

### 7. Dark-scheme accents, and the header CTA

**(a) The washed pink.** `heritage/dark/oxblood` is `#e5808f` — a pale pink,
because `accent on base` and `accent on surface` at 4.5:1 force the accent's
luminance up on a `#17130e` base, and the chroma was given up to buy it. The
accent-strong route does not help here (finding 5: it mixes toward cream on
dark). Two honest routes remain, in order of preference:

1. **Re-pick at the same luminance, maximizing chroma.** A crimson at oxblood's
   required luminance reads far less washed than `#e5808f` does; the pink is a
   picking artefact, not a mathematical necessity. Measured, not eyeballed.
2. If (1) leaves it short, a `--d-accent-fill` token for the button face, with
   the legitimate 3:1 large-text and non-text paths of 1.4.11 — **declared per
   family, gated like everything else**, never a threshold lowered.

AA is kept throughout. Before/after screenshots for heritage, both schemes,
under `docs/evidence/`.

**(b) The header CTA must be single-line at every width in every cell.**
`check-textfit.mjs:355` currently asserts buttons are *unclipped*; a wrapped
"GET IN TOUCH" is unclipped and passes. Extend the assertion from unclipped to
**`lines === 1`** for `.d-header__cta` (`DesignHeader.astro:63`),
`.d-callbar__call` and `.d-callbar__secondary` — the header and sticky CTAs
only, since body buttons may legitimately wrap. Failure demonstrated first, per
item 4.

Also: `check-textfit.mjs:465` hardcodes the widest-type cell as
`heritage/light/signwriter`. With two new families and five new pairings that
may no longer be the widest. It is **re-derived from `presets.json`**, not left
stale — a stale "widest" is a route sweep that proves nothing.

### 8. Compare page, cost, and byte-identity

**(a) One client, five iframes, URL params.** `make-compare.mjs:32` currently
points at `ks-welding-forge`, `-precision` and `-heritage` — three client
directories that are one real business spread three ways. It becomes **one
pitch client (`ks-welding`, `features.customizer: true`) loaded five times as
`./ks-welding/?theme=<family>`**. No new client directory is authored for a real
business, and the pattern is not extended by two.

The three existing `ks-welding-*` directories are delivered clients and are
**left exactly as they are** — deleting them would move shipped output. They
become redundant once compare uses parameters; Brief item 4.

**(b) Measure before capping — never silently.** `check:textfit` wall-clock is
measured at the expanded matrix **first**, and only then is a sweep shape
proposed in the PR. The arithmetic that motivates the measurement:

| gate | today | expanded | ratio |
| --- | --- | --- | --- |
| `check:contrast` palettes | 42 | 80 | 1.9× (pure Node arithmetic, no concern) |
| `check:switching` cells | 112 | 272 | 2.43× |
| `check:textfit` home sweep | 112 × 5 = 560 loads | 272 × 5 = 1,360 | 2.43× |
| `check:textfit` route sweep | 6 × 5 × 2 = 60 | 60 | flat |
| `check:reveal` (motion) | — | +18 | SUM, not product |

If material, the stratified sweep I will propose: **text metrics depend on font
pairing, density, radius and viewport — not on accent, which is a colour.**
Stratifying to `preset × scheme × font × one representative accent` gives 34
cells (170 loads) instead of 272 (1,360) — 8× — with the accent-invariance claim
defended by one recorded full-matrix run kept as evidence, not by assertion.
Reported in the PR with its numbers either way.

**(c) Byte-identity and the inlined-CSS delta.** All eight delivered clients
render byte-identical; lively-as-absent-attribute is the proof, and
`check:parity` is run against a baseline `dist/` built from `main@b0b2660`
before any edit. Reported alongside: gate runtimes, and the **inlined-CSS byte
delta** — every delivered page now carries five families' cosmetic blocks and
the motion rules inline, of which it uses one family and no motion. If that is
material, compact emission is *proposed*, not done: emitting only the shipped
family's block on a delivered build would change delivered bytes and is a
separate ruling. Brief item 5.

### 9. Fixture and niches

**`zz-fixture-motion`**, customizer on, built and gated like any client — where
all three motion presets and the reveal contracts are proved. `zz-` is excluded
from `CLIENT_SLUGS` in `build-all.mjs:52`, so it never reaches a deploy. **No
existing client's `theme.preset` or motion changes.**

**Niche row mapping** (`packages/prospect/src/niches.ts`). Only the `preset`
column and the affected `rationale` strings move; the `colors` column is left
alone — the file's own header records that correcting one axis is not a reason
to disturb the other.

| row (match terms) | today | proposed |
| --- | --- | --- |
| machine shop, machining, cnc, tool and die | forge | **forge** (unchanged) |
| weld, fabricat, metal, forge, iron, steel | forge | **forge** (unchanged) |
| auto, mechanic, tire, collision, body shop | forge | **apex** |
| plumb, hvac, heating, boiler, drain | precision | **precision** (unchanged) |
| electric, solar, wiring | precision | **precision** (unchanged) |
| roof, siding, contractor, construction, carpent, builder | precision | **meridian** |
| dental, dentist, orthodont, medical, clinic, physio, chiro | precision | **precision — DOES NOT MOVE** |
| landscap, lawn, garden, tree, nursery | precision | **meridian** |
| groom, pet, veterin, kennel | precision | **precision** (unchanged) |
| bakery, restaurant, cafe, catering, butcher, deli | precision | **precision** (unchanged) |

`heritage`'s deliberate absence from this table is untouched — it is chosen by
`legacySignal()` from sourced evidence, not guessed from a niche string.

**Parked, not planned: a clinical family (dental / medical).** It is a
reasonable future family, and the clinical row stays on `precision` until one
exists. Those niches are not in the discovery sweep yet, so nothing is waiting
on it.

---

## Gates

Full suite on the merged state, per policy — merge `main@b0b2660` into the
branch first and re-run everything there; green pre-merge does not count.

`pnpm -r build` → `build:all` (8/8 + `zz-fixture-motion`), `check:contrast`,
`check:reveal` (per motion preset), `check:switching`, `check:parity` (against a
`main@b0b2660` baseline `dist/`), `check:links`, `check:overflow`,
`check:textfit`, `check:metadata`, `check:schema`, `check:csp-runtime`.

Baseline to be recorded before any edit: 8/8 clients built and checked, 109
internal link/nav checks, 764 contrast checks, `3 presets × 2 schemes`, plus
wall-clock for `check:textfit` and `check:switching`.

Two browser gates need a served build on a known port. Issue #37 records
`check:overflow` having no served-slug guard and a third recorded port
collision; `check:reveal`, `check:switching` and `check:textfit` **do** have the
guard. This stream sets `PREVIEW_URL` explicitly and confirms the served slug
before trusting any run. It does not fix #37 — wrong scope.

Open issues stand at 8, under the ~15 cap.

---

## Decision Brief

1. **Apex: "one electric accent" vs. "8 accents per family per scheme."** Item 1
   and item 2 pull against each other here, and only here. **Recommendation:
   read it as character, not cardinality — apex ships 8 accents per scheme, all
   in the electric register (lime, cyan, magenta, signal orange…), with one of
   them as its shipped default.** A family with one accent would be the only one
   whose customizer accent group has nothing to switch between. Say so if you
   meant the literal reading; it is a small change now and a large one later.

2. **Calm's four numbers are a proposal, not a measurement.** 900ms / 1.5× /
   0.5rem / `cubic-bezier(0.33, 1, 0.68, 1)` is a defensible register but nobody
   has watched it. **Recommendation: accept the mechanism now; treat the numbers
   as adjustable on `zz-fixture-motion` — changing them afterwards is a one-line
   `presets.json` edit, not a replan.**

3. **The reveal-script parity exemption has to be closed, and closing it is a
   gate-script edit.** `onlyRevealScriptChanged()` would absorb this stream's
   `Reveal.astro` changes on the three delivered design clients. Editing a gate
   script is a held-lane trigger regardless, so it costs this stream nothing —
   but it narrows an allowance another stream authored. **Recommendation: narrow
   it to the migration it was written for and give the motion change its own
   named, announced allowance if it needs one.**

4. **The three `ks-welding-*` client directories become redundant.** Once
   compare uses URL parameters, they are one real business occupying three
   client slots for no remaining reason. They are delivered output, so this
   stream leaves them untouched. **Recommendation: leave them; I file a
   follow-up issue naming them as removable, and it is ruled separately.**

5. **The inlined-CSS delta is real and this stream deliberately does not fix
   it.** Every delivered page will carry five families' cosmetic blocks and the
   motion rules inline, using one family and no motion. **Recommendation: measure
   and report the delta in the PR; propose per-build family emission as its own
   ruling.** Doing it here would change delivered bytes and forfeit the
   byte-identity proof that item 8 exists to establish.

6. **Session/worktree rule, flagged rather than assumed.** `CLAUDE.md` says one
   session per worktree, ever. `D:/sf-design-expansion` is this stream's
   worktree, clean at my own prior plan commit with no foreign writes, and
   `feat/design-expansion` is already the pushed claim — so a fresh worktree
   would mean a second branch for one stream, which the duplicate-work rule
   forbids more strongly. **Recommendation: continue in this worktree.** Stated
   so the ruling is yours rather than mine by default.

7. **Scope check.** `worker/`, `worker-demo/`, `scripts/deploy/**` and every
   `clients/**` config for a delivered client are out of scope and untouched. No
   deploy, no Worker behaviour, no email path, no new dependency. Cross-boundary
   edits expected and declared: `packages/prospect/src/niches.ts` (item 9) and
   the gate scripts named in items 3, 7 and 8.

---

**STOP.** Awaiting approval — Brief 1 in particular, since it changes what apex
is — before any code is written.
