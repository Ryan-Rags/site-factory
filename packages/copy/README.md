# @site-factory/copy

The copywriting engine. It takes everything we can source about one local
business and writes that business's site copy: headlines, service
descriptions, trust blocks, an FAQ, town-by-town service-area sections, per-page
SEO and the structured-data seed.

It fetches nothing. No API key, no network call, no Google property. Prospect
data arrives on a record from the discovery pipeline; this side of the line only
writes.

## The one rule

**Every sentence is derived from a sourced fact, true of the whole trade, or a
marker. There is no fourth kind, and no code path that produces one.**

Three mechanisms enforce that, at three different moments:

| When | What | Catches |
| --- | --- | --- |
| Compile | `Fact<T>` requires `evidence` | a value with no source |
| Generation | `assertPublishable` over every emitted string | a *sentence* containing an unsourced claim |
| Post-build | `check-fabrication.mjs` over `dist/` | a claim typed into a config by hand, bypassing both |

The middle one is the interesting one. Types stop you inventing a value; they
do nothing about `'Serving Bergen County since 1985'`, which is a plain string
every type here accepts. So each generated string is scanned for the shapes a
claim takes — a year, a span of time, a credential, an ownership status, a
superlative, a guarantee, a price, a measured capability, a review count — and
any match that does not appear in the allowances built from that prospect's
`Fact`s throws `FabricationError`.

The scan is deliberately noisy. A false positive costs one allowance entry with
a source beside it; a false negative publishes a false claim under a real
business's name. Those are not symmetric.

## Input

```ts
const record: ProspectRecord = {
  slug: 'kts-machine-shop',
  niche: 'machine-shop',
  town: fact('Elmwood Park', 'address published on the shop listing'),
  foundedYear: carried(1987, 'approved mockup config — read back to the owner'),
  traits: {
    'walk-ins': fact('Walk-ins welcome', 'stated by the shop'),
    'no-minimum': unconfirmed('traits.no-minimum', 'Is there a minimum order?'),
  },
  // …
};
```

- `fact(value, evidence)` — publishable. Empty evidence throws.
- `carried(value, where)` — publishable, but inherited from an earlier mockup
  rather than sourced afresh. Listed separately in `REPORT.md` under *read back
  to the owner*, so the weaker provenance stays visible instead of dissolving
  into the general population of facts.
- `unconfirmed(field, question)` — becomes `[verify with client]` in the copy,
  and the question in `REPORT.md`.

`traits` are keyed rather than free text because the FAQ and trust block need to
*ask* whether a shop takes walk-ins, and a generator matching on the words of a
free-text differentiator would answer "yes" to `'No walk-ins'`.

## The FAQ drops rather than pads

The target is eight questions. A question whose answer the record cannot
support is dropped, not hedged — Industrial Machine Corporation, where three
facts are verified, gets six. That is the correct output. An FAQ is the one
section a reader arrives at with a real question, and padding it with "Contact
us to learn more about our commitment to quality" costs more trust than the
missing entry would. Every dropped question is in `REPORT.md` as a question for
the owner.

## Service-area sections, not per-town pages

One page, one block per town. Never a page per town — that is the doorway-page
pattern, demoted for years and worse for a reader anyway.

Town copy may never contain a distance, a drive time, a landmark, a
neighbourhood or a highway. We do not know them, and invented local colour is
the single most recognisable tell of automated local copy — a local spots it
instantly. Only towns on the prospect record get sections: "we serve X" is the
business's claim, so it lives with the business's other facts.

`bergen.ts` holds Bergen County's 70 municipalities. `checkProspects()` fails a
record whose county is Bergen and whose towns are not, because a misspelled
municipality does not error — it silently falls out of the Bergen partition and
the client loses a section nobody notices.

## Commands

```sh
pnpm --filter @site-factory/copy build

node dist/cli.js check          # generate every client, publish nothing
node dist/cli.js report         # write REPORT.md
node dist/cli.js emit --all     # write the markdown under packages/template/src/content/
node dist/cli.js show <slug>    # dump one client's generated output as JSON
```

From the repo root: `pnpm copy`, `pnpm copy:report`, `pnpm copy:emit`.

`check` is the one for CI. Generation is where the guard runs, so generating
every client and discarding the result is a full assertion that no client's copy
makes an unsourced claim — with no fixtures, and no way to drift from what the
build emits, because it is the same code path.

## How it reaches a site

`packages/template/clients/from-copy.ts` calls `generate()` and hands the result
to a client config. Configs are therefore in two halves:

- **Generated** — hero, trust strip, services, About, CTA, page headings, SEO,
  FAQ, service areas. Do not hand-edit. A string typed in afterwards has never
  been checked by anything.
- **Hand-written** — identity, theme, brand assets, testimonials, equipment,
  forms, `noindex`. None of it is copy. A colour is not a claim.

Long-form prose is emitted to `src/content/{about,services}/<slug>/` by
`cli.js emit`, because Astro content collections need files on disk.

## Adding a niche

Add a pack in `src/niches/`, register it in `src/niches/index.ts`, and add the
id to `NicheId`. A pack holds what is true of a *trade*: the work's name, the
service taxonomy, the question bank, the town line. Nothing about any specific
business — and if a pack tries, the guard fails every client using it on the
first run.
