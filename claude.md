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
- Self-merge feat/<stream> -> main ONLY when: (1) merge touches only your
  owned dirs + your plan file (plus explicitly granted shared files);
  (2) fetch first, rebase if main moved, conflict-free or STOP — never
  resolve a conflict yourself; (3) pnpm install && pnpm -r build &&
  pnpm -r typecheck green on the merged result BEFORE pushing; report SHA.
- Shared files (root configs, lockfile, .gitignore, claude.md, data/*.csv
  schema, root README) merge only with explicit grant in the task prompt.
- Plan files are per-stream: PLAN-pipeline.md / PLAN-template.md. Root
  PLAN.md is foundation-only.
- Plan gate: STOP after plan by default; a prompt ending in explicit
  execute-through language counts as pre-approval.

# Stream ownership
- feat/pipeline: packages/discover, packages/audit, packages/outreach, PLAN-pipeline.md
- feat/template: packages/template, PLAN-template.md

# PR-based self-merge (supersedes direct-merge clause)
- Streams ship via PR: push feat/<stream>, open a PR with gh, and merge
  your own PR — no human approval needed — when ALL hold:
  (1) diff touches only owned paths + granted shared files;
  (2) branch is rebased on latest main, conflict-free (any conflict → STOP);
  (3) pnpm install && pnpm -r build && pnpm -r typecheck green on the
      rebased branch before merging;
  (4) PR body lists any shared files touched + the grant that covers them.
- Squash-merge, delete the branch, report the merge SHA and PR number.
- Conflicts, failed checks, or ungranted shared files are still hard stops.