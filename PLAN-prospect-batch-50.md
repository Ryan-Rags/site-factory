# PLAN — prospect-batch-50

Stream: `ops/prospect-batch-50`. Worktree `D:/sf-prospect-batch-50`.
Ordered by Ryan 2026-08-16 as an execute-through batch (B2→B6) after he
reviewed and approved the shortlist printouts.

## What this stream does

Build and deploy 50 prospect demo sites from the 2026-08-16 Bergen re-sweep,
and hand Ryan a call sheet.

## Roster

Source: `data/prospects-scored.csv` (the re-sweep, post-#50). Filter, exactly as
reviewed: rows with a score, with non-empty `types`, and `nicheMatch=match`.
Pool after that filter: 640 rows.

Five rows removed by Ryan's review:

| Rank | Business | Why |
|---|---|---|
| 2 | pool contractor | GC pack mislabel risk; parked for a pool pitch |
| 11 | out-of-county GC | 856 + ambiguous "Washington Township" — Gloucester, not Bergen |
| 14 | handyman franchise | toll-free + 1453 reviews |
| 19 | sewing-machine dealer | `manufacturer` allowlist weak accept |
| 46 | existing client | already `kts-machine-shop` |

Backfills past those five are auto-vetted by the codified cut rules rather than
another review stop:

- (a) matches a client by placeId, or by name **and** phone
- (b) toll-free number **and** >500 reviews
- (c) bare-service accept whose name fails `/weld|fab|steel|iron|metal/i`
- (d) out-of-region area code **and** an ambiguous town name

The rules removed nothing the review had not already caught; one new row
(`r-and-r-building-services-nj`) entered at 50 to hold the count.

## Registry hygiene — the root cause behind exclusion 46

`packages/shortlist/client-place-ids.json` had **every** slug mapped to `""`,
so client exclusion by place id was inert and the sweep offered an existing
client as a prospect. Filled from the sweep's own rows, zero Places calls, on
the bar that **both** name and phone corroborate the client's config. All eight
real clients corroborated. A name-only substring hit (`"Machines"`, no phone)
matched two slugs and was rejected by exactly that bar.

## Provenance rule for generated records

`prospects/<slug>/prospect.json` is built from CSV columns only. Anything the
sweep did not persist stays `unavailable` with its reason — `emptyProspect`
already returns that, so the safe action is to leave a field alone. Address
carries locality and region only: no street or postal code was persisted, and
both are optional on `Address` precisely so an unconfirmed one is omitted.
Palette and preset are `generated` and flagged `createdByUs`, never presented
as the business's own brand.

## Steps

- **B2** generate 50 records + sites, full gates. A red gate skips that
  prospect and is reported, never worked around.
- **B3** KNOWN_PROSPECTS additions — **dropped, see below**.
- **B4** worker redeploy — **dropped, see below**.
- **B5** 50 Pages deploys, one project per slug (`<slug>-preview`).
- **B6** smoke against the baseline, and `data/call-sheet.csv`.

### Why B3 and B4 were dropped

`check-form-fields.mjs` asserts a bijection between `KNOWN_PROSPECTS` and
`clients/index.ts`. Registering the 50 turned the gate red with 100 problems
(50 slugs × 2 config files) and broke the build for every prospect after the
edit. That is the gate doing its job.

It is also moot: a prospect demo built from `prospects/` ships **no contact
form at all** — the built `contact/index.html` has zero `<form>` elements,
against one for a client build. No form means no POST, no `prospectId`, and
nothing for `KNOWN_PROSPECTS` to admit. With no worker-visible change, B4 has
nothing to redeploy either.

Registering them anyway would have required editing a gate script — held-lane,
outside this grant, and the wrong fix regardless.

## Ownership

- `packages/shortlist/client-place-ids.json` — the registry fix.
- `prospects/**`, `data/**` — gitignored generated data, never committed.
- `PLAN-prospect-batch-50.md` — deleted by the PR that completes this stream.

No edits to `packages/template/src/types/**`, `worker-demo/`, gate scripts, or
root config. The one `worker-demo/wrangler.jsonc` edit made during the run was
reverted in full; `git checkout` restored it and the gate is green.
