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
- prospects/<slug>/ records are gitignored but canonical at
  D:\site-factory\prospects\; worktrees copy IN at cold-start and copy BACK any
  records they create or refresh before the stream ends. A worktree is never the
  only holder of a real-business record.
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

## Plan files & docs
- A stream's PLAN-<stream>.md lives on its branch, not on main. The PR that
  completes the stream deletes it.
- Durable rulings are appended to docs/decisions.md in that same PR: one dated
  line each, citing the PR number or plan file it came from. Append-only — a
  reversal is a new line saying so, never an edit to an old one.
- Open defects and unmeasured properties go in docs/known-issues.md, with a
  repro. Settled rules go in decisions.md; the two are not interchangeable.
- Evidence images and transcripts under docs/evidence/ are welcome during
  review and are pruned by the next cleanup pass. Pin every link in a PR body
  to a SHA, never a branch, so it keeps rendering after the prune.
- Report plan and PR locations as GitHub blob URLs. Never an editor-internal
  link or a bare local path — nobody else can open those.
- When gh is unavailable, commit the PR body as PR-<stream>.md and hand Ryan
  the exact `gh pr create` command. That file is a courier, not a record: it is
  deleted by the next cleanup once the PR exists.

## GitHub issues
Issues track ACTIONABLE WORK AWAITING AN OWNER — never knowledge
(known-issues.md), never rulings (decisions.md), never per-PR judgment (the
Brief).
- File an issue ONLY for: (a) a defect confirmed by measurement that this
  stream cannot fix (wrong owner, wrong scope, or blocked); (b) a follow-up a
  merged PR names as deferred work; (c) a live/operational finding needing
  action on a specific surface. Nothing speculative, nothing cosmetic, no
  "ideas."
- Every issue: a one-line title naming the surface, a body with <=5 lines of
  repro-or-source (link the PR, ledger line, or known-issues entry — never
  re-explain), a fix sketch if one exists, and exactly one label from:
  defect / follow-up / ops / decision-needed.
- decision-needed is reserved for items blocked on Ryan and should be rare —
  the Brief remains the primary channel for rulings.
- NEVER include client names, phone numbers, lead data, or live URLs of
  prospect demos in an issue. Reference configs by slug and docs by path.
- Filing an issue never substitutes for the Brief. If a Brief item is deferred
  rather than ruled, the PR's author files the follow-up issue and links it in
  the PR body.
- Close discipline: the PR that resolves an issue says "Closes #N". A session
  that discovers an issue is stale closes it with one line of evidence. Anyone
  may close; only measurable items may be opened.
- Cap: if open issues exceed ~15, the next session to notice says so to Ryan
  instead of filing more — a queue nobody drains is worse than no queue.

## Verification norms
- Green ≠ correct: acceptance is behavior of the built artifact.
- Verify you're measuring your own build — ports move; confirm client/URL
  before trusting a run.
- Existing clients render byte-identical unless the task says otherwise; any
  drift is a defect in this work.
- A new gate lands with its failure demonstrated first, then the fix.