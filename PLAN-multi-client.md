# PLAN-multi-client.md — multi-client template (branch `feat/multi-client`)

Turns `packages/template` from a one-client build into a registry that builds
any number of clients from the same code, and adds four real client configs
alongside the existing K-H seed.

Worktree `D:/sf-multi`, branched from `main` at `a274674` (the squash-merge of
the K-H PR, #2).

## Scope

Owned: `packages/template/**`, this file.
Shared files touched: **none.** No dependency was added, so `pnpm-lock.yaml`
is untouched. (A lockfile grant was given for this branch and turned out not
to be needed.)

## What changed

### Client selection

`site.config.ts` stops being the config and becomes a resolver. Every
component still imports `site` from it and is unaware that more than one
client exists — which is why no component's data flow changed.

- `clients/<slug>.config.ts` — one per client.
- `clients/index.ts` — static registry, `SITE_CLIENT` resolution, unknown-slug
  error listing the valid slugs.
- `astro.config.mjs` — `outDir: ./dist/<slug>`, so one client's build never
  overwrites another's.

Selection is by env var, not a CLI flag: `astro build` owns its own argv, and
an extra `--client` flag would have to be stripped before handing off.

Content is namespaced the same way — `src/content/about/<slug>/` and
`src/content/services/<slug>/` — because the prose is per-client. Before this,
all five clients would have shared K-H's story.

### Type surface

- `foundedYear`, `email`, `address.street`, `address.postalCode` and `hours`
  are optional. Each absent field means its section does not render at all —
  not an empty shell, not "undefined". `industrial-machine-corp` omits four of
  the five and exists partly as the regression test for exactly that.
- `updates[]` and `equipment[]` added, both optional, both non-rendering when
  absent or empty.
- `forms.mode: 'worker' | 'mailto' | 'disabled'` — a form with nowhere to send
  is now a config choice rather than an inert form that silently fails.
- `pages: PageCopy` — per-page headings and meta descriptions. These were
  literals inside the `.astro` pages, which only became visibly wrong with a
  second client: "Four things, done properly" and "Machining, repair and
  fabrication under one roof" are K-H's words, and a two-service welding shop
  rendered both as lies.
- `VERIFY_MARKER` (`[verify with client]`) is the standard marker.
  `PLACEHOLDER` is kept as `LEGACY_MARKER`, used only by the K-H config,
  because K-H's output is byte-locked as the equivalence proof.

### No hard-coded ages, ever

`business.foundedYear` is the only place a year is stated as a number.
`src/lib/business.ts` exposes `yearsInBusiness()` and `foundedLabel()` for
anything that needs to derive from it, and returns `null` rather than a stray
"0 years" when no founding year is known.

Copy says "Since 1987", not "39 years" — a founding year never goes stale.
The one pre-existing violation, K-H's "Four decades on the same shop floor",
was already wrong on arrival and is the single intentional diff in the
equivalence proof.

### The marker check

`scripts/check-markers.mjs`, wired into `pnpm build`, reading the built bytes
rather than the config:

| `seo.noindex` | markers in output |
|---|---|
| `true` | fine — that is what a mockup is for |
| `false` | **build fails**, listing every file and line |

So marker-freedom is not something anyone has to remember. It is a
precondition of going live, and the failure it prevents is the quiet one:
somebody flips `noindex` to publish, and a guessed phone number ships under a
real business's name. Verified by flipping a config and watching the build
fail with exit 1. **This check does not get deleted.**

## Clients

| Slug | Confirmed data | Exercises |
|---|---|---|
| `kh-machine-works` | seed, unchanged | byte-equivalence baseline |
| `kts-machine-shop` | address, phone, 1987, people, trade, weekday hours | evergreen hero; omitted email; `forms.mode: 'disabled'` |
| `american-machine-specialty` | all of it, bar updates | `equipment[]`, `updates[]`, worker form with STEP/PDF upload |
| `industrial-machine-corp` | name, address, phone — and nothing else | non-rendering sections: no `foundedYear`, `email`, `hours`, `equipment`, `updates`, no testimonials |
| `ks-welding` | address, phone, owner, trade, weekday hours | two-service layout; no `foundedYear`, so no age copy anywhere |

Every unconfirmed value is either omitted or marked. Nothing was invented to
fill a gap. All testimonials are `status: 'placeholder'` paraphrases of
relayed sentiment, with the source recorded in `sourceNote`; no review text
was copied and no Google property was accessed.

KTS weekend hours are deliberately absent: sources conflict, and an earlier
"Sat 7–12" came from a stale listing.

## Verification

- **Byte-equivalence** — `clients/EQUIVALENCE.md`. K-H's built output is
  byte-identical to its pre-refactor output on `404.html` and
  `services/index.html`; `index.html` and `about/index.html` differ only by
  the one intended headline; `contact/index.html` differs by three mechanical
  tokens from the new `ContactForm` props. The inlined stylesheet grew 74
  bytes per page from Tailwind scanning the two new components — called out
  rather than waved through.
- **Lighthouse** — see the PR body. Real numbers, default config, no
  thresholds moved.
- `pnpm install && pnpm -r build && pnpm -r typecheck` green.
