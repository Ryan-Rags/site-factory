# PLAN-trust-seo

Stream: `feat/trust-seo` · worktree `D:/sf-trust-seo` · off `main` @ `e9654c5`

Goal: the sites are hard to abuse, impossible to miscategorize by accident, and
ready to rank the day they go live.

**Lane: HELD, certainly.** Three green-lane conditions fail before a line is
written: the work touches `packages/template/src/types/**`, it touches
`.env.example`, and it carries a non-empty Decision Brief. Stated up front so
nobody expects a self-merge. Stop at the PR.

---

## 0. What I measured first

Everything below rests on a read of the actual tree, not on assumption. The
findings that shape the design:

| Fact | Evidence |
| --- | --- |
| Output is fully static, no adapter | `astro.config.mjs`: `output: 'static'`, no adapter, and a comment saying this build "cannot publish itself anywhere" |
| All CSS is inlined into the HTML | `astro.config.mjs`: `build: { inlineStylesheets: 'always' }` |
| There are **four** distinct executable inline scripts | `ServiceWorker.astro:26` and `:36` (two mutually-exclusive branches), `design/Reveal.astro:34`, `design/Customizer.astro:424`, `design/DesignLayout.astro:179` (the no-flash resolver) |
| Two of them have **per-client bytes** | `Customizer.astro:424` uses `define:vars={{ config }}`; `DesignLayout.astro:179` embeds `offeredIds(design)` as a JSON matrix |
| Inline `<style>` elements exist and are per-client | `BaseLayout.astro:58` and `design/DesignLayout.astro:159,164` — `set:html` of a token block built from the client's palette |
| Inline **style attributes** exist in 10 files | `grep -cE 'style="|style=\{'` — 17 hits across `components/design/*` (e.g. `DesignFooter.astro:52`, `Stats.astro:62`, `DesignLayout.astro:187`) |
| One third-party script, conditionally | `contact.astro:177` — Turnstile from `challenges.cloudflare.com`, emitted only when `forms.turnstileSiteKey` is set |
| A service worker is registered | `ServiceWorker.astro`, served by `pages/sw.js.ts` |
| **No HTML-injection sink exists anywhere** | `grep -rn "dangerouslySetInnerHTML\|innerHTML" src/` → **zero hits**. No `document.write`, no `eval`, no `insertAdjacentHTML` |
| All 8 `set:html` sites carry build-time data only | 4× `JSON.stringify` of config-derived JSON-LD, 3× CSS token/font strings, 1× the no-flash resolver |
| Visitor input reaches exactly two places, both client-side | (a) contact form → `fetch(endpoint, {body: FormData})` at `ContactForm.tsx:294`; (b) four URL query params in the customizer |
| Those query params are **resolved against an allowlist**, never stamped | `DesignLayout.astro:115-130` — `if(!M[t])t=F.theme`, `if(o.s[c].indexOf(a)<0)a=o.s[c][0]`, etc., where `M` is `offeredIds(design)`; the resolved value then goes to `setAttribute('data-*', …)` and nowhere else |
| `@astrojs/sitemap` is already wired, gated on `noindex` | `astro.config.mjs` — the integration is omitted entirely while `seo.noindex` is true |
| `robots.txt` already flips on the same flag | `pages/robots.txt.ts` — disallow-all vs allow + `Sitemap: …/sitemap-index.xml` |
| Canonical is already on every page | `Seo.astro:15` via `BaseLayout` → every page |
| **Every** client config is `noindex: true` today | `grep -rn noindex clients/*.config.ts` — all 9 |
| A reusable QR renderer already exists | `packages/prospect/src/cards.ts:71` `renderQrCard()`, 3.5×5in @300dpi, error-correction `H`, black-on-white |
| A Lighthouse harness already exists | `packages/audit/src/lighthouse.ts` (`LH_CATEGORIES` includes `best-practices`, `seo`), driven by `scripts/pitch/compare.mjs` against a local server |
| No `_headers` or `_redirects` file exists yet | `find . -name _headers -o -name _redirects` → nothing |

Two consequences worth stating now, because they drive the whole design:

1. **The CSP must be generated per client, after the build.** A hand-written
   `public/_headers` cannot contain the right script hashes, because two of the
   four inline scripts differ per client and one of the other two depends on
   `features.offline`. A static file would be wrong for most clients and wrong
   *quietly*.
2. **The injection audit's conclusion is "no sink exists", not "the sinks are
   escaped".** That is a much stronger position, and it is what makes
   `style-src 'unsafe-inline'` (item 1) an acceptable cost rather than a hole.
   The gate in item 2 exists to keep that conclusion true.

---

## 1. Security headers via a generated `_headers`

### 1.1 Generator — `packages/template/scripts/gen-headers.mjs`

Runs after `astro build`, writes `dist/<slug>/_headers`. It **measures** the
built HTML rather than describing what we think it contains:

- Walk every `.html` in `dist/<slug>/`.
- Extract every `<script>` with no `src` whose type is executable (skip
  `application/ld+json` — a non-executable script type is not governed by
  `script-src`, and hashing it would add noise that drifts every time a config
  changes). SHA-256 each, base64, dedupe → the `script-src` hash set.
- Collect external script hosts actually referenced → added to `script-src`
  only if present. Turnstile therefore appears in the CSP of a build that uses
  Turnstile and in no other.
- Collect `<iframe>` / third-party embed hosts → `frame-src`, else `'none'`.
- Detect `data:` image URIs and non-self font/image origins → widen `img-src` /
  `font-src` only if measured.
- Read the resolved form endpoint (`resolveForms()`) and the customizer
  endpoint → their **origins** go in `connect-src`.

Resulting policy for `/*`:

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'sha256-…' 'sha256-…' … [https://challenges.cloudflare.com];
  style-src 'self' 'unsafe-inline';
  img-src 'self' [data:];
  font-src 'self';
  connect-src 'self' [<worker origin>];
  frame-src 'none' | https://challenges.cloudflare.com;
  frame-ancestors 'none';
  form-action 'self';
  base-uri 'none';
  object-src 'none';
  worker-src 'self';
  manifest-src 'self'
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
X-Frame-Options: DENY
Permissions-Policy: accelerometer=(), autoplay=(), camera=(), display-capture=(),
  encrypted-media=(), fullscreen=(), geolocation=(), gyroscope=(), magnetometer=(),
  microphone=(), midi=(), payment=(), picture-in-picture=(), screen-wake-lock=(),
  usb=(), xr-spatial-tracking=()
```

Notes on the judgment calls:

- **`script-src` uses hashes, never `'unsafe-inline'`.** This is the half of
  the policy that actually stops XSS, and it is achievable here because the
  inline scripts are ours and finite.
- **`style-src` needs `'unsafe-inline'`.** Not a shortcut — a measured
  constraint. CSP hashes do not cover style *attributes*, and there are 17 of
  them across the design components (`style="margin: 0;"`,
  `style={--d-reveal-delay: …}`). CSP3's `'unsafe-hashes'` would technically
  cover them at the cost of a hash per attribute value, regenerated on every
  copy change, with weaker browser support — worse on every axis. Since item 2
  proves there is no way to inject markup in the first place, an inline-style
  allowance grants an attacker who cannot inject exactly nothing. Recorded as
  Decision Brief #4 rather than buried here.
- **`X-Frame-Options: DENY` alongside `frame-ancestors 'none'`.** The latter is
  authoritative and the former is redundant for any current browser; it costs
  one line and covers old ones.
- **`Permissions-Policy` lists only widely-recognised features.** Naming
  features a browser does not know produces console warnings, which is exactly
  the noise that makes people stop reading consoles.
- **No `upgrade-insecure-requests`, no HSTS.** Every URL the build emits is
  already absolute HTTPS or root-relative, so the former is inert. HSTS belongs
  to the zone, not to a Pages project that shares `*.pages.dev` with everyone
  else's — it goes in `docs/go-live.md` as a DNS-stage step instead.

The generator **fails the build** if it finds an executable inline script it
cannot hash, or if the hash set comes back empty for a page that has one.

### 1.2 Static gate — `packages/template/scripts/check-headers.mjs`

Re-derives the expected policy from the built HTML and diffs it against the
emitted `_headers`; fails on drift, on any missing required header, and on
`'unsafe-inline'` or `'unsafe-eval'` appearing in `script-src`. Wired into
`pnpm build`.

### 1.3 Runtime gate — `packages/template/scripts/check-csp-runtime.mjs`

**This is the check that matters, and a file-diffing gate cannot replace it.** A
`_headers` file that parses is not a page that works; the failure we are
actually guarding against is a CSP that silently kills the customizer or the
service worker.

Playwright (already a devDependency) serves `dist/<slug>/` through a tiny local
server that **replays the generated `_headers`**, then for each page:

- listens for `securitypolicyviolation` and for CSP console errors — any
  violation fails;
- asserts the service worker registers (`navigator.serviceWorker.ready`) on a
  client with `features.offline`;
- drives the customizer on a design-family client: open the panel, change
  theme/scheme/accent/font, assert the `data-*` attributes change and the URL
  updates;
- asserts the reveal/counter script ran (`data-reveal-ready` on `<html>`).

Run as `pnpm check:csp-runtime`, not on every per-client build — it costs a
browser launch. It runs in `build:all` and in acceptance.

### 1.4 Live proof

`curl -sI https://<preview>/` against a real Cloudflare Pages preview, because
`_headers` is a Pages feature and a local replay is a simulation of it. See
§7 — this needs Ryan's go-ahead, and Decision Brief #1 asks which target.

---

## 2. Injection surface: audit + gate

### 2.1 Audit — `docs/injection-surface.md`

Writes up the trace already summarised in §0: every path from a visitor-supplied
string to any output, with file and line. The conclusion I expect to document
(subject to the two open checks below) is:

> No visitor-supplied string is rendered into any page. The sites are static
> files; the only two input paths are a `fetch` to the Worker and four
> allowlist-resolved query parameters that become `data-*` attribute values.

Two things I have **not** yet finished checking and will resolve during the
work rather than assert now:

- `ContactForm.tsx:256` assigns `window.location.href = 'mailto:…'`. Not an XSS
  sink, but if the subject or body is assembled from typed text, CRLF in that
  text could inject mail headers. I will check and, if needed, encode.
- The customizer's `persist()` writes the four params back with
  `history.replaceState`. Values are resolved-then-written, so the URL should
  only ever carry allowlisted tokens; I will confirm `resolve()` covers the
  path where a param arrives but the panel is never touched
  (`Customizer.astro:589 initial()`).

### 2.2 Gate — `packages/template/scripts/check-injection.mjs`

Grep-level, as asked, and honest about its limits:

- **Bans sinks outright** in `src/`: `innerHTML`, `outerHTML`,
  `insertAdjacentHTML`, `document.write`, `eval(`, `new Function(`,
  `dangerouslySetInnerHTML`, `href="javascript:`. All are at zero today, so the
  gate starts from a clean baseline and its job is to keep it.
- **`set:html` / `define:vars` allowlist.** A manifest of the 9 known call
  sites, each with a one-line justification, keyed on file + the expression
  text. Moving a line does not fail; changing what is interpolated does, until
  a human reviews it and updates the manifest.
- **Asserts the build stays static**: `output: 'static'` and no adapter in
  `astro.config.mjs`. Server rendering would create a class of sink this audit
  did not consider.
- **Bans request reflection**: `Astro.request`, `Astro.url.searchParams`,
  `Astro.params` used inside markup.
- **Bounds the query-param surface**: the set of `q.get('…')` / `params.get('…')`
  keys read by any shipped script must be a subset of
  `{theme, scheme, accent, font}`. A fifth parameter fails the gate and forces
  a re-audit.

What grep cannot prove is that the allowlist *resolution* is correct. So:

- **Fuzz probe**, in the same Playwright run as §1.3: load a design-family page
  with `?theme=<img src=x onerror=…>&accent="><script>…` and friends, then
  assert (a) the payload string appears nowhere in `document.documentElement
  .outerHTML`, (b) no script executed, (c) the page rendered a valid default
  theme. That is the actual proof; the grep gate is the thing that keeps it
  from rotting.

Per CLAUDE.md, each gate lands with its failure demonstrated first: a throwaway
commit introducing the violation, the gate failing, then the revert.

---

## 3. Metadata hygiene per site

### 3.1 What already holds

Canonical on every page, OG + Twitter with the generated brand card, valid
`LocalBusiness` (+ conditional `FAQPage`) JSON-LD, robots correct in demo mode.
This item is mostly **proving** and **gating** what exists, plus a real gap list.

### 3.2 Gaps to close

- `og:image:width`, `og:image:height`, `og:image:alt`, `twitter:image:alt` are
  absent. Cheap, and `alt` is the difference between a shared link that reads
  as a business and one that reads as an image.
- Nothing asserts the OG image *exists in `dist/`*. A client whose
  `brand.ogImage` points at a file `gen-brand-assets.mjs` never produced ships a
  broken card and nobody sees it until a customer shares the link.

### 3.3 Gates

**`check-metadata.mjs`** — over every built HTML file:
exactly one `<title>`, non-empty, ≤ 60ish chars; one `<meta name=description>`;
exactly one canonical, absolute, on `seo.siteUrl`'s origin, matching the page's
own path with no trailing-slash drift; complete OG + Twitter set; `og:image`
absolute **and resolving to a file present in `dist/` that is a real PNG of at
least 1200×630**; and the robots posture matching the mode (see 3.5).

**`check-schema.mjs`** (the schema lint) — over every `application/ld+json`:
parses as JSON; `@context` is `https://schema.org`; `@type` is in the allowlist
of types we actually emit (`LocalBusiness`, `FAQPage`, plus the nested ones);
`LocalBusiness` carries name/url/telephone/address/image and a stable `@id`; no
empty strings, no `[verify with client]`, no `PLACEHOLDER`; **no
`aggregateRating` or `review`** — the standing decision in
`LocalBusinessJsonLd.astro` becomes enforced rather than commented; all URLs
absolute and on `siteUrl`'s origin; `telephone` equals the config's; `FAQPage`
appears on exactly the page that renders the FAQ and nowhere else; `areaServed`
matches the towns the visible copy commits to.

No network calls. A lint that phones Google is a lint that fails in a tunnel.

### 3.4 Go-live mode

See Decision Brief #2. **My recommendation: `seo.noindex: false` *is* the
go-live mode** — a second flag that can disagree with the first is precisely the
drift `robots.txt.ts` was written to avoid ("the mockup lock is a single flag
rather than two files that can drift apart"). What is genuinely missing is not a
flag but *preconditions*, so I add:

**`check-go-live.mjs`** — inert while `noindex` is true; when false it demands:
`siteUrl` is a real domain (not `example.invalid`, not a `.pages.dev`), zero
markers (delegates to the existing rule), `robots.txt` allows and names a
sitemap that exists in `dist/`, the sitemap's URLs are on `siteUrl`'s origin,
every page's canonical matches, schema lint green, OG image present, and
`_headers` emitted.

Demo mode gets the mirror assertion: `noindex,nofollow` on every page,
`Disallow: /`, and **no sitemap emitted at all**.

### 3.5 Demonstrating it without touching a real business

New fixture `clients/zz-fixture-go-live.config.ts` with `noindex: false` and an
invented business on an invented domain. The `zz-fixture-` prefix already keeps
it out of `build:all` batches and out of `deploy-mockups.mjs`. No real client
config changes; every existing client stays byte-identical.

### 3.6 Sitemap filename

`@astrojs/sitemap` emits `sitemap-index.xml` + `sitemap-0.xml`, and
`robots.txt.ts` already points at the index. The brief says `sitemap.xml`. No
spec requires that name and Search Console accepts any. Decision Brief #3.

---

## 4. Domain-safety check for go-lives

`scripts/domain-safety/check.mjs` — `node scripts/domain-safety/check.mjs <domain> [--json]`

**Wayback history** (no key): CDX API for the capture range, count, and gaps,
then fetch a small sample of archived page `<title>`s across eras. The title
history is the part that actually catches the Wortmann scenario — a domain
whose 2011 captures are titled like an adult site is a domain that carries
inherited reputation, and no summary statistic surfaces that. Read-only GETs,
≤1 request/sec, ≤10 fetches per run, cached to disk — the same politeness
`CLAUDE.md` requires of site audits, applied to a third party that owes us
nothing.

**Google Safe Browsing** v4 `threatMatches:find`, key from `.env` as
`SAFE_BROWSING_API_KEY`. Per standing rule I will not handle a real key: the
script fails loudly and usefully when the variable is unset, and I will prove
the request shape, the gating, and both response paths against a **stubbed local
endpoint** (injectable base URL). Ryan runs the one live call. `.env.example`
gains the variable and a comment; the key itself never enters the repo, a log,
or this chat.

**Output**: a table plus `--json`, and a verdict of `clear` / `review` / `avoid`
— where anything unmeasured prints `unavailable`, never a guess. It reports; it
never blocks. The runbook makes running it a required step before a domain is
bought, which is where the decision belongs.

---

## 5. `docs/go-live.md`

The runbook. Sections: pre-purchase domain safety (§4, required); DNS on
Cloudflare (apex + `www`, Pages custom domain, the redirect direction chosen
once, HSTS at the zone); the index flip (`noindex: false` → full gate suite →
rebuild → redeploy, in that order, with the gates listed); Search Console
verification and Bing Webmaster (import from GSC); sitemap submission; Google
Business Profile linked to the site, with a note on tagged URLs; a 301 map
template (`old,new` CSV → Pages `_redirects`, with the rules for what deserves a
redirect and what deserves a 410); and citation basics — NAP consistency
checked against `site.config.ts` as the single source of truth, and the handful
of directories worth the time.

---

## 6. Review-QR counter card

Reuse `renderQrCard()` from `packages/prospect/src/cards.ts` — it already solves
the hard parts (300dpi print size, error-correction `H`, black-on-white because
a brand-coloured QR scans worse across a counter in bad light).

Add a **review** card variant: "Scan us on Google", business name, brand
colours, and a short instruction line. New entry point `pnpm review-card <slug>`.

The review URL comes from config, never derived and never invented. Google's
form is `https://search.google.com/local/writereview?placeid=<PLACE_ID>`, and
the Place ID is something the discovery pipeline legitimately holds — but a
guessed Place ID points a client's customers at the wrong business, so the
config value is explicit and the card refuses to render without it. Placement of
that field is Decision Brief #5.

Renders nothing on the site, so existing clients stay byte-identical.

---

## 7. Acceptance

| # | Check | How |
| --- | --- | --- |
| A | All clients build, all gates green | `pnpm build:all` on the merged-with-main state |
| B | Existing clients byte-identical | `check-delivered-parity.mjs` (see Risk R1) |
| C | No CSP violations; customizer + SW + reveal all work | `pnpm check:csp-runtime` |
| D | Injection fuzz produces no execution and no echo | same run |
| E | Lighthouse BP/SEO unchanged or better | `pnpm verify:offline:all` before/after, using the existing harness |
| F | **Headers verified live** | `curl -sI` against a Pages preview — **needs approval, Decision Brief #1** |
| G | Go-live fixture emits sitemap + index robots + green schema lint | `SITE_CLIENT=zz-fixture-go-live pnpm build` |
| H | One review QR card rendered | `pnpm review-card <slug>` |
| I | Domain-safety script proven | Wayback live against a throwaway domain; Safe Browsing against the stub. Ryan runs the keyed call |

Then stop at the PR.

---

## 8. Risks

- **R1 — parity gate vs. the new `_headers`.** Every client's `dist/` gains a
  file. If `check-delivered-parity.mjs` compares directory listings rather than
  HTML bytes, it will fail on a change that is correct. I will read it first and,
  if it does, the fix is to teach it that `_headers` is expected — a change to a
  gate script, which is itself a green-lane blocker and will be flagged.
- **R2 — Turnstile under CSP.** No client sets `turnstileSiteKey` today, so the
  Turnstile path is unexercised. Its widget injects its own styles and an
  iframe. My generator handles it by measurement, but "measured on a build where
  it is absent" is not "proven". I will build the fixture with a **dummy**
  Turnstile site key to exercise the path, and say plainly in the PR if it stays
  unproven against the real widget.
- **R3 — CSP hashes and the service worker.** The SW caches responses; a page
  cached under an old CSP is served with that old CSP. Harmless in practice
  (hashes only ever widen for a build the visitor already has) but it belongs in
  the runbook, and I will confirm the SW does not cache `_headers` semantics it
  cannot honour.
- **R4 — five new gates on the build path.** Four are file reads and cheap; the
  Playwright one is not, which is why it is deliberately out of the per-client
  build. If total build time moves meaningfully I will report the number rather
  than quietly absorb it.

---

## 9. Paths I intend to touch

Mine by this task's grant:

- `packages/template/scripts/` — `gen-headers.mjs`, `check-headers.mjs`,
  `check-csp-runtime.mjs`, `check-injection.mjs`, `check-metadata.mjs`,
  `check-schema.mjs`, `check-go-live.mjs`
- `packages/template/src/components/Seo.astro` — the four missing OG/Twitter tags
- `packages/template/src/pages/robots.txt.ts` — only if #3 changes the filename
- `packages/template/clients/zz-fixture-go-live.config.ts` + registry + its
  content dir
- `scripts/domain-safety/` — new
- `docs/go-live.md`, `docs/injection-surface.md` — new

**Cross-boundary, each of which HOLDs the PR and will be listed as such:**

1. `packages/template/src/types/site.ts` — `reviewUrl` (#5). Explicitly named in
   the green-lane exclusions.
2. `.env.example` — `SAFE_BROWSING_API_KEY`. "Anything reading/writing `.env*`".
3. `packages/template/package.json` — wiring the new gate scripts.
4. `packages/prospect/src/cards.ts` + a CLI entry — another package, granted
   implicitly by "reuse the existing QR generator" but not by path.
5. `packages/template/astro.config.mjs` — only if #3 changes the sitemap config.
6. `packages/template/scripts/check-delivered-parity.mjs` — only if R1 lands.

---

## 10. Decision Brief

**1. Live header verification target — I need an answer before acceptance F.**
`_headers` is a Pages feature; only a real deploy proves it. A deploy is
outward-facing and touches `scripts/deploy/**`, so it is not mine to do
unilaterally.
*Recommendation:* I build the `zz-fixture-go-live` client — invented business,
invented domain, nothing pitchable — and you run one
`wrangler pages deploy` to a throwaway project (`sf-headers-probe`), then I curl
it and paste the output into the PR. That keeps your account credentials yours
and keeps a fixture, not a client, on the public URL. Alternative if you would
rather I drove it: say so and I will, but it is a deploy, so I will ask again at
the moment.

**2. Is "go-live mode" a new flag, or is it `noindex: false`?**
*Recommendation:* `noindex: false` is already the mode — it flips robots, meta
robots and the sitemap integration from one place. Adding a second flag creates
two things that can disagree, which is the exact failure `robots.txt.ts` was
written to prevent. I add *preconditions* (`check-go-live.mjs`) instead of a
flag. Say the word if you want an explicit `seo.mode: 'demo' | 'live'` and I
will migrate all 9 configs — but I think it buys nothing.

**3. `sitemap-index.xml` or literally `sitemap.xml`?**
*Recommendation:* keep Astro's `sitemap-index.xml` and reference it from
`robots.txt` (which it already does). No spec requires the name `sitemap.xml`,
Search Console accepts any URL you submit, and renaming means either configuring
`filenameBase` or hand-rolling a second route that duplicates the first. If you
want the familiar name for the client conversation, `filenameBase: 'sitemap'` is
a one-line change and I will take it.

**4. `style-src 'unsafe-inline'`.**
*Recommendation:* accept it. It is forced by 17 inline style attributes and the
per-client token block, CSP3's `'unsafe-hashes'` alternative is worse on
maintenance and support, and with no injection sink anywhere (item 2) it grants
an attacker nothing. `script-src` stays hash-only, which is the half that
matters. Flagging it because a reviewer who greps for `unsafe-inline` deserves
to find a reasoned answer, not a shrug.

**5. Where does the review URL live?**
*Recommendation:* `business.reviewUrl?: string` in `types/site.ts` — optional,
so no existing config changes and no page renders differently. It belongs with
the business's other identity facts, and putting it in a side-file in the
prospect package would split one business's data across two homes. Cost: it
touches a protected type. The alternative — a `review-cards.json` in
`packages/prospect` — avoids that but I do not think the split is worth it.

**6. Order of work.**
*Recommendation:* items 2 and 3 first (the injection audit and the metadata
gates are pure gain and unblock nothing), then 1 (headers, the largest and the
one needing your deploy), then 4/5/6. If the preview deploy is slow to arrange
this ordering means everything else is already done and reviewable when it
lands.

---

## 11. Explicitly not doing

- Not touching any real client config. Every demonstration runs on
  `zz-fixture-go-live`.
- Not deploying anything, and not making the domain-safety script or any gate
  perform a keyed API call in CI.
- Not adding HSTS to `_headers` — it belongs at the zone, and the runbook says so.
- Not adding `aggregateRating`/`review` structured data. The existing refusal to
  emit review markup we cannot attribute becomes enforced, not relaxed.
- Not touching `worker/` or `worker-demo/` — the form backend is out of scope;
  this stream only proves the front end never renders visitor input.
- Not changing the design families' markup to remove inline style attributes.
  That would be a large, risky diff into another stream's territory to buy a CSP
  tightening worth little (see #4).
