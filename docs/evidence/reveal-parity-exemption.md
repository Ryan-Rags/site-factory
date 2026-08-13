# The reveal-script parity exemption, before and after narrowing

Failure-first evidence for `feat/design-expansion` item 3.1 (Brief 3, ruled).
Recorded 2026-08-13 against the merged branch.

Unlike the settle-window premise next door, **this one reproduced exactly as the
plan predicted.**

## What was at stake

`onlyRevealScriptChanged()` in `check-delivered-parity.mjs` passed *any* delta
confined to the inline reveal script. The motion axis changes that script — CSS
can stop a transition but cannot stop the carousel's `setInterval` or paint a
counter at its final value — so on the three delivered design clients the
exemption would have reported the whole thing as no change at all.

## Method

Baseline `dist/` built from the merged branch before any edit. One
representative reveal-script change, the shape the motion work actually needs:

```js
var motionProbe = docEl.getAttribute('data-motion');
```

`ks-welding-forge` — a delivered design client — rebuilt with it. The same
build compared twice, changing only whether the narrowing guard is present.

## Run 1 — the exemption as it stood (wide)

```
40 pages compared: 35 byte-identical, 5 changed only in panel machinery, 0 regressed.

5 page(s) took the named reveal-script exemption. ...
    + revealScriptChanged  ks-welding-forge/404.html
    + revealScriptChanged  ks-welding-forge/about/index.html
    + revealScriptChanged  ks-welding-forge/contact/index.html
    + revealScriptChanged  ks-welding-forge/index.html
    + revealScriptChanged  ks-welding-forge/services/index.html
✓ No client site changed what it renders.
```

A delivered client's every page had its only JavaScript changed, and the gate
signed it off green. This is the failure the file's own header warns about,
happening.

## Run 2 — narrowed to the migration

Same build, same baseline. The guard added: `before` must lack the `primed`
token, `after` must carry it.

```
  ✗ ks-welding-forge/404.html (delivered): content changed — that is the client's site, not the panel
  ✗ ks-welding-forge/about/index.html (delivered): content changed — that is the client's site, not the panel
  ✗ ks-welding-forge/contact/index.html (delivered): content changed — that is the client's site, not the panel
  ✗ ks-welding-forge/index.html (delivered): content changed — that is the client's site, not the panel
  ✗ ks-welding-forge/services/index.html (delivered): content changed — that is the client's site, not the panel

40 pages compared: 35 byte-identical, 0 changed only in panel machinery, 5 regressed.

✗ 5 page(s) changed what they render.
```

## Why `primed` is the right signature

The migration the exemption was written for moved `data-reveal-ready` from being
set up front to being set inside the observer's first callback, behind a
`primed` flag — the change that stopped 37 above-the-fold elements painting
blank. `Reveal.astro` ships `is:inline`, so the token survives verbatim into the
built HTML (`grep -c primed dist/ks-welding-forge/index.html` → 3) and the built
page can be asked directly which side of the migration it is on.

That makes the allowance one-way, matching `onlyColorSchemeAdded`: any baseline
taken from this branch onward already carries `primed`, so `before` matches, the
function returns null, and the three delivered design clients are fully gated
again. The motion work gets no free pass — it must either produce no delivered
delta at all, or come back for its own named allowance.

## It came back for the allowance

An earlier draft of this file predicted the first branch — no delivered delta,
because `data-motion-preset` is stamped on pitch builds only. **That prediction
was wrong, and the gate is what said so.**

The attribute is indeed pitch-only, so nothing about a delivered page *renders*
differently. But `Reveal.astro` is one component, and its inline script text is
shared by delivered and pitch builds alike. Adding the two lines that read the
attribute moved the bytes on all five pages of `ks-welding-forge` even though
every branch in the script resolves exactly as it did before:

```
  ✗ ks-welding-forge/index.html (delivered): content changed — that is the
    client's site, not the panel
  ... 5 regressed.
```

So the second branch was taken, under the ruling that anticipated it: a second
named exemption, `revealMotionAxis`, pinned one-way on the `data-motion-preset`
token exactly as the first is pinned on `primed`.

The alternative — a second copy of a 250-line inline script differing by two
lines — is a worse thing to own than a narrow, announced, self-expiring
allowance.

Final state:

```
40 pages compared: 30 byte-identical, 10 changed only in panel machinery, 0 regressed.

5 page(s) took the named motion-axis exemption. ...
    + revealMotionAxis  ks-welding-forge/404.html
    + revealMotionAxis  ks-welding-forge/about/index.html
    + revealMotionAxis  ks-welding-forge/contact/index.html
    + revealMotionAxis  ks-welding-forge/index.html
    + revealMotionAxis  ks-welding-forge/services/index.html
✓ No client site changed what it renders.
```

Worth stating plainly, because it is the honest reading of item 8(c): the eight
delivered clients are byte-identical in **every region the parity gate
compares**, with one named script allowance on the three design clients. They
are not byte-identical as files — `design.css` is inlined into every page and it
grew. That delta is measured and reported separately.
