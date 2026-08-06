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

This table is the refactor's own diff, at the commit it landed. Intended
change 2 below came later, as its own fix, and is recorded here because it
supersedes the string change 1 introduced — not because it was part of the
refactor build.

### Intended content change 1 — the hard-coded age

```
- Four decades on the same shop floor.
+ On the same shop floor since 1978.
```

Appears twice: `about.headline` in the config (rendered into `index.html` and
`about/index.html`) and the `title` of `src/content/about/kh-machine-works/about.md`.

"Four decades" is a hard-coded age: correct for at most twelve months and
silently wrong afterwards. Replacing it with a year removed that drift, and is
the reason the whole class of hard-coded ages is now banned by
`business.foundedYear`'s doc comment and `yearsInBusiness()`.

The year it replaced it with was wrong. See change 2.

### Intended content change 2 — the founding year itself

```
- On the same shop floor since 1978.
+ The same family keeping things running since 1918.
```

Same two places as change 1, plus every other string that named the year:
`hero.subhead`, the `Family-run since …` trust badge, `pages.about.eyebrow`,
`pages.about.metaDescription` and `seo.defaultDescription`.

Two separate errors were folded together here, and change 1 fixed only the
visible half.

**The year was wrong.** K-H was founded in **1918**, not 1978. The original
copy said "four decades", which was never the company's age — it was the
*owner's* personal time on the floor. Change 1 read that ~40-year span as the
company's age, back-solved a founding year from it, and wrote 1978 into
`business.foundedYear`. So the schema, the SEO descriptions and the trust
badge all inherited a fabricated date from a misread sentence.

**The claim was wrong.** Even with the right year, "on the same shop floor
since 1918" asserts that somebody has personally stood at a machine for over a
century. The replacement makes the subject the family, which is what actually
persisted — and is the claim the shop can stand behind.

`foundedYear` is now derived from one `FOUNDED_YEAR` constant at the top of
`kh-machine-works.config.ts`, and every string that names the year interpolates
it. Six copies of a date that could disagree with each other are now one.
`about.md` is the exception — content-collection markdown cannot interpolate,
so its two mentions are literal and must be updated by hand if the year ever
changes again.

The lesson change 1 missed: an evergreen format does not make the underlying
fact true. Deriving copy from `foundedYear` only helps once `foundedYear` is
right.

#### Provenance of 1918 (resolved)

1918 is no longer unconfirmed. It is externally verified from two independent
sources, retrieved August 2026:

- **K-H's own live site.** The hero on khmachineworks.com reads "Keeping
  Things Running Since 1918" — the company's own public claim about itself.
- **Third-party business listings.** D&B and Manta both show est. 1918 /
  ~108 years in business.

So `FOUNDED_YEAR` is the one field in this config that was wrong, was fixed,
and is now sourced — unlike the `PLACEHOLDER` fields, it does not need
checking with the client before the mockup is shown. The provenance is
recorded on `FOUNDED_YEAR`'s doc comment in `kh-machine-works.config.ts` so
it travels with the value rather than only living here.

### Intended content change 3 — the confirmed contact details

The byte-identity table above is a snapshot of the refactor. This change is
the first one since that deliberately moves K-H's rendered text, and it is
recorded here so the table is not read as still-current.

Four `PLACEHOLDER` values were replaced with values K-H publishes about
itself on khmachineworks.com, corroborated by directory listings (retrieved
Aug 2026):

```
- (201) 555-0142                    + (201) 867-2338
- PLACEHOLDER@example.com           + KHCanDo@optonline.net
- PLACEHOLDER — confirm street …    + 4322 Grand Ave
- PLACEHOLDER (postalCode)          + 07047
```

`seo.siteUrl` moved from `https://example.invalid` to
`https://www.khmachineworks.com` at the same time, which changes every
absolute URL Astro derives from it — canonicals, `og:image`, and the JSON-LD
`@id`, `url`, `image` and `logo` fields.

These touch the footer, the contact page, and the `LocalBusiness` JSON-LD on
every page, so **K-H's output is intentionally no longer byte-identical to
`a274674`**. The reproduction recipe at the bottom of this file will now show
these diffs, and that is correct.

What did *not* change: `seo.noindex` is still `true`. The mockup lock is
independent of `siteUrl`, and only the client's sign-off flips it.

The remaining markers are the ones no amount of research can close —
testimonial attributions (our paraphrase, needs client sign-off), the
certification label (no source), and the two `forms` values (deploy-time
infrastructure, not facts about the business). They are enumerated with
reasons in the config's header comment.

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
