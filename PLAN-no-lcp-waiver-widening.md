# PLAN — fix/no-lcp-waiver-widening

Scope is pre-ruled. PR #24 measured the fingerprint and stated the exact
boundary the waiver may be widened to; it deliberately did not write the code.
This stream writes exactly that code and nothing adjacent.

- Ruling: `docs/decisions.md` § 2026-08-12 — NO_LCP, measured (PR #24).
- Boundary and enumerated refusals: `docs/known-issues.md` #2, "What this
  authorises, and its exact boundary".

## The change

`isKnownNoLcp` in `scripts/live-smoke/checks/lighthouse.mjs` currently allows
exactly one shape: `NO_LCP` on the LCP audit **and** every other weighted
performance audit scored. Widen it by one fingerprint:

> `NO_LCP` on the LCP audit **and** `total-blocking-time` as the *only* other
> unscored weighted audit.

The `NO_LCP` precondition is unchanged and still short-circuits first, so the
widening cannot be reached from any other cause. The unscored set must be
empty or exactly `['total-blocking-time']`; anything else refuses.

The four ledgered refusals stand, unchanged and untouched:

1. LCP absent for any other reason (`PROTOCOL_TIMEOUT`, anything else).
2. `total-blocking-time` unscored *without* `NO_LCP`.
3. Any *third* weighted performance audit unscored, `NO_LCP` present or not.
4. `docs/known-issues.md` no longer carrying a `NO_LCP` entry.

Refusal 2 is already enforced by the `NO_LCP` short-circuit and stays that way —
it gets a case of its own so the enforcement is proved, not assumed.

## The selftest

`scripts/live-smoke/selftest.mjs`'s single "a run where other performance
audits also failed is NOT allowed" case becomes three, per the task:

| case | LCP audit | unscored others | expected |
| --- | --- | --- | --- |
| TBT with `NO_LCP` | `NO_LCP` | `total-blocking-time` | **allowed** |
| TBT without `NO_LCP` | `PROTOCOL_TIMEOUT` | `total-blocking-time` | refused |
| another audit with `NO_LCP` | `NO_LCP` | `speed-index` | refused |

The existing `otherCause`, missing-LHR and three waiver-document cases are
untouched.

## Failure-first

The new allowed-case is written and run against the *unchanged* rule first, and
its red recorded in the PR body. Only then does `lighthouse.mjs` change.

## Gates

`pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm smoke:selftest` — on the
merged-with-main state. `pnpm smoke` is not run: it hits the live fleet and
this stream changes no deployed artifact.

## Lane

**HELD** — the diff touches a gate script. Green lane condition 2 excludes it,
so this stops at the PR regardless of gate colour.
