# site-factory — agent rules
- Plan first: write/append PLAN.md and STOP for approval before writing code.
- STOP and report on any ambiguity. Never guess silently.
- Assert current branch before every commit. Push before reporting done.
- NEVER automate or scrape Google Search/Maps or any Google property.
  Discovery uses the official Places API only, key from .env.
- Never fabricate audit data. Failed checks are marked "unavailable".
- Secrets live in .env (gitignored). Never commit keys, tokens, or client data.
- Stack: Node 20, TypeScript strict, pnpm workspaces. No other package managers.
- Audits are read-only GETs, max 1 req/sec/domain, max 10 pages/site.
- This is a solo repo: commit to main only in the foundation phase;
  after worktrees exist, work stays on your assigned branch.