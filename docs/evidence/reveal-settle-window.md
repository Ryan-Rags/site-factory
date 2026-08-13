# The reveal gate's settle window — what was actually measured

Failure-first evidence for `feat/design-expansion` item 3.2 (parameterizing
`check-reveal.mjs`). Recorded 2026-08-13 against the merged branch, before any
gate edit.

**The plan's stated premise did not reproduce, and this file is the record of
that.** PLAN item 4 predicted that calm's 900ms reveal would make the unmodified
800ms gate "sample mid-fade and report settled elements as regressions." It does
not. The gate is far less sensitive to reveal duration than its own comment
claims, and that insensitivity is itself the finding.

## Method

One client, `ks-welding`, served from its own build on a known port with the
served slug confirmed before every run (`icons/ks-welding/` in the manifest
href). The only variable is the reveal timing in `design.css`; the gate script
was **not** modified in any run below.

```
SITE_CLIENT=ks-welding pnpm exec astro build
SITE_CLIENT=ks-welding pnpm exec astro preview --port 4321
SITE_CLIENT=ks-welding PREVIEW_URL=http://localhost:4321 node scripts/check-reveal.mjs
```

## Runs

| # | `design.css` reveal timing | unmodified gate | result |
| --- | --- | --- | --- |
| 1 | `620ms` / delay `× 1` (shipped) | 800ms settle | ✓ 382 checks passed, 1m14s |
| 2 | `900ms` / delay `× 1.5` (calm) | 800ms settle | ✓ **382 checks passed** |
| 3 | `8000ms` / delay `× 1.5` | 800ms settle | ✗ 155 occurrences of 382 checks |

Run 2 is the one the plan expected to fail. It passed.

Run 3's failure, verbatim:

```
  ✗ 320px /: a revealed [data-reveal] element fell back to opacity 0.996472 —
    it is being re-hidden behind the reader

1 distinct failure(s), 155 occurrence(s) of 382 checks:
    155 ×  a revealed [data-reveal] element fell back to opacity N —
           it is being re-hidden behind the reader
```

## Why run 2 passes — the mechanism

The 800ms literal is **not** what makes the gate correct for a 620+160ms reveal.
The double settle is, and by accident.

`check-reveal.mjs` reads opacity exactly once, at `afterUpDown` (`:216`), and
that read happens after *two* full `settle()` calls with a scroll-to-top between
them. An element is revealed for the first time during the **first** settle and
never re-hides — reveal is a one-way door, which is assertion 1 of the gate
itself. So by the time opacity is read, that element's transition has had:

```
800ms (first settle's final wait)
+ 150ms (the scroll-to-top pause)
+ steps × 40ms (the second settle's scroll)
+ 800ms (the second settle's final wait)
≈ 1750ms and up
```

Anything that finishes inside that window reads as opacity 1. Calm's worst case
is 900 + 240 = 1140ms, comfortably inside it. The gate would have absorbed the
entire motion axis without noticing.

Run 3 locates the far edge: 8000ms exceeds the window and the gate fires. The
ceiling is somewhere between 1.14s and 8s; it was not bisected, because the
number is an artefact rather than a contract and pinning it would give it a
standing it should not have.

## What this changes

Two things, and the second is the one that matters.

1. **Parameterizing the settle is still correct, for a corrected reason.** Not
   "calm breaks the gate" — it does not — but that the gate's tolerance of calm
   is accidental, resting on a double sweep nobody wrote for that purpose. A
   settle window derived from the served page's `data-motion` makes the
   correctness stated rather than incidental, and it lets `still` skip a wait it
   provably does not need.

2. **The gate cannot tell mid-fade from re-hiding, and says the wrong one.**
   Run 3's elements were at opacity 0.996 on the way *up*, mid-transition. The
   gate reported them as "being re-hidden behind the reader" — the exact
   misdiagnosis its own header records having already shipped once. Whatever the
   settle window is, an element below opacity 1 needs a second read before the
   gate is entitled to name the cause.

Neither is visible from the source. Both required the run.

---

## Addendum — the "no contract" and orthogonality assertions, demonstrated

Two of the three changes to `check-reveal.mjs` are assertions that must be
shown failing before they are worth anything.

**The orthogonality assertion.** One violating rule added to `design.css`:

```css
[data-theme='forge'][data-motion-preset='calm'] .d-hero { opacity: 0.99; }
```

Rebuilt, served, gate run:

```
✗ The motion axis is not orthogonal, so this gate cannot run as a SUM.
  1 selector(s) combine data-motion-preset with another axis:
    [data-theme=forge][data-motion-preset=calm] .d-hero   (also names data-theme)

  Either keep the axes separate, or change this gate to a product over the
  theme matrix and accept the cost. Do not delete the assertion.
```

Exit code 1, before any browser sweep runs. The probe was removed immediately;
the working tree carries no trace of it.

This is the assertion that licenses the motion sweep to be a SUM — three
presets over one representative route set, 15 page loads on this client —
rather than a product with the 272-cell theme matrix.

**Final shape of the gate on `ks-welding`:**

```
reveal: ks-welding at http://localhost:4321
  motion "lively", settle 800ms from the contract
  5 route(s) × 5 viewports, plus a reduced-motion pass
  ...
  swept 5 route(s) under motion "still" (settle 0ms)
  swept 5 route(s) under motion "calm" (settle 1200ms)
  swept 5 route(s) under motion "lively" (settle 800ms)

✓ 490 reveal checks passed — fires once, nothing pre-hidden, reduced motion whole.
```

382 checks in 1m14s before; 490 in 2m01s after. The motion axis costs ~46s and
15 page loads, which is the SUM the assertion bought.
