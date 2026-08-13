# The sticky call bar at 320px — the wrap, the overflow it caused, and the rule

Failure-first evidence for `feat/design-expansion` item 7(b): extending
`check-textfit.mjs` from "the CTA is not clipped" to "the CTA is one line", the
pre-existing defect that extension found, and **the regression the first fix
introduced**.

Recorded 2026-08-13 against the branch merged with `main@2121685`.

## 1. The original defect

`.d-callbar__label` carries the phone number in the bar fixed to the bottom of a
phone viewport. On `main` it is `font-size: 1.0625rem` with wrapping allowed, and
at 320px it breaks the number across two lines:

> Call (555) 010-
> 0177

A number split over a line break is not a number. It was **unclipped**, which is
why the older assertion passed it, and it is **pre-existing on `main`** — the two
new families are only how it was found. The full sweep counted 44 such cells
(320px in all five families, 360px in several, 1024px in two) plus 2 cells where
`.d-header__cta` wrapped in heritage's widest face.

## 2. The first fix, and the regression it caused

The fix was `white-space: nowrap` plus `font-size: clamp(0.875rem, 3.9vw,
1.0625rem)`. It made every label one line — and it made `check:overflow` red:

```
FAIL  320px  /          scrollWidth=320 (viewport 320)
        <a class="d-callbar__secondary"> extends to 351px
FAIL  320px  /services  … /about … /contact … /404

5 route/width combination(s) overflow horizontally.
```

**`main` is green on the same gate**, so this was a regression introduced by this
stream, not a pre-existing condition. It was found only because `check:overflow`
was re-run on the merged state; the textfit gate that motivated the fix is blind
to it, because a button pushed off the right edge is still one line.

Measured on `ks-welding` at 320px, with the label held to one line:

| part | width | note |
| --- | --- | --- |
| bar padding | 24px | 12px each side |
| call button (min-content) | 210px | 32 padding + 20 glyph + 10 gap + **148 number** |
| gap | 8px | |
| secondary "Photo quote" | 121px | 32 padding + 89 text, `flex: 0 0 auto` — cannot shrink |
| **total** | **363px** | in a **320px** bar → **43px over** |

`scrollWidth` stayed at 320, so the page did not scroll: the secondary CTA was
simply **clipped off the right edge**. That is worse than the wrap it replaced.

**Type size is not the lever.** Shrinking the number until the row fits needs
~12px, below the size this design is willing to set a phone number at. The
client's copy is not the lever either — `callLabel` and the secondary's text come
from the client's own config, and the stylesheet does not get to abbreviate them.

## 3. The rule that fixes it

Below 360px the chrome gives up room instead:

```css
@media (max-width: 359px) {
  .d-callbar { gap: 0.375rem; padding-left: 0.5rem; padding-right: 0.5rem; }
  .d-callbar__icon { display: none; }
  .d-callbar__call,
  .d-callbar__secondary { padding-left: 0.625rem; padding-right: 0.625rem; }
}
```

The glyph goes — the button still reads "Call (201) 385-8848", so what is lost is
decoration, not information — and the padding tightens.

| | before the rule | after the rule |
| --- | --- | --- |
| available (320 − bar padding) | 296px | 304px |
| call button min-content | 210px | 168px |
| gap | 8px | 6px |
| secondary | 121px | 109px |
| **content total** | **339px** | **283px** |
| **margin** | **−43px (overflow)** | **+21px clear** |

The arithmetic is validated against the observed failure: the predicted 43px
overflow matches the measured right edge exactly (351px against a 308px inner
edge).

The rule stops at 359px, so every wider viewport keeps the glyph and the shipped
padding untouched. **It does change how the bar looks on every client at the
narrowest phone widths**, which is why it is a Brief item and not only a comment.

## 4. The pixels, at 320px

One client (`zz-fixture-motion`, the stream's fixture — never a pitchable demo),
served on a known port, served slug confirmed and cross-checked against
`data-motion-preset` on `<html>`, which exists only on this branch
(known-issues #6).

`before` restores **all four** rule-sets this branch touched on the bar — the
label's two properties *and* the narrow-width rule. Reverting only the label
would flatter the fix: with the glyph gone and the padding tightened, even 17px
fits on one line, so a two-property override no longer reproduces `main`.

| state | computed size | white-space | lines | label height | bar height |
| --- | --- | --- | --- | --- | --- |
| **before** (`main`) | **17px** | `normal` | **2** | 39px | 100px |
| **after** (this branch) | **14px** | `nowrap` | **1** | 16px | 77px |

![callbar at 320px, before — the number wraps](callbar-320-before.png)
![callbar at 320px, after — the number holds one line, no glyph](callbar-320-after.png)

The after state in all five families — 14px, one line, secondary's right edge at
312px against the bar's 312px inner edge in every one:

| family | body face resolved | size | lines | secondary right edge |
| --- | --- | --- | --- | --- |
| forge | Arial Narrow | 14px | 1 | 312px |
| precision | ui-sans-serif | 14px | 1 | 312px |
| heritage | Georgia | 14px | 1 | 312px |
| meridian | Segoe UI | 14px | 1 | 312px |
| apex | Helvetica Neue | 14px | 1 | 312px |

![forge](callbar-320-after-forge.png)
![precision](callbar-320-after-precision.png)
![heritage](callbar-320-after-heritage.png)
![meridian](callbar-320-after-meridian.png)
![apex](callbar-320-after-apex.png)

## 5. Why 14px, stated for the ruling

- **The ceiling is the size that shipped.** `3.9vw` reaches `1.0625rem` at 436px,
  so at 768px and up nothing changes at all.
- **The floor binds only below 359px.** At 320px, `3.9vw` is 12.48px, so the
  clamp resolves to the `0.875rem` floor: **14px**. That is the number being
  ruled on, and it is what the screenshots above show.
- **14px alone does not make 320px fit** — the narrow-width rule does. An earlier
  draft of the CSS comment claimed the floor was "what fits the longest realistic
  label at 320px beside the icon, the gap and the secondary button". That was
  false, `check:overflow` disproved it, and the comment has been corrected in
  place.

## 6. Ordering — stated plainly

The failure was demonstrated first: the retargeted assertion was run against the
unfixed build and reported the counts in §1 before any CSS changed. But the two
landed in the **opposite order as commits** — the CSS fix in `53adb00`, the gate
edit in `8de7b4e` — so the red state cannot be reproduced by checking out an
intermediate commit on this branch. That is a deviation from the `CLAUDE.md` rule
that a new gate lands with its failure demonstrated first, and it is carried as a
Brief item rather than quietly left in the history.

§2 is the compensating record: a red gate, reproduced from the committed gate on
the merged state, with `main` green beside it.
