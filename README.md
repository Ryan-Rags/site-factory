# site-factory

Lead audit + outreach pipeline and a config-driven Astro/Tailwind template for local business websites. Deploys to Cloudflare Pages.

## Architecture

Four packages, three of them a pipeline and one a product:

- **discover** — finds candidate local businesses by niche and city via the official Google Places API (never by scraping), and emits a lead row per business. See the [lead schema](#lead-schema) below and [data/businesses.sample.csv](data/businesses.sample.csv).
- **audit** — takes those leads and scores each existing site with read-only GETs (max 1 page navigation/sec/domain, 10 navigations/site): mobile layout, speed, SEO basics, contactability. Checks that can't complete are recorded as `unavailable`, never guessed.
- **outreach** — turns audit findings into a per-lead message that cites the specific problems found and links a live mockup, then tracks replies.
- **template** — the config-driven Astro/Tailwind site template. One config object per business drives content, theme, and sections.

**The mockup bridge** is what joins outreach to template: audit output is
projected into a template config, rendered as a real preview site, and that URL
is the outreach message's proof. The same template then ships as the delivered
site — the mockup *is* the product, not a throwaway.

## Lead schema

One CSV row per business. `discover` writes rows with a `url` to
`data/businesses.csv` and rows without one to `data/no-site.csv`; both use this
same header. Neither file is tracked — they hold real third-party business data.
The tracked fixture is [data/businesses.sample.csv](data/businesses.sample.csv).

| Column | Source | Notes |
| --- | --- | --- |
| `name` | Places `displayName.text` | |
| `url` | Places `websiteUri` | Empty means the lead goes to `no-site.csv`. |
| `niche` | `--niche` argument | Echoed verbatim from the run. |
| `city` | `--city` argument | A run-level label, not a parsed value. See below. |
| `phone` | Places `nationalPhoneNumber` | |
| `source` | Fixed | `places` for API rows, `sample` for the fixture. |
| `notes` | Free text | Empty for API rows; nothing is inferred. |
| `place_id` | Places `id` | Primary dedupe key. |
| `rating` | Places `rating` | 1–5. Empty when the business has no rating. |
| `review_count` | Places `userRatingCount` | |
| `address` | Places `formattedAddress` | Kept whole, never split. |
| `discovered_at` | Run clock | ISO-8601 UTC. |

The first seven columns are the original scaffold schema in their original
order; the last five were appended so old rows stay readable.

`city` is a label supplied per run via `--city`, not a value read back from the
API. `formattedAddress` is a single localised string that cannot be split into a
locality reliably across countries, and the `addressComponents` field that
*would* give a locality moves the request into a more expensive Places SKU. So
the full address is preserved in `address`, and `city` records what the operator
searched for. Rows from a run with no `--city` have an empty `city`.

## Getting started

```sh
cp .env.example .env   # add GOOGLE_MAPS_API_KEY
pnpm install
pnpm -r build
```

Node >=20, TypeScript strict, pnpm workspaces.
