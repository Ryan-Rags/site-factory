# PLAN-mockup.md — mockup bridge (Part 3)

Status: **SHIPPED.** B1–B5 below were all resolved by PR #3 (`53299c0`),
which landed the template's multi-client contract on `main`. The design in
this plan is built as written. The blockers are kept for the record; read
"Contract as built" for what the contract actually turned out to be.

Scope granted: root `scripts/mockup/` directory, root `package.json` script
wiring. Reads (never writes) `packages/template/` and `audit/out/`.
Writes only `outreach/<slug>/` (gitignored).

## Blockers

Each of these is a factual finding, not a judgement call.

**B1 — `packages/template` on `main` is a stub.**
`main`'s template package is a single `src/index.ts` with a `tsc` build. The
real Astro template lives on `origin/feat/template` (`00819ed`) and has not
been merged. A main-checkout script cannot build a client from `main` today.

**B2 — the template has no `--client` flag.**
Even on `origin/feat/template`, the build is `astro build` against one
top-level `packages/template/site.config.ts`, imported statically by
`astro.config.mjs` (`import { site } from './site.config.ts'`). There is no
CLI flag, no env-var override, no config-selection layer. Output goes to
`packages/template/dist/`, not `dist/<slug>/`.

**B3 — `packages/template/clients/` does not exist.**
Nothing in any branch defines per-client configs, so `pnpm mockup:all` has no
set to iterate and `--client <slug>` has no lookup target.

**B4 — neither proof client is buildable.**
`kh-machine-works` exists only as the *seed* content inside the single
`site.config.ts` (business name "K-H Machine Works") — it is the default
build, not a selectable client. `kts-machine-shop` has no config anywhere in
the repo. The task asks me to prove the pipeline end-to-end for both; neither
can be built today.

**B5 — ownership.** Adding the `--client` flag, the `clients/` directory, and
a `kts-machine-shop` config means editing `packages/template/`, which
`claude.md` assigns to `feat/template`. That is not mine to write from the
main checkout, and the grant in this task covers only `scripts/mockup/` and
root `package.json`.

B1–B4 are one root cause: **the template's multi-client build contract has
not been built yet.** This bridge consumes that contract; it cannot define it.

## What *is* confirmed and ready

Verified in `packages/discover/src/paths.ts` and `packages/audit/src/probe.ts`:

- `audit/out/<slug>/desktop.png` and `mobile.png` — the "before" screenshots,
  full-page, captured at 1440x900 and 390x844. Same viewports the task asks
  for on the "after" side, so before/after pairs will be directly comparable.
- `outreach/<slug>/` already exists as a per-slug folder (`pitch.md` is
  written there by `packages/outreach/src/cli.ts`). Dropping the four PNGs
  beside it gives exactly the attachment set the task describes.
- Both `/audit/` and `/outreach/` are gitignored — no client data is at risk
  of being committed by this script.
- `packages/audit` already depends on `playwright@^1.49.1`, so the browser
  dependency can be reused as instructed rather than re-added.

## Design (ready to implement once the contract lands)

`scripts/mockup/` (plain Node 20 ESM, no new deps):

- `index.mjs` — arg parsing (`--client <slug>`, `--all`), orchestration.
- `build.mjs` — invokes the template build for one slug.
- `shoot.mjs` — static file server over the built output on an ephemeral
  port, then Playwright Chromium: 1440x900 and 390x844, `fullPage: true`,
  → `outreach/<slug>/after-desktop.png`, `after-mobile.png`.
- `before.mjs` — if `audit/out/<slug>/desktop.png` / `mobile.png` exist, copy
  → `before-desktop.png` / `before-mobile.png`. Absent is normal, not an
  error (see below).

Root `package.json`:
```
"mockup":     "node scripts/mockup/index.mjs",
"mockup:all": "node scripts/mockup/index.mjs --all"
```

**No-website clients are an expected case, not a failure.** A lead with no
site was never audited, so `audit/out/<slug>/` has no "before" to copy.
`kts-machine-shop` is exactly this. The run will emit after-only, log
`no before screenshots for <slug> (no existing site audited) — after-only`,
and exit 0. `mockup:all` will likewise not fail the batch on such a client.

Rate limiting does not apply here: this serves and screenshots our own
localhost build. No third-party navigation occurs.

## Contract as built

What `main` actually shipped, and where it differs from what this plan
guessed at while blocked:

- **Selection is `SITE_CLIENT`, not `--client`.** `astro build` owns its own
  argv, so the template selects via env var (`clients/index.ts`,
  `resolveClient`). The bridge keeps `--client <slug>` as *its* flag and
  translates. An unknown slug is a hard error on both sides.
- **`clients/<slug>.config.ts` + a static registry** in `clients/index.ts`.
  Five clients exist: `kh-machine-works`, `kts-machine-shop`,
  `american-machine-specialty`, `industrial-machine-corp`, `ks-welding`.
  `scripts/mockup/clients.mjs` reads the filenames and cross-checks them
  against the registry, failing on drift — the same technique, and the same
  reasoning, as the template's own `build-all.mjs`.
- **Output is `dist/<slug>/`**, as anticipated.
- **A marker gate exists** (`check-markers.mjs`) and was not foreseen here.
  The bridge invokes the template's `build` script rather than `astro build`,
  so the gate runs on mockup builds too. All five clients are `noindex`
  mockups, where markers are expected and pass.
- **The site must be served, not opened as `file://`.** Assets are
  root-absolute and `trailingSlash: 'ignore'`, so `scripts/mockup/serve.mjs`
  is a localhost-only static server on an ephemeral port. This was implied by
  the original design's "static file server" line; the reason is recorded
  here because it is not optional.

Verified on the first full run: all 5 clients build and shoot, and the
before-copy branch was exercised against a temporary `audit/out/` fixture
(then removed — no fabricated audit data was left behind, and none is
committed since `/audit/` and `/outreach/` are gitignored).

## To unblock (historical — resolved by #3)

One decision is needed, and it is the template stream's to make, not mine:

1. `feat/template` defines and ships the multi-client contract — a
   `clients/<slug>.config.ts` layout, a `--client` flag (or `SITE_CONFIG`
   env override consumed by `astro.config.mjs`), output at `dist/<slug>/` —
   and adds a `kts-machine-shop` config. Then merges to `main`.
2. This bridge is then a thin, uncontroversial consumer of it, and both proof
   runs become possible.

Alternatively, tell me to own that template change from this checkout with an
explicit grant for `packages/template/`, and I will do both parts together.
I will not write into another stream's directory without that.
