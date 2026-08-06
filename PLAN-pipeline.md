# PLAN — pipeline

Branch `feat/pipeline`, worktree `D:/sf-pipeline`. Owns `packages/discover`,
`packages/audit`, `packages/outreach`. Does **not** touch `packages/template`
(owned by `feat/template`).

Phase 0/1 foundation notes live in [PLAN.md](PLAN.md), which this branch leaves
alone so it merges cleanly.

## Resolved questions

All seven were raised as blocking and answered before any code was written.

**Q1. `audit/out/` and `outreach/` were swallowed by `.gitignore`.**
Line 79 ignored `out` (there for Next.js), which matched `audit/out/`; line 83
ignored `dist`. Screenshots would have been silently untracked. Separately,
screenshots and report text are third-party business data, which CLAUDE.md
forbids committing.
→ **Approved:** replace the accidental matches with explicit, root-anchored
intent. `/audit/`, `/outreach/`, `/data/businesses.csv` and `/data/no-site.csv`
are gitignored generated artifacts; `data/businesses.sample.csv` stays tracked.

**Q2. `data/businesses.csv` needed columns the sample schema didn't have.**
The field mask returns `id`, `rating`, `userRatingCount` and `formattedAddress`,
and `rating`/`userRatingCount` are the "profitable business" half of the score.
→ **Approved:** keep the 7 sample columns in order and append
`place_id,rating,review_count,address,discovered_at`. Sample CSV backfilled
empty; schema documented in the README. Explicit grant given to merge this
shared-file change to `main`.

**Q3. `city` had no source in the CLI or the field mask.**
`--near "lat,lng"` gives no place name, and `formattedAddress` cannot be split
into a locality reliably across countries.
→ **Approved:** add a `--city "<label>"` flag that labels every row from the
run. `formattedAddress` stays whole in its own `address` column.
`addressComponents` is **not** added to the field mask (higher Places SKU).

**Q4. Lighthouse conflicted with "max 1 req/sec/domain".**
A Lighthouse run issues dozens of concurrent requests and cannot be throttled to
1 req/sec without invalidating its own measurements.
→ **Approved:** the limit governs crawler *page navigations*, and one Lighthouse
run counts as one navigation. CLAUDE.md wording updated so this is not
re-litigated.

**Q5. The 3 sample rows cannot produce real audit data.**
`northgate-dental.example.com` and `ferrisandsons.example.net` are RFC-2606
reserved domains and do not resolve; `Ivywood Grooming Co` has no URL.
→ **Approved as planned.** `khmachineworks.com` as the sole live target is the
point — it is the pitch. Exercising the `unavailable` / never-fabricate path on
the sample rows is a feature, not a gap.

**Q6. No `.env` in this repo, so no Places key.**
→ **Approved:** `--dry-run` fixtures are the only `discover` proof this session;
the live path ships code-complete and typechecked but unexecuted. No key is
invented and the API is not called without one.

**Q7. Outreach requires 2 specific findings; some rows won't have 2.**
Writing a "personalized" pitch for an all-`unavailable` row would be
fabrication.
→ **Approved:** skip any business with fewer than 2 confirmed findings and log
it to `outreach/skipped.md` with the reason. Never fabricate personalization.

### Non-blocking decisions (all approved)

- **Lighthouse form factor:** mobile emulation (Moto G4 preset), 4 categories =
  performance, accessibility, best-practices, seo. `pwa` was removed in
  Lighthouse 12, so "x4 categories" maps to these four.
- **Lighthouse ↔ Playwright:** launch Chromium once via Playwright with
  `--remote-debugging-port` and attach Lighthouse to that port. One browser, one
  visit, screenshots and audit from the same session.
- **`pnpm audit-sites`, not `pnpm audit`** — `audit` is a reserved pnpm builtin.
- **Slug:** lowercase, non-alphanumerics → `-`, collapsed, deduped with a
  numeric suffix. Stable across runs (it is the cache key).
- **`--max 60` is the API ceiling**: Text Search (New) returns 20/page and
  allows 2 `nextPageToken` follow-ups. The 200-call hard cap binds across
  multi-query runs; the counter lives in a run-scoped budget object and throws
  when exhausted.

## Work plan

**1. `packages/discover`** — `pnpm discover -- --niche --near --radius --max
[--city] [--dry-run]`
- `places.ts`: POST `places.googleapis.com/v1/places:searchText`, header
  `X-Goog-FieldMask` with exactly the 7 requested fields (+`nextPageToken`).
  Key from `.env` via manual parse — no dotenv dep needed on Node 20+.
- Budget guard: hard 200 calls/run, enforced in the HTTP wrapper, not the loop.
- `--dry-run`: returns a checked-in fixture (`fixtures/places-response.json`),
  makes zero network calls, exits 0. This is the CI-safe path.
- Router: `websiteUri` present → `data/businesses.csv`; absent →
  `data/no-site.csv`. Both append-only and de-duped on `place_id`, falling back
  to normalized `url` for rows that predate place ids.

**2. `packages/audit`** — `pnpm audit-sites -- --top 5 [--only <slug>]`
- Per row: one Playwright visit, desktop 1440x900 + mobile 390x844 full-page
  PNGs → `audit/out/<slug>/`.
- Checks, each returning `pass | fail | unavailable` + evidence:
  HTTPS/cert validity, redirect chain, viewport meta, horizontal scroll at
  390px, Lighthouse x4, page weight, broken links (HEAD, ≤10 targets),
  phone visible above fold, contact form present, stale copyright year,
  builder fingerprint (Wix / GoDaddy / exposed WP version), dead social links,
  LocalBusiness JSON-LD, favicon.
- **Score 0-100** = weighted sum of a *neglect* component gated by a *value*
  component (`rating` × `log(review_count)`). A neglected site with no reviews
  scores low — it is not a lead. Rows with no rating data fall back to a neutral
  value multiplier, and the report says so explicitly.
- **Cache / resume:** `audit/.cache/<slug>.json` keyed by slug + check version.
  Re-runs reuse cached results; `--force` busts. Interrupt-safe: results are
  written per-site, not at the end.
- `audit/report.md`: ranked table, then a one-pager per business with both
  screenshots embedded via relative paths and the 3 worst findings in plain
  English (no jargon, no scores in the prose).

**3. `packages/outreach`** — `pnpm outreach -- --top N`
- Reads the audit cache (not the markdown). Per business →
  `outreach/<slug>/pitch.md`: 3-sentence email citing 2 specific findings by
  name and measured value; 6-bullet phone script; mockup brief with a hero
  headline built from services actually found on their page, 3 proof points,
  1 CTA. Every claim traces to a check result.
- Skips under-evidenced rows per Q7.

**4. Proof run** — `pnpm discover --dry-run` → `pnpm audit-sites --top 5` over
the 3 sample rows + `khmachineworks.com` → `pnpm outreach --top 3`. Committed
evidence: the command transcript and `audit/report.md` excerpt pasted into the
"Results" section below (artifacts themselves stay gitignored per Q1).

## Gate

`pnpm install`, `pnpm -r typecheck`, `pnpm -r build` clean; proof run green;
branch asserted `feat/pipeline`; push `-u origin feat/pipeline`.

## Results

`pnpm install`, `pnpm -r typecheck` and `pnpm -r build` all clean across the
four workspace packages.

### Proof run transcript

```
$ cp data/businesses.sample.csv data/businesses.csv
$ pnpm discover -- --dry-run --niche "machine shop" --city Houston
dry run: 2 place(s) from the checked-in fixture, 0 network calls.
data/businesses.csv  +1 new, 0 duplicate(s), 4 total
data/no-site.csv     +1 new, 0 duplicate(s), 1 total

$ pnpm audit-sites -- --top 5
3 site(s) to audit; 1 lead(s) have no website.
  northgate-dental-studio: auditing https://northgate-dental.example.com ... unreachable (all checks unavailable)
  ferris-sons-plumbing: auditing https://ferrisandsons.example.net ... unreachable (all checks unavailable)
  kh-machine-works: auditing https://khmachineworks.com ... 17/100
Wrote audit/report.md (3 site(s)).

$ pnpm outreach -- --top 3
  kh-machine-works: pitch written (cites no-horizontal-scroll, contact-form)
  northgate-dental-studio: skipped - Site could not be loaded (net::ERR_NAME_NOT_RESOLVED), so every check is unavailable and there are no findings to cite.
  ferris-sons-plumbing: skipped - Site could not be loaded (net::ERR_NAME_NOT_RESOLVED), so every check is unavailable and there are no findings to cite.
1 pitch(es) written, 2 skipped (see outreach/skipped.md).
```

This is exactly the Q5 outcome, and it exercises both paths in one run: one
lead routed away for having no website, two leads whose every check is
`unavailable` because the RFC-2606 domains do not resolve, and one real scored
audit.

### `audit/report.md` excerpt

```
| # | Business                | Score | Failed | Passed | Unavailable | Site                                               |
| 1 | KH Machine Works        |    17 |      4 |     12 |           1 | https://khmachineworks.com                         |
| 2 | Northgate Dental Studio |     0 |      0 |      0 |          17 | https://northgate-dental.example.com (unreachable) |
| 3 | Ferris & Sons Plumbing  |     0 |      0 |      0 |          17 | https://ferrisandsons.example.net (unreachable)    |

Leads with no website (not audited): Ivywood Grooming Co (York)
```

Checks for `kh-machine-works` — 17 checks, 4 failed, 1 unavailable:

```
pass         HTTPS                          https://www.khmachineworks.com/
pass         Redirect chain                 1 redirect(s)
pass         Viewport meta tag              width=device-width, initial-scale=1
fail         No sideways scroll at 390px    590px wider than the screen
pass         Lighthouse performance         70/100
pass         Lighthouse accessibility       87/100
pass         Lighthouse best practices      100/100
pass         Lighthouse SEO                 100/100
pass         Page weight                    1.84 MB
pass         Broken links                   6 link(s) probed, all reachable
pass         Phone number above the fold    visible without scrolling
fail         Contact form                   no contact form found on the home page
unavailable  Copyright year                 No copyright year found.
fail         Site builder fingerprint       Wix
fail         Dead social links              https://plus.google.com/+KHMachineWorksIncNorthBergen/about
pass         LocalBusiness structured data  LocalBusiness
pass         Favicon                        icon link tag present
```

The score is 17/100 rather than higher because the value half used the neutral
multiplier: the fixture carries no rating or review data, so there was none to
score with. The report and the pitch both say so rather than implying a
measured value. Lighthouse ran for real against the live site over the shared
CDP port — the four scores above are measured, not defaulted.

### Deviations from the plan as written

- **`--input` flag added to `audit-sites` and `outreach`.** The proof run needs
  to seed `data/businesses.csv` from the tracked sample, and hard-coding that
  path would have made the sample unusable as a fixture.
- **`--top` on `audit-sites` means "first N leads in file order"**, not a
  ranking. There is no score to rank by until the audit has run, and inventing
  an ordering would have been a fabricated priority. The *report* ranks by score.
- **The dry-run fixture is synthetic and says so.** Place ids are `fixture-*`,
  rows are written with `source=places-fixture`, and rating/review count are
  deliberately empty — inventing them would have fed fabricated numbers straight
  into the audit score. Only KH Machine Works' public name and website appear.
- **No project references between packages.** TypeScript project references
  require `composite: true`, which would have meant editing the shared
  `tsconfig.base.json`; pnpm already builds workspace dependencies first.
- **Bare `--` is ignored by all three CLIs**, because pnpm 9 forwards the
  separator from `pnpm discover -- --flag` through to the script verbatim.

### Not done this session

Live discovery against the Places API. There is no `.env` and no key, so per Q6
the live path is code-complete and typechecked but unexecuted. `--dry-run` is
the only `discover` evidence above.

## Backlog

### Slugs derived from business names collide with real-world legal names

Filed Aug 2026 from the `data/leads-machine.csv` run. **Not implemented — a
note, not a task in flight.**

The slug is the join key across four directories: the CSV row, `audit/out/<slug>/`,
`packages/template/clients/<slug>.config.ts`, and `outreach/<slug>/`. It is
derived in exactly one place — `assignSlugs()` in `packages/audit/src/run.ts`
calls `uniqueSlug(row.name)`, so `slugify()` on the `name` column decides the
key for everything downstream.

That makes the `name` column load-bearing in a way its name does not advertise,
and two ordinary properties of real business names break the join:

- **Legal suffixes.** `American Machine Specialty LLC` → `american-machine-specialty-llc`,
  which matches no client config.
- **Hyphenated initialisms.** `K-H Machine Works` → `k-h-machine-works`, because
  `slugify` maps every non-alphanumeric run to a separator and cannot tell an
  intra-word hyphen from a word break.

Both legal names are the *correct* values, and both are already recorded in the
client configs (`business.legalName`), which is what outreach copy reads. So the
CSV was written with local working labels — `KH Machine Works`, `American Machine
Specialty` — chosen to slugify onto the existing client slugs. That worked, and
the run produced full before/after sets for both. But it worked because someone
knew to hand-pick the labels.

The failure mode is what makes this worth fixing rather than remembering. A
wrong slug does not raise: `uniqueSlug` happily issues a well-formed key that
matches nothing, `copyBefore()` finds no `audit/out/<slug>/` and returns `[]`,
and the run reports `no before screenshots … — after-only` — a line that is
also the correct, expected output for a lead with no website. The mockup ships
without the "before" half, which is the strongest part of the pitch, and
nothing in the transcript distinguishes that from a legitimately siteless lead.

Two candidate fixes, not yet chosen:

1. **Teach `slugify` the domain** — strip a trailing `Inc|LLC|Corp|Co|Ltd` and
   collapse single-letter hyphen runs (`k-h` → `kh`). Fixes it everywhere at
   once, but `slugify` is documented as a stable cache key, and changing it
   re-keys every slug already issued. That is a migration, not an edit.
2. **Add a `slug` override column to the lead schema** — blank means derive as
   today, so old rows are unaffected and the CSV stays the source of record
   (consistent with the append-only reasoning in `LEAD_COLUMNS`). Explicit at
   the point the human already knows the answer, but it is one more column that
   must be filled correctly by hand.

Whichever of the two wins, it ships with a check that warns when a lead's slug
matches no registered client config — decided, not a maybe. Both fixes narrow
the collision class but neither closes it, so the derivation can still be wrong;
the warning is what turns a silent correct-looking failure into a loud one, and
that is the signal actually missing today.

This recurs at scale: a majority of registered US businesses carry a legal
suffix, so the collision class is the norm, not an edge case.
