# PLAN — loose-ends

Three mechanical follow-ups, every ruling pre-given in the task prompt. No open
questions; nothing here is a judgment call to be approved. The prompt ended in
explicit execute-through language, which stands in for the STOP.

## 1. `freePort` consolidation — PR #19 Brief, ruled

Three copies of the same eight-line function exist today:

| Copy | Fate |
|---|---|
| `packages/audit/src/cli.ts` (local, unexported) | becomes the canonical one, moved out to its own module |
| `packages/shortlist/src/browser.ts` (exported) | deleted; imports `@site-factory/audit` |
| `packages/shortlist/test/e2e-sites.test.mjs` (test scope) | deleted; imports `@site-factory/audit` |

- New module `packages/audit/src/port.ts` holding `freePort`, carrying the
  explanation of *why* an ephemeral CDP port is chosen before launch.
  A dedicated module rather than a corner of `lighthouse.ts`: `packages/audit`
  is one concern per file (`cache`, `checks`, `network`, `probe`, `throttle`),
  and allocating a port is not running Lighthouse.
- Exported from `packages/audit/src/index.ts`.
- `packages/audit/src/cli.ts` imports it instead of defining it.
- `packages/shortlist/src/browser.ts` imports it from `@site-factory/audit`
  (already a declared dependency) and no longer defines or re-exports it.
- `packages/shortlist/src/index.ts` drops `freePort` from its public surface.
  It is `@site-factory/audit`'s API; re-exporting another package's function is
  the same duplication one level up. Nothing outside the deleted copies
  consumes it.

Out of scope: `scripts/pitch/compare.mjs` has a fourth copy. `scripts/` is not
granted to this stream, and that script has no dependency edge to the workspace
packages, so pointing it at one is a packaging change rather than a repoint.
Recorded in the PR as deliberately not done.

## 2. `debugPort` becomes required on `assess()` — PR #19 not-done, ruled: do it

`packages/shortlist/src/run.ts` currently declares `debugPort?: number` and
falls back to `DEFAULT_DEBUG_PORT = 9222`. That fallback is what let the sweep
CLI launch a bare browser and still typecheck, while every Lighthouse-derived
check silently read `unavailable`.

- `AssessOptions.debugPort` becomes `debugPort: number` — required.
- `DEFAULT_DEBUG_PORT` and the `?? DEFAULT_DEBUG_PORT` at the `auditOne` call
  site are deleted. `auditOne` already requires the port; nothing changes for it.
- Callers, all of which already pass a port and so need no edit:
  - `runAuditStage` (`browser.ts`) — passes the port it launched with. Its
    `AuditStageOptions` already `Omit`s `debugPort`, so the option stays
    correctly invisible to the CLI.
  - `packages/shortlist/src/cli.ts` — goes through `runAuditStage`.
  - `packages/audit/src/cli.ts` — calls `auditOne` directly with its own port.
  - `test/e2e-sites.test.mjs` — passes `debugPort` at all three `assess` calls.
  - `test/launcher.test.mjs` — injects `assessImpl`, never calls `assess`.

**Failure-first proof.** A signature change has no red-then-green commit pair to
point at, so the record is a transcript: reconstruct the pre-#19 wiring (launch
a browser with no `--remote-debugging-port`, call `assess` with no `debugPort`)
in a scratch file under `packages/shortlist/src/`, run `pnpm typecheck`, capture
the compiler error, delete the file. That transcript goes in the PR body. The
class PR #19 fixed by wiring is now refused by the compiler.

## 3. Root `PLAN.md` — PR #20 Brief item 2, ruled: delete

`PLAN.md` carries two scaffold decisions that are not stated anywhere else:

1. Package dirs live under `packages/` rather than at the repo root.
2. Each package carries its own `tsconfig.json` + `typescript` devDep so
   `pnpm -r build` resolves without relying on root hoisting.

Both are appended to `docs/decisions.md` as dated ledger lines sourced to
`PLAN.md`'s blob URL pinned at `bfee8bc`, then `PLAN.md` is deleted. Root
carries no plan docs.

`docs/decisions.md`'s "Where the sources went" table records `PLAN.md` as
*kept*. That row is **not edited** — the ledger is append-only and a reversal is
a new line saying so. A third appended line states the reversal and gives the
pinned location, which is exactly the mechanism the file documents for itself.

## 4. Explicitly out of scope

The fourteen stale comment repoints (PR #20 Brief item 1). Deferred, not
declined: several live inside `packages/template`, and comment-only edits there
would hand the in-flight coverage stream trivial merge conflicts for zero
urgency. One pass after coverage merges, repointing each comment to
`docs/decisions.md`.

## Gates

Merge `main` into the branch first, then on the merged state:
`pnpm install`, `pnpm -r build`, `pnpm typecheck`, `pnpm test`, and
`packages/template`'s `build:all` gate chain.

## Green lane

Checked honestly against all five conditions at the end, and stated either way.
Expected to hold: the diff is `packages/audit` + `packages/shortlist` src/tests
plus `docs/decisions.md` and the `PLAN.md` deletion, no excluded path, no new
dependencies, nothing outward-facing, and every decision above arrived ruled.

## Brief

Empty. Everything above was ruled in the task prompt.
