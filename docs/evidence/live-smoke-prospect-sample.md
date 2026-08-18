# First live smoke of prospect demos (issue #56)

`live-smoke` could not see a generated demo before this stream: it resolved slugs
through `clients/index.ts` and answered `Unknown client`. 58 slugs are smokeable
now, against 8 before, and this is the first time any of the 50 has been measured
against its live origin by anything other than a deploy-time 200.

Six sites in one run, so one politeness ledger covers them: the c3m rebuild plus
a five-demo sample.

    0/6 demo(s) passed every check.

| client | routes | headers | posture | og:image | sw | form | customizer | lighthouse |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `c3m-of-nj-home-renovation-affordable-handyman` | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | n/a | ✓ |
| `a-and-a-bergen-home-improvements` | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | n/a | ✓ |
| `aaa-construction-and-renovations` | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | n/a | ✓ |
| `ak-welding-llc` | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | n/a | ✓ |
| `auto-tig-fab` | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | n/a | ✓ |
| `bliss-construction-llc` | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | n/a | ✓ |

**Routes, security headers, demo posture, the form path and Lighthouse pass on
all six.** The form path is the one worth naming: the live `/contact/` carries
the Worker endpoint, the preflight echoes the demo's own origin, a
suffix-lookalike origin is refused at the dot boundary, and the honeypot POST is
short-circuited `{"ok":true}`. c3m measured performance 100, accessibility 95,
best-practices 100 on mobile.

## Two systematic failures, neither in this stream's scope

**1. The card is an SVG, so no link unfurls with a picture — 6 of 6.**

    og:image .../images/og.svg → HTTP 200 image/svg+xml,
      not a PNG — first 8 bytes are 3c73766720786d6c ("<svg xml")

`gen-brand-assets.mjs` reads `clients/<slug>.config.ts`, which no generated demo
has, so all 50 ship the placeholder `og.svg`. The ledger of 2026-08-12 records
that Facebook, X, LinkedIn, iMessage, WhatsApp and Slack all decline to render an
SVG `og:image`. **This is the limit on what fixing c3m's origin achieved:** the
card is now advertised at a host that serves it and returns 200, and it still
will not draw in a message thread, because of the bytes rather than the address.

**2. No service worker on any generated demo — 6 of 6.**

    the live build registers a service worker:
      measured "the live page unregisters workers (features.offline is off in this build)"
      /sw.js answered 200

The demo does not work without a connection — which is the condition a phone is
in when it is being shown to somebody in a shop.

## The politeness ledger

    c3m-…-preview-rr.pages.dev:  3/10 navigations, 11 probes, min gap 5882 ms
    a-and-a-bergen-…:            3/10 navigations, 11 probes, min gap 1013 ms
    aaa-construction-…:          3/10 navigations, 11 probes, min gap 1005 ms
    ak-welding-llc-…:            3/10 navigations, 11 probes, min gap 1045 ms
    auto-tig-fab-…:              3/10 navigations, 11 probes, min gap 1014 ms
    bliss-construction-llc-…:    3/10 navigations, 11 probes, min gap 1015 ms
    site-factory-demo-form worker: 0 navigations, 18 probes

Three navigations of the ten allowed per site, and never faster than one per
second on any host. Full report and board under gitignored
`outreach/smoke/2026-08-18T14-03-49Z/`.
