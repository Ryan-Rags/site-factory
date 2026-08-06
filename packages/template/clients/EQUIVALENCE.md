# K-H byte-equivalence proof

The multi-client refactor moved every client's content behind a registry and
made a large part of the config surface optional. The risk in a change that
shape is a silent regression in the one client that already existed: a lost
paragraph, a mangled address line, a section that quietly stopped rendering.

So the refactor was held to a standard stricter than "it still looks right":
**K-H Machine Works' built output must be byte-identical to its pre-refactor
output, except for changes that are named here.**

## Method

1. Build K-H at `a274674` (the commit that merged the K-H PR, before any
   multi-client work). Archive `dist/` and SHA-256 every file.
2. Apply the refactor.
3. Rebuild K-H with no `SITE_CLIENT` set, so it comes through the default
   path, and compare file by file.

The comparison separates two things that a plain hash conflates:

- **Content** — the HTML with the inlined `<style>` block masked out.
- **The inlined stylesheet** — which Tailwind regenerates from whatever class
  names exist anywhere in `src/`.

## Result

| File | Content |
|---|---|
| `404.html` | byte-identical |
| `services/index.html` | byte-identical |
| `index.html` | 1 intended change |
| `about/index.html` | 1 intended change (same string) |
| `contact/index.html` | 3 mechanical tokens |

### The one intended content change

```
- Four decades on the same shop floor.
+ On the same shop floor since 1978.
```

Appears twice: `about.headline` in the config (rendered into `index.html` and
`about/index.html`) and the `title` of `src/content/about/kh-machine-works/about.md`.

"Four decades" is a hard-coded age. K-H was founded in 1978, so it was already
wrong at the time of writing — 2026 makes it nearly five decades — and it would
have gone on drifting. The replacement states the founding year, which is a
fact that never goes stale. This is the one string the refactor deliberately
changed, and the reason the whole class of hard-coded ages is now banned by
`business.foundedYear`'s doc comment and `yearsInBusiness()`.

### The three mechanical tokens on the contact page

```
- uid="Z1JDieh"                                  + uid="ZY1XYL"
- component-url=".../ContactForm.DezDE2yL.js"    + component-url=".../ContactForm.Bz75xlEq.js"
- props="{...services...}"                        + props="{...mode,mailto,services...}"
```

All three follow from one change: `ContactForm` gained `mode` and `mailto`
props to support `forms.mode`. The props are serialised into the island, the
new source changes the bundle's content hash, and Astro's island `uid` is
derived from the component and its props. No rendered text differs.

### The stylesheet

The inlined stylesheet grew by **74 bytes per page** (21,925 → 21,999 on
`index.html`). Tailwind scans all of `src/`, so the utility classes used by the
two new components — `Equipment.astro` and `Updates.astro` — are emitted even
on pages that render neither, because K-H sets neither `equipment` nor
`updates`.

This is a real deviation from byte-identity and is called out rather than
waved through. It is 74 bytes of unreachable CSS on a ~22 KB stylesheet, it
changes nothing that renders, and removing it would mean per-client Tailwind
scanning — a build-complexity cost out of proportion to the benefit. If the
client set ever grows enough that this matters, the fix is a per-client
`content` glob in `tailwind.config.mjs`.

## Reproducing

```sh
git checkout a274674 -- packages/template
cd packages/template && pnpm build            # archive dist/
git checkout HEAD -- packages/template
pnpm build                                     # compare dist/kh-machine-works/
```
