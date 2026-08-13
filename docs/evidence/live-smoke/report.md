# Live smoke — 8 demos, 2026-08-13T03:28:02.331Z

**Verdict: FAIL** — 8 of 8 client(s) failed at least one check.

## How to read this report

**Every expectation below is derived from the live response, never from local
`dist/`.** A deploy and the build that produced it are different artifacts the
moment one lags the other, and these have been: reconnaissance on 2026-08-12,
before the fleet was redeployed from `main@c301f2c`, found the live
`kh-machine-works` declaring `og:image =
https://www.khmachineworks.com/og/kh-machine-works.png` while the same client
in the checkout declared `…/images/og.svg` — two different artifacts, one of
them the only one anybody would ever see. Those two agree again now; the
redeploy closed that particular gap. That is the reason the rule is structural
rather than a reaction to one incident: nothing tells you which of the two
states you are in except asking the live site. So the CSP is re-derived from the
live pages, the route list is read from the live nav, the form endpoint is read
from the live contact page, and the card is parsed from the bytes the live URL
returns.

Four limits on what a green here means:

1. **`not-deployed` is a failure, not a skip,** and it is reported as its own
   findings class. A client on the registry whose project does not answer is
   exactly the thing this suite exists to surface; it is separated from broken
   deploys so the two cannot be confused.
2. **The form check covers the shared *demo* Worker only** —
   `packages/template/worker-demo`, which every prospect demo posts to. It has
   never touched the single-tenant `packages/template/worker` a real client
   eventually gets. A green here is not coverage of that path.
3. **`seo` is reported and not enforced.** Every demo is `noindex` by
   design, so the `is-crawlable` deduction is the demo lock working and a bar
   would fail every client for being correctly configured. The bar arrives when
   a go-live smoke exists.
4. **Header provenance is partly inference.** A header present live on a site
   carrying none of this repo's generated headers is labelled `platform
   (inferred: not produced by this repo)` — supported by the absence of any
   static header file here and its presence live, which is strong, but is still
   inference rather than measurement.

Politeness: read-only GET/HEAD/OPTIONS throughout, with one exception — a
single honeypot POST per client, which `worker-demo` discards at step 2
before the prospect-id gate, the rate limiter, the KV write and Resend. Page
navigations are spaced at least 1000 ms per domain and capped at 10 per site;
bare probes are spaced 500 ms. What was actually spent is at the bottom.

## Fleet

| client | routes | headers | posture | og:image | sw | form | customizer | lighthouse |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `american-machine-specialty` | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ |
| `industrial-machine-corp` | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ |
| `kh-machine-works` | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ |
| `ks-welding` | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ |
| `ks-welding-forge` | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | n/a | ✗ |
| `ks-welding-heritage` | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | n/a | ✗ |
| `ks-welding-precision` | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | n/a | ✗ |
| `kts-machine-shop` | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ |

## Per client

### `american-machine-specialty` — https://american-machine-specialty-preview.pages.dev

Verdict: **fail**

#### Routes — ✓

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | the live origin serves this client | american-machine-specialty | american-machine-specialty | read from <link rel="manifest"> → /icons/<slug>/ |
| ✓ | / status | 200 | 200 |  |
| ✓ | / content-type | text/html; charset=utf-8 | text/html |  |
| ✓ | /about/ status | 200 | 200 |  |
| ✓ | /about/ content-type | text/html; charset=utf-8 | text/html |  |
| ✓ | /contact/ status | 200 | 200 |  |
| ✓ | /contact/ content-type | text/html; charset=utf-8 | text/html |  |
| ✓ | /services/ status | 200 | 200 |  |
| ✓ | /services/ content-type | text/html; charset=utf-8 | text/html |  |
| ✓ | /definitely-not-a-page status | 404 | 404 |  |
| ✓ | /definitely-not-a-page is the template's own 404 page | That page isn't here. | That page isn't here. |  |

#### Security headers — ✓

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | the deploy carries this repo's generated _headers | yes | yes | derived from 4 live page(s): /, /about/, /contact/, /services/ |
| ✓ | x-content-type-options | nosniff | nosniff | build |
| ✓ | referrer-policy | strict-origin-when-cross-origin | strict-origin-when-cross-origin | build |
| ✓ | x-frame-options | DENY | DENY | build |
| ✓ | permissions-policy denies every feature in DENIED_FEATURES | all 16 denied | all 16 denied | build |
| ✓ | csp script-src does not contain 'unsafe-inline' | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndm… (330 chars) | no 'unsafe-inline' |  |
| ✓ | csp script-src does not contain 'unsafe-eval' | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndm… (330 chars) | no 'unsafe-eval' |  |
| ✓ | csp script-src does not contain 'strict-dynamic' | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndm… (330 chars) | no 'strict-dynamic' |  |
| ✓ | csp script-src does not contain 'unsafe-hashes' | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndm… (330 chars) | no 'unsafe-hashes' |  |
| ✓ | csp script-src has no wildcard | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndm… (330 chars) | no * |  |
| ✓ | csp script-src includes 'self' | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndm… (330 chars) | 'self' |  |
| ✓ | csp default-src does not contain 'unsafe-inline' | 'self' | no 'unsafe-inline' |  |
| ✓ | csp script-src does not contain 'unsafe-inline' | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndm… (330 chars) | no 'unsafe-inline' |  |
| ✓ | csp img-src does not contain 'unsafe-inline' | 'self' | no 'unsafe-inline' |  |
| ✓ | csp font-src does not contain 'unsafe-inline' | 'self' | no 'unsafe-inline' |  |
| ✓ | csp connect-src does not contain 'unsafe-inline' | 'self' https://site-factory-demo-form.ragmybunsvideogames.workers.dev | no 'unsafe-inline' |  |
| ✓ | csp frame-src does not contain 'unsafe-inline' | 'none' | no 'unsafe-inline' |  |
| ✓ | csp frame-ancestors does not contain 'unsafe-inline' | 'none' | no 'unsafe-inline' |  |
| ✓ | csp form-action does not contain 'unsafe-inline' | 'self' | no 'unsafe-inline' |  |
| ✓ | csp base-uri does not contain 'unsafe-inline' | 'none' | no 'unsafe-inline' |  |
| ✓ | csp object-src does not contain 'unsafe-inline' | 'none' | no 'unsafe-inline' |  |
| ✓ | csp worker-src does not contain 'unsafe-inline' | 'self' | no 'unsafe-inline' |  |
| ✓ | csp manifest-src does not contain 'unsafe-inline' | 'self' | no 'unsafe-inline' |  |
| ✓ | csp default-src | 'self' | 'self' |  |
| ✓ | csp frame-ancestors | 'none' | 'none' |  |
| ✓ | csp form-action | 'self' | 'self' |  |
| ✓ | csp base-uri | 'none' | 'none' |  |
| ✓ | csp object-src | 'none' | 'none' |  |
| ✓ | csp worker-src | 'self' | 'self' |  |
| ✓ | csp manifest-src | 'self' | 'self' |  |
| ✓ | csp style-src | 'self' 'unsafe-inline' | 'self' 'unsafe-inline' |  |
| ✓ | csp default-src matches the live pages | 'self' | 'self' |  |
| ✓ | csp script-src matches the live pages | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndm… (330 chars) | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndm… (330 chars) |  |
| ✓ | csp style-src matches the live pages | 'self' 'unsafe-inline' | 'self' 'unsafe-inline' |  |
| ✓ | csp img-src matches the live pages | 'self' | 'self' |  |
| ✓ | csp font-src matches the live pages | 'self' | 'self' |  |
| ✓ | csp connect-src matches the live pages | 'self' https://site-factory-demo-form.ragmybunsvideogames.workers.dev | 'self' https://site-factory-demo-form.ragmybunsvideogames.workers.dev |  |
| ✓ | csp frame-src matches the live pages | 'none' | 'none' |  |
| ✓ | csp frame-ancestors matches the live pages | 'none' | 'none' |  |
| ✓ | csp form-action matches the live pages | 'self' | 'self' |  |
| ✓ | csp base-uri matches the live pages | 'none' | 'none' |  |
| ✓ | csp object-src matches the live pages | 'none' | 'none' |  |
| ✓ | csp worker-src matches the live pages | 'self' | 'self' |  |
| ✓ | csp manifest-src matches the live pages | 'self' | 'self' |  |

Policy derived from the live pages:

```
default-src 'self'; script-src 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndmvxuL/Q=' 'sha256-S1A5adduEijVrGcCbQP7qjtQjWcDc5wUn9YMbKf6E6U=' 'sha256-U7a72oKuFFz8D7GUHLA1NZ0ciymHmDOc9T9aVDg2rWU=' 'sha256-u+TquWHJOBijgNy7IzAwARRKwK3Pzqf1SGBQnt1iKnU='; style-src 'self' 'unsafe-inline'; img-src 'self'; font-src 'self'; connect-src 'self' https://site-factory-demo-form.ragmybunsvideogames.workers.dev; frame-src 'none'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'; object-src 'none'; worker-src 'self'; manifest-src 'self'
```

Live: `default-src 'self'; script-src 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndmvxuL/Q=' 'sha256-S1A5adduEijVrGcCbQP7qjtQjWcDc5wUn9YMbKf6E6U=' 'sha256-U7a72oKuFFz8D7GUHLA1NZ0ciymHmDOc9T9aVDg2rWU=' 'sha256-u+TquWHJOBijgNy7IzAwARRKwK3Pzqf1SGBQnt1iKnU='; style-src 'self' 'unsafe-inline'; img-src 'self'; font-src 'self'; connect-src 'self' https://site-factory-demo-form.ragmybunsvideogames.workers.dev; frame-src 'none'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'; object-src 'none'; worker-src 'self'; manifest-src 'self'`

#### Demo posture — ✓

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | / meta robots | noindex,nofollow | noindex, nofollow |  |
| ✓ | /about/ meta robots | noindex,nofollow | noindex, nofollow |  |
| ✓ | /contact/ meta robots | noindex,nofollow | noindex, nofollow |  |
| ✓ | /services/ meta robots | noindex,nofollow | noindex, nofollow |  |
| ✓ | /robots.txt disallows / for User-agent: * | # Private pitch mockup — not for indexing. · User-agent: * · Disallow: / | User-agent: * → Disallow: / |  |
| ✓ | /sitemap-index.xml is absent | 404 | 404 |  |
| ✓ | /sitemap-0.xml is absent | 404 | 404 |  |

#### og:image — ✗

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | context · og:image declared | https://americanmachinespecialty.com/og/american-machine-specialty.png |  |  |
| ✓ | twitter:image matches og:image | https://americanmachinespecialty.com/og/american-machine-specialty.png | https://americanmachinespecialty.com/og/american-machine-specialty.png |  |
| ✗ | og:image is advertised on the origin serving this demo | https://americanmachinespecialty.com | https://american-machine-specialty-preview.pages.dev | the template builds og:image absolute against seo.siteUrl |
| ✗ | og:image is reachable | HTTP 404 | 200 or 206 |  |
| ✓ | context · the same path at the deploy origin | https://american-machine-specialty-preview.pages.dev/og/american-machine-specialty.png → HTTP 200 image/png, 1200×630 |  | the card exists and is correct here; only the tag points elsewhere |

#### Form path — ✓

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | the live /contact/ carries a form endpoint | https://site-factory-demo-form.ragmybunsvideogames.workers.dev | a Worker URL | read from <astro-island props>, the same attribute measurePage parses |
| ✓ | preflight status | 204 | 204 |  |
| ✓ | preflight Access-Control-Allow-Origin echoes this demo | https://american-machine-specialty-preview.pages.dev | https://american-machine-specialty-preview.pages.dev |  |
| ✓ | preflight Access-Control-Allow-Methods includes POST | POST, OPTIONS | POST |  |
| ✓ | preflight Vary | Origin | Origin |  |
| ✓ | a suffix-lookalike origin gets no CORS grant | absent | absent | sent Origin: https://evil-preview.pages.dev.attacker.com — the dot-boundary case lib/http.ts refuses |
| ✓ | honeypot POST status | 200 | 200 |  |
| ✓ | honeypot POST body | {"ok":true} | {"ok":true} |  |
| ✓ | POST Access-Control-Allow-Origin echoes this demo | https://american-machine-specialty-preview.pages.dev | https://american-machine-specialty-preview.pages.dev |  |

#### Service worker — ✓

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | / loads in a browser | 200 | 200 |  |
| ✓ | the live build registers a service worker | register script present |  |  |
| ✓ | /sw.js is served | 200 | 200 |  |
| ✓ | a service worker is active | https://american-machine-specialty-preview.pages.dev/sw.js | an active registration |  |
| ✓ | the worker filled a cache | 74 entries in site-factory:american-machine-specialty:64d0f6e50cfa | > 0 entries |  |
| ✓ | /services/ loads in a browser | 200 | 200 |  |
| ✓ | /services/ was served through the worker | true | true | sw.js is network-first for navigations; this asserts the worker handled it |
| ✓ | /services/ rendered | What we do | a non-empty <h1> |  |
| ✓ | /services/ has its brand custom property applied | #12507a | a non-empty --color-primary or --d-accent | the inlined stylesheet arrived; a 200 that is visibly broken fails here |

#### Lighthouse — ✓

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | Lighthouse attached to the port this session opened | port 63126 | port 63126 | the browser was launched with --remote-debugging-port |
| ✓ | lighthouse accessibility | 96 | ≥ 90 |  |
| ✓ | lighthouse best-practices | 100 | ≥ 90 |  |
| ✓ | lighthouse seo | 69 | reported, no bar | no bar while every demo is noindex — see the header |
| ✓ | lighthouse performance | 100 | reported, no bar |  |

Scores (mobile, port 63126): performance 100, accessibility 96, best-practices 100, seo 69.

#### Customizer — ✓

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | forge/dark/ember/condensed-caps · data-theme | forge | forge |  |
| ✓ | forge/dark/ember/condensed-caps · data-scheme | dark | dark |  |
| ✓ | forge/dark/ember/condensed-caps · data-accent | ember | ember |  |
| ✓ | forge/dark/ember/condensed-caps · data-font | condensed-caps | condensed-caps |  |
| ✓ | forge/dark/ember/condensed-caps · --d-accent | #e2551f | #e2551f | expected value read from presets.json, not from the page |
| ✓ | precision/light/teal/technical · data-theme | precision | precision |  |
| ✓ | precision/light/teal/technical · data-scheme | light | light |  |
| ✓ | precision/light/teal/technical · data-accent | teal | teal |  |
| ✓ | precision/light/teal/technical · data-font | technical | technical |  |
| ✓ | precision/light/teal/technical · --d-accent | #0a6a6a | #0a6a6a | expected value read from presets.json, not from the page |
| ✓ | heritage/light/forest/signwriter · data-theme | heritage | heritage |  |
| ✓ | heritage/light/forest/signwriter · data-scheme | light | light |  |
| ✓ | heritage/light/forest/signwriter · data-accent | forest | forest |  |
| ✓ | heritage/light/forest/signwriter · data-font | signwriter | signwriter |  |
| ✓ | heritage/light/forest/signwriter · --d-accent | #1f5140 | #1f5140 | expected value read from presets.json, not from the page |
| ✓ | ?theme=brutalist&accent=chartreuse · resolved to a real family | precision | a preset in presets.json |  |
| ✓ | ?theme=brutalist&accent=chartreuse · did not stamp the invented accent | blueprint | not "chartreuse" |  |
| ✓ | ?theme=brutalist&accent=chartreuse · landed on a painted cell | #0b5fbe | a non-empty --d-accent | the accent is one presets.json offers for that cell |

### `industrial-machine-corp` — https://industrial-machine-corp-preview.pages.dev

Verdict: **fail**

#### Routes — ✓

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | the live origin serves this client | industrial-machine-corp | industrial-machine-corp | read from <link rel="manifest"> → /icons/<slug>/ |
| ✓ | / status | 200 | 200 |  |
| ✓ | / content-type | text/html; charset=utf-8 | text/html |  |
| ✓ | /about/ status | 200 | 200 |  |
| ✓ | /about/ content-type | text/html; charset=utf-8 | text/html |  |
| ✓ | /contact/ status | 200 | 200 |  |
| ✓ | /contact/ content-type | text/html; charset=utf-8 | text/html |  |
| ✓ | /services/ status | 200 | 200 |  |
| ✓ | /services/ content-type | text/html; charset=utf-8 | text/html |  |
| ✓ | /definitely-not-a-page status | 404 | 404 |  |
| ✓ | /definitely-not-a-page is the template's own 404 page | That page isn't here. | That page isn't here. |  |

#### Security headers — ✓

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | the deploy carries this repo's generated _headers | yes | yes | derived from 4 live page(s): /, /about/, /contact/, /services/ |
| ✓ | x-content-type-options | nosniff | nosniff | build |
| ✓ | referrer-policy | strict-origin-when-cross-origin | strict-origin-when-cross-origin | build |
| ✓ | x-frame-options | DENY | DENY | build |
| ✓ | permissions-policy denies every feature in DENIED_FEATURES | all 16 denied | all 16 denied | build |
| ✓ | csp script-src does not contain 'unsafe-inline' | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndm… (330 chars) | no 'unsafe-inline' |  |
| ✓ | csp script-src does not contain 'unsafe-eval' | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndm… (330 chars) | no 'unsafe-eval' |  |
| ✓ | csp script-src does not contain 'strict-dynamic' | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndm… (330 chars) | no 'strict-dynamic' |  |
| ✓ | csp script-src does not contain 'unsafe-hashes' | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndm… (330 chars) | no 'unsafe-hashes' |  |
| ✓ | csp script-src has no wildcard | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndm… (330 chars) | no * |  |
| ✓ | csp script-src includes 'self' | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndm… (330 chars) | 'self' |  |
| ✓ | csp default-src does not contain 'unsafe-inline' | 'self' | no 'unsafe-inline' |  |
| ✓ | csp script-src does not contain 'unsafe-inline' | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndm… (330 chars) | no 'unsafe-inline' |  |
| ✓ | csp img-src does not contain 'unsafe-inline' | 'self' | no 'unsafe-inline' |  |
| ✓ | csp font-src does not contain 'unsafe-inline' | 'self' | no 'unsafe-inline' |  |
| ✓ | csp connect-src does not contain 'unsafe-inline' | 'self' https://site-factory-demo-form.ragmybunsvideogames.workers.dev | no 'unsafe-inline' |  |
| ✓ | csp frame-src does not contain 'unsafe-inline' | 'none' | no 'unsafe-inline' |  |
| ✓ | csp frame-ancestors does not contain 'unsafe-inline' | 'none' | no 'unsafe-inline' |  |
| ✓ | csp form-action does not contain 'unsafe-inline' | 'self' | no 'unsafe-inline' |  |
| ✓ | csp base-uri does not contain 'unsafe-inline' | 'none' | no 'unsafe-inline' |  |
| ✓ | csp object-src does not contain 'unsafe-inline' | 'none' | no 'unsafe-inline' |  |
| ✓ | csp worker-src does not contain 'unsafe-inline' | 'self' | no 'unsafe-inline' |  |
| ✓ | csp manifest-src does not contain 'unsafe-inline' | 'self' | no 'unsafe-inline' |  |
| ✓ | csp default-src | 'self' | 'self' |  |
| ✓ | csp frame-ancestors | 'none' | 'none' |  |
| ✓ | csp form-action | 'self' | 'self' |  |
| ✓ | csp base-uri | 'none' | 'none' |  |
| ✓ | csp object-src | 'none' | 'none' |  |
| ✓ | csp worker-src | 'self' | 'self' |  |
| ✓ | csp manifest-src | 'self' | 'self' |  |
| ✓ | csp style-src | 'self' 'unsafe-inline' | 'self' 'unsafe-inline' |  |
| ✓ | csp default-src matches the live pages | 'self' | 'self' |  |
| ✓ | csp script-src matches the live pages | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndm… (330 chars) | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndm… (330 chars) |  |
| ✓ | csp style-src matches the live pages | 'self' 'unsafe-inline' | 'self' 'unsafe-inline' |  |
| ✓ | csp img-src matches the live pages | 'self' | 'self' |  |
| ✓ | csp font-src matches the live pages | 'self' | 'self' |  |
| ✓ | csp connect-src matches the live pages | 'self' https://site-factory-demo-form.ragmybunsvideogames.workers.dev | 'self' https://site-factory-demo-form.ragmybunsvideogames.workers.dev |  |
| ✓ | csp frame-src matches the live pages | 'none' | 'none' |  |
| ✓ | csp frame-ancestors matches the live pages | 'none' | 'none' |  |
| ✓ | csp form-action matches the live pages | 'self' | 'self' |  |
| ✓ | csp base-uri matches the live pages | 'none' | 'none' |  |
| ✓ | csp object-src matches the live pages | 'none' | 'none' |  |
| ✓ | csp worker-src matches the live pages | 'self' | 'self' |  |
| ✓ | csp manifest-src matches the live pages | 'self' | 'self' |  |

Policy derived from the live pages:

```
default-src 'self'; script-src 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndmvxuL/Q=' 'sha256-TW/Vwkrtf9rifpEgKlyeac1Qkp70RHxwZOCgmJDiDmk=' 'sha256-U7a72oKuFFz8D7GUHLA1NZ0ciymHmDOc9T9aVDg2rWU=' 'sha256-aCmkFVzJYkRRHDKBDzYNgK07UD9yVVLnE8qO5lECt0M='; style-src 'self' 'unsafe-inline'; img-src 'self'; font-src 'self'; connect-src 'self' https://site-factory-demo-form.ragmybunsvideogames.workers.dev; frame-src 'none'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'; object-src 'none'; worker-src 'self'; manifest-src 'self'
```

Live: `default-src 'self'; script-src 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndmvxuL/Q=' 'sha256-TW/Vwkrtf9rifpEgKlyeac1Qkp70RHxwZOCgmJDiDmk=' 'sha256-U7a72oKuFFz8D7GUHLA1NZ0ciymHmDOc9T9aVDg2rWU=' 'sha256-aCmkFVzJYkRRHDKBDzYNgK07UD9yVVLnE8qO5lECt0M='; style-src 'self' 'unsafe-inline'; img-src 'self'; font-src 'self'; connect-src 'self' https://site-factory-demo-form.ragmybunsvideogames.workers.dev; frame-src 'none'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'; object-src 'none'; worker-src 'self'; manifest-src 'self'`

#### Demo posture — ✓

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | / meta robots | noindex,nofollow | noindex, nofollow |  |
| ✓ | /about/ meta robots | noindex,nofollow | noindex, nofollow |  |
| ✓ | /contact/ meta robots | noindex,nofollow | noindex, nofollow |  |
| ✓ | /services/ meta robots | noindex,nofollow | noindex, nofollow |  |
| ✓ | /robots.txt disallows / for User-agent: * | # Private pitch mockup — not for indexing. · User-agent: * · Disallow: / | User-agent: * → Disallow: / |  |
| ✓ | /sitemap-index.xml is absent | 404 | 404 |  |
| ✓ | /sitemap-0.xml is absent | 404 | 404 |  |

#### og:image — ✗

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | context · og:image declared | https://example.invalid/og/industrial-machine-corp.png |  |  |
| ✓ | twitter:image matches og:image | https://example.invalid/og/industrial-machine-corp.png | https://example.invalid/og/industrial-machine-corp.png |  |
| ✗ | og:image is advertised on the origin serving this demo | https://example.invalid | https://industrial-machine-corp-preview.pages.dev | the template builds og:image absolute against seo.siteUrl |
| ✗ | og:image is reachable | fetch failed (ENOTFOUND) | 200 or 206 |  |
| ✓ | context · the same path at the deploy origin | https://industrial-machine-corp-preview.pages.dev/og/industrial-machine-corp.png → HTTP 200 image/png, 1200×630 |  | the card exists and is correct here; only the tag points elsewhere |

#### Form path — ✓

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | the live /contact/ carries a form endpoint | https://site-factory-demo-form.ragmybunsvideogames.workers.dev | a Worker URL | read from <astro-island props>, the same attribute measurePage parses |
| ✓ | preflight status | 204 | 204 |  |
| ✓ | preflight Access-Control-Allow-Origin echoes this demo | https://industrial-machine-corp-preview.pages.dev | https://industrial-machine-corp-preview.pages.dev |  |
| ✓ | preflight Access-Control-Allow-Methods includes POST | POST, OPTIONS | POST |  |
| ✓ | preflight Vary | Origin | Origin |  |
| ✓ | a suffix-lookalike origin gets no CORS grant | absent | absent | sent Origin: https://evil-preview.pages.dev.attacker.com — the dot-boundary case lib/http.ts refuses |
| ✓ | honeypot POST status | 200 | 200 |  |
| ✓ | honeypot POST body | {"ok":true} | {"ok":true} |  |
| ✓ | POST Access-Control-Allow-Origin echoes this demo | https://industrial-machine-corp-preview.pages.dev | https://industrial-machine-corp-preview.pages.dev |  |

#### Service worker — ✓

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | / loads in a browser | 200 | 200 |  |
| ✓ | the live build registers a service worker | register script present |  |  |
| ✓ | /sw.js is served | 200 | 200 |  |
| ✓ | a service worker is active | https://industrial-machine-corp-preview.pages.dev/sw.js | an active registration |  |
| ✓ | the worker filled a cache | 74 entries in site-factory:industrial-machine-corp:2baff4a472c5 | > 0 entries |  |
| ✓ | /services/ loads in a browser | 200 | 200 |  |
| ✓ | /services/ was served through the worker | true | true | sw.js is network-first for navigations; this asserts the worker handled it |
| ✓ | /services/ rendered | What we do | a non-empty <h1> |  |
| ✓ | /services/ has its brand custom property applied | #334155 | a non-empty --color-primary or --d-accent | the inlined stylesheet arrived; a 200 that is visibly broken fails here |

#### Lighthouse — ✓

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | Lighthouse attached to the port this session opened | port 53642 | port 53642 | the browser was launched with --remote-debugging-port |
| ✓ | lighthouse accessibility | 100 | ≥ 90 |  |
| ✓ | lighthouse best-practices | 100 | ≥ 90 |  |
| ✓ | lighthouse seo | 69 | reported, no bar | no bar while every demo is noindex — see the header |
| ✓ | lighthouse performance | 99 | reported, no bar |  |

Scores (mobile, port 53642): performance 99, accessibility 100, best-practices 100, seo 69.

#### Customizer — ✓

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | forge/dark/ember/condensed-caps · data-theme | forge | forge |  |
| ✓ | forge/dark/ember/condensed-caps · data-scheme | dark | dark |  |
| ✓ | forge/dark/ember/condensed-caps · data-accent | ember | ember |  |
| ✓ | forge/dark/ember/condensed-caps · data-font | condensed-caps | condensed-caps |  |
| ✓ | forge/dark/ember/condensed-caps · --d-accent | #e2551f | #e2551f | expected value read from presets.json, not from the page |
| ✓ | precision/light/teal/technical · data-theme | precision | precision |  |
| ✓ | precision/light/teal/technical · data-scheme | light | light |  |
| ✓ | precision/light/teal/technical · data-accent | teal | teal |  |
| ✓ | precision/light/teal/technical · data-font | technical | technical |  |
| ✓ | precision/light/teal/technical · --d-accent | #0a6a6a | #0a6a6a | expected value read from presets.json, not from the page |
| ✓ | heritage/light/forest/signwriter · data-theme | heritage | heritage |  |
| ✓ | heritage/light/forest/signwriter · data-scheme | light | light |  |
| ✓ | heritage/light/forest/signwriter · data-accent | forest | forest |  |
| ✓ | heritage/light/forest/signwriter · data-font | signwriter | signwriter |  |
| ✓ | heritage/light/forest/signwriter · --d-accent | #1f5140 | #1f5140 | expected value read from presets.json, not from the page |
| ✓ | ?theme=brutalist&accent=chartreuse · resolved to a real family | forge | a preset in presets.json |  |
| ✓ | ?theme=brutalist&accent=chartreuse · did not stamp the invented accent | ember | not "chartreuse" |  |
| ✓ | ?theme=brutalist&accent=chartreuse · landed on a painted cell | #b3400f | a non-empty --d-accent | the accent is one presets.json offers for that cell |

### `kh-machine-works` — https://kh-machine-works-preview.pages.dev

Verdict: **fail**

#### Routes — ✓

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | the live origin serves this client | kh-machine-works | kh-machine-works | read from <link rel="manifest"> → /icons/<slug>/ |
| ✓ | / status | 200 | 200 |  |
| ✓ | / content-type | text/html; charset=utf-8 | text/html |  |
| ✓ | /about/ status | 200 | 200 |  |
| ✓ | /about/ content-type | text/html; charset=utf-8 | text/html |  |
| ✓ | /contact/ status | 200 | 200 |  |
| ✓ | /contact/ content-type | text/html; charset=utf-8 | text/html |  |
| ✓ | /services/ status | 200 | 200 |  |
| ✓ | /services/ content-type | text/html; charset=utf-8 | text/html |  |
| ✓ | /definitely-not-a-page status | 404 | 404 |  |
| ✓ | /definitely-not-a-page is the template's own 404 page | That page isn't here. | That page isn't here. |  |

#### Security headers — ✓

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | the deploy carries this repo's generated _headers | yes | yes | derived from 4 live page(s): /, /about/, /contact/, /services/ |
| ✓ | x-content-type-options | nosniff | nosniff | build |
| ✓ | referrer-policy | strict-origin-when-cross-origin | strict-origin-when-cross-origin | build |
| ✓ | x-frame-options | DENY | DENY | build |
| ✓ | permissions-policy denies every feature in DENIED_FEATURES | all 16 denied | all 16 denied | build |
| ✓ | csp script-src does not contain 'unsafe-inline' | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndm… (330 chars) | no 'unsafe-inline' |  |
| ✓ | csp script-src does not contain 'unsafe-eval' | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndm… (330 chars) | no 'unsafe-eval' |  |
| ✓ | csp script-src does not contain 'strict-dynamic' | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndm… (330 chars) | no 'strict-dynamic' |  |
| ✓ | csp script-src does not contain 'unsafe-hashes' | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndm… (330 chars) | no 'unsafe-hashes' |  |
| ✓ | csp script-src has no wildcard | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndm… (330 chars) | no * |  |
| ✓ | csp script-src includes 'self' | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndm… (330 chars) | 'self' |  |
| ✓ | csp default-src does not contain 'unsafe-inline' | 'self' | no 'unsafe-inline' |  |
| ✓ | csp script-src does not contain 'unsafe-inline' | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndm… (330 chars) | no 'unsafe-inline' |  |
| ✓ | csp img-src does not contain 'unsafe-inline' | 'self' | no 'unsafe-inline' |  |
| ✓ | csp font-src does not contain 'unsafe-inline' | 'self' | no 'unsafe-inline' |  |
| ✓ | csp connect-src does not contain 'unsafe-inline' | 'self' https://site-factory-demo-form.ragmybunsvideogames.workers.dev | no 'unsafe-inline' |  |
| ✓ | csp frame-src does not contain 'unsafe-inline' | 'none' | no 'unsafe-inline' |  |
| ✓ | csp frame-ancestors does not contain 'unsafe-inline' | 'none' | no 'unsafe-inline' |  |
| ✓ | csp form-action does not contain 'unsafe-inline' | 'self' | no 'unsafe-inline' |  |
| ✓ | csp base-uri does not contain 'unsafe-inline' | 'none' | no 'unsafe-inline' |  |
| ✓ | csp object-src does not contain 'unsafe-inline' | 'none' | no 'unsafe-inline' |  |
| ✓ | csp worker-src does not contain 'unsafe-inline' | 'self' | no 'unsafe-inline' |  |
| ✓ | csp manifest-src does not contain 'unsafe-inline' | 'self' | no 'unsafe-inline' |  |
| ✓ | csp default-src | 'self' | 'self' |  |
| ✓ | csp frame-ancestors | 'none' | 'none' |  |
| ✓ | csp form-action | 'self' | 'self' |  |
| ✓ | csp base-uri | 'none' | 'none' |  |
| ✓ | csp object-src | 'none' | 'none' |  |
| ✓ | csp worker-src | 'self' | 'self' |  |
| ✓ | csp manifest-src | 'self' | 'self' |  |
| ✓ | csp style-src | 'self' 'unsafe-inline' | 'self' 'unsafe-inline' |  |
| ✓ | csp default-src matches the live pages | 'self' | 'self' |  |
| ✓ | csp script-src matches the live pages | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndm… (330 chars) | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndm… (330 chars) |  |
| ✓ | csp style-src matches the live pages | 'self' 'unsafe-inline' | 'self' 'unsafe-inline' |  |
| ✓ | csp img-src matches the live pages | 'self' | 'self' |  |
| ✓ | csp font-src matches the live pages | 'self' | 'self' |  |
| ✓ | csp connect-src matches the live pages | 'self' https://site-factory-demo-form.ragmybunsvideogames.workers.dev | 'self' https://site-factory-demo-form.ragmybunsvideogames.workers.dev |  |
| ✓ | csp frame-src matches the live pages | 'none' | 'none' |  |
| ✓ | csp frame-ancestors matches the live pages | 'none' | 'none' |  |
| ✓ | csp form-action matches the live pages | 'self' | 'self' |  |
| ✓ | csp base-uri matches the live pages | 'none' | 'none' |  |
| ✓ | csp object-src matches the live pages | 'none' | 'none' |  |
| ✓ | csp worker-src matches the live pages | 'self' | 'self' |  |
| ✓ | csp manifest-src matches the live pages | 'self' | 'self' |  |

Policy derived from the live pages:

```
default-src 'self'; script-src 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndmvxuL/Q=' 'sha256-U7a72oKuFFz8D7GUHLA1NZ0ciymHmDOc9T9aVDg2rWU=' 'sha256-Wxl3K+B8B4wsCc9eUsCKeksB4tcdRqaL4eS4cTdi+1I=' 'sha256-cADwpaCMAwsj1MAWiePt1HBieYTl/9hkjDXcJB3EQQM='; style-src 'self' 'unsafe-inline'; img-src 'self'; font-src 'self'; connect-src 'self' https://site-factory-demo-form.ragmybunsvideogames.workers.dev; frame-src 'none'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'; object-src 'none'; worker-src 'self'; manifest-src 'self'
```

Live: `default-src 'self'; script-src 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndmvxuL/Q=' 'sha256-U7a72oKuFFz8D7GUHLA1NZ0ciymHmDOc9T9aVDg2rWU=' 'sha256-Wxl3K+B8B4wsCc9eUsCKeksB4tcdRqaL4eS4cTdi+1I=' 'sha256-cADwpaCMAwsj1MAWiePt1HBieYTl/9hkjDXcJB3EQQM='; style-src 'self' 'unsafe-inline'; img-src 'self'; font-src 'self'; connect-src 'self' https://site-factory-demo-form.ragmybunsvideogames.workers.dev; frame-src 'none'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'; object-src 'none'; worker-src 'self'; manifest-src 'self'`

#### Demo posture — ✓

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | / meta robots | noindex,nofollow | noindex, nofollow |  |
| ✓ | /about/ meta robots | noindex,nofollow | noindex, nofollow |  |
| ✓ | /contact/ meta robots | noindex,nofollow | noindex, nofollow |  |
| ✓ | /services/ meta robots | noindex,nofollow | noindex, nofollow |  |
| ✓ | /robots.txt disallows / for User-agent: * | # Private pitch mockup — not for indexing. · User-agent: * · Disallow: / | User-agent: * → Disallow: / |  |
| ✓ | /sitemap-index.xml is absent | 404 | 404 |  |
| ✓ | /sitemap-0.xml is absent | 404 | 404 |  |

#### og:image — ✗

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | context · og:image declared | https://www.khmachineworks.com/og/kh-machine-works.png |  |  |
| ✓ | twitter:image matches og:image | https://www.khmachineworks.com/og/kh-machine-works.png | https://www.khmachineworks.com/og/kh-machine-works.png |  |
| ✗ | og:image is advertised on the origin serving this demo | https://www.khmachineworks.com | https://kh-machine-works-preview.pages.dev | the template builds og:image absolute against seo.siteUrl |
| ✗ | og:image is reachable | HTTP 404 | 200 or 206 |  |
| ✓ | context · the same path at the deploy origin | https://kh-machine-works-preview.pages.dev/og/kh-machine-works.png → HTTP 200 image/png, 1200×630 |  | the card exists and is correct here; only the tag points elsewhere |

#### Form path — ✓

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | the live /contact/ carries a form endpoint | https://site-factory-demo-form.ragmybunsvideogames.workers.dev | a Worker URL | read from <astro-island props>, the same attribute measurePage parses |
| ✓ | preflight status | 204 | 204 |  |
| ✓ | preflight Access-Control-Allow-Origin echoes this demo | https://kh-machine-works-preview.pages.dev | https://kh-machine-works-preview.pages.dev |  |
| ✓ | preflight Access-Control-Allow-Methods includes POST | POST, OPTIONS | POST |  |
| ✓ | preflight Vary | Origin | Origin |  |
| ✓ | a suffix-lookalike origin gets no CORS grant | absent | absent | sent Origin: https://evil-preview.pages.dev.attacker.com — the dot-boundary case lib/http.ts refuses |
| ✓ | honeypot POST status | 200 | 200 |  |
| ✓ | honeypot POST body | {"ok":true} | {"ok":true} |  |
| ✓ | POST Access-Control-Allow-Origin echoes this demo | https://kh-machine-works-preview.pages.dev | https://kh-machine-works-preview.pages.dev |  |

#### Service worker — ✓

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | / loads in a browser | 200 | 200 |  |
| ✓ | the live build registers a service worker | register script present |  |  |
| ✓ | /sw.js is served | 200 | 200 |  |
| ✓ | a service worker is active | https://kh-machine-works-preview.pages.dev/sw.js | an active registration |  |
| ✓ | the worker filled a cache | 74 entries in site-factory:kh-machine-works:f4e7c66f341f | > 0 entries |  |
| ✓ | /services/ loads in a browser | 200 | 200 |  |
| ✓ | /services/ was served through the worker | true | true | sw.js is network-first for navigations; this asserts the worker handled it |
| ✓ | /services/ rendered | What we do | a non-empty <h1> |  |
| ✓ | /services/ has its brand custom property applied | #0f4c81 | a non-empty --color-primary or --d-accent | the inlined stylesheet arrived; a 200 that is visibly broken fails here |

#### Lighthouse — ✓

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | Lighthouse attached to the port this session opened | port 59945 | port 59945 | the browser was launched with --remote-debugging-port |
| ✓ | lighthouse accessibility | 96 | ≥ 90 |  |
| ✓ | lighthouse best-practices | 100 | ≥ 90 |  |
| ✓ | lighthouse seo | 69 | reported, no bar | no bar while every demo is noindex — see the header |
| ✓ | lighthouse performance | 98 | reported, no bar |  |

Scores (mobile, port 59945): performance 98, accessibility 96, best-practices 100, seo 69.

#### Customizer — ✓

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | forge/dark/ember/condensed-caps · data-theme | forge | forge |  |
| ✓ | forge/dark/ember/condensed-caps · data-scheme | dark | dark |  |
| ✓ | forge/dark/ember/condensed-caps · data-accent | ember | ember |  |
| ✓ | forge/dark/ember/condensed-caps · data-font | condensed-caps | condensed-caps |  |
| ✓ | forge/dark/ember/condensed-caps · --d-accent | #e2551f | #e2551f | expected value read from presets.json, not from the page |
| ✓ | precision/light/teal/technical · data-theme | precision | precision |  |
| ✓ | precision/light/teal/technical · data-scheme | light | light |  |
| ✓ | precision/light/teal/technical · data-accent | teal | teal |  |
| ✓ | precision/light/teal/technical · data-font | technical | technical |  |
| ✓ | precision/light/teal/technical · --d-accent | #0a6a6a | #0a6a6a | expected value read from presets.json, not from the page |
| ✓ | heritage/light/forest/signwriter · data-theme | heritage | heritage |  |
| ✓ | heritage/light/forest/signwriter · data-scheme | light | light |  |
| ✓ | heritage/light/forest/signwriter · data-accent | forest | forest |  |
| ✓ | heritage/light/forest/signwriter · data-font | signwriter | signwriter |  |
| ✓ | heritage/light/forest/signwriter · --d-accent | #1f5140 | #1f5140 | expected value read from presets.json, not from the page |
| ✓ | ?theme=brutalist&accent=chartreuse · resolved to a real family | forge | a preset in presets.json |  |
| ✓ | ?theme=brutalist&accent=chartreuse · did not stamp the invented accent | ember | not "chartreuse" |  |
| ✓ | ?theme=brutalist&accent=chartreuse · landed on a painted cell | #b3400f | a non-empty --d-accent | the accent is one presets.json offers for that cell |

### `ks-welding` — https://ks-welding-preview.pages.dev

Verdict: **fail**

#### Routes — ✓

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | the live origin serves this client | ks-welding | ks-welding | read from <link rel="manifest"> → /icons/<slug>/ |
| ✓ | / status | 200 | 200 |  |
| ✓ | / content-type | text/html; charset=utf-8 | text/html |  |
| ✓ | /about/ status | 200 | 200 |  |
| ✓ | /about/ content-type | text/html; charset=utf-8 | text/html |  |
| ✓ | /contact/ status | 200 | 200 |  |
| ✓ | /contact/ content-type | text/html; charset=utf-8 | text/html |  |
| ✓ | /services/ status | 200 | 200 |  |
| ✓ | /services/ content-type | text/html; charset=utf-8 | text/html |  |
| ✓ | /definitely-not-a-page status | 404 | 404 |  |
| ✓ | /definitely-not-a-page is the template's own 404 page | That page isn't here. | That page isn't here. |  |

#### Security headers — ✓

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | the deploy carries this repo's generated _headers | yes | yes | derived from 4 live page(s): /, /about/, /contact/, /services/ |
| ✓ | x-content-type-options | nosniff | nosniff | build |
| ✓ | referrer-policy | strict-origin-when-cross-origin | strict-origin-when-cross-origin | build |
| ✓ | x-frame-options | DENY | DENY | build |
| ✓ | permissions-policy denies every feature in DENIED_FEATURES | all 16 denied | all 16 denied | build |
| ✓ | csp script-src does not contain 'unsafe-inline' | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-E/gBaBKtEy2xqo5M2yA6u/O0zxtewM+3f+pGY4QnRFI=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7… (330 chars) | no 'unsafe-inline' |  |
| ✓ | csp script-src does not contain 'unsafe-eval' | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-E/gBaBKtEy2xqo5M2yA6u/O0zxtewM+3f+pGY4QnRFI=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7… (330 chars) | no 'unsafe-eval' |  |
| ✓ | csp script-src does not contain 'strict-dynamic' | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-E/gBaBKtEy2xqo5M2yA6u/O0zxtewM+3f+pGY4QnRFI=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7… (330 chars) | no 'strict-dynamic' |  |
| ✓ | csp script-src does not contain 'unsafe-hashes' | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-E/gBaBKtEy2xqo5M2yA6u/O0zxtewM+3f+pGY4QnRFI=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7… (330 chars) | no 'unsafe-hashes' |  |
| ✓ | csp script-src has no wildcard | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-E/gBaBKtEy2xqo5M2yA6u/O0zxtewM+3f+pGY4QnRFI=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7… (330 chars) | no * |  |
| ✓ | csp script-src includes 'self' | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-E/gBaBKtEy2xqo5M2yA6u/O0zxtewM+3f+pGY4QnRFI=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7… (330 chars) | 'self' |  |
| ✓ | csp default-src does not contain 'unsafe-inline' | 'self' | no 'unsafe-inline' |  |
| ✓ | csp script-src does not contain 'unsafe-inline' | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-E/gBaBKtEy2xqo5M2yA6u/O0zxtewM+3f+pGY4QnRFI=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7… (330 chars) | no 'unsafe-inline' |  |
| ✓ | csp img-src does not contain 'unsafe-inline' | 'self' | no 'unsafe-inline' |  |
| ✓ | csp font-src does not contain 'unsafe-inline' | 'self' | no 'unsafe-inline' |  |
| ✓ | csp connect-src does not contain 'unsafe-inline' | 'self' https://site-factory-demo-form.ragmybunsvideogames.workers.dev | no 'unsafe-inline' |  |
| ✓ | csp frame-src does not contain 'unsafe-inline' | 'none' | no 'unsafe-inline' |  |
| ✓ | csp frame-ancestors does not contain 'unsafe-inline' | 'none' | no 'unsafe-inline' |  |
| ✓ | csp form-action does not contain 'unsafe-inline' | 'self' | no 'unsafe-inline' |  |
| ✓ | csp base-uri does not contain 'unsafe-inline' | 'none' | no 'unsafe-inline' |  |
| ✓ | csp object-src does not contain 'unsafe-inline' | 'none' | no 'unsafe-inline' |  |
| ✓ | csp worker-src does not contain 'unsafe-inline' | 'self' | no 'unsafe-inline' |  |
| ✓ | csp manifest-src does not contain 'unsafe-inline' | 'self' | no 'unsafe-inline' |  |
| ✓ | csp default-src | 'self' | 'self' |  |
| ✓ | csp frame-ancestors | 'none' | 'none' |  |
| ✓ | csp form-action | 'self' | 'self' |  |
| ✓ | csp base-uri | 'none' | 'none' |  |
| ✓ | csp object-src | 'none' | 'none' |  |
| ✓ | csp worker-src | 'self' | 'self' |  |
| ✓ | csp manifest-src | 'self' | 'self' |  |
| ✓ | csp style-src | 'self' 'unsafe-inline' | 'self' 'unsafe-inline' |  |
| ✓ | csp default-src matches the live pages | 'self' | 'self' |  |
| ✓ | csp script-src matches the live pages | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-E/gBaBKtEy2xqo5M2yA6u/O0zxtewM+3f+pGY4QnRFI=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7… (330 chars) | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-E/gBaBKtEy2xqo5M2yA6u/O0zxtewM+3f+pGY4QnRFI=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7… (330 chars) |  |
| ✓ | csp style-src matches the live pages | 'self' 'unsafe-inline' | 'self' 'unsafe-inline' |  |
| ✓ | csp img-src matches the live pages | 'self' | 'self' |  |
| ✓ | csp font-src matches the live pages | 'self' | 'self' |  |
| ✓ | csp connect-src matches the live pages | 'self' https://site-factory-demo-form.ragmybunsvideogames.workers.dev | 'self' https://site-factory-demo-form.ragmybunsvideogames.workers.dev |  |
| ✓ | csp frame-src matches the live pages | 'none' | 'none' |  |
| ✓ | csp frame-ancestors matches the live pages | 'none' | 'none' |  |
| ✓ | csp form-action matches the live pages | 'self' | 'self' |  |
| ✓ | csp base-uri matches the live pages | 'none' | 'none' |  |
| ✓ | csp object-src matches the live pages | 'none' | 'none' |  |
| ✓ | csp worker-src matches the live pages | 'self' | 'self' |  |
| ✓ | csp manifest-src matches the live pages | 'self' | 'self' |  |

Policy derived from the live pages:

```
default-src 'self'; script-src 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-E/gBaBKtEy2xqo5M2yA6u/O0zxtewM+3f+pGY4QnRFI=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndmvxuL/Q=' 'sha256-U7a72oKuFFz8D7GUHLA1NZ0ciymHmDOc9T9aVDg2rWU=' 'sha256-x4nXAg6mriNnt3CIhm5ZwI2QT8QnFDJLYkfpx6sbth4='; style-src 'self' 'unsafe-inline'; img-src 'self'; font-src 'self'; connect-src 'self' https://site-factory-demo-form.ragmybunsvideogames.workers.dev; frame-src 'none'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'; object-src 'none'; worker-src 'self'; manifest-src 'self'
```

Live: `default-src 'self'; script-src 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-E/gBaBKtEy2xqo5M2yA6u/O0zxtewM+3f+pGY4QnRFI=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndmvxuL/Q=' 'sha256-U7a72oKuFFz8D7GUHLA1NZ0ciymHmDOc9T9aVDg2rWU=' 'sha256-x4nXAg6mriNnt3CIhm5ZwI2QT8QnFDJLYkfpx6sbth4='; style-src 'self' 'unsafe-inline'; img-src 'self'; font-src 'self'; connect-src 'self' https://site-factory-demo-form.ragmybunsvideogames.workers.dev; frame-src 'none'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'; object-src 'none'; worker-src 'self'; manifest-src 'self'`

#### Demo posture — ✓

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | / meta robots | noindex,nofollow | noindex, nofollow |  |
| ✓ | /about/ meta robots | noindex,nofollow | noindex, nofollow |  |
| ✓ | /contact/ meta robots | noindex,nofollow | noindex, nofollow |  |
| ✓ | /services/ meta robots | noindex,nofollow | noindex, nofollow |  |
| ✓ | /robots.txt disallows / for User-agent: * | # Private pitch mockup — not for indexing. · User-agent: * · Disallow: / | User-agent: * → Disallow: / |  |
| ✓ | /sitemap-index.xml is absent | 404 | 404 |  |
| ✓ | /sitemap-0.xml is absent | 404 | 404 |  |

#### og:image — ✗

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | context · og:image declared | https://example.invalid/og/ks-welding.png |  |  |
| ✓ | twitter:image matches og:image | https://example.invalid/og/ks-welding.png | https://example.invalid/og/ks-welding.png |  |
| ✗ | og:image is advertised on the origin serving this demo | https://example.invalid | https://ks-welding-preview.pages.dev | the template builds og:image absolute against seo.siteUrl |
| ✗ | og:image is reachable | fetch failed (ENOTFOUND) | 200 or 206 |  |
| ✓ | context · the same path at the deploy origin | https://ks-welding-preview.pages.dev/og/ks-welding.png → HTTP 200 image/png, 1200×630 |  | the card exists and is correct here; only the tag points elsewhere |

#### Form path — ✓

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | the live /contact/ carries a form endpoint | https://site-factory-demo-form.ragmybunsvideogames.workers.dev | a Worker URL | read from <astro-island props>, the same attribute measurePage parses |
| ✓ | preflight status | 204 | 204 |  |
| ✓ | preflight Access-Control-Allow-Origin echoes this demo | https://ks-welding-preview.pages.dev | https://ks-welding-preview.pages.dev |  |
| ✓ | preflight Access-Control-Allow-Methods includes POST | POST, OPTIONS | POST |  |
| ✓ | preflight Vary | Origin | Origin |  |
| ✓ | a suffix-lookalike origin gets no CORS grant | absent | absent | sent Origin: https://evil-preview.pages.dev.attacker.com — the dot-boundary case lib/http.ts refuses |
| ✓ | honeypot POST status | 200 | 200 |  |
| ✓ | honeypot POST body | {"ok":true} | {"ok":true} |  |
| ✓ | POST Access-Control-Allow-Origin echoes this demo | https://ks-welding-preview.pages.dev | https://ks-welding-preview.pages.dev |  |

#### Service worker — ✓

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | / loads in a browser | 200 | 200 |  |
| ✓ | the live build registers a service worker | register script present |  |  |
| ✓ | /sw.js is served | 200 | 200 |  |
| ✓ | a service worker is active | https://ks-welding-preview.pages.dev/sw.js | an active registration |  |
| ✓ | the worker filled a cache | 74 entries in site-factory:ks-welding:5fdfd531de7b | > 0 entries |  |
| ✓ | /services/ loads in a browser | 200 | 200 |  |
| ✓ | /services/ was served through the worker | true | true | sw.js is network-first for navigations; this asserts the worker handled it |
| ✓ | /services/ rendered | What we do | a non-empty <h1> |  |
| ✓ | /services/ has its brand custom property applied | #1f4e79 | a non-empty --color-primary or --d-accent | the inlined stylesheet arrived; a 200 that is visibly broken fails here |

#### Lighthouse — ✗

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | Lighthouse attached to the port this session opened | port 57022 | port 57022 | the browser was launched with --remote-debugging-port |
| ✓ | lighthouse accessibility | 100 | ≥ 90 |  |
| ✓ | lighthouse best-practices | 100 | ≥ 90 |  |
| ✓ | lighthouse seo | 69 | reported, no bar | no bar while every demo is noindex — see the header |
| ✗ | lighthouse performance | unavailable — other performance audits also failed to score: total-blocking-time | a score | other performance audits also failed to score: total-blocking-time |

Scores (mobile, port 57022): performance unavailable — other performance audits also failed to score: total-blocking-time, accessibility 100, best-practices 100, seo 69.

#### Customizer — ✓

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | forge/dark/ember/condensed-caps · data-theme | forge | forge |  |
| ✓ | forge/dark/ember/condensed-caps · data-scheme | dark | dark |  |
| ✓ | forge/dark/ember/condensed-caps · data-accent | ember | ember |  |
| ✓ | forge/dark/ember/condensed-caps · data-font | condensed-caps | condensed-caps |  |
| ✓ | forge/dark/ember/condensed-caps · --d-accent | #e2551f | #e2551f | expected value read from presets.json, not from the page |
| ✓ | precision/light/teal/technical · data-theme | precision | precision |  |
| ✓ | precision/light/teal/technical · data-scheme | light | light |  |
| ✓ | precision/light/teal/technical · data-accent | teal | teal |  |
| ✓ | precision/light/teal/technical · data-font | technical | technical |  |
| ✓ | precision/light/teal/technical · --d-accent | #0a6a6a | #0a6a6a | expected value read from presets.json, not from the page |
| ✓ | heritage/light/forest/signwriter · data-theme | heritage | heritage |  |
| ✓ | heritage/light/forest/signwriter · data-scheme | light | light |  |
| ✓ | heritage/light/forest/signwriter · data-accent | forest | forest |  |
| ✓ | heritage/light/forest/signwriter · data-font | signwriter | signwriter |  |
| ✓ | heritage/light/forest/signwriter · --d-accent | #1f5140 | #1f5140 | expected value read from presets.json, not from the page |
| ✓ | ?theme=brutalist&accent=chartreuse · resolved to a real family | forge | a preset in presets.json |  |
| ✓ | ?theme=brutalist&accent=chartreuse · did not stamp the invented accent | ember | not "chartreuse" |  |
| ✓ | ?theme=brutalist&accent=chartreuse · landed on a painted cell | #b3400f | a non-empty --d-accent | the accent is one presets.json offers for that cell |

### `ks-welding-forge` — https://ks-welding-forge-preview.pages.dev

Verdict: **fail**

#### Routes — ✓

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | the live origin serves this client | ks-welding-forge | ks-welding-forge | read from <link rel="manifest"> → /icons/<slug>/ |
| ✓ | / status | 200 | 200 |  |
| ✓ | / content-type | text/html; charset=utf-8 | text/html |  |
| ✓ | /about/ status | 200 | 200 |  |
| ✓ | /about/ content-type | text/html; charset=utf-8 | text/html |  |
| ✓ | /contact/ status | 200 | 200 |  |
| ✓ | /contact/ content-type | text/html; charset=utf-8 | text/html |  |
| ✓ | /services/ status | 200 | 200 |  |
| ✓ | /services/ content-type | text/html; charset=utf-8 | text/html |  |
| ✓ | /definitely-not-a-page status | 404 | 404 |  |
| ✓ | /definitely-not-a-page is the template's own 404 page | That page isn't here. | That page isn't here. |  |

#### Security headers — ✓

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | the deploy carries this repo's generated _headers | yes | yes | derived from 4 live page(s): /, /about/, /contact/, /services/ |
| ✓ | x-content-type-options | nosniff | nosniff | build |
| ✓ | referrer-policy | strict-origin-when-cross-origin | strict-origin-when-cross-origin | build |
| ✓ | x-frame-options | DENY | DENY | build |
| ✓ | permissions-policy denies every feature in DENIED_FEATURES | all 16 denied | all 16 denied | build |
| ✓ | csp script-src does not contain 'unsafe-inline' | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndm… (222 chars) | no 'unsafe-inline' |  |
| ✓ | csp script-src does not contain 'unsafe-eval' | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndm… (222 chars) | no 'unsafe-eval' |  |
| ✓ | csp script-src does not contain 'strict-dynamic' | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndm… (222 chars) | no 'strict-dynamic' |  |
| ✓ | csp script-src does not contain 'unsafe-hashes' | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndm… (222 chars) | no 'unsafe-hashes' |  |
| ✓ | csp script-src has no wildcard | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndm… (222 chars) | no * |  |
| ✓ | csp script-src includes 'self' | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndm… (222 chars) | 'self' |  |
| ✓ | csp default-src does not contain 'unsafe-inline' | 'self' | no 'unsafe-inline' |  |
| ✓ | csp script-src does not contain 'unsafe-inline' | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndm… (222 chars) | no 'unsafe-inline' |  |
| ✓ | csp img-src does not contain 'unsafe-inline' | 'self' | no 'unsafe-inline' |  |
| ✓ | csp font-src does not contain 'unsafe-inline' | 'self' | no 'unsafe-inline' |  |
| ✓ | csp connect-src does not contain 'unsafe-inline' | 'self' https://site-factory-demo-form.ragmybunsvideogames.workers.dev | no 'unsafe-inline' |  |
| ✓ | csp frame-src does not contain 'unsafe-inline' | 'none' | no 'unsafe-inline' |  |
| ✓ | csp frame-ancestors does not contain 'unsafe-inline' | 'none' | no 'unsafe-inline' |  |
| ✓ | csp form-action does not contain 'unsafe-inline' | 'self' | no 'unsafe-inline' |  |
| ✓ | csp base-uri does not contain 'unsafe-inline' | 'none' | no 'unsafe-inline' |  |
| ✓ | csp object-src does not contain 'unsafe-inline' | 'none' | no 'unsafe-inline' |  |
| ✓ | csp worker-src does not contain 'unsafe-inline' | 'self' | no 'unsafe-inline' |  |
| ✓ | csp manifest-src does not contain 'unsafe-inline' | 'self' | no 'unsafe-inline' |  |
| ✓ | csp default-src | 'self' | 'self' |  |
| ✓ | csp frame-ancestors | 'none' | 'none' |  |
| ✓ | csp form-action | 'self' | 'self' |  |
| ✓ | csp base-uri | 'none' | 'none' |  |
| ✓ | csp object-src | 'none' | 'none' |  |
| ✓ | csp worker-src | 'self' | 'self' |  |
| ✓ | csp manifest-src | 'self' | 'self' |  |
| ✓ | csp style-src | 'self' 'unsafe-inline' | 'self' 'unsafe-inline' |  |
| ✓ | csp default-src matches the live pages | 'self' | 'self' |  |
| ✓ | csp script-src matches the live pages | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndm… (222 chars) | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndm… (222 chars) |  |
| ✓ | csp style-src matches the live pages | 'self' 'unsafe-inline' | 'self' 'unsafe-inline' |  |
| ✓ | csp img-src matches the live pages | 'self' | 'self' |  |
| ✓ | csp font-src matches the live pages | 'self' | 'self' |  |
| ✓ | csp connect-src matches the live pages | 'self' https://site-factory-demo-form.ragmybunsvideogames.workers.dev | 'self' https://site-factory-demo-form.ragmybunsvideogames.workers.dev |  |
| ✓ | csp frame-src matches the live pages | 'none' | 'none' |  |
| ✓ | csp frame-ancestors matches the live pages | 'none' | 'none' |  |
| ✓ | csp form-action matches the live pages | 'self' | 'self' |  |
| ✓ | csp base-uri matches the live pages | 'none' | 'none' |  |
| ✓ | csp object-src matches the live pages | 'none' | 'none' |  |
| ✓ | csp worker-src matches the live pages | 'self' | 'self' |  |
| ✓ | csp manifest-src matches the live pages | 'self' | 'self' |  |

Policy derived from the live pages:

```
default-src 'self'; script-src 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndmvxuL/Q=' 'sha256-U7a72oKuFFz8D7GUHLA1NZ0ciymHmDOc9T9aVDg2rWU='; style-src 'self' 'unsafe-inline'; img-src 'self'; font-src 'self'; connect-src 'self' https://site-factory-demo-form.ragmybunsvideogames.workers.dev; frame-src 'none'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'; object-src 'none'; worker-src 'self'; manifest-src 'self'
```

Live: `default-src 'self'; script-src 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndmvxuL/Q=' 'sha256-U7a72oKuFFz8D7GUHLA1NZ0ciymHmDOc9T9aVDg2rWU='; style-src 'self' 'unsafe-inline'; img-src 'self'; font-src 'self'; connect-src 'self' https://site-factory-demo-form.ragmybunsvideogames.workers.dev; frame-src 'none'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'; object-src 'none'; worker-src 'self'; manifest-src 'self'`

#### Demo posture — ✓

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | / meta robots | noindex,nofollow | noindex, nofollow |  |
| ✓ | /about/ meta robots | noindex,nofollow | noindex, nofollow |  |
| ✓ | /contact/ meta robots | noindex,nofollow | noindex, nofollow |  |
| ✓ | /services/ meta robots | noindex,nofollow | noindex, nofollow |  |
| ✓ | /robots.txt disallows / for User-agent: * | # Private pitch mockup — not for indexing. · User-agent: * · Disallow: / | User-agent: * → Disallow: / |  |
| ✓ | /sitemap-index.xml is absent | 404 | 404 |  |
| ✓ | /sitemap-0.xml is absent | 404 | 404 |  |

#### og:image — ✗

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | context · og:image declared | https://example.invalid/og/ks-welding-forge.png |  |  |
| ✓ | twitter:image matches og:image | https://example.invalid/og/ks-welding-forge.png | https://example.invalid/og/ks-welding-forge.png |  |
| ✗ | og:image is advertised on the origin serving this demo | https://example.invalid | https://ks-welding-forge-preview.pages.dev | the template builds og:image absolute against seo.siteUrl |
| ✗ | og:image is reachable | fetch failed (ENOTFOUND) | 200 or 206 |  |
| ✓ | context · the same path at the deploy origin | https://ks-welding-forge-preview.pages.dev/og/ks-welding-forge.png → HTTP 200 image/png, 1200×630 |  | the card exists and is correct here; only the tag points elsewhere |

#### Form path — ✓

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | the live /contact/ carries a form endpoint | https://site-factory-demo-form.ragmybunsvideogames.workers.dev | a Worker URL | read from <astro-island props>, the same attribute measurePage parses |
| ✓ | preflight status | 204 | 204 |  |
| ✓ | preflight Access-Control-Allow-Origin echoes this demo | https://ks-welding-forge-preview.pages.dev | https://ks-welding-forge-preview.pages.dev |  |
| ✓ | preflight Access-Control-Allow-Methods includes POST | POST, OPTIONS | POST |  |
| ✓ | preflight Vary | Origin | Origin |  |
| ✓ | a suffix-lookalike origin gets no CORS grant | absent | absent | sent Origin: https://evil-preview.pages.dev.attacker.com — the dot-boundary case lib/http.ts refuses |
| ✓ | honeypot POST status | 200 | 200 |  |
| ✓ | honeypot POST body | {"ok":true} | {"ok":true} |  |
| ✓ | POST Access-Control-Allow-Origin echoes this demo | https://ks-welding-forge-preview.pages.dev | https://ks-welding-forge-preview.pages.dev |  |

#### Service worker — ✓

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | / loads in a browser | 200 | 200 |  |
| ✓ | the live build registers a service worker | register script present |  |  |
| ✓ | /sw.js is served | 200 | 200 |  |
| ✓ | a service worker is active | https://ks-welding-forge-preview.pages.dev/sw.js | an active registration |  |
| ✓ | the worker filled a cache | 74 entries in site-factory:ks-welding-forge:e2b31bf56c07 | > 0 entries |  |
| ✓ | /services/ loads in a browser | 200 | 200 |  |
| ✓ | /services/ was served through the worker | true | true | sw.js is network-first for navigations; this asserts the worker handled it |
| ✓ | /services/ rendered | What we do | a non-empty <h1> |  |
| ✓ | /services/ has its brand custom property applied | #1f4e79 | a non-empty --color-primary or --d-accent | the inlined stylesheet arrived; a 200 that is visibly broken fails here |

#### Lighthouse — ✗

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | Lighthouse attached to the port this session opened | port 58966 | port 58966 | the browser was launched with --remote-debugging-port |
| ✓ | lighthouse accessibility | 100 | ≥ 90 |  |
| ✓ | lighthouse best-practices | 100 | ≥ 90 |  |
| ✓ | lighthouse seo | 69 | reported, no bar | no bar while every demo is noindex — see the header |
| ✗ | lighthouse performance | unavailable — other performance audits also failed to score: total-blocking-time | a score | other performance audits also failed to score: total-blocking-time |

Scores (mobile, port 58966): performance unavailable — other performance audits also failed to score: total-blocking-time, accessibility 100, best-practices 100, seo 69.

#### Customizer — n/a

the live build carries no customizer panel (features.customizer is off)

### `ks-welding-heritage` — https://ks-welding-heritage-preview.pages.dev

Verdict: **fail**

#### Routes — ✓

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | the live origin serves this client | ks-welding-heritage | ks-welding-heritage | read from <link rel="manifest"> → /icons/<slug>/ |
| ✓ | / status | 200 | 200 |  |
| ✓ | / content-type | text/html; charset=utf-8 | text/html |  |
| ✓ | /about/ status | 200 | 200 |  |
| ✓ | /about/ content-type | text/html; charset=utf-8 | text/html |  |
| ✓ | /contact/ status | 200 | 200 |  |
| ✓ | /contact/ content-type | text/html; charset=utf-8 | text/html |  |
| ✓ | /services/ status | 200 | 200 |  |
| ✓ | /services/ content-type | text/html; charset=utf-8 | text/html |  |
| ✓ | /definitely-not-a-page status | 404 | 404 |  |
| ✓ | /definitely-not-a-page is the template's own 404 page | That page isn't here. | That page isn't here. |  |

#### Security headers — ✓

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | the deploy carries this repo's generated _headers | yes | yes | derived from 4 live page(s): /, /about/, /contact/, /services/ |
| ✓ | x-content-type-options | nosniff | nosniff | build |
| ✓ | referrer-policy | strict-origin-when-cross-origin | strict-origin-when-cross-origin | build |
| ✓ | x-frame-options | DENY | DENY | build |
| ✓ | permissions-policy denies every feature in DENIED_FEATURES | all 16 denied | all 16 denied | build |
| ✓ | csp script-src does not contain 'unsafe-inline' | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndm… (222 chars) | no 'unsafe-inline' |  |
| ✓ | csp script-src does not contain 'unsafe-eval' | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndm… (222 chars) | no 'unsafe-eval' |  |
| ✓ | csp script-src does not contain 'strict-dynamic' | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndm… (222 chars) | no 'strict-dynamic' |  |
| ✓ | csp script-src does not contain 'unsafe-hashes' | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndm… (222 chars) | no 'unsafe-hashes' |  |
| ✓ | csp script-src has no wildcard | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndm… (222 chars) | no * |  |
| ✓ | csp script-src includes 'self' | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndm… (222 chars) | 'self' |  |
| ✓ | csp default-src does not contain 'unsafe-inline' | 'self' | no 'unsafe-inline' |  |
| ✓ | csp script-src does not contain 'unsafe-inline' | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndm… (222 chars) | no 'unsafe-inline' |  |
| ✓ | csp img-src does not contain 'unsafe-inline' | 'self' | no 'unsafe-inline' |  |
| ✓ | csp font-src does not contain 'unsafe-inline' | 'self' | no 'unsafe-inline' |  |
| ✓ | csp connect-src does not contain 'unsafe-inline' | 'self' https://site-factory-demo-form.ragmybunsvideogames.workers.dev | no 'unsafe-inline' |  |
| ✓ | csp frame-src does not contain 'unsafe-inline' | 'none' | no 'unsafe-inline' |  |
| ✓ | csp frame-ancestors does not contain 'unsafe-inline' | 'none' | no 'unsafe-inline' |  |
| ✓ | csp form-action does not contain 'unsafe-inline' | 'self' | no 'unsafe-inline' |  |
| ✓ | csp base-uri does not contain 'unsafe-inline' | 'none' | no 'unsafe-inline' |  |
| ✓ | csp object-src does not contain 'unsafe-inline' | 'none' | no 'unsafe-inline' |  |
| ✓ | csp worker-src does not contain 'unsafe-inline' | 'self' | no 'unsafe-inline' |  |
| ✓ | csp manifest-src does not contain 'unsafe-inline' | 'self' | no 'unsafe-inline' |  |
| ✓ | csp default-src | 'self' | 'self' |  |
| ✓ | csp frame-ancestors | 'none' | 'none' |  |
| ✓ | csp form-action | 'self' | 'self' |  |
| ✓ | csp base-uri | 'none' | 'none' |  |
| ✓ | csp object-src | 'none' | 'none' |  |
| ✓ | csp worker-src | 'self' | 'self' |  |
| ✓ | csp manifest-src | 'self' | 'self' |  |
| ✓ | csp style-src | 'self' 'unsafe-inline' | 'self' 'unsafe-inline' |  |
| ✓ | csp default-src matches the live pages | 'self' | 'self' |  |
| ✓ | csp script-src matches the live pages | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndm… (222 chars) | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndm… (222 chars) |  |
| ✓ | csp style-src matches the live pages | 'self' 'unsafe-inline' | 'self' 'unsafe-inline' |  |
| ✓ | csp img-src matches the live pages | 'self' | 'self' |  |
| ✓ | csp font-src matches the live pages | 'self' | 'self' |  |
| ✓ | csp connect-src matches the live pages | 'self' https://site-factory-demo-form.ragmybunsvideogames.workers.dev | 'self' https://site-factory-demo-form.ragmybunsvideogames.workers.dev |  |
| ✓ | csp frame-src matches the live pages | 'none' | 'none' |  |
| ✓ | csp frame-ancestors matches the live pages | 'none' | 'none' |  |
| ✓ | csp form-action matches the live pages | 'self' | 'self' |  |
| ✓ | csp base-uri matches the live pages | 'none' | 'none' |  |
| ✓ | csp object-src matches the live pages | 'none' | 'none' |  |
| ✓ | csp worker-src matches the live pages | 'self' | 'self' |  |
| ✓ | csp manifest-src matches the live pages | 'self' | 'self' |  |

Policy derived from the live pages:

```
default-src 'self'; script-src 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndmvxuL/Q=' 'sha256-U7a72oKuFFz8D7GUHLA1NZ0ciymHmDOc9T9aVDg2rWU='; style-src 'self' 'unsafe-inline'; img-src 'self'; font-src 'self'; connect-src 'self' https://site-factory-demo-form.ragmybunsvideogames.workers.dev; frame-src 'none'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'; object-src 'none'; worker-src 'self'; manifest-src 'self'
```

Live: `default-src 'self'; script-src 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndmvxuL/Q=' 'sha256-U7a72oKuFFz8D7GUHLA1NZ0ciymHmDOc9T9aVDg2rWU='; style-src 'self' 'unsafe-inline'; img-src 'self'; font-src 'self'; connect-src 'self' https://site-factory-demo-form.ragmybunsvideogames.workers.dev; frame-src 'none'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'; object-src 'none'; worker-src 'self'; manifest-src 'self'`

#### Demo posture — ✓

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | / meta robots | noindex,nofollow | noindex, nofollow |  |
| ✓ | /about/ meta robots | noindex,nofollow | noindex, nofollow |  |
| ✓ | /contact/ meta robots | noindex,nofollow | noindex, nofollow |  |
| ✓ | /services/ meta robots | noindex,nofollow | noindex, nofollow |  |
| ✓ | /robots.txt disallows / for User-agent: * | # Private pitch mockup — not for indexing. · User-agent: * · Disallow: / | User-agent: * → Disallow: / |  |
| ✓ | /sitemap-index.xml is absent | 404 | 404 |  |
| ✓ | /sitemap-0.xml is absent | 404 | 404 |  |

#### og:image — ✗

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | context · og:image declared | https://example.invalid/og/ks-welding-heritage.png |  |  |
| ✓ | twitter:image matches og:image | https://example.invalid/og/ks-welding-heritage.png | https://example.invalid/og/ks-welding-heritage.png |  |
| ✗ | og:image is advertised on the origin serving this demo | https://example.invalid | https://ks-welding-heritage-preview.pages.dev | the template builds og:image absolute against seo.siteUrl |
| ✗ | og:image is reachable | fetch failed (ENOTFOUND) | 200 or 206 |  |
| ✓ | context · the same path at the deploy origin | https://ks-welding-heritage-preview.pages.dev/og/ks-welding-heritage.png → HTTP 200 image/png, 1200×630 |  | the card exists and is correct here; only the tag points elsewhere |

#### Form path — ✓

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | the live /contact/ carries a form endpoint | https://site-factory-demo-form.ragmybunsvideogames.workers.dev | a Worker URL | read from <astro-island props>, the same attribute measurePage parses |
| ✓ | preflight status | 204 | 204 |  |
| ✓ | preflight Access-Control-Allow-Origin echoes this demo | https://ks-welding-heritage-preview.pages.dev | https://ks-welding-heritage-preview.pages.dev |  |
| ✓ | preflight Access-Control-Allow-Methods includes POST | POST, OPTIONS | POST |  |
| ✓ | preflight Vary | Origin | Origin |  |
| ✓ | a suffix-lookalike origin gets no CORS grant | absent | absent | sent Origin: https://evil-preview.pages.dev.attacker.com — the dot-boundary case lib/http.ts refuses |
| ✓ | honeypot POST status | 200 | 200 |  |
| ✓ | honeypot POST body | {"ok":true} | {"ok":true} |  |
| ✓ | POST Access-Control-Allow-Origin echoes this demo | https://ks-welding-heritage-preview.pages.dev | https://ks-welding-heritage-preview.pages.dev |  |

#### Service worker — ✓

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | / loads in a browser | 200 | 200 |  |
| ✓ | the live build registers a service worker | register script present |  |  |
| ✓ | /sw.js is served | 200 | 200 |  |
| ✓ | a service worker is active | https://ks-welding-heritage-preview.pages.dev/sw.js | an active registration |  |
| ✓ | the worker filled a cache | 74 entries in site-factory:ks-welding-heritage:163495f153ad | > 0 entries |  |
| ✓ | /services/ loads in a browser | 200 | 200 |  |
| ✓ | /services/ was served through the worker | true | true | sw.js is network-first for navigations; this asserts the worker handled it |
| ✓ | /services/ rendered | What we do | a non-empty <h1> |  |
| ✓ | /services/ has its brand custom property applied | #1f4e79 | a non-empty --color-primary or --d-accent | the inlined stylesheet arrived; a 200 that is visibly broken fails here |

#### Lighthouse — ✗

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | Lighthouse attached to the port this session opened | port 56428 | port 56428 | the browser was launched with --remote-debugging-port |
| ✓ | lighthouse accessibility | 96 | ≥ 90 |  |
| ✓ | lighthouse best-practices | 100 | ≥ 90 |  |
| ✓ | lighthouse seo | 69 | reported, no bar | no bar while every demo is noindex — see the header |
| ✗ | lighthouse performance | unavailable — other performance audits also failed to score: total-blocking-time | a score | other performance audits also failed to score: total-blocking-time |

Scores (mobile, port 56428): performance unavailable — other performance audits also failed to score: total-blocking-time, accessibility 96, best-practices 100, seo 69.

#### Customizer — n/a

the live build carries no customizer panel (features.customizer is off)

### `ks-welding-precision` — https://ks-welding-precision-preview.pages.dev

Verdict: **fail**

#### Routes — ✓

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | the live origin serves this client | ks-welding-precision | ks-welding-precision | read from <link rel="manifest"> → /icons/<slug>/ |
| ✓ | / status | 200 | 200 |  |
| ✓ | / content-type | text/html; charset=utf-8 | text/html |  |
| ✓ | /about/ status | 200 | 200 |  |
| ✓ | /about/ content-type | text/html; charset=utf-8 | text/html |  |
| ✓ | /contact/ status | 200 | 200 |  |
| ✓ | /contact/ content-type | text/html; charset=utf-8 | text/html |  |
| ✓ | /services/ status | 200 | 200 |  |
| ✓ | /services/ content-type | text/html; charset=utf-8 | text/html |  |
| ✓ | /definitely-not-a-page status | 404 | 404 |  |
| ✓ | /definitely-not-a-page is the template's own 404 page | That page isn't here. | That page isn't here. |  |

#### Security headers — ✓

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | the deploy carries this repo's generated _headers | yes | yes | derived from 4 live page(s): /, /about/, /contact/, /services/ |
| ✓ | x-content-type-options | nosniff | nosniff | build |
| ✓ | referrer-policy | strict-origin-when-cross-origin | strict-origin-when-cross-origin | build |
| ✓ | x-frame-options | DENY | DENY | build |
| ✓ | permissions-policy denies every feature in DENIED_FEATURES | all 16 denied | all 16 denied | build |
| ✓ | csp script-src does not contain 'unsafe-inline' | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndm… (222 chars) | no 'unsafe-inline' |  |
| ✓ | csp script-src does not contain 'unsafe-eval' | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndm… (222 chars) | no 'unsafe-eval' |  |
| ✓ | csp script-src does not contain 'strict-dynamic' | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndm… (222 chars) | no 'strict-dynamic' |  |
| ✓ | csp script-src does not contain 'unsafe-hashes' | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndm… (222 chars) | no 'unsafe-hashes' |  |
| ✓ | csp script-src has no wildcard | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndm… (222 chars) | no * |  |
| ✓ | csp script-src includes 'self' | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndm… (222 chars) | 'self' |  |
| ✓ | csp default-src does not contain 'unsafe-inline' | 'self' | no 'unsafe-inline' |  |
| ✓ | csp script-src does not contain 'unsafe-inline' | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndm… (222 chars) | no 'unsafe-inline' |  |
| ✓ | csp img-src does not contain 'unsafe-inline' | 'self' | no 'unsafe-inline' |  |
| ✓ | csp font-src does not contain 'unsafe-inline' | 'self' | no 'unsafe-inline' |  |
| ✓ | csp connect-src does not contain 'unsafe-inline' | 'self' https://site-factory-demo-form.ragmybunsvideogames.workers.dev | no 'unsafe-inline' |  |
| ✓ | csp frame-src does not contain 'unsafe-inline' | 'none' | no 'unsafe-inline' |  |
| ✓ | csp frame-ancestors does not contain 'unsafe-inline' | 'none' | no 'unsafe-inline' |  |
| ✓ | csp form-action does not contain 'unsafe-inline' | 'self' | no 'unsafe-inline' |  |
| ✓ | csp base-uri does not contain 'unsafe-inline' | 'none' | no 'unsafe-inline' |  |
| ✓ | csp object-src does not contain 'unsafe-inline' | 'none' | no 'unsafe-inline' |  |
| ✓ | csp worker-src does not contain 'unsafe-inline' | 'self' | no 'unsafe-inline' |  |
| ✓ | csp manifest-src does not contain 'unsafe-inline' | 'self' | no 'unsafe-inline' |  |
| ✓ | csp default-src | 'self' | 'self' |  |
| ✓ | csp frame-ancestors | 'none' | 'none' |  |
| ✓ | csp form-action | 'self' | 'self' |  |
| ✓ | csp base-uri | 'none' | 'none' |  |
| ✓ | csp object-src | 'none' | 'none' |  |
| ✓ | csp worker-src | 'self' | 'self' |  |
| ✓ | csp manifest-src | 'self' | 'self' |  |
| ✓ | csp style-src | 'self' 'unsafe-inline' | 'self' 'unsafe-inline' |  |
| ✓ | csp default-src matches the live pages | 'self' | 'self' |  |
| ✓ | csp script-src matches the live pages | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndm… (222 chars) | 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndm… (222 chars) |  |
| ✓ | csp style-src matches the live pages | 'self' 'unsafe-inline' | 'self' 'unsafe-inline' |  |
| ✓ | csp img-src matches the live pages | 'self' | 'self' |  |
| ✓ | csp font-src matches the live pages | 'self' | 'self' |  |
| ✓ | csp connect-src matches the live pages | 'self' https://site-factory-demo-form.ragmybunsvideogames.workers.dev | 'self' https://site-factory-demo-form.ragmybunsvideogames.workers.dev |  |
| ✓ | csp frame-src matches the live pages | 'none' | 'none' |  |
| ✓ | csp frame-ancestors matches the live pages | 'none' | 'none' |  |
| ✓ | csp form-action matches the live pages | 'self' | 'self' |  |
| ✓ | csp base-uri matches the live pages | 'none' | 'none' |  |
| ✓ | csp object-src matches the live pages | 'none' | 'none' |  |
| ✓ | csp worker-src matches the live pages | 'self' | 'self' |  |
| ✓ | csp manifest-src matches the live pages | 'self' | 'self' |  |

Policy derived from the live pages:

```
default-src 'self'; script-src 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndmvxuL/Q=' 'sha256-U7a72oKuFFz8D7GUHLA1NZ0ciymHmDOc9T9aVDg2rWU='; style-src 'self' 'unsafe-inline'; img-src 'self'; font-src 'self'; connect-src 'self' https://site-factory-demo-form.ragmybunsvideogames.workers.dev; frame-src 'none'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'; object-src 'none'; worker-src 'self'; manifest-src 'self'
```

Live: `default-src 'self'; script-src 'self' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndmvxuL/Q=' 'sha256-U7a72oKuFFz8D7GUHLA1NZ0ciymHmDOc9T9aVDg2rWU='; style-src 'self' 'unsafe-inline'; img-src 'self'; font-src 'self'; connect-src 'self' https://site-factory-demo-form.ragmybunsvideogames.workers.dev; frame-src 'none'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'; object-src 'none'; worker-src 'self'; manifest-src 'self'`

#### Demo posture — ✓

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | / meta robots | noindex,nofollow | noindex, nofollow |  |
| ✓ | /about/ meta robots | noindex,nofollow | noindex, nofollow |  |
| ✓ | /contact/ meta robots | noindex,nofollow | noindex, nofollow |  |
| ✓ | /services/ meta robots | noindex,nofollow | noindex, nofollow |  |
| ✓ | /robots.txt disallows / for User-agent: * | # Private pitch mockup — not for indexing. · User-agent: * · Disallow: / | User-agent: * → Disallow: / |  |
| ✓ | /sitemap-index.xml is absent | 404 | 404 |  |
| ✓ | /sitemap-0.xml is absent | 404 | 404 |  |

#### og:image — ✗

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | context · og:image declared | https://example.invalid/og/ks-welding-precision.png |  |  |
| ✓ | twitter:image matches og:image | https://example.invalid/og/ks-welding-precision.png | https://example.invalid/og/ks-welding-precision.png |  |
| ✗ | og:image is advertised on the origin serving this demo | https://example.invalid | https://ks-welding-precision-preview.pages.dev | the template builds og:image absolute against seo.siteUrl |
| ✗ | og:image is reachable | fetch failed (ENOTFOUND) | 200 or 206 |  |
| ✓ | context · the same path at the deploy origin | https://ks-welding-precision-preview.pages.dev/og/ks-welding-precision.png → HTTP 200 image/png, 1200×630 |  | the card exists and is correct here; only the tag points elsewhere |

#### Form path — ✓

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | the live /contact/ carries a form endpoint | https://site-factory-demo-form.ragmybunsvideogames.workers.dev | a Worker URL | read from <astro-island props>, the same attribute measurePage parses |
| ✓ | preflight status | 204 | 204 |  |
| ✓ | preflight Access-Control-Allow-Origin echoes this demo | https://ks-welding-precision-preview.pages.dev | https://ks-welding-precision-preview.pages.dev |  |
| ✓ | preflight Access-Control-Allow-Methods includes POST | POST, OPTIONS | POST |  |
| ✓ | preflight Vary | Origin | Origin |  |
| ✓ | a suffix-lookalike origin gets no CORS grant | absent | absent | sent Origin: https://evil-preview.pages.dev.attacker.com — the dot-boundary case lib/http.ts refuses |
| ✓ | honeypot POST status | 200 | 200 |  |
| ✓ | honeypot POST body | {"ok":true} | {"ok":true} |  |
| ✓ | POST Access-Control-Allow-Origin echoes this demo | https://ks-welding-precision-preview.pages.dev | https://ks-welding-precision-preview.pages.dev |  |

#### Service worker — ✓

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | / loads in a browser | 200 | 200 |  |
| ✓ | the live build registers a service worker | register script present |  |  |
| ✓ | /sw.js is served | 200 | 200 |  |
| ✓ | a service worker is active | https://ks-welding-precision-preview.pages.dev/sw.js | an active registration |  |
| ✓ | the worker filled a cache | 74 entries in site-factory:ks-welding-precision:2a01b61f00a3 | > 0 entries |  |
| ✓ | /services/ loads in a browser | 200 | 200 |  |
| ✓ | /services/ was served through the worker | true | true | sw.js is network-first for navigations; this asserts the worker handled it |
| ✓ | /services/ rendered | What we do | a non-empty <h1> |  |
| ✓ | /services/ has its brand custom property applied | #1f4e79 | a non-empty --color-primary or --d-accent | the inlined stylesheet arrived; a 200 that is visibly broken fails here |

#### Lighthouse — ✗

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | Lighthouse attached to the port this session opened | port 60873 | port 60873 | the browser was launched with --remote-debugging-port |
| ✓ | lighthouse accessibility | 96 | ≥ 90 |  |
| ✓ | lighthouse best-practices | 100 | ≥ 90 |  |
| ✓ | lighthouse seo | 69 | reported, no bar | no bar while every demo is noindex — see the header |
| ✗ | lighthouse performance | unavailable — other performance audits also failed to score: total-blocking-time | a score | other performance audits also failed to score: total-blocking-time |

Scores (mobile, port 60873): performance unavailable — other performance audits also failed to score: total-blocking-time, accessibility 96, best-practices 100, seo 69.

#### Customizer — n/a

the live build carries no customizer panel (features.customizer is off)

### `kts-machine-shop` — https://kts-machine-shop-preview.pages.dev

Verdict: **fail**

#### Routes — ✓

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | the live origin serves this client | kts-machine-shop | kts-machine-shop | read from <link rel="manifest"> → /icons/<slug>/ |
| ✓ | / status | 200 | 200 |  |
| ✓ | / content-type | text/html; charset=utf-8 | text/html |  |
| ✓ | /about/ status | 200 | 200 |  |
| ✓ | /about/ content-type | text/html; charset=utf-8 | text/html |  |
| ✓ | /contact/ status | 200 | 200 |  |
| ✓ | /contact/ content-type | text/html; charset=utf-8 | text/html |  |
| ✓ | /services/ status | 200 | 200 |  |
| ✓ | /services/ content-type | text/html; charset=utf-8 | text/html |  |
| ✓ | /definitely-not-a-page status | 404 | 404 |  |
| ✓ | /definitely-not-a-page is the template's own 404 page | That page isn't here. | That page isn't here. |  |

#### Security headers — ✓

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | the deploy carries this repo's generated _headers | yes | yes | derived from 4 live page(s): /, /about/, /contact/, /services/ |
| ✓ | x-content-type-options | nosniff | nosniff | build |
| ✓ | referrer-policy | strict-origin-when-cross-origin | strict-origin-when-cross-origin | build |
| ✓ | x-frame-options | DENY | DENY | build |
| ✓ | permissions-policy denies every feature in DENIED_FEATURES | all 16 denied | all 16 denied | build |
| ✓ | csp script-src does not contain 'unsafe-inline' | 'self' 'sha256-8HMcnZ7+BYwtcAQtGKjVhYfJv5CCisM8AaEbNm9p9vM=' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7… (330 chars) | no 'unsafe-inline' |  |
| ✓ | csp script-src does not contain 'unsafe-eval' | 'self' 'sha256-8HMcnZ7+BYwtcAQtGKjVhYfJv5CCisM8AaEbNm9p9vM=' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7… (330 chars) | no 'unsafe-eval' |  |
| ✓ | csp script-src does not contain 'strict-dynamic' | 'self' 'sha256-8HMcnZ7+BYwtcAQtGKjVhYfJv5CCisM8AaEbNm9p9vM=' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7… (330 chars) | no 'strict-dynamic' |  |
| ✓ | csp script-src does not contain 'unsafe-hashes' | 'self' 'sha256-8HMcnZ7+BYwtcAQtGKjVhYfJv5CCisM8AaEbNm9p9vM=' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7… (330 chars) | no 'unsafe-hashes' |  |
| ✓ | csp script-src has no wildcard | 'self' 'sha256-8HMcnZ7+BYwtcAQtGKjVhYfJv5CCisM8AaEbNm9p9vM=' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7… (330 chars) | no * |  |
| ✓ | csp script-src includes 'self' | 'self' 'sha256-8HMcnZ7+BYwtcAQtGKjVhYfJv5CCisM8AaEbNm9p9vM=' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7… (330 chars) | 'self' |  |
| ✓ | csp default-src does not contain 'unsafe-inline' | 'self' | no 'unsafe-inline' |  |
| ✓ | csp script-src does not contain 'unsafe-inline' | 'self' 'sha256-8HMcnZ7+BYwtcAQtGKjVhYfJv5CCisM8AaEbNm9p9vM=' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7… (330 chars) | no 'unsafe-inline' |  |
| ✓ | csp img-src does not contain 'unsafe-inline' | 'self' | no 'unsafe-inline' |  |
| ✓ | csp font-src does not contain 'unsafe-inline' | 'self' | no 'unsafe-inline' |  |
| ✓ | csp connect-src does not contain 'unsafe-inline' | 'self' https://site-factory-demo-form.ragmybunsvideogames.workers.dev | no 'unsafe-inline' |  |
| ✓ | csp frame-src does not contain 'unsafe-inline' | 'none' | no 'unsafe-inline' |  |
| ✓ | csp frame-ancestors does not contain 'unsafe-inline' | 'none' | no 'unsafe-inline' |  |
| ✓ | csp form-action does not contain 'unsafe-inline' | 'self' | no 'unsafe-inline' |  |
| ✓ | csp base-uri does not contain 'unsafe-inline' | 'none' | no 'unsafe-inline' |  |
| ✓ | csp object-src does not contain 'unsafe-inline' | 'none' | no 'unsafe-inline' |  |
| ✓ | csp worker-src does not contain 'unsafe-inline' | 'self' | no 'unsafe-inline' |  |
| ✓ | csp manifest-src does not contain 'unsafe-inline' | 'self' | no 'unsafe-inline' |  |
| ✓ | csp default-src | 'self' | 'self' |  |
| ✓ | csp frame-ancestors | 'none' | 'none' |  |
| ✓ | csp form-action | 'self' | 'self' |  |
| ✓ | csp base-uri | 'none' | 'none' |  |
| ✓ | csp object-src | 'none' | 'none' |  |
| ✓ | csp worker-src | 'self' | 'self' |  |
| ✓ | csp manifest-src | 'self' | 'self' |  |
| ✓ | csp style-src | 'self' 'unsafe-inline' | 'self' 'unsafe-inline' |  |
| ✓ | csp default-src matches the live pages | 'self' | 'self' |  |
| ✓ | csp script-src matches the live pages | 'self' 'sha256-8HMcnZ7+BYwtcAQtGKjVhYfJv5CCisM8AaEbNm9p9vM=' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7… (330 chars) | 'self' 'sha256-8HMcnZ7+BYwtcAQtGKjVhYfJv5CCisM8AaEbNm9p9vM=' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7… (330 chars) |  |
| ✓ | csp style-src matches the live pages | 'self' 'unsafe-inline' | 'self' 'unsafe-inline' |  |
| ✓ | csp img-src matches the live pages | 'self' | 'self' |  |
| ✓ | csp font-src matches the live pages | 'self' | 'self' |  |
| ✓ | csp connect-src matches the live pages | 'self' https://site-factory-demo-form.ragmybunsvideogames.workers.dev | 'self' https://site-factory-demo-form.ragmybunsvideogames.workers.dev |  |
| ✓ | csp frame-src matches the live pages | 'none' | 'none' |  |
| ✓ | csp frame-ancestors matches the live pages | 'none' | 'none' |  |
| ✓ | csp form-action matches the live pages | 'self' | 'self' |  |
| ✓ | csp base-uri matches the live pages | 'none' | 'none' |  |
| ✓ | csp object-src matches the live pages | 'none' | 'none' |  |
| ✓ | csp worker-src matches the live pages | 'self' | 'self' |  |
| ✓ | csp manifest-src matches the live pages | 'self' | 'self' |  |

Policy derived from the live pages:

```
default-src 'self'; script-src 'self' 'sha256-8HMcnZ7+BYwtcAQtGKjVhYfJv5CCisM8AaEbNm9p9vM=' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndmvxuL/Q=' 'sha256-U7a72oKuFFz8D7GUHLA1NZ0ciymHmDOc9T9aVDg2rWU=' 'sha256-gADdUY1iVCVzbQpfxVj+hYg13eYJF6V6ZacwsSuG7Qc='; style-src 'self' 'unsafe-inline'; img-src 'self'; font-src 'self'; connect-src 'self' https://site-factory-demo-form.ragmybunsvideogames.workers.dev; frame-src 'none'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'; object-src 'none'; worker-src 'self'; manifest-src 'self'
```

Live: `default-src 'self'; script-src 'self' 'sha256-8HMcnZ7+BYwtcAQtGKjVhYfJv5CCisM8AaEbNm9p9vM=' 'sha256-B1nDLrA3TmwBeEdGwmQM7PwDa1+sYrojG8t1k3MKwx4=' 'sha256-Jv1VkN+0LW+wxNfX5J3yEdEWqcJmp1f3ktmS7ZRF7Rg=' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndmvxuL/Q=' 'sha256-U7a72oKuFFz8D7GUHLA1NZ0ciymHmDOc9T9aVDg2rWU=' 'sha256-gADdUY1iVCVzbQpfxVj+hYg13eYJF6V6ZacwsSuG7Qc='; style-src 'self' 'unsafe-inline'; img-src 'self'; font-src 'self'; connect-src 'self' https://site-factory-demo-form.ragmybunsvideogames.workers.dev; frame-src 'none'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'; object-src 'none'; worker-src 'self'; manifest-src 'self'`

#### Demo posture — ✓

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | / meta robots | noindex,nofollow | noindex, nofollow |  |
| ✓ | /about/ meta robots | noindex,nofollow | noindex, nofollow |  |
| ✓ | /contact/ meta robots | noindex,nofollow | noindex, nofollow |  |
| ✓ | /services/ meta robots | noindex,nofollow | noindex, nofollow |  |
| ✓ | /robots.txt disallows / for User-agent: * | # Private pitch mockup — not for indexing. · User-agent: * · Disallow: / | User-agent: * → Disallow: / |  |
| ✓ | /sitemap-index.xml is absent | 404 | 404 |  |
| ✓ | /sitemap-0.xml is absent | 404 | 404 |  |

#### og:image — ✗

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | context · og:image declared | https://example.invalid/og/kts-machine-shop.png |  |  |
| ✓ | twitter:image matches og:image | https://example.invalid/og/kts-machine-shop.png | https://example.invalid/og/kts-machine-shop.png |  |
| ✗ | og:image is advertised on the origin serving this demo | https://example.invalid | https://kts-machine-shop-preview.pages.dev | the template builds og:image absolute against seo.siteUrl |
| ✗ | og:image is reachable | fetch failed (ENOTFOUND) | 200 or 206 |  |
| ✓ | context · the same path at the deploy origin | https://kts-machine-shop-preview.pages.dev/og/kts-machine-shop.png → HTTP 200 image/png, 1200×630 |  | the card exists and is correct here; only the tag points elsewhere |

#### Form path — ✓

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | the live /contact/ carries a form endpoint | https://site-factory-demo-form.ragmybunsvideogames.workers.dev | a Worker URL | read from <astro-island props>, the same attribute measurePage parses |
| ✓ | preflight status | 204 | 204 |  |
| ✓ | preflight Access-Control-Allow-Origin echoes this demo | https://kts-machine-shop-preview.pages.dev | https://kts-machine-shop-preview.pages.dev |  |
| ✓ | preflight Access-Control-Allow-Methods includes POST | POST, OPTIONS | POST |  |
| ✓ | preflight Vary | Origin | Origin |  |
| ✓ | a suffix-lookalike origin gets no CORS grant | absent | absent | sent Origin: https://evil-preview.pages.dev.attacker.com — the dot-boundary case lib/http.ts refuses |
| ✓ | honeypot POST status | 200 | 200 |  |
| ✓ | honeypot POST body | {"ok":true} | {"ok":true} |  |
| ✓ | POST Access-Control-Allow-Origin echoes this demo | https://kts-machine-shop-preview.pages.dev | https://kts-machine-shop-preview.pages.dev |  |

#### Service worker — ✓

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | / loads in a browser | 200 | 200 |  |
| ✓ | the live build registers a service worker | register script present |  |  |
| ✓ | /sw.js is served | 200 | 200 |  |
| ✓ | a service worker is active | https://kts-machine-shop-preview.pages.dev/sw.js | an active registration |  |
| ✓ | the worker filled a cache | 74 entries in site-factory:kts-machine-shop:12b30aeaec99 | > 0 entries |  |
| ✓ | /services/ loads in a browser | 200 | 200 |  |
| ✓ | /services/ was served through the worker | true | true | sw.js is network-first for navigations; this asserts the worker handled it |
| ✓ | /services/ rendered | What we do | a non-empty <h1> |  |
| ✓ | /services/ has its brand custom property applied | #1e3a5f | a non-empty --color-primary or --d-accent | the inlined stylesheet arrived; a 200 that is visibly broken fails here |

#### Lighthouse — ✗

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | Lighthouse attached to the port this session opened | port 57431 | port 57431 | the browser was launched with --remote-debugging-port |
| ✓ | lighthouse accessibility | 96 | ≥ 90 |  |
| ✓ | lighthouse best-practices | 100 | ≥ 90 |  |
| ✓ | lighthouse seo | 69 | reported, no bar | no bar while every demo is noindex — see the header |
| ✗ | lighthouse performance | unavailable — other performance audits also failed to score: total-blocking-time | a score | other performance audits also failed to score: total-blocking-time |

Scores (mobile, port 57431): performance unavailable — other performance audits also failed to score: total-blocking-time, accessibility 96, best-practices 100, seo 69.

#### Customizer — ✓

| | assertion | measured | expected | note |
| --- | --- | --- | --- | --- |
| ✓ | forge/dark/ember/condensed-caps · data-theme | forge | forge |  |
| ✓ | forge/dark/ember/condensed-caps · data-scheme | dark | dark |  |
| ✓ | forge/dark/ember/condensed-caps · data-accent | ember | ember |  |
| ✓ | forge/dark/ember/condensed-caps · data-font | condensed-caps | condensed-caps |  |
| ✓ | forge/dark/ember/condensed-caps · --d-accent | #e2551f | #e2551f | expected value read from presets.json, not from the page |
| ✓ | precision/light/teal/technical · data-theme | precision | precision |  |
| ✓ | precision/light/teal/technical · data-scheme | light | light |  |
| ✓ | precision/light/teal/technical · data-accent | teal | teal |  |
| ✓ | precision/light/teal/technical · data-font | technical | technical |  |
| ✓ | precision/light/teal/technical · --d-accent | #0a6a6a | #0a6a6a | expected value read from presets.json, not from the page |
| ✓ | heritage/light/forest/signwriter · data-theme | heritage | heritage |  |
| ✓ | heritage/light/forest/signwriter · data-scheme | light | light |  |
| ✓ | heritage/light/forest/signwriter · data-accent | forest | forest |  |
| ✓ | heritage/light/forest/signwriter · data-font | signwriter | signwriter |  |
| ✓ | heritage/light/forest/signwriter · --d-accent | #1f5140 | #1f5140 | expected value read from presets.json, not from the page |
| ✓ | ?theme=brutalist&accent=chartreuse · resolved to a real family | heritage | a preset in presets.json |  |
| ✓ | ?theme=brutalist&accent=chartreuse · did not stamp the invented accent | brick | not "chartreuse" |  |
| ✓ | ?theme=brutalist&accent=chartreuse · landed on a painted cell | #8c3b1f | a non-empty --d-accent | the accent is one presets.json offers for that cell |

## Findings

Grouped by class, so two clients broken the same way read as one problem
rather than as two.

### lighthouse — 5 client(s)

- ks-welding: no performance score, and it is not known-issues #2 — unavailable — other performance audits also failed to score: total-blocking-time
- ks-welding-forge: no performance score, and it is not known-issues #2 — unavailable — other performance audits also failed to score: total-blocking-time
- ks-welding-heritage: no performance score, and it is not known-issues #2 — unavailable — other performance audits also failed to score: total-blocking-time
- ks-welding-precision: no performance score, and it is not known-issues #2 — unavailable — other performance audits also failed to score: total-blocking-time
- kts-machine-shop: no performance score, and it is not known-issues #2 — unavailable — other performance audits also failed to score: total-blocking-time

### og-image-origin — 8 client(s)

- american-machine-specialty: the card is valid at https://american-machine-specialty-preview.pages.dev/og/american-machine-specialty.png (1200×630 image/png) but og:image advertises it at https://americanmachinespecialty.com/og/american-machine-specialty.png, which answers HTTP 404. The tag is built absolute against seo.siteUrl — a domain this demo is not served from — so every shared link unfurls blank while every local check passes.
- industrial-machine-corp: the card is valid at https://industrial-machine-corp-preview.pages.dev/og/industrial-machine-corp.png (1200×630 image/png) but og:image advertises it at https://example.invalid/og/industrial-machine-corp.png, which answers fetch failed (ENOTFOUND). The tag is built absolute against seo.siteUrl — a domain this demo is not served from — so every shared link unfurls blank while every local check passes.
- kh-machine-works: the card is valid at https://kh-machine-works-preview.pages.dev/og/kh-machine-works.png (1200×630 image/png) but og:image advertises it at https://www.khmachineworks.com/og/kh-machine-works.png, which answers HTTP 404. The tag is built absolute against seo.siteUrl — a domain this demo is not served from — so every shared link unfurls blank while every local check passes.
- ks-welding: the card is valid at https://ks-welding-preview.pages.dev/og/ks-welding.png (1200×630 image/png) but og:image advertises it at https://example.invalid/og/ks-welding.png, which answers fetch failed (ENOTFOUND). The tag is built absolute against seo.siteUrl — a domain this demo is not served from — so every shared link unfurls blank while every local check passes.
- ks-welding-forge: the card is valid at https://ks-welding-forge-preview.pages.dev/og/ks-welding-forge.png (1200×630 image/png) but og:image advertises it at https://example.invalid/og/ks-welding-forge.png, which answers fetch failed (ENOTFOUND). The tag is built absolute against seo.siteUrl — a domain this demo is not served from — so every shared link unfurls blank while every local check passes.
- ks-welding-heritage: the card is valid at https://ks-welding-heritage-preview.pages.dev/og/ks-welding-heritage.png (1200×630 image/png) but og:image advertises it at https://example.invalid/og/ks-welding-heritage.png, which answers fetch failed (ENOTFOUND). The tag is built absolute against seo.siteUrl — a domain this demo is not served from — so every shared link unfurls blank while every local check passes.
- ks-welding-precision: the card is valid at https://ks-welding-precision-preview.pages.dev/og/ks-welding-precision.png (1200×630 image/png) but og:image advertises it at https://example.invalid/og/ks-welding-precision.png, which answers fetch failed (ENOTFOUND). The tag is built absolute against seo.siteUrl — a domain this demo is not served from — so every shared link unfurls blank while every local check passes.
- kts-machine-shop: the card is valid at https://kts-machine-shop-preview.pages.dev/og/kts-machine-shop.png (1200×630 image/png) but og:image advertises it at https://example.invalid/og/kts-machine-shop.png, which answers fetch failed (ENOTFOUND). The tag is built absolute against seo.siteUrl — a domain this demo is not served from — so every shared link unfurls blank while every local check passes.

## Politeness ledger

Navigations are what claude.md caps at 10 per site and 1 per second per
domain. Probes are bare fetches, spaced but uncounted — the reading
`packages/audit/src/throttle.ts` already documents for the broken-link checker.

| host | navigations | cap | min gap between navigations | probes |
| --- | --- | --- | --- | --- |
| american-machine-specialty-preview.pages.dev | 9 | 10 | 1003 ms | 11 |
| americanmachinespecialty.com | 0 | 10 | n/a (one navigation) | 1 |
| site-factory-demo-form.ragmybunsvideogames.workers.dev | 0 | 10 | n/a (one navigation) | 24 |
| industrial-machine-corp-preview.pages.dev | 9 | 10 | 1000 ms | 11 |
| example.invalid | 0 | 10 | n/a (one navigation) | 6 |
| kh-machine-works-preview.pages.dev | 9 | 10 | 1003 ms | 11 |
| www.khmachineworks.com | 0 | 10 | n/a (one navigation) | 1 |
| ks-welding-preview.pages.dev | 9 | 10 | 1001 ms | 11 |
| ks-welding-forge-preview.pages.dev | 5 | 10 | 1002 ms | 11 |
| ks-welding-heritage-preview.pages.dev | 5 | 10 | 1010 ms | 11 |
| ks-welding-precision-preview.pages.dev | 5 | 10 | 1002 ms | 11 |
| kts-machine-shop-preview.pages.dev | 9 | 10 | 1002 ms | 11 |

---

Run finished 2026-08-13T03:30:44.480Z. Suite: `scripts/live-smoke`.
