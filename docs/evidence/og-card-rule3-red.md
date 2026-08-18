# check-stamped-origins rule 3: red on the artifact that is live now

Issue #61. Recorded 2026-08-18, before any fix, on
`c3m-of-nj-home-renovation-affordable-handyman` — the one demo whose origin #63
already corrected, so the only thing left wrong with its card is the bytes.

## The live tag and the live card

```
$ curl -s https://c3m-…-preview-rr.pages.dev/ | grep og:image
<meta property="og:image" content="https://c3m-of-nj-home-renovation-affordable-handyman-preview-rr.pages.dev/images/og.svg">

$ curl -sI https://c3m-…-preview-rr.pages.dev/images/og.svg
HTTP/1.1 200 OK
Content-Type: image/svg+xml
```

The address is right. The bytes are an SVG, and rule 2 (“it answers 200”)
cannot see that.

## The gate, extended, on the same artifact rebuilt from unchanged code

```
$ node scripts/check-stamped-origins.mjs \
    --slug c3m-of-nj-home-renovation-affordable-handyman \
    --origin https://c3m-of-nj-home-renovation-affordable-handyman-preview-rr.pages.dev
  · https://c3m-of-nj-home-renovation-affordable-handyman-preview-rr.pages.dev/images/logo.svg  200 image/svg+xml

✗ c3m-of-nj-home-renovation-affordable-handyman: 1 stamped-origin problem(s).

    https://c3m-of-nj-home-renovation-affordable-handyman-preview-rr.pages.dev/images/og.svg answers 200 image/svg+xml, which no platform will draw as a card. Facebook, X, LinkedIn, iMessage, WhatsApp and Slack all decline anything but a raster image, so this link unfurls blank while every other check passes. Stamped by 15 tag(s), first 404.html (og:image). Expected one of image/png, image/jpeg.

Rebuild this slug with the origin it is actually served from, then redeploy:

  PREVIEW_ORIGIN=https://c3m-of-nj-home-renovation-affordable-handyman-preview-rr.pages.dev pnpm demo -- --prospect <slug> --skip-ingest

EXIT=1
```

Note the line above the failure: the JSON-LD `logo` is `/images/logo.svg`, it
answers `image/svg+xml`, and it **passes**. That is the exemption working, not a
hole — nothing unfurls a graph node, and all nine hand-authored clients ship
that logo by design. Rule 3 asks about `og:image` and `twitter:image` only.
