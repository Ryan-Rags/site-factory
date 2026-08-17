# PLAN — batch-2-readiness

Stream: `ops/batch-2-readiness`. Worktree `D:/sf-batch-2-readiness`, off
`origin/main` @ `30991a5` (post-#54).

Ordered by Ryan 2026-08-17 as four rulings on #54's Decision Brief, execute-through.
HELD is expected: the work is outward-facing (a Worker redeploy and 50 Pages
deploys) and the Brief will not be empty.

## Base

#54 was still open when this stream started — `main` was at #50 and there was no
"post-#54 main". Ryan chose (of three options offered) that this session merge
#54 first. Squash-merged as `30991a5`; this branch is cut from it.

## The four rulings, and what each one costs

### R1 — forms on prospect demos

Root cause of Brief 2 is two lines in `packages/prospect/src/project.ts`: a
prospect with no confirmed email address gets `forms.mode: 'disabled'`, and
email coverage on this batch is 0 of 50. `resolveForms()` in
`packages/template/site.config.ts` already overrides any mode to `worker` when
`DEMO_FORM_ENDPOINT` is set, so the demo build path never opted in.

- The emitter gains the standard demo forms config: `mode: 'worker'`,
  `workerEndpoint` from `DEMO_FORM_ENDPOINT`, and **no `fields` block** — the
  template's documented default *is* name and message required with phone/email
  as the either-or pair, and it is also the Worker's default. Emitting an
  explicit `fields` block would force a `PROSPECT_FIELDS` entry per prospect and
  a drift check the gate cannot perform for a generated config.
- `prospectId` needs no work: `src/lib/quote-form.ts` already sends
  `clientSlug` as `prospectId` whenever the demo endpoint is in play.
- A prospect with a confirmed email keeps `mailto` when no demo endpoint is
  configured, so a real client build cannot inherit the demo endpoint — the
  standing rule from PR #13.

Registry, so `check-form-fields.mjs` can assert the wider set:

- `packages/template/prospects/known.json` — **slugs only**. Real-business
  slugs are public names; names, phones and place ids stay out of git under the
  standing rule. Committed.
- The gate's bijection becomes
  `KNOWN_PROSPECTS === clients/index.ts ∪ prospects/known.json`, asserted in
  both directions. `PROSPECT_FIELDS` comparison stays clients-only: there is no
  config file on disk for a generated prospect, so there is nothing to compare
  and a missing entry correctly means "the defaults".
- Failure demonstrated before the fix: the gate is run with the 50 slugs in
  `KNOWN_PROSPECTS` and no `known.json`, reproducing #54's 100 problems.
- `worker-demo/wrangler.jsonc` (committed) and `wrangler.local.jsonc` (local,
  gitignored) both gain the 50. **No `PROSPECT_RECIPIENTS` entries** — every
  prospect lead falls back to `MAIL_TO`, which is the pitch-stage behaviour
  Ryan ruled for.

Verification that ruling 1 needs and #54 could not do: `live-smoke` and
`check-form-fields` both resolve slugs through `clients/index.ts` (Brief 5,
unruled). The form path is therefore smoked by hand against the deployed
Worker on 2 sample prospects — see "Smoke" below.

### R1a — the customizer's send button (Ryan's note on R1)

Verified before touching anything: `Customizer.astro` posts
`content-type: application/json` to the same endpoint, and the Worker's first
act on a POST is `await request.formData()`, which throws on a JSON body and
returns `400 bad_request`. Today that path is dead on a prospect demo because
`endpoint` is empty; **R1 is what lights it up**, so R1 is what would put a
"That did not go through" in front of 50 prospects.

Fixed inside R1's own blast radius: the Worker accepts a JSON design-selection
submission on the same endpoint, through the same origin gate, the same
`KNOWN_PROSPECTS` gate, the same rate limit and the same
KV-before-email ordering, and mails it to the routed recipient with a subject
that says it is a design choice, not a lead. Carried as a Brief item because it
is a Worker behaviour change beyond the literal wording of the ruling.

### R2 — the title formula (#55)

All 17 failures are `index.html` only — the home title, which is used bare.
Interior pages are `%s | <name>` and the longest composed one in the batch is
60 chars, so they are not at risk. Formula today:

    `${name} — ${titleTrade} in ${town}`      (packages/copy/src/generate/seo.ts)

Two facts that shape the fix:

1. `check-metadata.mjs` measures the **raw HTML** `<title>`, so `&` counts as 5
   characters. Avishay is 90 chars in the config and was reported at 94. The
   copy engine must therefore budget the *escaped* length, or it will agree
   with itself and disagree with the gate.
2. The tiers must engage **only when the primary formula overflows**, so every
   title that passes today is byte-identical afterwards. That is what keeps the
   8 hand-authored clients out of this change.

Tiers, in Ryan's order, hard ceiling 70 on the escaped string:

1. `name — trade in town` (unchanged; today's output)
2. drop the locality suffix → `name — trade`
3. shorten the trade descriptor (the niche pack's own short noun, then the
   pack noun) → `name — <shorter trade>`
4. `name` alone

The business name is never truncated at any tier. A name that alone exceeds 70
escaped characters is not truncated either — it is emitted whole and reported,
because a machine cutting a business name is the failure this file's own header
warns about. None of the 50 is in that case (longest name: 45 escaped chars).

Failure demonstrated first on one of the 17 (`avishay-…`, the 94-char worst
case) before the formula changes, then all 17 re-run, then all 50 deployed.

### R3 — preset variety

`design.ts` pins `scheme = defaultScheme` and `accent = accents[0].id`, so 44
meridian prospects get one look. `presets.json` offers 8 accents per scheme and
2 schemes per family — up to 16 within a family, with the family-per-niche
mapping untouched.

- Scheme: rotate across the schemes whose palette clears contrast with at
  least one accent; a family where only one qualifies keeps `defaultScheme`.
- Accent: rotate across that scheme's swatches that pass
  `designAccentPasses()` against the tone actually in play. AA-passing only,
  no adjusted colours.
- `brandAccent` precedence is unchanged: a prospect's own accent still wins
  when it clears the chosen tone, and is still dropped rather than nudged.

**Key: `placeId` — and the record does not carry one.** `ProspectConfig` has no
`placeId` field, so the ruling is not satisfiable as things stand. Fix:
`placeId` becomes an optional sourced field, persisted from the lead row's
place id on a full ingest, and lazily filled from the sweep CSV (`placeId,name,…`
matched on `slugify(name)`) when a record predates the field. Zero Places
calls — the call freeze holds. Rotation keys on the place id, falling back to
the slug with a run note when there is none.

Re-ingest is **not** an option for this batch: `--skip-places` would blank the
reviews, rating and photos the 50 records already carry. Everything runs
`--skip-ingest`.

### R4 — gitignore

`/data/*` ignored wholesale, with an allowlist re-admitting
`data/businesses.sample.csv`. `roster-50.json` and `data/batch-log/` — both of
which showed as untracked in this worktree on the first `git status`, evidence
captured — become ignored. Closes #36.

## Steps

1. R4 first (it is the smallest and it protects every later step from a stray
   `git add`), with the before/after `git status` as evidence.
2. R2 in `packages/copy`, failure-first, unit tests, then rebuild the 17.
3. R3 in `packages/prospect`, with the `placeId` field and its tests.
4. R1: emitter, `known.json`, the gate, both wrangler files. Gate failure
   demonstrated first.
5. R1a in `worker-demo/src`.
6. Full gate suite on the merged-with-main state.
7. Deploy the Worker. Rebuild and redeploy all 50.
8. Smoke the form path on 2 sample prospects.
9. Refresh `data/call-sheet.csv` from the 50 manifests.
10. `docs/decisions.md`: Ryan's four rulings, dated, one line each.
    `docs/known-issues.md`: whatever measurement leaves unresolved.

## Smoke

The honeypot check runs **before** the `KNOWN_PROSPECTS` check in the Worker, so
a honeypot POST answers 200 for an unknown slug too and proves nothing about
admission. The smoke therefore uses three probes per sample prospect:

- unknown slug, no honeypot → expect `422 unknown_prospect` (the guard is live)
- registered slug, no honeypot, deliberately incomplete fields → expect
  `422 validation_failed`. This is the discriminator: reaching field validation
  proves the slug cleared `KNOWN_PROSPECTS`. No mail, no KV lead.
- registered slug, honeypot filled, complete fields → expect `200`, no mail

Plus the built artifact: `contact/index.html` carries one `<form>`, the endpoint
and the right `prospectId`.

## Ownership

Granted by the task prompt, by path:

- `packages/copy/**` — R2
- `packages/prospect/**` — R1, R3
- `packages/template/prospects/known.json` — R1 (new)
- `packages/template/scripts/check-form-fields.mjs` — R1 (a gate script)
- `packages/template/worker-demo/**` — R1, R1a
- `.gitignore` — R4
- `data/**`, `prospects/**` — gitignored generated data, never committed
- `docs/decisions.md`, `docs/known-issues.md` — the ledger duty
- `PLAN-batch-2-readiness.md` — deleted by the PR that completes this stream

Cross-boundary edits expected, and each one HOLDs the PR on its own:

- `packages/template/scripts/check-form-fields.mjs` — a gate script
- `packages/template/worker-demo/**` — Worker behaviour, plus a deploy
- `.gitignore` — root config
- `PLAN-prospect-batch-50.md` — **deleted**. #54 was supposed to delete its own
  plan file and did not; it is stranded on main. Residue, not my stream's, so
  it is listed rather than done quietly.

No edits to `packages/template/src/types/**`, `clients/**`, `worker/`,
`scripts/deploy/**`, root `package.json`, `pnpm-workspace.yaml` or
`pnpm-lock.yaml`.

## Not doing

- Making prospect demos first-class to `live-smoke` (Brief 5). Unruled; the
  form path is smoked by hand instead and the gap stays in known-issues.
- The homepage email harvest (Brief 6). Unruled and still nothing to harvest.
- #51, #52, #53. Parked under the call freeze.
