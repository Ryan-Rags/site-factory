# founder-site v3 — gate failures, demonstrated before the fix

Per CLAUDE.md: "A new gate lands with its failure demonstrated first, then the
fix." Each block below is the real console output from this branch, captured
before the corresponding change was made.

## 1. `check-placeholders` — the /sites portfolio grid

The page was rewritten first, with the gate untouched. It refused the change on
both counts it was written to refuse, which is the evidence that narrowing it
narrows something real rather than deleting a rule that never fired.

```
      4 placeholder slot(s) across 5 page(s), all as declared (headshot FILLED, linkedin FILLED)
FAIL  check-placeholders: 6 problem(s)
  - /sites: 1 DEMO_LINK slot(s), expected 5.
  - /sites: links https://portfolio-ironvale-fabrication.pages.dev — prospect/client demos are private noindex builds and must not be linked from an indexed page.
  - /sites: links https://portfolio-northmark-hvac.pages.dev — prospect/client demos are private noindex builds and must not be linked from an indexed page.
  - /sites: links https://portfolio-elderbrook-masonry.pages.dev — prospect/client demos are private noindex builds and must not be linked from an indexed page.
  - /sites: links https://portfolio-halcott-dental.pages.dev — prospect/client demos are private noindex builds and must not be linked from an indexed page.
  - /sites: links https://portfolio-voltway-electric.pages.dev — prospect/client demos are private noindex builds and must not be linked from an indexed page.
```

The fix narrows the host rule to the `portfolio-` prefix and drops the client
slot count from five to one. It does **not** remove the refusal: a
`kh-machine-works-preview.pages.dev` link still fails, which section 2 proves.

Both directions of the narrowed rule, measured after the fix:

```
# a portfolio host passes
ok    check-placeholders

# a real client's preview host still fails
FAIL  check-placeholders: 1 problem(s)
  - /sites: links https://kh-machine-works-preview.pages.dev — prospect/client demos are private
    noindex builds about real named businesses and must not be linked from an indexed page.
    Only portfolio-*.pages.dev (invented businesses) may be linked.
```

## 2. `check-motion` — the new gate, failing before it passed

Written first, then run against two deliberately broken builds.

**2a. A reveal on the hero** (`.hero__now` given `.reveal`):

```
FAIL  check-motion: 1 problem(s)
  - /: an element inside the hero carries .reveal. The hero holds this page's LCP element;
    revealing it starts the largest paint at opacity 0.
```

**2b. Content pre-hidden outside the `@supports` guard** (`.reveal { opacity: 0 }`
added at the top level of the sheet — the failure mode that leaves a permanently
blank block on any browser without scroll-driven animations):

```
FAIL  check-motion: 5 problem(s)
  - /: ".reveal" sets opacity 0 outside the @supports (animation-timeline) guard. A browser
    without scroll-driven animations would apply it and never animate it away — the block
    would be blank forever.
  - /about: (same)
  - /ai: (same)
  - /amenity: (same)
  - /sites: (same)
```

Green on the shipped build:

```
      5 page(s) checked, 5 carrying reveals: no hero reveal, nothing pre-hidden,
      reduced motion collapses, no script
ok    check-motion
```

## 3. `check-live` CTA resolution — demonstrated against the LIVE site

The new assertion was pointed at the deployed production build **before** this
branch was deployed, so the failure below is the real defect the task named,
measured on the real origin rather than staged:

```
      verifying https://raghubans-com.pages.dev
      5 document route(s) + 8 asset(s) checked, 17 mailto CTA(s) resolved
FAIL  check-live: 17 problem(s)
  - /: mailto to ryan@raghubans.com carries no subject — it would arrive untriageable.
  - /: mailto to vending@raghubans.com carries no subject — it would arrive untriageable.
  - /sites: … (×4)
  - /ai: … (×4)
  - /amenity: … (×4)
  - /about: … (×3)
```

All 17 CTAs across all five routes. After the fix, every one of them carries a
URL-encoded subject:

```
  2 href="mailto:ryan@raghubans.com?subject=AI%20voice%20agents%20%E2%80%94%20call%20flow"
  5 href="mailto:ryan@raghubans.com?subject=Hello%20from%20raghubans.com"
  2 href="mailto:ryan@raghubans.com?subject=site-factory%20%E2%80%94%20website%20enquiry"
  8 href="mailto:vending@raghubans.com?subject=Alcove%20Markets%20%E2%80%94%20proposal%20request"
```
