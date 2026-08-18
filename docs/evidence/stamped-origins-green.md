# check-stamped-origins.mjs — green, on the redeployed artifact

Same gate, same slug, after the rebuild on the origin the demo is really served
from. Run against the deployed `dist/` with live asset probes.

```
$ node packages/template/scripts/check-stamped-origins.mjs \
    --slug c3m-of-nj-home-renovation-affordable-handyman \
    --origin https://c3m-of-nj-home-renovation-affordable-handyman-preview-rr.pages.dev
  · https://c3m-of-nj-home-renovation-affordable-handyman-preview-rr.pages.dev/images/og.svg  200 image/svg+xml
  · https://c3m-of-nj-home-renovation-affordable-handyman-preview-rr.pages.dev/images/logo.svg  200 image/svg+xml
✓ c3m-of-nj-home-renovation-affordable-handyman: 5 page(s), every stamped origin is https://c3m-of-nj-home-renovation-affordable-handyman-preview-rr.pages.dev and 2 asset(s) answer 200.
exit 0
```

## And read back off the live host, not off dist/

```
GET https://c3m-of-nj-home-renovation-affordable-handyman-preview-rr.pages.dev/   200

  canonical      <serving origin>/
  og:url         <serving origin>/
  og:image       <serving origin>/images/og.svg
  twitter:image  <serving origin>/images/og.svg
  json-ld image  <serving origin>/images/og.svg
  json-ld logo   <serving origin>/images/logo.svg
  json-ld url    <serving origin>/
  json-ld @id    <serving origin>/

  all 8 stamped URLs name the serving origin
```
