# Fabrication allowances: ingested **replaces** curated — the failure

Evidence for Decision Brief #1, captured **before** the fix, per the repo's rule
that a gate change lands with its failure demonstrated first.

`check-fabrication.mjs:151` composes a slug's allowances as

```js
allowed = [ ...(ingested ?? allowancesFor(prospectFor(factsFrom))), … ]
```

so an ingested record does not add to the hand-authored copy pack, it **stands
in for it**. For a slug that has both records — a hand-authored client that has
also been run through the demo pipeline — the reviewed copy pack is dropped, and
every sentence sourced only from it becomes a fabrication finding.

## Reproduction

`prospects/` is gitignored, so this state does not live in git. It is produced
by running the pipeline on a slug that is also a hand-authored client:

```
pnpm -r build
pnpm demo -- --prospect kh-machine-works --skip-places --skip-website --skip-deploy
```

## The A/B

Both runs below are the **same `dist/kh-machine-works`**, checked twice. The only
thing that changes between them is whether `prospects/kh-machine-works/prospect.json`
exists on disk.

```
$ node scripts/check-fabrication.mjs kh-machine-works       # prospects/kh-machine-works/prospect.json PRESENT

✗ kh-machine-works: 1 claim(s) with nothing behind them.

    kh-machine-works\about\index.html
      "cheapest" reads as a superlative or ranking
      …We are not the cheapest shop in the county and we do not pretend to be. What we offer is a machinist who will pick up the phone, tell you honestly whether the job is worth doing, and stand behind the work when it leaves the building.…

  Each one is a sentence this business would be making a claim with.
  Fix by adding the fact to packages/copy/src/prospects/kh-machine-works.ts with its
  source, by marking it, or by rewriting the line. Do not delete this check.

exit: 1
```

```
$ node scripts/check-fabrication.mjs kh-machine-works       # same dist, record MOVED ASIDE
✓ kh-machine-works: every claim in the built pages traces to a sourced fact (2 testimonial quote(s) excluded).
exit: 0
```

## Why this is the gate being wrong, not the copy being wrong

The flagged sentence is a disclaimer — it *disclaims* the superlative the pattern
matched — and it is sourced. It is a `voice` entry in the copy pack, carrying
its provenance:

`packages/copy/src/prospects/kh-machine-works.ts:136-142`

```ts
{
  phrase:
    'We are not the cheapest shop in the county and we do not pretend to be. …',
  source:
    "src/content/about/kh-machine-works/about.md — written by the template stream from K-H's public description of itself; not the owner's words",
  attributed: 'ours-pending-confirmation',
},
```

`allowancesFor()` emits every `voice[].phrase` as an allowance. The gate is not
failing to find a source; it is refusing to look at the one it has, because a
thinner machine-written record turned up beside it.

Two things make this worse than a one-off false positive:

- **It is machine-local and invisible in git.** `prospects/` is gitignored, so
  the same commit is green on a machine that has never run the demo and red on
  one that has. Nothing in the diff explains the difference.
- **It persists.** The poisoning is not scoped to the demo run — it changes that
  client's *normal* build, for every later build, until someone deletes a
  directory git does not track.

Ruled: **union, not replace** (see the commit that follows this one). Replace
semantics stay correct for a purely generated prospect, where the existing
reasoning — nobody has read that copy — genuinely holds, and a slug with neither
record still errors out hard.
