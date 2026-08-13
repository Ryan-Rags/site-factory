# Injection surface audit

**Scope:** `packages/template` — every page the factory builds and ships.
**Date:** 2026-08-12 · **Branch:** `feat/trust-seo` · **Baseline:** `main` @ `e9654c5`
**Enforced by:** `packages/template/scripts/check-injection.mjs` (static) and
`packages/template/scripts/check-csp-runtime.mjs` (runtime fuzz).

---

## Conclusion

**No visitor-supplied string is rendered into any page.**

Not "every visitor-supplied string is escaped before rendering" — the stronger
statement: there is no code path that renders one, because there is no sink that
could. The template contains zero uses of `innerHTML`, `outerHTML`,
`insertAdjacentHTML`, `document.write`, `dangerouslySetInnerHTML`, `eval`,
`new Function`, `javascript:` URLs or `srcdoc`.

That is worth stating precisely, because it is the property the rest of the
security posture leans on. It is why `style-src 'unsafe-inline'` in the
Content-Security-Policy costs nothing real (see `docs/go-live.md` and
`scripts/gen-headers.mjs`): an inline-style allowance only matters to an attacker
who can already inject markup, and there is no way to inject markup here.

Properties like this decay silently — one `innerHTML` added in a hurry and it is
gone, with nothing to say so. `check-injection.mjs` exists to make it a standing
guarantee rather than a snapshot of one afternoon.

---

## How pages are produced

`astro.config.mjs` declares `output: 'static'` and configures **no adapter** —
the config comments note the build "cannot publish itself anywhere". Every page
is HTML written to disk at build time from `site.config.ts`. Nothing is rendered
per request, so the entire class of server-side reflection (query strings, path
segments, headers, form bodies echoed into a response) does not exist.

This is load-bearing for everything below, which is why `check-injection.mjs`
rule 3 fails the build if `output: 'static'` is dropped or an adapter appears.

---

## Every path from a visitor-supplied string

There are exactly two. Both are client-side, and neither reaches markup.

### 1. The contact form → the Worker

`src/components/ContactForm.tsx`. Fields are collected into a `FormData` and
sent onward:

- **`worker` mode** — `fetch(endpoint, { method: 'POST', body: data })`
  (`ContactForm.tsx:294`). The values leave the page and are never rendered.
- **`mailto` mode** — the fields are assembled into a message body and handed to
  the visitor's mail client via `window.location.href = 'mailto:…'`
  (`ContactForm.tsx:256`).

What the visitor's own input is *rendered* into: nothing. The component's own
status messages (`success`, `error`, `offline`) are fixed strings from config,
and React renders all of them as text nodes, which escape by construction.

**Checked and clear — mail-header injection.** A `mailto:` URL whose body
contains a bare CRLF can, in some mail clients, terminate the body and inject a
header (`Bcc:` being the interesting one). Here the whole body goes through
`encodeURIComponent(lines.join('\n'))`, so a newline becomes `%0A` and a
carriage return `%0D`; neither survives as a raw control character. The
recipient and the subject are constants from config, not from the form. No
finding.

### 2. Five URL query parameters → the customizer

Only on design-family pages, and only these five: `theme`, `scheme`, `accent`,
`font`, `motion`. They are read in two places, and **both resolve before use**:

- `src/components/design/DesignLayout.astro:115-130` — the inline no-flash
  script, which runs before first paint. Its embedded allowlist `M` is
  `offeredIds(design)`, the id skeleton of the very CSS the page ships.
- `src/components/design/Customizer.astro:462-476` — `resolve()`, which the
  file's own comment describes as "the only thing allowed to decide that".

Resolution is not sanitisation, it is **replacement**. An unrecognised value is
not escaped and used; it is discarded and the client's configured default is
used instead:

```js
var t=q.get('theme')||s.theme||F.theme; if(!M[t])t=F.theme;
var a=q.get('accent')||s.accent||F.accent; if(o.s[c].indexOf(a)<0)a=o.s[c][0];
```

`motion` was added by `feat/design-expansion` and went through this door rather
than around it — `check-injection.mjs` failed the build until `ALLOWED_PARAMS`
was widened deliberately. Its audit:

```js
var m=q.get('motion')||s.motion||F.motion; if(N.indexOf(m)<0)m=F.motion;
```

`N` is the flat list of motion ids emitted from `presets.json`. Every source —
URL, `localStorage`, the client's own config — lands in the same `indexOf`
test, so the only three strings that can reach `setAttribute` are `still`,
`calm` and `lively`. `Customizer.astro` only WRITES the parameter
(`params.set`) and tests for its presence (`params.has`); it reads its own
state back off the resolved attribute, never off the URL.

The attribute it lands in, `data-motion-preset`, is consumed by CSS attribute
selectors and by one `getAttribute` comparison against the literal `'still'`.
It is never interpolated into markup, a URL or a style.

The resolved value's only destination is `setAttribute('data-theme', …)` and its
four siblings — a `data-*` attribute value, never markup, never a URL, never a
style. So a crafted `?theme=<script>…` does not reach the DOM in any form: the
string fails the `M[t]` lookup and is dropped on the floor before anything is
written.

`localStorage` (`sf-theme`) feeds the same resolver and is bounded identically.

Note that these two implementations are independent — the pre-paint script and
the panel resolve separately — and a payload has to survive both. It survives
neither.

---

## What is interpolated into markup, and why each is safe

Nine call sites use `set:html` or `define:vars`. Every one carries build-time
data derived from `site.config.ts` or the design config. They are enumerated with
individual justifications in the `REVIEWED` map in `check-injection.mjs`; the
summary:

| Site | Carries |
| --- | --- |
| `LocalBusinessJsonLd.astro:114,117` | `JSON.stringify` of the LocalBusiness and FAQPage graphs, assembled from config |
| `design/Faq.astro:60`, `design/Reviews.astro:138` | `JSON.stringify` of FAQ and review graphs from the design config |
| `BaseLayout.astro:58`, `DesignLayout.astro:159,164` | CSS custom-property and `@font-face` blocks built from config colours and fonts |
| `DesignLayout.astro:179` | The no-flash script — fixed code, with `offeredIds(design)` and the client defaults interpolated |
| `Customizer.astro:424` | `define:vars={{ config }}` — the preset matrix. This is the allowlist visitor input is resolved *against*, not a value taken from the visitor |

Each is pinned by a hash of the expression it interpolates, scoped to its file.
Change what is passed in and the gate fails until a human has re-read it and
recorded why the new expression is still build-time data. That is the actual
risk being managed: `set:html` is never the danger, `set:html` whose argument
quietly started carrying something else is.

---

## What the static gate proves, and what it does not

`check-injection.mjs` is grep-level by design. Being honest about the boundary
matters more than the gate looking comprehensive.

**It proves:** no banned sink exists anywhere in `src/`; the build is still
static with no adapter; no request reflection (`Astro.request`,
`Astro.url.searchParams`, `Astro.params`); every markup interpolation is one a
human has reviewed at its current text; and no query parameter outside the five
is read in any shape the gate can follow.

**It does not prove** that the allowlist resolution is *correct*. A gate that
reads `if(!M[t])t=F.theme` cannot tell you the lookup actually rejects hostile
values — only that the line is there.

**So that is proved at runtime instead.** `check-csp-runtime.mjs` loads a real
built page with a script payload in every accepted parameter and asserts the
payload reaches neither the DOM nor the JavaScript engine. The two checks are
complementary and neither substitutes for the other.

### Three fail-opens found while building the gate

Recorded because they are the most useful thing in this document — each was a
version of the gate reporting **green** on a planted violation, and each was
caught only by demonstrating the failure rather than assuming it. Full transcript:
`docs/evidence/trust-seo/check-injection-failures.txt`.

1. **Binder regex too tight.** Rule 5 required `var|let|const` immediately
   before the identifier. `DesignLayout` declares
   `var d=document.documentElement,q=new URLSearchParams(location.search),s={};`
   — `q` is the second declarator in a comma list, so the gate found no binder,
   checked nothing, and passed a planted `?ref`. It was blind to the only file
   in the tree that reads query parameters.
2. **Trigger too narrow.** The rule engaged only on the literal text
   `location.search`, so rewriting the binder as
   `new URL(location.href).searchParams` made the gate skip the file in silence.
   A narrow *trigger* is more dangerous than a narrow *match*, because skipping
   produces no output at all.
3. **Assignment target mistaken for the params object.**
   `t = new URLSearchParams(location.search).get('ref')` binds a string, but it
   matched the binder pattern, satisfied the "this file has a binder" test, and
   let an unallowlisted key through one line away.

The rule now fails **closed**: a file that touches the query string in a shape
the gate cannot follow is reported as unbounded rather than skipped.

---

## Standing rules

- No sink from the banned list, ever. If one is genuinely needed, that is a
  conversation and a re-audit, not a commit.
- The build stays static. An adapter means a new surface this audit never
  considered.
- A sixth query parameter needs an audit, a proof that it is resolved, and a
  deliberate widening of `ALLOWED_PARAMS`. `motion` was the fifth and is the
  worked example: the gate refused the build, the resolver was audited against
  the same allowlist shape as the other four, and only then was the set widened.
- A new or changed `set:html` / `define:vars` expression needs a re-read and a
  written justification in `REVIEWED`.
