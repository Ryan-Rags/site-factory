# What the JSON-LD change moved, exhaustively (issue #35)

The acceptance is that an existing client's site does not move. The stale `dist/`
in the main checkout cannot answer that — it predates work already merged — so
both sides were built **in this worktree, from the same tree, in the same
environment**, with only the two lines of `LocalBusinessJsonLd.astro` differing.

`pnpm build` cannot produce the baseline: `check-schema.mjs` now asserts the
graph's `image`/`logo` origin, so the reverted code fails its own gate. Both
sides are therefore `astro build` alone, which is what emits the bytes.

## The gate says nothing moved — and it is structurally unable to see this

    $ node packages/template/scripts/check-delivered-parity.mjs \
        .scratch/dist-base .scratch/dist-cand2
    45 pages compared: 45 byte-identical, 0 changed only in panel machinery, 0 regressed.
    ✓ No client site changed what it renders.

    $ byte-for-byte comparison of the same two trees
    identical files: 672   differing: 40

Both are true. `regions()` elides every `<script>` before comparing, which the
script's own comment records ("neither covers structured data"), so a JSON-LD
change is invisible to `check:parity`. **A green parity run is not a claim of
byte-identity.** Worth knowing before the next stream leans on it for a change
that lives inside a script tag.

## The real delta, measured

Every `"image"`/`"logo"` value in both trees was replaced with a constant and the
files compared again:

    html pages compared: 45
    pages differing outside JSON-LD image/logo: 0

So the change moved those two fields and nothing else, on any page, of any
client. What they moved from and to:

| client | from | to |
|---|---|---|
| american-machine-specialty | `americanmachinespecialty.com` | `american-machine-specialty-preview.pages.dev` |
| industrial-machine-corp | `example.invalid` | `industrial-machine-corp-preview.pages.dev` |
| kh-machine-works | `www.khmachineworks.com` | `kh-machine-works-preview.pages.dev` |
| ks-welding | `example.invalid` | `ks-welding-preview.pages.dev` |
| ks-welding-forge | `example.invalid` | `ks-welding-forge-preview.pages.dev` |
| ks-welding-heritage | `example.invalid` | `ks-welding-heritage-preview.pages.dev` |
| ks-welding-precision | `example.invalid` | `ks-welding-precision-preview.pages.dev` |
| kts-machine-shop | `example.invalid` | `kts-machine-shop-preview.pages.dev` |

Five cited a host that resolves nowhere; two cited the client's own domain, which
does not serve `/og/<slug>.png`. All eight now cite the origin that does. `@id`
and `url` are untouched on every one of them.

**All eight are `noindex` demos, so all eight move.** There is no delivered build
in the repo to show unmoved: on one, `cardOrigin` is `''` and `assetBase` falls
back to `Astro.site`, which `astro.config.mjs` sets to `seo.siteUrl` — the exact
string the reverted code used. That guarantee is by code path, and it is stated
here rather than claimed as measured.
