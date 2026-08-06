# site-factory

Lead audit + outreach pipeline and a config-driven Astro/Tailwind template for local business websites. Deploys to Cloudflare Pages.

## Architecture

Four packages, three of them a pipeline and one a product:

- **discover** — finds candidate local businesses by niche and city via the official Google Places API (never by scraping), and emits a lead row per business: `name,url,niche,city,phone,source,notes`. See [data/businesses.sample.csv](data/businesses.sample.csv).
- **audit** — takes those leads and scores each existing site with read-only GETs (max 1 req/sec/domain, 10 pages/site): mobile layout, speed, SEO basics, contactability. Checks that can't complete are recorded as `unavailable`, never guessed.
- **outreach** — turns audit findings into a per-lead message that cites the specific problems found and links a live mockup, then tracks replies.
- **template** — the config-driven Astro/Tailwind site template. One config object per business drives content, theme, and sections.

**The mockup bridge** is what joins outreach to template: audit output is
projected into a template config, rendered as a real preview site, and that URL
is the outreach message's proof. The same template then ships as the delivered
site — the mockup *is* the product, not a throwaway.

## Getting started

```sh
cp .env.example .env   # add GOOGLE_MAPS_API_KEY
pnpm install
pnpm -r build
```

Node >=20, TypeScript strict, pnpm workspaces.
