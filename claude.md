# site-factory — agent rules
- Plan first: write/append PLAN.md and STOP for approval before writing code.
- STOP and report on any ambiguity. Never guess silently.
- Assert current branch before every commit. Push before reporting done.
- NEVER automate or scrape Google Search/Maps or any Google property.
  Discovery uses the official Places API only, key from .env.
- Never fabricate audit data. Failed checks are marked "unavailable".
- Secrets live in .env (gitignored). Never commit keys, tokens, or client data.
- Stack: Node 20, TypeScript strict, pnpm workspaces. No other package managers.
- Audits are read-only GETs. The rate limit governs crawler page navigations:
  max 1 page navigation/sec/domain, max 10 page navigations/site. A single
  Lighthouse run counts as one page navigation.
- This is a solo repo: commit to main only in the foundation phase;
  after worktrees exist, work stays on your assigned branch.
# Worktree + merge protocol (solo-repo mode)
- Streams create their own worktrees; never work in the main checkout.
- Shared files (root configs, lockfile, .gitignore, claude.md, data/*.csv
  schema, root README) merge only with explicit grant in the task prompt.
- Plan files are per-stream: PLAN-pipeline.md / PLAN-template.md. Root
  PLAN.md is foundation-only.
- Plan gate: STOP after plan by default; a prompt ending in explicit
  execute-through language counts as pre-approval.

# Stream ownership
- feat/pipeline: packages/discover, packages/audit, packages/outreach, PLAN-pipeline.md
- feat/template: packages/template, PLAN-template.md

# Stream isolation & merge rules
1. Every stream gets a fresh worktree and a unique branch. Worktree dir =
   branch name. Branch-push is the claim; check `git branch -r` for an
   existing claim before creating yours.
2. One session per worktree, ever. At session start, verify the worktree is
   clean or contains only your own prior work. If files change during your
   session that you did not write, STOP immediately, commit a WIP snapshot
   ("WIP: foreign writes detected"), and ask Ryan. Never stash (banned
   repo-wide).
3. Finish = push + open a PR. Never merge, never approve. PR description
   must list: shared files touched (site.ts, package.json,
   pnpm-workspace.yaml, pnpm-lock.yaml, .gitignore, clients/*), gates run
   with results, and anything deliberately not done.
4. Ryan merges serially and re-runs gates between merges. A green check is
   necessary, not sufficient.
- Exception: an explicitly-assigned integration stream may merge feature
  branches into an integration branch (never main). The integration PR to
  main is merged only by Ryan.

  ## Merge policy v2 (supersedes "Ryan merges serially")
Default: push + open PR. An agent may SELF-MERGE its own PR only when ALL hold:
1. Merge main into the branch first and re-run the FULL gate suite green on that
   merged state. Green on the pre-merge branch does not count. No conflicts.
2. The diff touches NONE of: clients/** or any content that ships on a page about
   a real business; packages/template/src/types/**; worker/ or worker-demo/;
   scripts/deploy/**; root package.json, pnpm-workspace.yaml, pnpm-lock.yaml,
   .gitignore, CLAUDE.md; anything reading or writing .env*.
3. No new dependencies, no edits to gate scripts themselves.
4. Nothing outward-facing: no deploys, no Worker behavior, no email paths.
5. The stream's own report contains zero "you should look at" flags. An open
   judgment flag holds the PR for Ryan regardless of the diff.
If any condition fails: stop at the PR and state which number failed. Every
self-merge posts the PR link + gate results. One self-merged regression and
this policy tightens again.