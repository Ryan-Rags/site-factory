# PLAN

## Phase 0 — Foundation scaffold (in progress)

Skeleton only, no feature logic.

- `pnpm-workspace.yaml` — workspace root, globs `packages/*`
- `package.json` (root, private) — Node >=20, script stubs, `typescript` devDep
- `tsconfig.base.json` — strict TS config shared by all packages
- `packages/{discover,audit,outreach,template}/` — each with `package.json`,
  `tsconfig.json`, `src/index.ts` stub
- `data/businesses.sample.csv` — 3 fake rows
  (`name,url,niche,city,phone,source,notes`)
- `.env.example` — `GOOGLE_MAPS_API_KEY=`
  (renamed to `GOOGLE_PLACES_API_KEY` by `feat/prospect-parity`; the old name
  is still read, with a deprecation warning, for one release)
- `README.md` — four-part architecture overview

Gate: `pnpm install` and `pnpm -r build` run clean; commit + push to `main`.

### Decisions made during scaffold
- Package dirs live under `packages/` rather than at the repo root — idiomatic
  pnpm layout, keeps `data/`, `docs/`, and future infra dirs unambiguous.
- Each package carries its own `tsconfig.json` + `typescript` devDep so
  `pnpm -r build` resolves without relying on root hoisting.

## Phase 1 — Feature work (not started)
Discovery (Places API only), audit engine, outreach, Astro template + mockup
bridge. Each gets its own worktree/branch; `main` is foundation-only from here.
