# Decisions — the rulings ledger

Append-only. One dated line per ruling, each naming its source. A ruling that is
later narrowed or replaced gets a **new** line saying so; nothing above is edited
or deleted, because the point of the file is that a settled question stays
settled and a reversal is visible as a reversal.

**How to add one.** A stream that receives a durable ruling appends it in the PR
that completes the stream — the same PR that deletes the stream's
`PLAN-<stream>.md`. Date it, state it as a rule rather than as a narrative, and
cite the PR number or the plan file it came from.

**What belongs here.** Anything a later session would otherwise re-litigate or
guess at: a rule about money, safety, provenance, naming, gates or scope. Not
progress notes, not defect write-ups (those are `docs/known-issues.md`), not
anything the code already states plainly.

---

## Where the sources went

This ledger was seeded on 2026-08-12 by walking every root `PLAN-*.md`,
`PR-trust-seo.md` and every merged PR body. Those plan files were deleted in the
same pass. They remain readable, permanently, at the pre-cleanup commit
[`1b6225a`](https://github.com/Ryan-Rags/site-factory/tree/1b6225ac5fe0c69ab144aa7b742bbd5ebc64d393)
— so a code comment that says "see `PLAN-pipeline.md`'s backlog" resolves in one
hop from here:

| Deleted file | Permanent location |
|---|---|
| `PLAN.md` | *kept — repo scaffold notes, not a stream plan* |
| `PLAN-copy.md` | [blob@1b6225a](https://github.com/Ryan-Rags/site-factory/blob/1b6225ac5fe0c69ab144aa7b742bbd5ebc64d393/PLAN-copy.md) |
| `PLAN-demo.md` | [blob@1b6225a](https://github.com/Ryan-Rags/site-factory/blob/1b6225ac5fe0c69ab144aa7b742bbd5ebc64d393/PLAN-demo.md) |
| `PLAN-demo-support.md` | [blob@1b6225a](https://github.com/Ryan-Rags/site-factory/blob/1b6225ac5fe0c69ab144aa7b742bbd5ebc64d393/PLAN-demo-support.md) |
| `PLAN-design-families.md` | [blob@1b6225a](https://github.com/Ryan-Rags/site-factory/blob/1b6225ac5fe0c69ab144aa7b742bbd5ebc64d393/PLAN-design-families.md) |
| `PLAN-design-polish.md` | [blob@1b6225a](https://github.com/Ryan-Rags/site-factory/blob/1b6225ac5fe0c69ab144aa7b742bbd5ebc64d393/PLAN-design-polish.md) |
| `PLAN-discovery.md` | [blob@1b6225a](https://github.com/Ryan-Rags/site-factory/blob/1b6225ac5fe0c69ab144aa7b742bbd5ebc64d393/PLAN-discovery.md) |
| `PLAN-lead-flow-2.md` | [blob@1b6225a](https://github.com/Ryan-Rags/site-factory/blob/1b6225ac5fe0c69ab144aa7b742bbd5ebc64d393/PLAN-lead-flow-2.md) |
| `PLAN-mockup.md` | [blob@1b6225a](https://github.com/Ryan-Rags/site-factory/blob/1b6225ac5fe0c69ab144aa7b742bbd5ebc64d393/PLAN-mockup.md) |
| `PLAN-multi-client.md` | [blob@1b6225a](https://github.com/Ryan-Rags/site-factory/blob/1b6225ac5fe0c69ab144aa7b742bbd5ebc64d393/PLAN-multi-client.md) |
| `PLAN-pipeline.md` | [blob@1b6225a](https://github.com/Ryan-Rags/site-factory/blob/1b6225ac5fe0c69ab144aa7b742bbd5ebc64d393/PLAN-pipeline.md) |
| `PLAN-prospect-parity.md` | [blob@1b6225a](https://github.com/Ryan-Rags/site-factory/blob/1b6225ac5fe0c69ab144aa7b742bbd5ebc64d393/PLAN-prospect-parity.md) |
| `PLAN-template.md` | [blob@1b6225a](https://github.com/Ryan-Rags/site-factory/blob/1b6225ac5fe0c69ab144aa7b742bbd5ebc64d393/PLAN-template.md) |
| `PLAN-trust-seo.md` | [blob@1b6225a](https://github.com/Ryan-Rags/site-factory/blob/1b6225ac5fe0c69ab144aa7b742bbd5ebc64d393/PLAN-trust-seo.md) |
| `PR-trust-seo.md` | superseded by [PR #17](https://github.com/Ryan-Rags/site-factory/pull/17) |

`docs/evidence/**` was pruned in the same pass, per the ruling of 2026-08-12
below. Its contents are pinned in the PR bodies that cite them and remain at
[`68e2c1b`](https://github.com/Ryan-Rags/site-factory/tree/68e2c1bc823ff5276c6bd7bd75e9adac243ec666/docs/evidence)
(beta-2) and
[`1b6225a`](https://github.com/Ryan-Rags/site-factory/tree/1b6225ac5fe0c69ab144aa7b742bbd5ebc64d393/docs/evidence)
(trust-seo).

---

## Ledger

### 2026-08-06 — pipeline, template, multi-client, deploy

- **2026-08-06** — The crawl limit governs *page navigations*, and one Lighthouse run counts as one navigation; CLAUDE.md's wording was changed so this is not re-litigated. *Source: PLAN-pipeline.md Q4, PR #1.*
- **2026-08-06** — Discovery labels rows from a `--city "<label>"` flag rather than parsing a locality out of `formattedAddress`; `addressComponents` stays out of the field mask because it is a dearer Places SKU. *Source: PLAN-pipeline.md Q3, PR #1.*
- **2026-08-06** — The lead CSV keeps its seven original columns in order and appends `place_id,rating,review_count,address,discovered_at`; `data/businesses.sample.csv` is the one tracked CSV. *Source: PLAN-pipeline.md Q2, PR #1.*
- **2026-08-06** — Outreach skips any business with fewer than two confirmed findings and logs the reason to `outreach/skipped.md`; personalization is never invented to fill the gap. *Source: PLAN-pipeline.md Q7, PR #1.*
- **2026-08-06** — Without a Places key, the live path ships code-complete, typechecked and **unexecuted**, proved only against `--dry-run` fixtures. No key is ever invented and the API is not called without one. *Source: PLAN-pipeline.md Q6, PR #1.*
- **2026-08-06** — Sample rows that cannot resolve are a feature, not a gap: exercising the `unavailable` / never-fabricate path is the point of them. *Source: PLAN-pipeline.md Q5, PR #1.*
- **2026-08-06** — `VERIFY_MARKER` (`[verify with client]`) is the standard marker; `PLACEHOLDER` survives only as `LEGACY_MARKER` on the K-H config, because K-H's built output was the byte-equivalence proof. *Source: PR #3.* (**Superseded 2026-08-11** — see the marker-unification ruling below.)
- **2026-08-06** — The marker gate reads the **built bytes**, not the config: markers are fine while `seo.noindex` is `true` and fail the build the moment it is `false`, listing every file and line. Marker-freedom is a precondition of going live, not something anyone has to remember. *Source: PR #3.*
- **2026-08-06** — The client is selected by the `SITE_CLIENT` env var, not a `--client` flag, because `astro build` owns its own argv. Output goes to `dist/<slug>/` so one client's build never overwrites another's. *Source: PR #3.*
- **2026-08-06** — `business.foundedYear` is the only place a year is stated as a number, and copy states a founding year ("Since 1987") rather than an age that goes stale. *Source: PR #3.*
- **2026-08-06** — An evergreen format does not make the underlying fact true. K-H's `foundedYear` had been back-solved from prose about the owner's own time on the floor; a sourced value carries a provenance comment beside it so a later reader can check the claim instead of trusting it. *Source: PR #5, PR #6.*
- **2026-08-06** — `seo.siteUrl` and the mockup lock (`seo.noindex`) are independent and do not flip together. *Source: PR #7.*
- **2026-08-06** — `.gitignore` ignores the category, not the file: `/data/*.csv` with `data/businesses.sample.csv` as the single negation, so a new lead CSV is ignored by default rather than tracked by default. *Source: PR #8.*
- **2026-08-06** — Warn when a lead's slug matches no registered client config. Decided independently of which slug fix eventually wins, because both candidates narrow the collision class without closing it and the warning is what turns a silent, correct-looking failure into a loud one. *Source: PR #9.* (**Superseded 2026-08-12** — see placeId-first matching below.)
- **2026-08-06** — Hosting model: one Cloudflare Pages project per client, each at its own root (`<slug>-preview`), never one project with per-client subpaths — the template emits root-absolute hrefs. Verification targets the canonical `<project>.pages.dev` alias, not the per-deployment hash host. *Source: PR #10.*

### 2026-08-11 — copy, demo, demo-support, design families

- **2026-08-11** — **One marker spelling repo-wide: `[verify with client]`.** No third variant. The constant lives in `@site-factory/copy` and `src/types/site.ts` re-exports it, so there is one definition and every existing import resolves. The legacy `PLACEHOLDER` is retired from every config, and `check-markers.mjs` still refuses it so a resurrected old config cannot go live. *Source: PLAN-copy.md Q1(a), landed in PR #11.*
- **2026-08-11** — No filler copy anywhere. A marker remains only where a real question is open; a gap is reported as a gap, never smoothed over. *Source: PLAN-copy.md Q2 (Reading A), PR #11.*
- **2026-08-11** — `packages/copy` never calls Places. *Source: PLAN-copy.md Q4, PR #11.*
- **2026-08-11** — SMS components ship wired but with `smsHref` unset for every prospect: no demo shows a text link that goes nowhere, and turning one on is one line. *Source: PLAN-demo-support.md decision A, PR #11.*
- **2026-08-11** — Worker code is committed with PLACEHOLDER ids only. Nothing is deployed to Cloudflare by an agent unasked; deploying is outward-facing. *Source: PLAN-demo-support.md decision C, PR #11.*
- **2026-08-11** — A prospect's extracted `brandAccent` is offered as a swatch only where it passes the AA gate in the role it would occupy, and is **dropped, never nudged** — a shifted colour is not their colour. The gate is never relaxed. *Source: PLAN-design-families.md Q1(a), PR #11.*
- **2026-08-11** — All five hand-authored clients move to the design path; `clients/EQUIVALENCE.md` records that K-H's legacy byte-lock is superseded. *Source: PLAN-design-families.md Q2(a), PR #11.*
- **2026-08-11** — Generated configs never overwrite the five hand-authored ones. Via `SITE_CONFIG_FILE` they go further: a hand-authored config is read as the **top-precedence ingestion source**, so a demo for a business we already researched starts from that research. *Source: PLAN-demo.md Q3, PR #11.*
- **2026-08-11** — Google reviews may be shown verbatim with visible `via Google` attribution and the source recorded. Places **photos** are ingested but not published, because no component renders a visible credit near an image and there is nowhere for the attribution to go. *Source: PLAN-demo.md Q4, PR #11.*
- **2026-08-12** — `build:all` runs the same per-client gate chain as `build`. A batch build may never be a weaker gate than a single build. *Source: PR #11 (integration defect 3).*
- **2026-08-12** — Generated copy names the route ("call the shop") rather than printing the phone number as prose, since every page already renders it as a `tel:` link; `seo.ts` still emits the digits, because a meta description is read by a search result, not a thumb. *Source: PR #11 (integration defect 5).*
- **2026-08-12** — A demo pipeline that fabricates is stopped by the gate, not by review: `check-fabrication` reads a discovered prospect's own record (`prospects/<id>/prospect.json`) under the same known/unavailable discipline as the curated packs. *Source: PR #11 (integration defect 6).*

### 2026-08-12 — prospect parity (PR #12)

- **2026-08-12** — Design-family assignment follows the template's own definitions — forge = machine shops, welding, fabrication; precision = contractors, HVAC, electrical — not the prospect package's own table. `heritage` is never selected by trade: it comes from sourced legacy evidence (a sourced founding year 40+ years back, a sourced family-run claim, or a name that states it). *Source: PR #12.*
- **2026-08-12** — A colour extracted from a parked or expired-domain page is not the business's brand. `parked`/`dead` sites contribute **nothing** — no name, phone, address, services, and no logo for palette extraction — and the crawler stops after one navigation instead of spending five on a registrar. *Source: PR #12.*
- **2026-08-12** — A niche with no copy pack emits **no** FAQ and **no** service-area section and says so in the summary and `demo.json` — never a generic one. The same holds for a record too thin to write from, and a `FabricationError` discards the whole run's copy rather than publishing the sentences that happened to pass. *Source: PR #12.*
- **2026-08-12** — `GOOGLE_PLACES_API_KEY` is the documented key name; `GOOGLE_MAPS_API_KEY` is read for one release behind a once-per-process deprecation warning. *Source: PR #12.*
- **2026-08-12** — **The contrast rule has more than one implementation, and the seam stays flagged rather than silently tolerated.** `check-contrast.mjs --matrix` finds brand accents by scanning `clients/design/*.json`, so it structurally cannot see a payload passed via `SITE_CONFIG_FILE`; `packages/prospect/src/color.ts` ports the design-accent pairs so a generated demo is held to the same bar. *Source: PR #12 Brief 1.* (**Narrowed 2026-08-12** — see below.)

### 2026-08-12 — lead flow (PR #13)

- **2026-08-12** — **`KNOWN_PROSPECTS` must match the registry.** `check-form-fields.mjs` fails the build when a `PROSPECT_RECIPIENTS` key is absent from `KNOWN_PROSPECTS` (a typo'd key falls back to `MAIL_TO`: the lead survives, the routing is a lie) or when `KNOWN_PROSPECTS` is missing a slug present in `clients/index.ts`. It runs over the committed `wrangler.jsonc` and, when present, the gitignored `wrangler.local.jsonc`. *Source: PLAN-lead-flow-2.md, PR #13.*
- **2026-08-12** — **`DEMO_FORM_ENDPOINT` is the demo build's one switch.** Set, every prospect's form posts to the single shared Worker tagged with its slug — including clients whose own config says `forms.mode: 'disabled'`, which is right for a mockup and wrong for a demo whose purpose is a form that works. Unset, each client's own `forms` block governs, so **a real client build can never inherit the demo endpoint by accident**. *Source: PR #13 (introduced in PR #11).*
- **2026-08-12** — No config may produce a lead nobody can answer. The invariant is enforced three times: `resolveFields()` throws at build, the field gate fails the build, and the Worker throws illegal rules away for the defaults rather than failing open. *Source: PR #13.*
- **2026-08-12** — Visitor confirmations stay inert until `MAIL_FROM` leaves `resend.dev`, from which Resend delivers only to the account owner. No agent handles a real Resend key; Ryan flips `CONFIRMATIONS_ENABLED` and runs the live end-to-end receipt himself. Key custody is his. *Source: PLAN-lead-flow-2.md approval of 2026-08-12, PR #13.*
- **2026-08-12** — **`zz-*` fixtures never deploy.** A fixture is registered in `KNOWN_PROSPECTS` so the gates can see it, is skipped by `build-all.mjs` so it never reaches `dist/`, and is excluded by prefix in `scripts/deploy/deploy-mockups.mjs`, which announces the skip. "Never deployed" is a property of the pipeline, not a note in a README. *Source: PR #13; enforced in the deploy script by PR #15 Ruling 4.*
- **2026-08-12** — Non-default configuration is proved on a throwaway `zz-fixture-*`, never on a pitchable demo: the five prospect demos stay uniform. *Source: PLAN-lead-flow-2.md approval of 2026-08-12, PR #13.*

### 2026-08-12 — design polish (PR #14)

- **2026-08-12** — **The URL carries accent *ids*, not indices:** `?theme=heritage&scheme=dark&accent=brick&font=old-serif`. An index would renumber the moment swatches are added, silently changing what every previously-shared link resolves to. *Source: PLAN-design-polish.md Q1, PR #14.*
- **2026-08-12** — **Curated swatches hard-fail; only a prospect's `brandAccent` auto-drops, and it drops per cell.** A curated swatch that fails its cell is a build failure — they are our colours, and silently dropping one converts a loud, fixable authoring error into a swatch that quietly vanishes from a scheme. A brand accent legal on a light Heritage and illegal on a dark Forge is offered where it works instead of everywhere or nowhere. One mechanism (`offeredCells()`) feeds the gate, the CSS and the UI, and every drop is printed by name and cell. *Source: PLAN-design-polish.md Q2, PR #14.*
- **2026-08-12** — **`theme.scheme` defaults to the tone each family already shipped in, and there is no `prefers-color-scheme` auto-follow.** The demo shows a deliberate design decision; a prospect's OS preference silently flipping it on open would read as exactly the bug being fixed. The config default wins and the toggle is explicit. Both tones carry the same accent *ids* with different values, so flipping the tone never reassigns a prospect's colour. *Source: PLAN-design-polish.md Q3, PR #14.*
- **2026-08-12** — `offeredPresets()` is the single source of which theme cells exist; the matrix emitter, the panel's controls, the panel's resolver and the pre-paint script all derive from it, and one `resolve()` clamps any request — URL, `localStorage` or click — to a legal cell. The pre-paint script resolves rather than obeys, and a URL that carried a selection is rewritten to name what is actually on screen. *Source: PR #14.*
- **2026-08-12** — Metric tokens stay on `:root[data-theme]` at the lowest specificity so no combination can lose them, which is what keeps a tone flip free of layout shift. *Source: PR #14.*

### 2026-08-12 — beta-2 verify-and-repair (PR #15)

- **2026-08-12** — **The fabrication boundary is a union, not a substitution.** When a slug owns *both* an ingested prospect record and a curated copy pack, `check-fabrication.mjs` checks against the **union of both allowance sets**. Replace semantics are kept for a purely generated prospect, and a hard error naming both records is kept for neither. No allowance moves between slugs, and content precedence is untouched — the hand-authored config still wins for what ships; the union applies only to the allowance set this gate consults. Landed failure-first (`dc138d5` red, `704a8ed` green). *Source: PR #15 §1.3 / Brief 1.*
- **2026-08-12** — `color-scheme` is emitted on **delivered** builds, not only in the pitch matrix: a delivered dark site otherwise gets a light scrollbar. *Source: PR #15 Ruling 1.*
- **2026-08-12** — **The parity gate takes a narrow named allowance, never a re-baseline.** A delivered `:root` block may differ *only* by the ADDITION of a single `color-scheme: light|dark;`, and only where the baseline had none; every page taking the exemption is printed by name. One other token moving alongside it, or the scheme value flipping once present, still fails. Re-baselining was rejected because it would absorb unrelated drift landing in the same build, and keep absorbing it. *Source: PR #15 Ruling 1.*
- **2026-08-12** — `color-scheme` is design-pages-only. The legacy `BaseLayout` pages (`/about`, `/services`, `/contact`, `/404`) carry no design tokens and no resolved scheme, so a client's home page declares its tone while its contact page declares nothing. Correct as built; a named seam to settle before the legacy pages get a dark treatment. *Source: PR #15 Brief 2 (open).*
- **2026-08-12** — A lead-row miss is a structural `warnings` channel — not string-sniffing the log — carried into the manifest and printed under its own banner at the **end** of the summary and on **stderr**, so a piped run cannot lose it. *Source: PR #15 Ruling 3.*
- **2026-08-12** — **The contrast seam is a double, not a triple.** `contrast.mjs` is canonical; `packages/prospect/src/color.ts`'s 17 pairs, derivations, thresholds and `1e-9` slack are equivalent to it and were never stale — only the *shape* they were fed was wrong. Unification stays a named follow-up rather than a rediscovery. *Source: PR #15 §1.1 and Brief 4 (open), narrowing PR #12 Brief 1.*
- **2026-08-12** — **Evidence images are welcome during review and are deleted by the next cleanup.** A PR body that cites evidence pins every image and link to a SHA rather than to a branch, so it keeps rendering once the files leave `HEAD`. *Source: PR #15 Brief 5.*

### 2026-08-12 — discovery (PR #16)

- **2026-08-12** — **One Enterprise sweep, no second pass.** `places.websiteUri` and `places.nationalPhoneNumber` are Enterprise, not Pro, which killed the two-pass survivor design: the filter was defined on exactly those fields, so a Pro sweep would have had nothing to filter on and Details would have had to run against every deduplicated business in the county. Once the call is Enterprise, `rating` and `userRatingCount` ride along at no marginal cost. 210 calls for a 70-town × 3-niche county sweep. *Source: PLAN-discovery.md addendum, PR #16.*
- **2026-08-12** — **The Enterprise + Atmosphere SKU class is banned outright**, enforced at the call site rather than asserted about a constant. The sweep mask must equal the declared mask byte-for-byte, every field must have a known price, and an unpriced field resolves to the dearest tier so it is a gate failure rather than a silent cost. The tier table carries a VERIFY-BEFORE-A-LIVE-RUN header and `checkSkuTable()` guards its internal consistency. *Source: PR #16; re-affirmed by the county dry run in PR #18's stream.*
- **2026-08-12** — **placeId-first matching supersedes the slug WARNING.** A Places id is assigned by Google, not derived from a name, so it survives a legal suffix, a punctuation change or a rename — which is the entire collision class filed in `PLAN-pipeline.md`'s backlog. The slug match remains as a **loud fallback** for records predating place ids, which is what that backlog entry itself asked for. *Source: PR #16, closing the interim of PR #9.*
- **2026-08-12** — `--backfill-place-ids` is opt-in, prints its plan before acting, and only ever writes the `place_id` cell of a row whose id is empty. A wrong place id silently attaches one business's identity to another; an empty one merely falls back to the loud warning. *Source: PR #16.*
- **2026-08-12** — Call-list reasons rank by **salience, not contribution**: a missing component contributes zero, which buried "no phone number — cannot be called" beneath "copy pack ready", so a missing component now competes on the weight it **forfeited**, ties breaking toward the negative. On a call list a fatal gap is the most decision-relevant thing a row can say. *Source: PR #16 Brief 4.* (**Extended 2026-08-12** — see below.)
- **2026-08-12** — Audit-ordering weights are ordinal, not calibrated, and are left uncalibrated until a live run shows whether the queue surfaces the worst sites first. They never enter the score; they only sort the audit queue, and the whole table prints in the run header. *Source: PR #16 Brief 2.*
- **2026-08-12** — The live sweep and its console reconciliation are Ryan's to run. Everything is proved against fixtures; no agent handles the key. *Source: PLAN-discovery.md Q5, PR #16.*

### 2026-08-12 — trust & SEO (PR #17)

- **2026-08-12** — **The design payload wins for `areaServed`.** Within one build, the page's rendered service areas and the JSON-LD `areaServed` derive from a **single** source and can never disagree: when a `design` block exists that source is the design payload, otherwise it is `site.serviceAreas`. `ServiceArea.astro`'s own fallback to `business.serviceArea` on an empty list is mirrored so the two cannot diverge. The lint asserts consistency between the two representations **site-wide**, not prose-subset per page. *Source: PR #17 defect 2.*
- **2026-08-12** — `script-src` is hash-only and permanently asserted: `'unsafe-inline'`, `'unsafe-eval'`, `'strict-dynamic'`, `'unsafe-hashes'` and wildcards are refused there, and `'unsafe-inline'` is refused in every directive but `style-src`. *Source: PLAN-trust-seo.md ruling on `style-src`, PR #17.*
- **2026-08-12** — **Turnstile is blocked from being enabled for any client** until the hydration race is fixed. `contact.astro` loads `api.js` at page level while `.cf-turnstile` lives inside a `client:visible` React island, so roughly one run in five React wipes the widget and the form posts with no `cf-turnstile-response` token — a submission any verifying Worker rejects. The fix is `?render=explicit` plus `turnstile.render()` from a `useEffect`, which removes the race rather than narrowing it. The test key was removed from the fixture rather than importing a one-in-five third-party flake into a gate that runs on every `build:all`; the CSP path is proved by recorded measurement and a reproducible command, and the key is re-added the moment the race is fixed, at which point it becomes a permanent regression test for both. *Source: PR #17 Brief 1 and 2; repro in `docs/known-issues.md`.*
- **2026-08-12** — No HSTS in `_headers`: it belongs to the zone, not to a project that also answers on `*.pages.dev`. The go-live runbook covers it. *Source: PR #17.*
- **2026-08-12** — A social card must be a real raster of the declared size. Facebook, X, LinkedIn, iMessage, WhatsApp and Slack all decline to render an SVG `og:image`, so an SVG card means every shared link arrives with no image. *Source: PR #17 defect 1.*
- **2026-08-12** — A gate fails **closed** on any shape it cannot follow. A narrow trigger is worse than a narrow match, because skipping produces no output at all. *Source: PR #17 ("three fail-opens in my own gates").*
- **2026-08-12** — `example.invalid` may remain in a config's `siteUrl` while that client is noindex; `check-go-live.mjs` is the control that refuses to let it go live carrying one. *Source: PR #17 Brief 4.*

### 2026-08-12 — served-fixture exercise (PR #18)

- **2026-08-12** — **Forfeited-weight reason semantics apply to every scoring component, opportunity included.** Opportunity previously always carried `forfeited: 0`, so an unaudited live site read as three positives with no hint its site was never measured — the score was right and the sentence was a lie. Opportunity now forfeits what it did not claim, the same rule as the viability components; because its bands are 0.10–0.65 and 0.90–1.00, `max(value, 1 − value)` never falls below 0.65, so **the website's condition is always the headline**. Never scored as decent by default; unmeasured is unavailable. *Source: PR #18, extending PR #16 Brief 4.*
- **2026-08-12** — Test fixtures are hand-written, never a saved copy of a real business's page, because CLAUDE.md forbids committing third-party business data. Served fixtures get one loopback IP each, since `NavigationBudget` keys on hostname and several sites behind one host would share one budget and one throttle — an artefact of the test rather than of the system. *Source: PR #18.*

### 2026-08-12 — docs cleanup (this PR)

- **2026-08-12** — A stream's `PLAN-<stream>.md` lives on its branch and is deleted by the PR that completes the stream; durable rulings are appended to this file in that same PR. Sessions report plan and PR locations as GitHub blob URLs, never editor-internal links. *Source: CLAUDE.md "Plan files & docs", this PR.*
