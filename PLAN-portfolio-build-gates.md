# PLAN — portfolio build gates (rulings 1–6 on PR #66's Brief)

Branch: `fix/portfolio-build-gates`  ·  worktree: `../fix-portfolio-build-gates`
Off `main` @ 4c74d69 (post-#66).

## The finding that shapes this plan

Rulings 2 and 4 are the same defect, measured in this worktree:

```
$ SITE_CLIENT=portfolio-ironvale-fabrication pnpm build
✓ 17 client(s) + 50 generated demo(s): … form fields
✓ injection surface: 67 source files, no sinks …
✓ portfolio-ironvale-fabrication: noindex build — no markers.
✗ portfolio-ironvale-fabrication: no prospect record, so nothing here can be
  checked against a source.
```

`pnpm build` is a `&&` chain. `check-fabrication` sits fourth, so its refusal
takes **`check-contrast`, `check-contact-links`, `check-links`, `gen-headers`,
`check-headers`, `check-metadata`, `check-schema` and `check-go-live` down with
it** — none of them ever ran. That is why the operator fell back to bare
`pnpm exec astro build` (the command `build-all.mjs` currently documents at
line 87), and bare `astro build` is precisely the path with no `gen-headers` in
it. **The missing `_headers` on first deploy was not an oversight in the deploy
step; it was the fabrication gate's exit, one gate earlier.**

So ruling 4's gate is also ruling 2's permanent fix: once a record-less build
can pass `check-fabrication`, `pnpm build` runs end to end for a `portfolio-`
slug and `gen-headers` is in the path by construction — not as a step somebody
has to remember. I would rather fix it there than bolt a headers step onto a
deploy script, and I want that reading confirmed before I write it.

## Ruling → change

### (4) `check-fabrication` covers record-less builds — the core change
`packages/template/scripts/check-fabrication.mjs`. Today the no-record `catch`
prints and returns `false`. It becomes a three-way classification:

| build | behaviour |
| --- | --- |
| `zz-fixture-*` | skipped with a printed note, passes. Fixture-exempt per the ruling. |
| `portfolio-*` | **scanned with an empty allowance list** — every claim pattern, nothing permitted except the footer copyright year (same rationale as the normal path: a fact about the build, not about the business). |
| anything else with no record | **stays a hard error**, wording unchanged. |

That third row is a deliberate narrowing of the ruling's words and it is Brief
item 1 below. Verified reachable: the known-issues entry records that the
patterns were hand-run against all five builds at 0 findings, so this should
land green — and a green gate proves nothing until I have seen it red, so:

**Red first.** A claim is planted in one `portfolio-*` config (a `since 1974`
in a service body), the gate is shown failing on it, the transcript goes to
`docs/evidence/`, the plant is reverted, green re-run. Per "a new gate lands
with its failure demonstrated first".

### (2) the headers step, permanently
- `build-all.mjs` lines 86–87: the documented command becomes
  `SITE_CLIENT=<slug> pnpm build`, since it now works. The comment gains one
  line saying why the full chain matters (it is what generates `_headers`).
- `packages/template/README.md`: a short **Deploying a demonstration build**
  section — build, confirm `dist/<slug>/_headers` exists, deploy to that
  slug's own project, delete `dist/<slug>/` before any batch.
- No change to `deploy-mockups.mjs`; portfolio builds are one project each and
  deliberately outside the mockup fleet (c2f3663).

### (1) known-issues one-liner
`docs/known-issues.md`, beside the founder-site entries: the reveal is CSS-only
and Firefox renders it complete but unanimated — **accepted, do not "fix" it by
adding a script**; `packages/founder-site` fails its build on any `<script>`.
Points at the decisions.md ruling of 2026-08-18 rather than restating it.

### (5) the 59, sourced
`packages/founder-site/src/site.ts:102-110`. The comment keeps the number and
re-sources it: 50 from the measured live fleet of 2026-08-17
(`docs/evidence/r1-r2-r3-live-fleet.txt`, "demos fetched: 50/50") plus the nine
earlier demo hosts, and states it is Ryan's number to maintain. No value change.

### (3) the `--preset` gap → an issue, not a cross-stream edit
Measured: `packages/prospect/src/cli.ts:36` hardcodes
`["forge","precision","heritage"]` while `ThemePreset`
(`packages/prospect/src/types.ts:109`) and the template's `presets.json` both
carry `meridian` and `apex`.

```
$ node dist/cli.js --preset meridian
unknown preset "meridian". Known: forge, precision, heritage
```

Filed as one `follow-up` issue against `packages/prospect` with that repro and
the one-line sketch (derive `PRESETS` from `loadPresets()` rather than
restating it). **No code in `packages/prospect` this stream.** Open issues
stand at 10, under the ~15 cap.

### (6) `/about`
No action. Recorded here so the ruling is visibly accounted for.

## Paths
`packages/template/scripts/check-fabrication.mjs`, `.../scripts/build-all.mjs`,
`packages/template/README.md`, `packages/founder-site/src/site.ts` (comment
only), `docs/known-issues.md`, `docs/decisions.md`, `docs/evidence/` (new),
this file (deleted by the PR). One `portfolio-*.config.ts` touched and reverted
within the red-demo commit.

## Gates
`SITE_CLIENT=<each of the five portfolio slugs> pnpm build` (all 12 gates
green, `_headers` present in each `dist/`), `pnpm build:all` unchanged and
green, `check-fabrication --all`, both `zz-fixture-*` builds, founder-site
`pnpm build`. Byte-identical check on the nine hand-authored clients — that is
the "existing clients render byte-identical" rule and this gate touches the
path all nine run through.

## Lane
**Held.** The diff touches a gate script and `packages/template/**`, so the
green lane is closed to it by condition 2 regardless of outcome.

## Decision Brief (carried to the PR)

1. **A record-less build that is not `portfolio-` or `zz-fixture-` should stay
   a hard error.** The ruling says "any build lacking a prospect record",
   which read literally would also relax the case where a *real* prospect
   demo's record failed to ingest — a slug typo, a half-written
   `prospects/<slug>/`. That error is load-bearing: it is the only thing that
   notices a real business's site built against no source at all. I propose
   scanning only the two declared record-less prefixes and leaving everything
   else erroring. Recommendation: **narrow it as described.** Say so if you
   meant the wider reading.
2. **Ruling 4 asked for "this PR or a named follow-up, your judgment on
   size."** Measured, it is one function's control flow in one file — small,
   and it is also the permanent fix for ruling 2. Recommendation: **this PR**,
   both together.
