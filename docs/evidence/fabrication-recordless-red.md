# `check-fabrication` on a record-less build: red first, then green

The gate added in `fix/portfolio-build-gates`. Ruling 4 on PR #66's Brief.

## Before the change — it never checked anything

`pnpm build` is a `&&` chain and `check-fabrication` is its fourth link, so its
refusal took **eight later gates down with it**, `gen-headers` among them:

```
$ SITE_CLIENT=portfolio-ironvale-fabrication pnpm build
> node scripts/check-form-fields.mjs && node scripts/check-injection.mjs && astro build
  && node scripts/check-markers.mjs && node scripts/check-fabrication.mjs
  && node scripts/check-contrast.mjs && node scripts/check-contact-links.mjs
  && node scripts/check-links.mjs && node scripts/gen-headers.mjs && node scripts/check-headers.mjs
  && node scripts/check-metadata.mjs && node scripts/check-schema.mjs && node scripts/check-go-live.mjs

✓ 17 client(s) + 50 generated demo(s): every form keeps a contact channel …
✓ injection surface: 67 source files, no sinks, 9 reviewed interpolation(s) …
✓ portfolio-ironvale-fabrication: noindex build — no markers.
✗ portfolio-ironvale-fabrication: no prospect record, so nothing here can be
  checked against a source.
```

That is the whole reason the five were built with bare `pnpm exec astro build`,
and bare `astro build` is the path with no `gen-headers` in it — which is how
five publicly-linked builds first deployed with no `_headers`.

## Red — a planted claim, caught

One line in `clients/portfolio-ironvale-fabrication.config.ts` was temporarily
changed to `'Family-owned since 1974. One-off pieces: railings, gates, …'`:

```
✓ portfolio-ironvale-fabrication: noindex build — no markers.
✗ portfolio-ironvale-fabrication: 2 claim(s) with nothing behind them.

    portfolio-ironvale-fabrication\index.html
      "1974" reads as a year
      …Family-owned since 1974. One-off pieces: railings, gates, canopies, brackets and the awkward part nobody stocks.…

    portfolio-ironvale-fabrication\index.html
      "Family-owned" reads as an ownership or status claim
      …Family-owned since 1974. One-off pieces: railings, gates, canopies, brackets and the awkward part nobody stocks.…

  This is an invented business, so there is no fact to add and nothing to
  mark — a source cannot be produced for a shop that does not exist.
  Rewrite the line in clients/portfolio-ironvale-fabrication.config.ts so it describes the work
  without claiming a history, a credential or a guarantee.
  Do not delete this check.
```

Both patterns fired on one sentence, and the advice is the advice that applies
to an invented business: there is no fact to add, so rewrite the line. The
plant was reverted in the same commit that added the gate.

## Green — the five, scanned against nothing

With the plant reverted, all five pass the strict scan, and the build now runs
to the end of the chain. Transcript: `docs/evidence/fabrication-recordless-green.txt`.

## The two exemptions

`zz-fixture-*` is skipped and says so. Every other missing record is still a
hard error, unchanged — ruling 1 on this stream's plan: that error is the only
thing that notices a real business built against no source, and it does not
soften.
