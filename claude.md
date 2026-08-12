# site-factory — agent rules

## Ground rules
- Plan first: write PLAN-<stream>.md and STOP for approval before code.
  A prompt ending in explicit execute-through language counts as pre-approval.
- STOP and report on ambiguity. Never guess silently.
- Assert current branch before every commit. Push before reporting done.
- Stack: Node 20, TypeScript strict, pnpm workspaces. No other package managers.
- Secrets live in .env / wrangler.local.jsonc (gitignored). Never commit keys,
  tokens, or client contact data. Never echo secret values into chat, logs, PRs.
- NEVER automate or scrape Google Search/Maps or any Google property.
  Discovery uses the official Places API only, key from .env.
- Never fabricate data. Unmeasured = "unavailable", never estimated. Facts
  about real businesses require evidence; unsourced claims are markers, never
  prose.
- Audits are read-only GETs. Max 1 page navigation/sec/domain, 10/site.
  A Lighthouse run counts as one navigation.

## Worktrees & claims
- Every stream: fresh worktree + unique branch, worktree dir = branch name.
  Branch-push is the claim; check `git branch -r` before creating yours.
- One session per worktree, ever. If files change that you did not write:
  STOP, commit "WIP: foreign writes detected", ask Ryan. git stash is banned.
- Cold start: copy .env and gitignored data/*.csv fixtures from the main
  checkout into your worktree. They are inputs, never commits.
- Ownership is granted per task prompt, by path. No grant = not yours. An edit
  outside granted paths must be necessary for acceptance, minimal, and listed
  in the PR under "Cross-boundary edits" — its presence HOLDs the PR.

## PRs & merging (policy v3 — replaces ALL earlier merge rules)
- Finish = push + open a PR targeting main. Integration branches exist only
  for an explicitly assigned integrator.
- Every PR body: paths touched (shared/cross-boundary flagged), every gate
  with its result, anything deliberately not done, and a Decision Brief —
  numbered judgment items, each with a recommendation. None = say "Brief: empty".
- Before opening (and again if the PR goes stale): merge main INTO the branch
  and re-run the FULL gate suite on the merged state. Green pre-merge does not
  count. A held PR is kept mergeable while it waits; that duty is the author's.

### Green lane — self-merge allowed only when ALL hold
1. Merged-with-main gates green, no conflicts.
2. Diff touches NONE of: clients/** or any content shipped about a real
   business; packages/template/src/types/**; worker/ or worker-demo/;
   scripts/deploy/**; any gate script; root package.json, pnpm-workspace.yaml,
   pnpm-lock.yaml, .gitignore, CLAUDE.md; anything reading/writing .env*;
   any path outside your granted paths.
3. No new dependencies.
4. Nothing outward-facing: no deploys, no Worker behavior, no email paths.
5. Decision Brief is empty.
Self-merge posts the PR link + gate results. One self-merged regression and
this lane closes.

### Held lane — everything else
- Stop at the PR, state which condition failed, keep it current with main.
- If 2+ held PRs are queued, say so and propose an integration batch.

### Integration batches
- An explicitly assigned integrator: fresh worktree, integrate/<name> off
  main, merge the named branches serially per the precedence rules in the
  task, full gates after each, ONE PR to main with a per-branch conflict log
  and combined Decision Brief. The integrator never merges to main.

## Verification norms
- Green ≠ correct: acceptance is behavior of the built artifact.
- Verify you're measuring your own build — ports move; confirm client/URL
  before trusting a run.
- Existing clients render byte-identical unless the task says otherwise; any
  drift is a defect in this work.
- A new gate lands with its failure demonstrated first, then the fix.