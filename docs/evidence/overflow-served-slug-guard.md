# check:overflow — the served-slug guard, demonstrated red first (issue #37)

A preview of `ks-welding` was served on port 4399, and `check:overflow` was told
to measure `kh-machine-works` against it. That is the port-collision hazard, made
deterministic — the third recorded occurrence cost a session an afternoon.

## Before — green, on a client it never looked at

    $ curl -s http://localhost:4399/ | grep manifest
    rel="manifest" href="/icons/ks-welding/site.webmanifest"

    $ SITE_CLIENT=kh-machine-works PREVIEW_URL=http://localhost:4399 \
        node packages/template/scripts/check-overflow.mjs
    PASS  390px  /contact  scrollWidth=390
    PASS  390px  /404  scrollWidth=390

    No horizontal overflow at any tested width.
    exit 0

## After — the same pairing, refused

    $ SITE_CLIENT=kh-machine-works PREVIEW_URL=http://localhost:4399 \
        node packages/template/scripts/check-overflow.mjs
    http://localhost:4399 is serving "ks-welding", not "kh-machine-works".
    Another preview server is probably on that port — astro preview moves to the
    next free one silently. Start yours on a known port and set PREVIEW_URL.
    exit 1

## After — the correct pairing still measures

    $ SITE_CLIENT=ks-welding PREVIEW_URL=http://localhost:4399 \
        node packages/template/scripts/check-overflow.mjs
    No horizontal overflow at any tested width.
    exit 0

## After — no SITE_CLIENT is a refusal, not a default

    $ PREVIEW_URL=http://localhost:4399 node packages/template/scripts/check-overflow.mjs
    check:overflow needs SITE_CLIENT — the client whose preview is on PREVIEW_URL.
    Without it there is nothing to check the served build against, and a stale
    preview of another client on a recycled port reports green (issue #37).
    exit 1

The guard is `scripts/lib/served-slug.mjs`, now the single copy: `check-textfit`,
`check-reveal` and `check-switching` call it too, so a fifth browser gate is
written by importing it rather than by remembering it.
