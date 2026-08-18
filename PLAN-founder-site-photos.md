# PLAN — founder-site-photos

Real photos of Ryan into the two slots PR #60 built: the `/` hero headshot, and a new
restrained "off the clock" row on `/about`.

## 0. BLOCKER — this branch is not off `main`

The task says *"off main (verify PR #60's asset-slot wiring is present)"*. Those two
instructions conflict, and the verification is the one that fails:

- `main` is at `9e91939` (#59). It has **no** `src/assets.ts`, no `HEADSHOT_SRC`, no hero
  `<img>` — the whole slot mechanism is unmerged.
- PR #60 (`feat/founder-site-v2`) is **OPEN and self-declared HELD**, blocked on Ryan's
  rulings for Brief items 1 (4th venture card) and 3 (zone robots.txt). It will not land
  on its own, so waiting is not a plan either.

**Done:** branched off `origin/feat/founder-site-v2`, not `main`. Re-implementing the slot
on a `main` base would be a second parallel implementation of a mechanism that already
exists and is already gated — the one thing prior streams ruled against.

**Recommendation:** PR targets `main` as a stacked PR. Until #60 merges its diff shows
#60's commits too; the moment #60 merges, this collapses to just the photo work. No
rebase, no duplicated code. *Needs a ruling — see Brief item 1.*

## 1. Source scan — `C:\Users\rragh\Downloads`

No `D:\Downloads` exists (D: holds the `sf-*` worktrees). Scoped to Downloads as
instructed; `~/Pictures` and `~/OneDrive/Pictures` exist but were not in scope.

7 images, newest first. No HEIC — the six from 2026-08-18 are already JPEG (an
AirDrop/LocalSend re-encode, which is also why five carry zero EXIF).

| file | px | EXIF | subject |
|---|---|---|---|
| `D83B3B45` | 5712×4284 | 1 tag | Ryan, smiling to camera, overcast, water + hills |
| `B3868841` | 2160×3840 | none | Ryan **with Gary Vaynerchuk**, VeeCon 2024 backdrop |
| `694275E3` | 4284×5712 | none | Ryan mirroring a gilded archer statue, museum court |
| `1917F80F` | 4284×5712 | none | Ryan at a giant rooster statue, golden hour |
| `C57A62E7` | 2316×3088 | none | Ryan, selfie, park trail, earbuds |
| `DFD2BF30` | 4284×5712 | none | Ryan in a navy suit by an indoor fountain |
| `IMG_0788` | 4284×5712 | **11 tags, 15 GPS** | photo of a Wells Fargo job-description document |

`IMG_0788` proves the GPS concern is real, not theoretical: iPhone 17 Pro Max,
2026-03-30 11:32, 15 GPS tags. Everything shipped gets stripped regardless.

## 2. Selection

**Hero — `D83B3B45`.** Clearest face by a distance: direct eye contact, genuine smile, and
overcast light, which is the softest, most even light available for a portrait. Verified
sharp at 100% on the crop region. Face sits right-of-centre in a landscape frame, so a 4:5
portrait crop lands comfortably inside the frame.

**/about — three, not four.** Restraint is the point; three reads as a considered row,
four starts reading as a feed.

1. `694275E3` — museum archer. Background verified **empty of people**.
2. `1917F80F` — rooster, golden hour. Crop tight to drop the picnic tables (see below).
3. `C57A62E7` — park trail. Crop tight to drop the sign, car park and distant walkers.

### Privacy skips — every one, with the reason

- **`IMG_0788` — hard skip.** Not a photo of Ryan. It is a photographed document: a Wells
  Fargo internal job description, with a mail header exposing two named third parties and
  both of their corporate addresses. Plus 15 GPS tags and a thumb in frame. Fails
  "documents", "private info", and "other identifiable people" at once. Never ships.
- **`B3868841` — skip.** A two-shot; the second subject is an identifiable public figure,
  framed as a co-subject. Croppable in principle, but the photo's whole value *is* the
  association, and implying a public figure's endorsement on a credibility page is not
  ours to imply. *Brief item 2 — Ryan may overrule.*
- **`DFD2BF30` — not selected (no privacy fault).** Clean frame, nobody else in it. It is
  simply the wrong register for a row headed "off the clock" — it is a formal full-length.
  Held as the fallback if a crop below cannot clear its background.
- **`1917F80F` — crop, not skip.** Seated people at picnic tables, right of frame, one face
  partially legible. Crop bounded left of them; the built file gets re-inspected and falls
  back to `DFD2BF30` if any face survives.
- **`C57A62E7` — crop, not skip.** Left third holds a "Bergen County" park sign, a car park
  (plates not legible, but not worth arguing) and two distant walkers. County-level is
  coarse, not an address — but the crop removes all of it anyway, at no cost, since Ryan
  already occupies the right ~55% of the frame.

## 3. Processing

One-off Pillow script in the scratchpad — **not** a repo dependency; the committed
artifacts are the deliverable, not the tooling. Originals in Downloads stay untouched.

- `ImageOps.exif_transpose` first, so a rotation flag is baked into pixels before strip.
- Re-encode through a bare `Image.new` → **no EXIF, no GPS, no ICC, no thumbnail**.
  Asserted after write: re-open each output, `getexif()` must be empty.
- Hero → `public/ryan.jpg`, 4:5, 1200×1500, quality tuned to land **<200KB**. Declared
  `HEADSHOT_W/H` (800×1000) stay as-is — same 4:5, and the attributes only need to carry
  the *ratio* for CLS. Shipping 1200 wide buys retina sharpness.
- /about → `public/off-the-clock/{museum,rooster,trail}.jpg`, 4:5, 600×750, <200KB each.
- Every crop re-inspected visually after processing, before commit.

## 4. Wiring

- **Hero:** file-drop only. `HAS_HEADSHOT` flips `existsSync` → the `<img>` renders and the
  placeholder retires. #60 already emits `width`, `height` and `fetchpriority="high"` with
  no `loading` attribute, so the hero is eager and CLS-safe **with no markup edit**.
  `check-placeholders.mjs` asserts the built HTML agrees with the file's existence.
- **/about:** new `<section>` headed *Off the clock*, placed after "Three sports, one
  habit" — the trail photo pays off that section's "progress is mostly boring" line.
  Three figures, one-line captions in a single clearly-commented `OFF_THE_CLOCK` array at
  the top of `about.astro`, so Ryan edits captions in one obvious place.
- Captions match the page's dry, plain register — no exclamation marks, no hashtags, and
  **no invented facts** (no place names beyond what is already visible or public).
- Below the fold ⇒ every /about image gets `loading="lazy"`, `decoding="async"` and
  explicit `width`/`height`.
- CSS in `styles/global.css`, scoped to the new row. No client JS — `check-no-forms.mjs`
  asserts the site emits zero script and that must stay true.

## 5. Gates

Merge `main` in first, then on the merged state: `pnpm build` (indexable, metadata,
amenity-wording, placeholders, no-forms, headers), `typecheck`, `check:textfit`, then
deploy raghubans-com and `check-live` + Lighthouse against the deployed origin.
Before/after Lighthouse both recorded — the four 100s are the baseline, and any movement
gets reported with its cause, not quietly absorbed.

Risk noted: `/ryan.jpg` is unhashed, so it inherits Pages' default cache TTL rather than
`immutable`. If Lighthouse's cache-lifetime audit moves, the fix is a `_headers` rule —
flagged rather than pre-emptively applied.

## 6. Not doing

- Not merging or unblocking #60 — its Brief is Ryan's to rule on.
- Not setting `LINKEDIN_URL`, despite the profile URL in the task. That is #60's other
  slot and it is one line, but it is #60's line. *Brief item 3.*

## Decision Brief (draft)

1. **Base + target.** Branched off `feat/founder-site-v2`, PR stacked onto `main`.
   *Recommendation: accept the stack.* The alternative is duplicating a gated mechanism.
2. **The VeeCon photo.** Skipped on implied-endorsement grounds, not image quality —
   Ryan's face is well lit in it. *Recommendation: keep it skipped.* One word and it goes in.
3. **`LINKEDIN_URL`.** The URL was supplied in this task; the slot lives in #60.
   *Recommendation: set it here* — it is one line, it is already-public information, and it
   retires the last placeholder on the site. Say the word and it lands in this PR.
