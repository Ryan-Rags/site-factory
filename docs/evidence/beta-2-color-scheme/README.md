# `color-scheme` on delivered builds — before/after

Evidence for the ruling that delivered builds declare their resolved scheme.
Captured from the built `dist/` of two delivered clients (`SITE_DELIVERED=1`),
served locally; no deploys were involved.

| tone | client | before | after |
| --- | --- | --- | --- |
| forge / dark | `ks-welding` | `forge-dark-before.png` | `forge-dark-after.png` |
| heritage / light | `ks-welding-heritage` | `heritage-light-before.png` | `heritage-light-after.png` |

The crops are the right-hand scrollbar column, magnified 6×. The full-page pair
(`forge-dark-*-full.png`) is the same capture uncropped, for context.

## Why the visitor's OS is emulated in these captures

`color-scheme` changes what the browser paints for the parts of the page CSS
does not own — the scrollbar, native form controls, and the canvas behind an
overscroll. Two things follow, and both are why these images were captured the
way they were rather than as a naive screenshot:

1. **Headless Chrome paints no scrollbar at all.** A `headless: 'shell'` capture
   of these two pages is byte-identical before and after, which looks like
   "the change does nothing" and is really "the harness cannot see it". These
   were captured from a real browser surface (`Page.captureScreenshot` with
   `fromSurface: true`), not from the page's content box.

2. **The effect is only visible when the page's tone disagrees with the host's.**
   On a machine already in dark mode, `color-scheme: normal` resolves dark
   anyway, so a dark page looks correct before the fix — for the wrong reason.
   Each tone is therefore captured against the opposite host preference, which
   is the case the declaration exists to fix:

   - forge/dark is shown to a **light-mode** visitor — a white scrollbar down
     the edge of a carbon page, before;
   - heritage/light is shown to a **dark-mode** visitor — a charcoal scrollbar
     down the edge of a cream page, before.

The declaration itself is verifiable without trusting any image: the computed
`color-scheme` on `<html>` moves from `normal` to `dark` on `ks-welding` and
from `normal` to `light` on `ks-welding-heritage`, and the emitted `:root`
block gains exactly one line, which is what `check-delivered-parity.mjs` now
admits as its single named exemption.
