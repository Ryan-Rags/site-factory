# PLAN — design polish (stream: feat/design-polish, branch `feat/design-polish`)

Worktree `D:/sf-design-polish`, branched from `main` @ c26fdd2. Owned paths:
`packages/template/**` and this plan file. No shared root file is touched:
no root `package.json`, no `pnpm-workspace.yaml`, no lockfile, no `.gitignore`,
no `CLAUDE.md`. No new dependencies. Finish = push + PR. **No merge.**

Four items, in the order the prompt gives them. Item 1 ships first and stands
on its own, because it is a live bug in a panel we put in front of prospects.

---

## 1 · The accent bug — root cause

Reproduced by reading the code, not guessed. Three faults compound.

**(a) The accent fieldset is built for one preset and never rebuilt.**
`Customizer.astro:39` renders swatches from `accentsFor(design.theme)` — the
swatches of the *shipped* preset only. The font fieldset, by contrast, renders
every preset's pairings with a `data-preset` attribute and filters them on
switch (`syncFontOptions`). Accents got the single-preset treatment.

Accent ids are **disjoint across presets** — forge `ember/signal/molten/arc`,
precision `blueprint/teal/indigo/copper`, heritage `brick/oxblood/forest/navy`
— so after switching to Heritage the panel is still offering Forge's four
swatches, under Forge's names, in Forge's colours.

**(b) The failure is silent, and it is a *missing CSS block*.**
Clicking one of those stale swatches writes `data-accent="molten"` onto an
`<html>` that now carries `data-theme="heritage"`. `themeMatrixCss()`
(`lib/design.ts:727`) only ever emitted `[data-theme][data-accent]` blocks for
pairs that exist in the data, so `heritage`+`molten` has no block. The accent
custom properties therefore fall back to the plain `:root` block that
`designTokens()` emits for the client's *shipped* theme — which is precisely
the reported symptom: **the accent goes stale (or reads as another family's
colour) while the fonts, which are filtered correctly, stay right.**

**(c) The panel's state and the document's state can already disagree.**
`syncAccent()` (`Customizer.astro:360`) picks `allowed[0]` when the current
accent is illegal for the new preset, then looks for a radio to check — and on
a cross-preset switch that radio does not exist in the DOM. It returns the id
anyway. So `data-accent` says `brick` while the panel shows `ember` ticked.

**(d) URL params are stamped with no validation at all.** The no-flash script
(`DesignLayout.astro:90`) writes `q.get('theme')`, `q.get('accent')`,
`q.get('font')` straight onto `<html>`. `?theme=heritage&accent=ember` lands on
a combination that has no CSS block, i.e. the same stale-colour state, before
any JavaScript has run. `localStorage` can hold the same illegal pair across a
reload. So "URL restores exactly what was on screen" is not true today even
without the panel bug.

### The fix

1. **Render every preset's accents**, each tagged `data-preset` (and, after
   item 2, `data-scheme`), exactly as the font fieldset already does. The
   swatch chip and the label then always describe the colour that will
   actually be applied.
2. **One resolver, used by everything.** A single `resolve(desired)` in the
   panel script takes `{theme, scheme, accent, font}`, checks each id against
   the offered set for the *active* cell, substitutes the cell's first legal id
   where one is illegal, and returns a tuple that is guaranteed to have a CSS
   block. Every entry point routes through it: the three (soon four) change
   handlers, the initial sync, and the restore path. Nothing else may write the
   `data-*` attributes.
3. **The resolver's allow-list is emitted from the same data the CSS is.**
   `config.presets` in the component frontmatter and `themeMatrixCss()` are
   both derived from one exported `offeredCells()` helper, so a cell the CSS
   does not carry cannot be offered by the panel. This is the invariant that
   makes (b) structurally impossible rather than fixed-by-hand.
4. **Validate before first paint.** The no-flash script gets the same
   allow-list inlined (it is small: ids only) and clamps URL/localStorage
   values to a legal cell. Illegal input falls back to the config's own
   selection rather than stamping a combination with no styles.
5. **`persist()` writes the resolved tuple**, so the address bar always
   describes what is on screen — which is what makes the URL the shareable
   artefact the panel's own copy promises.

**URL parameter shape.** The prompt writes `?theme=heritage&accent=N`. The
existing scheme is `accent=<swatch id>` (`accent=brick`), which is stable,
readable and already what `persist()` writes and what shared links in the wild
carry. I am keeping ids and adding `scheme`, not switching to an index — an
index would renumber the moment item 3 adds swatches, silently changing what
every previously-shared link resolves to. Final shape:
`?theme=heritage&scheme=dark&accent=brick&font=old-serif`. Say the word if you
meant a literal numeric index and I will change it.

---

## 2 · Scheme as a first-class token dimension

### Data model

`ThemePreset` currently owns one `palette` and one `accents` list. Scheme
splits both, and only those:

```ts
interface ThemePreset {
  id; label; blurb;
  defaultScheme: 'light' | 'dark';
  schemes: Record<SchemeName, { palette: PresetPalette; accents: AccentSwatch[] }>;
  radius; density; fonts; variants;   // unchanged, preset-level
}
```

Radius, density, fonts and variants stay at preset level deliberately: scheme
is a *tone* axis, not a second design system. A dark Precision is still
Precision — same geometry, same lettering, same layouts.

Accents move **inside** the scheme because they have to. `onAccent` and the
4.5:1 the accent must reach against `base`/`surface` are different questions in
each tone; a swatch that passes on carbon does not necessarily pass on cream.
Same reason `--d-accent-strong` already mixes toward `ink` on dark palettes and
toward black on light ones.

**Both schemes of a family carry the same accent *ids*, with per-scheme hex
values.** So toggling scheme preserves the prospect's accent choice instead of
resetting it — a toggle that silently reassigns your colour is the same class
of surprise as the bug in item 1. Ids stay disjoint *between* families.

### Backward compatibility

`ThemeSelection.scheme` is **optional**, defaulting to the preset's
`defaultScheme`, and the defaults are today's tones — forge `dark`, precision
`light`, heritage `light`. Every one of the six existing design payloads and
briefs keeps its exact current output with no edit, which also keeps the K-H
equivalence proof intact. New tones: forge light, precision dark, heritage
dark.

### CSS emission

A fourth attribute, `data-scheme`, on `<html>`:

- `:root[data-theme=X]` → metrics (radius/density) — unchanged, scheme-invariant
- `:root[data-theme=X][data-scheme=S]` → palette tokens
- `:root[data-theme=X][data-scheme=S][data-accent=A]` → accent tokens
- `:root[data-theme=X][data-font=F]` → font tokens — unchanged

Specificity is ascending in the order the tokens need to override, and the
metric tokens stay in the low-specificity block so no combination can lose them
— which is the property that keeps switching free of layout shift.

### Tone-dependent CSS to fix

The 26 `[data-theme='…']` decorative rules in `design.css` are almost all
`color-mix()` against palette tokens, so they follow a flipped palette for
free. Four places do not, and would look wrong in the new tones:

- `design.css:332`, `:507`, `:544` — `box-shadow: … rgb(0 0 0 / 0.45…)`
- `design.css:1206` — `color-mix(in srgb, #000 18%, var(--d-surface-alt))` in
  Forge's brushed-steel band

These get a scheme-emitted `--d-shadow` / `--d-shade` token instead of a
literal black, so a light Forge does not get a dark family's shadow weight.
The full 26 get read in both tones on a real page before I call this done; the
list above is what a read of the stylesheet predicts, not the finding.

### Customizer

A fourth `<fieldset>` — two radios, "Light" / "Dark", same platform-provided
group semantics as the other three. Not a checkbox and not an icon toggle:
`role=radiogroup` announces "Light, 1 of 2" and a lone icon button does not.

**No `prefers-color-scheme` auto-follow.** The demo shows a deliberate design
decision; a prospect's OS preference silently flipping it on open would read as
exactly the bug we are fixing here. The config default wins, the toggle is
explicit. (Alternative, if you want it: a `scheme: 'auto'` config value that
follows the OS on first visit only. Not building it unless you ask.)

### Anything else that reads a palette

`scripts/gen-brand-assets.mjs:108,114,168` reads `preset.palette` and
`preset.accents` for favicons, OG images and `theme_color`. It resolves through
the client's selection, so it picks the client's scheme and its output is
unchanged for all eight existing clients. `DesignLayout.astro:113`'s
`theme-color` meta likewise follows the resolved scheme.

---

## 3 · More curated accents, and what "auto-drop" means

**7 ids per family** (inside the 6–8 asked for), each with a light and a dark
rendition: 3 families × 2 schemes × 7 = 42 palettes, up from 12.

On auto-dropping, I am splitting the behaviour, and this is the one place I am
deliberately not doing exactly what the prompt says:

- **A curated swatch that fails its cell is a build failure**, as today. These
  are *our* colours. `check-contrast.mjs` already says "fix the palette — do
  not lower the threshold", and silently dropping our own failing swatch
  converts a loud, fixable authoring error into a swatch that quietly vanishes
  from one scheme. I will author all 42 to pass.
- **A prospect's `brandAccent` that fails a cell is dropped from that cell**,
  which is the existing, approved Q1(a) rule — their colour, never nudged,
  offered only where it is legal. Today that decision is all-or-nothing across
  the whole matrix; per-cell is strictly better, because a brand colour that is
  legal on a light Heritage and illegal on a dark Forge can now be offered
  where it works instead of everywhere or nowhere.

One mechanism, not two: `offeredCells()` computes the drop, and the gate,
`themeMatrixCss()` and the customizer's allow-list all consume it — so a
dropped cell is dropped in the data, the CSS and the UI simultaneously. The
gate prints every drop by name and cell, so nothing disappears silently. If you
want curated swatches auto-dropped too, that is a one-line change to the same
helper — tell me and I will make it.

### Projected cell count

| | today | after |
|---|---|---|
| preset × scheme × accent palettes | 12 | 42 |
| preset × scheme × accent × font combinations | 32 | **112** |
| contrast assertions (matrix + legacy) | 234 | **~774** |

More than the "roughly double" you expected — because scheme doubles it and
4→7 accents multiplies it again. Flagging it rather than quietly shipping a
3.3× runtime: it is a pure-arithmetic script, so the cost is milliseconds, but
the *inlined CSS* grows too and that one I will measure (below).

---

## 4 · Verification

### New gate: `scripts/check-switching.mjs`

A video cannot prove "zero stale colours", so this does. Headless, drives the
real panel on a real build, and for **every offered cell**:

1. selects the cell through the panel's own controls,
2. reads `getComputedStyle(document.documentElement)` for `--d-accent`,
   `--d-on-accent`, `--d-base`, `--d-ink`, and asserts each equals the value
   `presets.json` holds for that exact cell — this is the assertion that fails
   today and is the regression test for item 1,
3. asserts the panel's checked radios match the document's four attributes,
4. reloads on the URL `persist()` wrote and asserts all four attributes and all
   four computed tokens come back identical — the URL-restore acceptance,
5. asserts an illegal URL (`?theme=heritage&accent=ember`) lands on a legal
   cell rather than an unstyled one.

Exits non-zero on any mismatch, so it gates like the others.

### Screen capture

`record-theme-switch.mjs` extended to walk preset → accent → scheme → font at a
phone viewport, so the capture shows the switching the acceptance asks for.
Output stays `dist/theme-switch.webm`.

### Existing gates

`pnpm -r build`, `pnpm -r typecheck` / `astro check`, `check:markers` on all 8
clients, `check:contrast` at the new count, `check:overflow` at 320/390 on
`/`, `/services`, `/about`, `/contact`, `/404` — run on the **heaviest new
combo** (heritage dark, its serif display and rule-and-texture treatment, on
the customizer build) as well as the shipped one.

### Lighthouse

Mobile, real run, on `ks-welding` at the heaviest new combo. Known constraint
recorded in `PLAN-design-families.md`: Lighthouse mobile reports `NO_LCP` on a
`DesignLayout` page under device emulation, so **performance was never
demonstrated on this template and I am not going to report it as if it were**.
What I will report: accessibility / best-practices / SEO scores, every
individual performance audit that does score, and — new, because this change
causes it — the **inlined token CSS byte delta** from 32 to 112 cells, since
that is the one way this work could plausibly move a real performance number.
If the byte growth is material I will emit the matrix more compactly (shared
palette blocks, accent blocks only where they differ) rather than shipping it
and hoping.

Anything that cannot be measured here is reported as unavailable, not
estimated.

---

## Order of work

1. Item 1 alone, on today's data model, with `check-switching.mjs` written
   first so the failure is demonstrated before it is fixed. Commit.
2. Scheme axis: types → `presets.json` → `lib/design.ts` → CSS tokens →
   customizer → gates. Commit.
3. Accent expansion to 7 per family per scheme, `offeredCells()` + per-cell
   brand drop. Commit.
4. Verification pass, capture, Lighthouse, byte delta. Commit.
5. Push, open PR listing shared files touched (none expected beyond
   `packages/template/**`), every gate with its result, and anything not done.

## Not doing

- No merge, no self-merge. This diff touches `packages/template/src/types/**`,
  which condition 2 of the merge policy excludes regardless of gate results.
- No deploy, no Worker change, no `.env` read, no email path, no new dependency.
- No free colour picker, in either scheme. The finite matrix is the only reason
  the contrast gate can prove anything.
- No change to the eight client configs' rendered output. If a byte-diff shows
  one moved, that is a bug in this work and it gets fixed, not accepted.

## Open questions (answer only if you disagree; defaults are stated above)

1. **`accent=N`** — keeping ids (`accent=brick`), not a numeric index. §1.
2. **Curated swatches hard-fail; only `brandAccent` auto-drops.** §3.
3. **No `prefers-color-scheme` auto-follow.** §2.

All three confirmed as written before any code was committed.

---

# Results

Everything below was run, not estimated. Where a number could not be measured
it says so.

## The bug, measured before and after

Before, on `ks-welding` (shipped forge/ember, `#e2551f`):

| step | `data-accent` | `--d-accent` | panel showed |
|---|---|---|---|
| select Heritage | `brick` | `#8c3b1f` ✓ | **`ember`** — the old family's |
| click "Molten" | `molten` | **`#e2551f`** — ember, not molten | `molten` |
| `?theme=heritage&accent=ember` | `ember` | **`#e2551f`** over cream | `ember` |

After: `check:switching` walks all 112 cells and asserts the attributes, the
computed tokens, the painted CTA and page, the chip on the checked control and
the panel's own radios all agree with `presets.json` — then reloads on the URL
the panel wrote, with `localStorage` cleared so the URL alone is doing the
work. 4396 assertions, all green.

## Gates

| gate | result |
|---|---|
| `check:contrast` | **746/746**, 42 palettes, 112 cells (was 234/234, 12, 32) |
| `check:switching` | **4396 checks over 112 cells**, apply + URL restore |
| `check:overflow` | clean at 320/390 on all 5 routes, in **all three new tones** at their widest type, plus the shipped combo |
| `check:parity` | 35 pages byte-identical, 5 changed only in panel machinery, **0 regressed** |
| `astro check` | 0 errors, 0 warnings, 4 hints (the known `astro(4000)` JSON-LD notes) |
| `build:all` | 8/8 clients |
| `check:markers`, `check:contact-links` | green |

The contrast count landed at 746 against a projected ~774: 42 palettes × 17
assertions + 18 legacy + 2 selftest. The projection assumed 18 pairs per
palette; there are 17.

## Lighthouse (mobile, real runs)

Heaviest new combo — heritage **dark**, signwriter, the widest display type in
the matrix (uppercase Georgia at +0.05em) — and the shipped combo, both on
`ks-welding`, against baseline `main` built and served identically:

| | baseline `main` | shipped combo | heaviest new combo |
|---|---|---|---|
| Accessibility | 100 | 100 | **100** |
| Best practices | 100 | 100 | **100** |
| SEO | 69 | 69 | **69** |
| Performance | `NO_LCP` | `NO_LCP` | `NO_LCP` |

Nothing moved. The single SEO deduction is `is-crawlable` — the page is
`noindex`, which is correct for a mockup and is what `check-markers.mjs`
exists to enforce. Note that `PLAN-design-families.md` recorded SEO **93** for
the same audit; that number came from an earlier Lighthouse, and baseline
`main` scores 69 on the version installed here, so the drop is the tool, not
this work.

Performance remains unmeasurable for the reason that stream documented:
Lighthouse mobile reports `NO_LCP` on a `DesignLayout` page under device
emulation. FCP 0.8s, Speed Index 0.8s and CLS 0 all score 1. **The 90+ mobile
bar is still not demonstrated**, and this branch has not changed that in
either direction — baseline `main` reports exactly the same thing.

## Byte cost (ks-welding pitch page)

|  | matrix+tokens | panel | page | page gzipped |
|---|---|---|---|---|
| baseline, 32 cells | 8884 | 18542 | 104411 | 22390 |
| 112 cells, uncompacted | 18659 | 35174 | 131788 | 26032 |
| 112 cells, compacted | 19909 | 27768 | 125670 | **25809** |

Compaction — one accent control per preset instead of one per preset per tone,
with the chip colour arriving through `--d-swatch-*` — saved 6.1KB raw and
**223 bytes gzipped**. Gzip had already absorbed the duplication, so the case
for it is the simpler markup and a chip that cannot go stale, not transfer
size. Net against baseline: +21KB raw, +3.4KB gzipped, on pitch builds only.

## What the plan predicted and got wrong

- **Tone-aware shadow tokens were not needed.** The plan expected the four
  literal blacks in `design.css` to need `--d-shadow`/`--d-shade`. They do not:
  every one means "darker than the surface", which is black in both tones. The
  other 26 decorative rules are `color-mix()` against palette tokens and follow
  the palette already. Checked by reading, then on screen in all three new
  tones.
- **The cell count is 3.5×, not 2×**, as flagged before starting: scheme
  doubles it and 4→7 accents multiplies again.

## Three mistakes the gates caught

Recorded because each was a real defect in this work, not a near-miss:

1. `data-scheme` was landing on delivered builds, changing the bytes of eight
   shipped client sites to no effect. Now pitch-only.
2. An Astro comment placed above `<html>` — the exact trap documented in
   `DesignLayout`'s own frontmatter — silently dropped `<html>`, `<head>` and
   `<body>` from every design page.
3. Two bugs in `check-parity` itself: a `<style>` regex that missed
   `<style is:global>` and so compared empty strings to empty strings, and a
   `--d-base` filter that swept the whole inlined stylesheet in as "matrix". It
   now refuses to report parity on a region it could not extract.

A fourth, outside the diff: the first `check:switching` run was measured
against **another worktree's preview server**. `astro preview` walks to the
next free port silently when 4321 is taken, and several worktrees are open at
once. The gate now refuses to run unless the served build is the client it was
asked about.

## Not done

- **Performance is still not demonstrated.** See above. Finding what in
  `DesignLayout` suppresses LCP under device emulation remains open, and is
  not something this branch attempted.
- **`color-scheme` is not emitted on delivered builds**, only in the matrix.
  It belongs there too — a delivered dark site gets a light scrollbar without
  it — but adding it changes how eight shipped sites render, which is a
  deliberate decision to make rather than a side effect of this work.
- No merge. The diff touches `packages/template/src/types/**`, which condition
  2 of the merge policy excludes regardless of gate results.
