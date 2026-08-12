Closes the six items in `PLAN-trust-seo.md`, approved 2026-08-12 with rulings on
deploy scope, go-live mode, sitemap naming, `style-src`, `reviewUrl`, ordering,
parity allowances and the cross-boundary client-config edits.

**Lane: HELD.** Touches `src/types/**`, `.env*`, `worker-demo/`, gate scripts and
four real client configs; Decision Brief is non-empty. No self-merge.

---

## What landed

| # | Item | Where |
| --- | --- | --- |
| 1 | Generated Pages `_headers`, CSP measured from the built HTML | `scripts/gen-headers.mjs`, `scripts/lib/csp.mjs`, `scripts/check-headers.mjs`, `scripts/check-csp-runtime.mjs` |
| 2 | Injection audit + grep gate + runtime fuzz probe | `docs/injection-surface.md`, `scripts/check-injection.mjs` |
| 3 | Canonical/OG/Twitter, schema lint, go-live mode | `scripts/check-metadata.mjs`, `scripts/check-schema.mjs`, `scripts/check-go-live.mjs`, `clients/zz-fixture-go-live.config.ts` |
| 4 | Domain-safety pre-purchase check | `scripts/domain-safety/` |
| 5 | Go-live runbook | `docs/go-live.md` |
| 6 | Review-QR counter card | `packages/prospect/src/review-card.ts` |

---

## Three defects found in shipped output

All found by measuring built bytes, not by reading config.

**1 — Four of eight clients had a blank social card.** `og:image` pointed at
`/images/og.svg`, a file whose own `aria-label` reads "Social share image
placeholder", while their generated 1200×630 brand card sat unused in
`public/og/`. Facebook, X, LinkedIn, iMessage, WhatsApp and Slack all decline to
render SVG cards, so every shared link arrived with no image. Before/after:
`docs/evidence/trust-seo/unfurl-kh-machine-works.png`.

**2 — K&S Welding claimed four towns it never mentions.** `LocalBusinessJsonLd`
derived "the towns the visible copy commits to" from `site.serviceAreas`, but
design-family pages render `design.sections.serviceArea.areas` and never read
`site.serviceAreas` at all. Tenafly, Englewood, Paramus and Hackensack were in
the structured data and nowhere on the site.

*Which source wins:* within one build, the page's rendered service areas and the
JSON-LD's `areaServed` derive from a single source and can never disagree. When
a design block exists that source is the **design payload**; otherwise it is
`site.serviceAreas`. `ServiceArea.astro`'s own fallback to
`business.serviceArea` on an empty list is mirrored so the two cannot diverge.
The lint asserts consistency between the two representations, site-wide — not
prose-subset per page, which was my first draft and was wrong.

**3 — Review markup had no `@id`.** An `aggregateRating` would have attached to
a nameless second `LocalBusiness` instead of the shop with the address and
phone. **Latent, not live**: no client satisfies `canEmitReviewJsonLd` today, so
zero delivered bytes change. It would have become real the first time a client's
reviews were verified — exactly when nobody would be looking at the graph.

---

## Gates added

Each landed with its failure demonstrated first. Transcripts in
`docs/evidence/trust-seo/`.

| Gate | Runs in | Proves |
| --- | --- | --- |
| `check-injection.mjs` | `build` | No HTML sink; every markup interpolation reviewed by hash; query surface bounded |
| `gen-headers` + `check-headers` | `build` | `_headers` matches the pages; `script-src` hash-only, permanently asserted |
| `check-metadata.mjs` | `build` | Canonical, complete OG/Twitter, card is a real raster of the declared size |
| `check-schema.mjs` | `build` | JSON-LD valid **and consistent with the page it sits on** |
| `check-go-live.mjs` | `build` | Inert while noindex; demanding once live |
| `check-csp-runtime.mjs` | `build:all` | The policy does not break the customizer, SW or island — plus the fuzz probe |

`script-src` hash-only is asserted explicitly, per ruling: `'unsafe-inline'`,
`'unsafe-eval'`, `'strict-dynamic'`, `'unsafe-hashes'` and wildcards are all
refused there, and `'unsafe-inline'` is refused in every directive but
`style-src`.

---

## Three fail-opens in my own gates, caught by demoing the failure

The argument for the rule, in one place:

1. The binder regex required `var|let|const` adjacent to the name, so it was
   blind to `var d=…,q=new URLSearchParams(location.search),s={}` — a comma
   list, and the only file in the tree that reads query parameters.
2. The rule engaged only on the literal text `location.search`, so
   `new URL(href).searchParams` skipped it **in silence**. A narrow trigger is
   worse than a narrow match: skipping produces no output at all.
3. `t = new URLSearchParams(…).get('x')` binds a string but satisfied the "this
   file has a binder" test, passing an unallowlisted key one line away.

Rule 5 now fails closed on any shape it cannot follow. Two of the schema lint's
own first-draft rules were also wrong and were corrected after they fired.

---

## A correction, and a defect handed to another stream

I reported mid-run that the CSP broke Turnstile. That was one sample and it was
wrong. Five trials each, headers the only variable:

```
WITH generated CSP:  ok ok ok ok ok
WITHOUT any headers: ok BAD ok ok ok
```

The real defect is **pre-existing and unrelated to CSP**: `contact.astro` loads
Turnstile's `api.js` at page level, but `.cf-turnstile` lives inside a
`client:visible` React island, so Turnstile mutates a node React is about to
hydrate. When React loses that race it wipes the widget, leaving no
`cf-turnstile-response` token — a submission any verifying Worker would reject.
Reproduces on unmodified `main`, roughly one run in five, and fires **no
`securitypolicyviolation`**, which is why the runtime gate also listens for
`pageerror`.

Not fixed here — `ContactForm.tsx` and `contact.astro` are outside this stream's
paths. Evidence and a fix sketch:
`docs/evidence/trust-seo/turnstile-csp-and-hydration.md`.

**Coverage reduction, stated plainly:** the Turnstile test key was removed from
the fixture rather than kept. Keeping it would import a one-in-five third-party
flake into a gate that runs on every `build:all`, and a gate that goes red
intermittently teaches people to re-run it instead of read it. The Turnstile CSP
path is therefore proven by recorded measurement and a reproducible command, not
by a standing gate.

---

## Gate results — on the merged-with-main state

Merged `origin/main@93bbc89` (which brought `packages/shortlist`) into the
branch and re-ran everything. Main touched neither `packages/template` nor
`scripts/`; no conflicts.

| Gate | Result |
| --- | --- |
| `pnpm install` + `pnpm -r build` | exit 0 |
| `pnpm test` | 71/71 pass, exit 0 |
| `pnpm --filter @site-factory/template typecheck` | 0 errors, 0 warnings, 4 pre-existing hints |
| `pnpm build:all` | **8/8 clients built and checked**, exit 0 |
| `check-injection` | 58 files, no sinks, 9 reviewed interpolations, query surface bounded |
| `check-csp-runtime --all` | 9/9 builds clean under their own CSP; customizer applies selections; SW registers; 5 fuzz payloads neither executed nor echoed |
| `check-delivered-parity` | **8/8 "No client site changed what it renders"** |
| Lighthouse BP / SEO | **unchanged** (100 / 69) |
| Live headers | verified by `curl` against a real Pages deploy |
| Domain safety | 3 stub modes + live Wayback |

### Parity

Two narrow named head exemptions, one per defect, printed by name:

- `cardMetadataAdded` — 8/8 clients. The four tags `Seo.astro` gained, exactly
  one of each, none present in the baseline, heads identical once removed.
- `brandCardSwapped` — 4/8 clients, scoped by name. `og:image` and
  `twitter:image` move together from `/images/og.svg` to `/og/<slug>.png`.

Narrowness demonstrated: an unrelated meta tag riding along, and the card
swapped to a *different* client's card, each regress the tampered page while the
untampered pages still take the exemption. `ks-welding` and the three K&S design
builds correctly take only `cardMetadataAdded`.

**No exemption was needed for the structured-data corrections** — `regions()`
elides every `<script>` from the head, `application/ld+json` included. Worth
knowing in both directions: this gate would not have caught defects 2 or 3.

### Lighthouse

`kh-machine-works`, same harness both sides:

| | perf | a11y | best-practices | seo |
| --- | --- | --- | --- | --- |
| `main@e9654c5` | 100 | 96 | **100** | **69** |
| `feat/trust-seo` | 99 → 100 → 100 | 96 | **100** | **69** |

BP and SEO unchanged. The single 99 did not reproduce over two further runs and
is run-to-run variance — checked rather than waved away. SEO 69 on both sides is
Lighthouse's "blocked from indexing" audit, i.e. the mockup lock working. The
go-live fixture, the one config with `noindex: false`, scores
**100 / 100 / 100 / 100**, which is the whole of the gap.

### Live header verification

`sf-headers-probe` was created, served the go-live fixture (invented business,
`.test` domain, nothing pitchable), curled, and **deleted**. Confirmed gone: the
hostname returns 530 and the project list is empty of it.

```
$ curl -sI https://sf-headers-probe.pages.dev/
HTTP/1.1 200 OK
content-security-policy: default-src 'self'; script-src 'self' 'sha256-Jv1VkN+0LW+…' 'sha256-Q2BPg90ZMplYY+…' 'sha256-U7a72oKuFFz8D…'; style-src 'self' 'unsafe-inline'; img-src 'self'; font-src 'self'; connect-src 'self'; frame-src 'none'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'; object-src 'none'; worker-src 'self'; manifest-src 'self'
permissions-policy: accelerometer=(), autoplay=(), camera=(), display-capture=(), encrypted-media=(), fullscreen=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), picture-in-picture=(), screen-wake-lock=(), usb=(), xr-spatial-tracking=()
referrer-policy: strict-origin-when-cross-origin
x-content-type-options: nosniff
x-frame-options: DENY
```

Subpaths carry the same headers (`/*` covers them), `robots.txt` served
`Allow: /` plus the `Sitemap:` line, `sitemap-index.xml` resolved, and no
`name="robots"` tag is present on the live build.

Two requests returned a transient Cloudflare 522 and were re-run — noted in the
transcript rather than quietly re-rolled. One probe correction is recorded
there too: a bare `grep -c noindex` returns 1 against the live home page and is
a bad check, because it matches the fixture's own prose explaining that
`seo.noindex` is false. Full transcript:
`docs/evidence/trust-seo/live-headers-curl.txt`.

---

## Cross-boundary edits

Every one of these HOLDs this PR.

| Path | Change | Why necessary |
| --- | --- | --- |
| `packages/template/src/types/site.ts` | `business.reviewUrl?: string` | Item 6. Additive-optional; renders nothing |
| `.env.example` | `SAFE_BROWSING_API_KEY=` | Item 4. Documents the key; never holds one |
| `packages/template/package.json` | Gate wiring | Items 1–3 |
| `package.json` (root) | `review-card` script | Item 6 |
| `packages/prospect/src/review-card{,-cli}.ts` | New renderer + CLI | Item 6, granted by "reuse the existing QR generator" |
| `packages/template/scripts/check-delivered-parity.mjs` | Two named head exemptions | Ruling 2 |
| `packages/template/scripts/build-all.mjs` | Runs the new gates | Items 1–3 |
| **`clients/american-machine-specialty.config.ts`** | `ogImage` → generated card | Defect 1 |
| **`clients/industrial-machine-corp.config.ts`** | `ogImage` → generated card | Defect 1 |
| **`clients/kh-machine-works.config.ts`** | `ogImage` → generated card | Defect 1 |
| **`clients/kts-machine-shop.config.ts`** | `ogImage` → generated card | Defect 1 |
| `packages/template/worker-demo/wrangler.jsonc` | `zz-fixture-go-live` in `KNOWN_PROSPECTS` | `check-form-fields` requires every registered client listed. The fixture's `workerEndpoint` is empty; it posts nowhere |
| `src/components/{Seo,LocalBusinessJsonLd,design/Reviews}.astro` | Metadata + defects 2, 3 | Item 3 |

---

## Deliberately not done

- **Turnstile hydration race** — outside this stream's paths. Filed with
  evidence and a fix sketch.
- **No HSTS in `_headers`** — belongs to the zone, not a project that also
  answers on `*.pages.dev`. The runbook covers it.
- **Inline style attributes not removed** from the design components to tighten
  `style-src`. Large, risky, another stream's territory, for a hardening worth
  little given there is no injection sink.
- **`check-fabrication.mjs` cannot run on either fixture** — it needs a prospect
  record and a fixture has none by construction. **Pre-existing**: the same
  command fails identically for `zz-fixture-phone-optional` on unmodified
  `main`. Reported rather than worked around; the fixture is verified with
  `astro build` plus the gates that do apply.
- **301 execution** is per-client at go-live; the template ships here, as ruled.
- **One live Safe Browsing call** remains for Ryan, per key custody.

---

## Decision Brief

1. **Turnstile is currently unsafe to enable for a client.** The hydration race
   wipes the widget roughly one run in five, leaving the form with no token. No
   client sets a site key today so nothing is broken in production, but the
   feature should be considered non-functional until fixed. *Recommendation:*
   file it against whoever owns `ContactForm.tsx`; the fix is
   `?render=explicit` plus `turnstile.render()` from a `useEffect`, which
   removes the race rather than narrowing it. Not mine to make.

2. **The Turnstile CSP path is no longer continuously proven.** Removing the
   test key traded standing coverage for a deterministic gate. *Recommendation:*
   accept for now, and re-add the key the moment item 1 is fixed — at which
   point it becomes a permanent regression test for both.

3. **`check-fabrication.mjs` is unreachable for fixtures.** Both fixtures fail
   it for lack of a prospect record, so neither can go through `pnpm build`
   end-to-end. *Recommendation:* a `zz-fixture-` exemption in that gate, with
   the reasoning that a fixture whose every page says "this is not a real
   business" has nothing to fabricate. I did not make that change because it
   weakens a gate I do not own, and it is pre-existing rather than caused here.

4. **`example.invalid` remains in five client configs' `siteUrl`.** Harmless
   while noindex — and `check-go-live.mjs` now refuses to let any of them go
   live carrying it. *Recommendation:* no action; the gate is the control.

5. **The go-live fixture is the ninth registered client**, so it appears in
   `--list` output, `KNOWN_PROSPECTS`, and anything else that enumerates
   clients. It is excluded from `build:all` and from the deploy script by the
   `zz-fixture-` prefix. *Recommendation:* accept, consistent with how
   `zz-fixture-phone-optional` already behaves.


---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
