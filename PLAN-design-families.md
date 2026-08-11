# PLAN — design families (stream: feat/template, branch `feat/design-families`)

Worktree `D:/sf-design`. Owned paths: `packages/template/**`, this plan file.
No shared root file is touched.

## Goal

Three visually distinct, config-driven design families for local service
businesses — Forge (dark industrial), Precision (light engineering), Heritage
(warm family business) — sharing one section vocabulary and one JSON contract.
Acceptance: rebuild the K&S Welding mockup in all three, side by side.

## Constraint restated from the existing architecture

The current template is a *single skin*: `theme` has exactly two colours,
`index.astro` composes a fixed list of eight sections, and there is no notion
of a family or a layout variant. Five client configs and one byte-locked
equivalence proof (`kh-machine-works`) depend on that behaviour.

So the design layer is **additive and opt-in**, never a rewrite:
`SiteConfig.design` is optional. Absent → the legacy path renders exactly as
today, byte for byte. Present → the family path renders instead. This is the
only reason five existing clients keep building unchanged.

## The config contract

The user asked for "a single per-prospect JSON config". The repo's contract is
a *typed* one, and that is worth keeping — so: the payload is a real
`.json` file per prospect (`clients/design/<slug>.design.json`), imported and
type-checked against `DesignConfig` in `src/types/design.ts`. JSON in fact,
typed in effect, and directly emittable by the discovery pipeline later.

`src/types/design.ts` adds:

- `family: 'forge' | 'precision' | 'heritage'` — picks the token set.
- `palette` — base, surface, surfaceAlt, ink, inkMuted, line, primary, accent,
  onAccent, onPrimary. Every colour on the page resolves from these; nothing
  is hard-coded in a component or a family stylesheet.
- `fonts` — display/body stacks + optional self-hosted faces (reuses the
  existing `FontFace`).
- `sections` — every block is `{ enabled, ... }` with its own copy:
  `hero` (with `variant`), `stickyCta`, `services`, `reviews`, `stats`,
  `faq`, `gallery`, `serviceArea`, `footer`.

Hero variants, one shared set across all three families:
`split` (media beside copy), `full-bleed` (image behind, overlay copy),
`stacked-panel` (copy panel over a banded/textured field).

## Honesty rules carried into the new sections

- The reviews block renders **whatever the config holds** and never fetches or
  scrapes anything. No Google property is contacted at build or run time; the
  section's attribution string is a config field, not an assumed "Google".
- Each review keeps `status` + `sourceNote`, same as `Testimonial`. K&S's
  three configs reuse its existing paraphrases, still marked.
- `aggregate` (rating/count) is optional and omitted for K&S — we have not
  confirmed a count, and inventing one would be fabricated audit data.
- No `Review`/`AggregateRating` JSON-LD is emitted for placeholder reviews.
- Stat counters take their numbers from config; K&S gets only stats that are
  true of it (service count, service-area count, response promise) — no
  invented "500+ jobs".

## Components (`src/components/design/`)

`DesignLayout.astro` (emits the family token block + `data-family`),
`DesignHeader`, `DesignHero` (3 variants), `StickyCallBar`, `DesignServices`,
`Reviews`, `Stats`, `Faq`, `Gallery`, `ServiceArea`, `DesignFooter`,
`Reveal.astro` (the one inline script).

Markup is family-agnostic. Families differ through the emitted custom
properties plus decorative rules scoped under `[data-family="…"]` in
`src/styles/design.css` — carbon/steel gradients for Forge, a blueprint grid
for Precision, a rule-and-serif treatment for Heritage.

## JS budget

One inline IIFE, ~1KB, no dependencies:
IntersectionObserver adds `.is-revealed` to `[data-reveal]`, and drives the
stat count-up. `prefers-reduced-motion` → final values painted immediately,
no observer. FAQ is `<details>/<summary>` (zero JS). Sticky call bar is
`position: fixed` + a media query (zero JS). No animation library.

## Acceptance test

`ks-welding-forge`, `ks-welding-precision`, `ks-welding-heritage` — same
business facts, three families, all `noindex: true`. Plus a static
`compare.html` index linking the three builds side by side.

## Checks before commit

`pnpm install && pnpm -r build && pnpm -r typecheck` green; `check:markers`
green for all 8 clients; `check:contrast` for the new palettes;
`check:overflow` at 320/390 on each family; a byte-diff proving
`dist/kh-machine-works` is unchanged by the additive `design` field.

## Not doing

No merge to main. No deploy. No Lighthouse claim without a real run — if
Chrome-driven measurement cannot run here, the number is reported as
unmeasured rather than asserted.

---

# Addendum — presets, customizer, life layer, realism

Folded in on top of the plan above. Where the two disagree, this section wins.
Status: **approved and resolved.** Q1 and Q2 below were answered before any
addendum code was written:

- **Q1 → (a) drop it.** A prospect's extracted brand colour is offered as a
  swatch only when it passes the AA gate in the role it would occupy;
  otherwise it is omitted and the prospect gets the curated set. The gate is
  never relaxed and the colour is never silently adjusted.
- **Q2 → (a) convert the five existing clients.** All five move to the design
  path. `clients/EQUIVALENCE.md` gains an entry recording that K-H's legacy
  comparison is superseded, in the same way its change 3 is recorded.

## What changes structurally: colour authority inverts

The plan above makes `DesignConfig.palette` a hand-authored 10-colour literal
per prospect, with `family` selecting only decorative rules. The addendum asks
for the opposite: the **preset supplies the palette**, and the prospect config
*chooses* rather than *authors*. That inversion is the whole of item 1, and it
is worth being explicit that it supersedes the section above — otherwise we
ship both models and every prospect config can silently contradict its preset.

New `src/design/presets.json` + `src/design/presets.ts`:

```
ThemePreset {
  id: 'forge' | 'precision' | 'heritage'
  label, blurb
  palette:  base surface surfaceAlt ink inkMuted line primary onPrimary   // no accent
  accents:  AccentSwatch[]        // 4–6, curated, each { id, label, accent, onAccent }
  fonts:    FontPairing[]         // 2–3, each { id, label, display, body,
                                  //   displayWeight, displayTransform, displayTracking }
  radius:   { sharp | soft }      // default per preset, overridable
  density:  { compact | comfortable }
  variants: { hero: HeroVariant[], services: …, reviews: … }   // allowed per section
}
```

JSON as the data with a runtime validator in `presets.ts`, matching the
precedent `lib/design.ts` already sets for `DesignConfig` — and, not
incidentally, the only shape a plain-Node check script can read without a
compile step (see the contrast gate below).

`DesignConfig` accordingly replaces `palette` + `fonts` with:

```
theme: {
  preset: 'forge' | 'precision' | 'heritage'
  accent: string            // AccentSwatch id — never a free hex
  fontPairing: string       // FontPairing id
  radius?, density?         // override the preset default
  variants?: { hero?: HeroVariant, … }
  paletteOverride?: Partial<DesignPalette>   // escape hatch, still contrast-gated
}
```

`resolveTheme(theme) → { palette, fonts, radius, density }` lands in
`lib/design.ts`, and `designTokens()` takes the *resolved* value. That keeps
the blast radius at the token **source** only — every component, every
`--d-*` custom property and every `[data-family]` rule in `design.css` is
untouched. `family` stays on the rendered `<body>` as `theme.preset`.

There is no free colour picker anywhere in the config or the UI, per the brief.

## 2 · Design preview mode (the customizer)

**Gate.** `Features` in `src/types/site.ts` gains `customizer?: boolean`.
Optional, so the five existing configs typecheck unchanged. Demo builds set it
true; a delivered site sets it false (or omits it) and the panel component,
its inline script and the extra CSS are **not emitted at all** — not hidden,
not shipped-and-disabled. `SITE_DELIVERED=1` forces it off regardless of
config, so a delivery build cannot leak the customizer through a stale flag.

**Instant switching, no reload, no layout shift.** With the customizer on,
`DesignLayout` emits the full matrix as static CSS instead of one `:root`
block:

```
:root[data-theme="forge"]              { --d-base … --d-on-primary }
:root[data-theme="forge"][data-accent="2"] { --d-accent; --d-on-accent }
:root[data-font="condensed-caps"]      { --d-font-display … --d-display-tracking }
```

Switching is then three attribute writes on `<html>` — no style
recalculation beyond the custom-property cascade the browser does anyway, and
no geometry change, because radius/density are the only metric tokens and
both are declared in every combination. Cost: 3 palette blocks + ~15 accent
pairs + ~8 font blocks ≈ 2 KB of CSS on demo builds only.

**No flash.** A ~200-byte blocking inline script in `<head>` reads URL params,
then `localStorage`, then falls back to the config's own selection, and stamps
`data-theme`/`data-accent`/`data-font` before first paint — the standard
no-flash pattern.

**Panel.** `Customizer.astro`, floating brush button **bottom-left**
(bottom-right stays the call CTA; the sticky call bar's `--d-callbar-space`
already reserves the strip below on mobile, and the button clears it). Panel
is non-modal: `aria-expanded` on the button, `Esc` closes, focus returns to
the button. The three controls are real `<fieldset>`/`<input type=radio>`
groups, so arrow-key navigation and screen-reader semantics come free. Swatches
are labelled by name, not colour alone.

**State sharing.** Selections encode to `?theme=forge&accent=2&font=1` and
mirror to `localStorage`; the panel rewrites the URL with `history.replaceState`
so a prospect can copy the address bar and send their combo back.

**"Love this look? Send it to us."** POSTs `{ prospectId, selections }` to the
demo Worker endpoint when one is configured, `mailto:` fallback otherwise —
same two-mode pattern `forms.mode` already uses, so there is one story for
"is there a backend" rather than two. The endpoint is a new route on the
existing `packages/template/worker`; `prospectId` is the client slug.

**Motion.** `prefers-reduced-motion: reduce` → the panel appears without
transition. No dependencies added.

## 3 · Contrast gate over the full matrix

`scripts/check-contrast.mjs` today regex-scrapes two hex values out of
`site.config.ts`. That input model cannot express a matrix, so the script
grows a second mode rather than being replaced:

- **legacy mode** (unchanged) — the two `site.config.ts` brand colours, so the
  five existing clients keep their current gate;
- **matrix mode** — reads `src/design/presets.json` and iterates
  *every preset × every accent × every font pairing that changes weight*,
  plus each client design config's `paletteOverride` and any per-prospect
  brand swatch.

Pairs checked per combination — the ones that actually carry text, including
the `color-mix()` derivations `designTokens()` emits, which today's script
models by hand and must keep modelling:

| pair | min |
|---|---|
| `ink` on `base` / `surface` / `surfaceAlt` | 4.5 |
| `inkMuted` on `base` / `surface` | 4.5 |
| `onPrimary` on `primary` | 4.5 |
| `onAccent` on `accent` | 4.5 |
| `accent-strong` on `base` / `surface` | 4.5 |
| `ink` on `accent-soft` / `primary-soft` / `tint-2` / `tint-6` | 4.5 |
| `line` on `base`, `accent` on `surface` (UI boundaries) | 3.0 |

Any failure fails the build. Wired into `pnpm build` beside `check-markers`
and into `build-all.mjs`, so a bad swatch cannot reach a demo.

## 4 · Life layer (all config-gated, CSS + IntersectionObserver only)

Everything here extends the single existing inline IIFE. No new dependencies,
no animation library.

1. **Open/closed badge** — `sections.openNow.enabled`, computed from
   `business.hours`. Two honesty constraints the brief's "confirmed fact" rule
   forces: it renders nothing if `hours` is absent **or** carries
   `VERIFY_MARKER`; and it is computed **client-side**, because a badge baked
   at build time asserts a fact about the moment the visitor is reading, not
   the moment we built. This needs an IANA `business.timezone` — a visitor in
   another state otherwise gets "Open now" computed in their own zone, which
   is simply wrong. Added as an optional field; **absent → the badge does not
   render**, which is the honest default rather than a guessed zone.
2. **Review carousel** — `reviews.carousel`. CSS scroll-snap rail; advance on
   a timer from the IIFE; pauses on `:hover` and on `focus-within`. Under
   reduced motion the timer never starts and the rail renders as a static
   stacked list.
3. **Before/after slider** — `sections.beforeAfter`. Renders **only** when the
   config declares two real project photographs; a placeholder pair renders
   nothing. Implemented as an `<input type=range>` driving a `clip-path` — so
   it is keyboard- and screen-reader-operable natively, with no drag handler.
4. **Hero pan/zoom** — `hero.motion: 'none' | 'pan' | 'zoom'`, pure CSS
   keyframes on the hero image, transform-only (no layout, no paint storm),
   off under reduced motion.
5. **Micro-interactions** — button press/hover and `:focus-visible` rings
   drawn from `--d-accent-strong`; transitions collapse to none under reduced
   motion. CSS only.

Budget discipline: items 1–3 add roughly 700 bytes to the IIFE; 4 and 5 add
zero JS. Lighthouse mobile 90+ is verified by a real run, not asserted.

## 5 · Realism details

**Already done — verified, not re-implemented.** `Seo.astro` emits a canonical
tag on every page; `robots.txt.ts` generates robots from `seo.noindex`; and
`astro.config.mjs` wires `@astrojs/sitemap`, deliberately suppressed while
`noindex` is true so a private mockup advertises nothing. The brief's "if not
already emitted" is satisfied for all three. `DesignLayout` will be checked to
confirm it inherits the canonical (it renders `Seo`, so it does).

**Genuinely new:**

- **Icon set** — `scripts/gen-icons.mjs` renders the prospect logo on the
  resolved preset surface and screenshots 512/192/180/32 PNGs, emits
  `site.webmanifest`, and `DesignLayout` gains `apple-touch-icon` + manifest
  links (it currently emits a single SVG favicon).
- **OG/social card** — `scripts/gen-og.mjs` renders an HTML card (name, logo,
  preset palette) at 1200×630 and screenshots it to `public/og/<slug>.png`,
  pointed at by the existing `brand.ogImage`, which `Seo.astro` already wires
  to `og:image` and `twitter:image` with `summary_large_image`. So a texted
  demo link unfurls branded with no change to `Seo.astro` at all.

Both use the Playwright the repo already ships (`packages/audit`,
`scripts/mockup/shoot.mjs`). One judgment call to flag: `packages/template`
does not currently list Playwright, so these two build-time scripts need it as
a **devDependency** of the template package. That is not a site runtime
dependency — the shipped pages stay zero-dependency, which is what "no new
dependencies" protects.

## Acceptance

- five demos rebuilt on presets + customizer;
- `check:contrast` green across the full matrix;
- a real Lighthouse mobile run ≥90 on the heaviest combination (the preset
  with the most decorative CSS, carousel + before/after + hero motion all on);
  if Lighthouse cannot run in this environment the result is reported as
  **unmeasured**, never asserted;
- a short screen capture of theme switching on one demo, recorded with
  Playwright's `recordVideo`;
- `check:markers`, `check:overflow` at 320/390, `pnpm -r build`,
  `pnpm -r typecheck` all green.

Commit to `feat/design-families`. **No merge, no PR, no deploy.**

## Blocking questions

**Q1 — the extracted brand colour vs. the contrast gate.** Item 1 says the
swatch set must "always include the prospect's extracted brand color when
available." Item 3 says every offered combination must pass AA. A real
extracted brand colour is arbitrary and will sometimes fail against a preset's
surfaces — these two requirements collide, and which way it resolves changes
what we build:

  - **(a) Drop it.** A failing brand colour is omitted from the swatch set;
    the prospect gets the curated 4–6. Honest, never ships a contrast bug,
    but the demo loses "that's our blue" on exactly the prospects whose brand
    colour is a pale or washed-out one. *Recommended.*
  - **(b) Adjust it.** Darken/lighten until it passes, keep the hue. Always
    present, but we are then showing them a colour that is not their colour
    and calling it theirs.
  - **(c) Keep it and pair it.** Keep the exact hex but only offer it in
    roles where it passes (e.g. as `primary` on a dark preset, not as `accent`
    behind white text) — most faithful, most work, and it will still be
    unavailable in some presets.
  - **(d) Fail the build.** Cleanest gate, but one bad prospect colour blocks
    that prospect's demo entirely.

**Q2 — what "all five demos" means.** The repo has five client configs
(`american-machine-specialty`, `industrial-machine-corp`, `kh-machine-works`,
`ks-welding`, `kts-machine-shop`), all `noindex: true` mockups. The plan above
instead defined acceptance as *one* client (K&S) in *three* families. Two
readings:

  - **(a) The five existing clients each get a design config** and render
    through the design path. Note the consequence: `kh-machine-works` moves
    off `BaseLayout`, so `clients/EQUIVALENCE.md`'s comparison stops being
    reproducible against the legacy path. That document already records
    intentional drift (change 3), so this is a recorded supersession rather
    than a broken invariant — but it is your call, not mine.
  - **(b) Keep the five legacy builds as they are** and add five *new* demo
    slugs on the design path, leaving the equivalence proof intact and the
    client set at ten.

I lean **(a)** — "rebuilt" reads as the existing demos, and carrying two
parallel skins for the same five businesses is the kind of duplication that
rots. But (b) is the only reading that preserves the K-H proof, so I will not
pick for you.


---

# Results

Everything below was run, not estimated. Where a number could not be measured
it says so rather than being asserted.

## Built and checked

- `pnpm install && pnpm -r build && pnpm -r typecheck` green.
- `astro check`: **0 errors, 0 warnings**, 4 hints (all `astro(4000)`, the
  known "this script has an attribute so it is inline" note on the two
  JSON-LD blocks).
- `build:all`: **8/8 clients** built, marker check green on each.
- `check:contrast`: **234/234** assertions pass over the full matrix -
  3 presets x 4 accents x 2-3 font pairings, plus the legacy brand colours in
  five configs.
- `check:overflow`: no horizontal overflow at 320px or 390px on `/`,
  `/services`, `/about`, `/contact`, `/404`, verified on the Forge, Precision,
  Heritage and customizer builds.
- `dist/compare.html` and `dist/theme-switch.webm` both produced.

## Lighthouse (mobile, real runs)

Measured against `ks-welding` - the heaviest build: customizer matrix, reviews
carousel, hero pan motion and every section on.

| Category | Score |
|---|---|
| Accessibility | **100** |
| Best practices | **100** |
| SEO | **93** |
| Performance | **unmeasured - see below** |

The single SEO deduction is `is-crawlable`: the page is `noindex`, which is
correct for a mockup and is what `check-markers.mjs` exists to enforce. It
would score 100 the day `seo.noindex` is turned off.

Accessibility was **96** on the first run. The failing audit was real: a
`.d-callbar__note` with `opacity: 0.85`, which dropped the accent pairing from
a measured 4.95:1 to 4.28:1. `check-contrast.mjs` could not have caught it -
it checks colour pairs, and opacity is not one. Removing the opacity fixed it,
and the note is recorded in the CSS so it is not reintroduced.

### Why performance is reported as unmeasured

Lighthouse cannot produce a performance score for a design-family home page in
this environment: its LCP audit reports `NO_LCP` on Lighthouse 11 and 12 alike.
Every other performance audit scores **1/1**:

| Metric | Value | Audit score |
|---|---|---|
| First Contentful Paint | 1.0 s | 1 |
| Speed Index | 1.0 s | 1 |
| Total Blocking Time | 0 ms | 1 |
| Cumulative Layout Shift | 0.036 | 1 |
| Time to Interactive | 1.0 s | 1 |
| Largest Contentful Paint | - | `NO_LCP` |

Chased down to a precise, reproducible boundary with a direct Chrome probe:

| Viewport | LCP reported |
|---|---|
| 1280 desktop | yes - `H1.d-hero__title`, 344 ms |
| 412 x 823 | yes - `H1.d-hero__title` |
| 412 x 823 with touch emulation | yes |
| **412 x 823 with `isMobile: true`** | **no candidates at all** |

So: Chrome reports a healthy LCP on the same page at the same width, and stops
reporting one the moment mobile *device* emulation is switched on - which is
exactly the mode Lighthouse mobile runs in. It is specific to `DesignLayout`:
`/about` on the same server, in the same emulation mode, reports LCP normally.
Ruled out along the way: hero motion (a build with `motion: none` behaves
identically), the customizer (a build without it behaves identically), the hero
variant (all three behave identically), quirks mode, and the `left: -9999px`
skip link.

Two things were fixed while chasing it, both worth having on their own:

1. **Quirks mode.** An HTML comment sat above `<!doctype html>`, so the doctype
   was no longer the first thing in the document and every design page rendered
   in quirks mode with broken charset sniffing. Found because the Lighthouse
   trace looked wrong; fixed by moving the note into the frontmatter, where a
   comment in the template body cannot cause it.
2. **The skip link** now clips itself rather than sitting at `left: -9999px`.

The honest position: **the 90+ mobile Lighthouse bar is not demonstrated.** The
evidence available says the pages are fast - zero blocking time, CLS well
inside the 0.1 threshold, one ~1 KB inline script, no webfonts, no third-party
requests, an inlined stylesheet and a preloaded LCP image - but "the metrics
look good" is not the same claim as "it scores 90+", and I am not going to
report the second on the strength of the first. The remaining work is to find
what in `DesignLayout` suppresses LCP under device emulation.

## Deviations from the plan above

- **`theme.variants`** was not implemented as a theme-level override. The
  rewritten `presets.ts` puts the allow-list on the preset (`ThemePreset.variants`)
  and each section keeps its own `variant`, validated against that list at
  build time. Same guarantee, one less place for the two to disagree.
- **A second authoring mode** (`clients/design/derive.ts`) was added. The five
  pre-existing clients supply a *brief* - theme, stats, FAQ, service-area copy -
  and everything already confirmed in their `SiteConfig` is read rather than
  restated. Full payloads for all five would have meant a second copy of every
  headline and every review, and a second copy of a confirmed sentence is a
  second chance for one of them to go stale. `ks-welding` keeps a full payload
  as the reference for the whole contract.
- **`--d-line-strong`** was introduced. Running the matrix at WCAG 1.4.11's
  3:1 failed `line` on all three palettes, and the honest reading was not that
  three good palettes were wrong but that one token was doing two jobs:
  decorative dividers and actual control boundaries. The boundaries are now a
  separate token and are the ones that get gated.
