# check-stamped-origins.mjs — failure first, on the artifact that is live today

Ran against the c3m demo exactly as it was built and deployed on 2026-08-17, with
the -rr host it is actually served from. Every existing gate passes this artifact.

```
$ node packages/template/scripts/check-stamped-origins.mjs \
    --slug c3m-of-nj-home-renovation-affordable-handyman \
    --dist <the artifact as deployed> \
    --origin https://c3m-of-nj-home-renovation-affordable-handyman-preview-rr.pages.dev --offline


✗ c3m-of-nj-home-renovation-affordable-handyman: 8 stamped-origin problem(s).

    canonical is rooted at https://c3m-of-nj-home-renovation-affordable-handyman-preview.pages.dev on 5 page(s) (404.html, about/index.html, contact/index.html, …), but this build is served from https://c3m-of-nj-home-renovation-affordable-handyman-preview-rr.pages.dev. Both are Cloudflare Pages hosts of ours, so this is not an identity claim about the business — it is a demo advertising an address that is not itself.
    og:url is rooted at https://c3m-of-nj-home-renovation-affordable-handyman-preview.pages.dev on 5 page(s) (404.html, about/index.html, contact/index.html, …), but this build is served from https://c3m-of-nj-home-renovation-affordable-handyman-preview-rr.pages.dev. Both are Cloudflare Pages hosts of ours, so this is not an identity claim about the business — it is a demo advertising an address that is not itself.
    og:image is rooted at https://c3m-of-nj-home-renovation-affordable-handyman-preview.pages.dev on 5 page(s) (404.html, about/index.html, contact/index.html, …), but this build is served from https://c3m-of-nj-home-renovation-affordable-handyman-preview-rr.pages.dev. Both are Cloudflare Pages hosts of ours, so this is not an identity claim about the business — it is a demo advertising an address that is not itself.
    twitter:image is rooted at https://c3m-of-nj-home-renovation-affordable-handyman-preview.pages.dev on 5 page(s) (404.html, about/index.html, contact/index.html, …), but this build is served from https://c3m-of-nj-home-renovation-affordable-handyman-preview-rr.pages.dev. Both are Cloudflare Pages hosts of ours, so this is not an identity claim about the business — it is a demo advertising an address that is not itself.
    json-ld image is rooted at https://c3m-of-nj-home-renovation-affordable-handyman-preview.pages.dev on 5 page(s) (404.html, about/index.html, contact/index.html, …), but this build is served from https://c3m-of-nj-home-renovation-affordable-handyman-preview-rr.pages.dev. Both are Cloudflare Pages hosts of ours, so this is not an identity claim about the business — it is a demo advertising an address that is not itself.
    json-ld logo is rooted at https://c3m-of-nj-home-renovation-affordable-handyman-preview.pages.dev on 5 page(s) (404.html, about/index.html, contact/index.html, …), but this build is served from https://c3m-of-nj-home-renovation-affordable-handyman-preview-rr.pages.dev. Both are Cloudflare Pages hosts of ours, so this is not an identity claim about the business — it is a demo advertising an address that is not itself.
    json-ld url is rooted at https://c3m-of-nj-home-renovation-affordable-handyman-preview.pages.dev on 5 page(s) (404.html, about/index.html, contact/index.html, …), but this build is served from https://c3m-of-nj-home-renovation-affordable-handyman-preview-rr.pages.dev. Both are Cloudflare Pages hosts of ours, so this is not an identity claim about the business — it is a demo advertising an address that is not itself.
    json-ld @id is rooted at https://c3m-of-nj-home-renovation-affordable-handyman-preview.pages.dev on 5 page(s) (404.html, about/index.html, contact/index.html, …), but this build is served from https://c3m-of-nj-home-renovation-affordable-handyman-preview-rr.pages.dev. Both are Cloudflare Pages hosts of ours, so this is not an identity claim about the business — it is a demo advertising an address that is not itself.

Rebuild this slug with the origin it is actually served from, then redeploy:

  PREVIEW_ORIGIN=https://c3m-of-nj-home-renovation-affordable-handyman-preview-rr.pages.dev pnpm demo -- --id <slug> --skip-ingest

exit 1
```
