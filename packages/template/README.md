# Site template

A config-driven static site for a local business. Astro 5, Tailwind, static
output, zero JavaScript except the contact form.

A new client is `clients/<slug>.config.ts` + `src/content/*/<slug>/*.md` +
images. **No client-specific string appears in any `.astro` file** — if you
find yourself about to type a business name, a trade, or a number of services
into a component, put it in the config instead.

One package builds every client:

```sh
pnpm build                                  # the default client
SITE_CLIENT=kts-machine-shop pnpm build     # one named client → dist/kts-machine-shop/
pnpm build:all                              # every client, each to dist/<slug>/
```

All current clients are pitch mockups with `seo.noindex: true`, so none of
them is indexable. `clients/EQUIVALENCE.md` records the proof that adding the
multi-client layer left the original client's built output unchanged.

---

## New client in 30 minutes

### 1. Add a client config (2 min)

Do **not** copy the package. Copy the nearest existing config instead:

```sh
cp clients/kts-machine-shop.config.ts clients/<slug>.config.ts
mkdir -p src/content/about/<slug> src/content/services/<slug>
```

You will also need a prospect record — `packages/copy/src/prospects/<slug>.ts`,
registered in that package's `prospects/index.ts`. That is where the client's
facts and their sources live, and it is what the copy is generated from.

Then register the config in `clients/index.ts` — one import, one line in the
`clients` map. The slug must match the discovery pipeline's slug for that business: it
is also the `dist/<slug>/` output directory and the key the mockup bridge uses
to find `audit/out/<slug>/` screenshots.

`pnpm build:all` fails if a config exists that nobody registered, so a
half-added client cannot sit there unnoticed.

### 2. Fill in the client config (10 min)

**Half of a client config is generated now, and must not be hand-edited.**

The copy — hero, trust strip, service descriptions, About, CTA, page headings,
SEO strings, FAQ, service areas — comes from `@site-factory/copy`, out of a
prospect record in `packages/copy/src/prospects/<slug>.ts` where every fact
sits beside the source that supports it. The config pulls it in with one line:

```ts
const copy = copyFor('<slug>');
```

To change generated copy, change the record or the niche pack — not the
config. A string typed straight into a config has never been through the
fabrication guard, and that guard is the thing standing between a draft and a
sentence claiming the shop is ISO certified when nobody checked.

What stays hand-written is everything that is not copy: identity, theme, brand
assets, testimonials, equipment, forms, `noindex`. A colour is not a claim.

Values we could not confirm are marked **`[verify with client]`** — one
spelling repo-wide, and `check-markers.mjs` blocks any live build carrying it.
`packages/copy/REPORT.md` lists every remaining marker beside the single
question that clears it.

| Key | What it drives | Notes |
|---|---|---|
| `business.name` / `legalName` | Header, footer, JSON-LD, page titles | `name` is the short trading name |
| `business.tagline` | Footer, home page `<title>` | One line |
| `business.foundedYear` | Hero eyebrow, footer, JSON-LD `foundingDate` | |
| `business.phone` / `phoneHref` | Every call-to-action | `phoneHref` is digits only, E.164: `+12015550142` |
| `business.email` | Footer, contact page, JSON-LD | |
| `business.address` | Footer, contact page, JSON-LD `PostalAddress` | |
| `business.serviceArea[]` | About page chips, footer line, JSON-LD `areaServed` | First 3–4 show in the footer |
| `business.hours[]` | Footer, contact page, JSON-LD `openingHours` | `{ day, opens, closes }` or `{ day, closed: true }` |
| `business.mapUrl` | Optional plain link on the contact page | Never an embed — see "What this template will not do" |
| `theme.colors` | The entire palette | Two colours. Run `pnpm check:contrast` after changing |
| `theme.fonts` | Heading and body stacks | See "Fonts" below |
| `brand.logo` / `favicon` / `ogImage` | Header, tab icon, social preview | |
| `hero.*` | Home page hero | Headline, subhead, two CTAs, image |
| `trustStrip[]` | Four-item band under the hero | `icon` must be one of the `IconName` values |
| `services[]` | Home grid, services page, contact form dropdown, JSON-LD | Each `slug` **must** have a matching `src/content/services/<slug>.md` |
| `about` | About page and home teaser | `entry` points at `src/content/about/<entry>.md` |
| `testimonials[]` | Testimonials section | See step 3 — this one has rules |
| `certifications[]` | About page | Only list what the client actually holds |
| `cta` | The dark call-to-action band | Appears on every page except the home page footer area |
| `seo` | Titles, meta, canonical, robots.txt | `noindex` is the mockup lock — step 8 |
| `features.gallery` | Whether `/gallery` is built at all | `false` emits no gallery HTML and no nav link |
| `forms` | Contact form behaviour | `workerEndpoint` comes from `worker/README.md` |

The file is typed as `SiteConfig` (`src/types/site.ts`), so a missing or
misspelled field fails `pnpm typecheck` rather than rendering blank.

### 3. Testimonials — read this before you touch them (3 min)

**Never write a testimonial and present it as a customer's words.** Never copy
review text from a review platform either.

Each entry has a `status`:

- `verified` — the words came from the client or from the reviewer themselves.
- `placeholder` — we wrote them. **While any entry is `placeholder`, the
  testimonials section renders a visible dashed warning banner on the page.**

That banner is deliberate. It is not possible to send this site to a client, or
show it to their customers, without noticing that the quotes are not real. It
disappears on its own once every entry is `verified`.

The seed testimonials are `placeholder`: they paraphrase sentiment the client
relayed to us, in our words. Replace them with client-supplied wording, or
delete the section.

### 4. Generate the content (2 min)

| File | Becomes |
|---|---|
| `src/content/about/<slug>/about.md` | The about page and the home page teaser |
| `src/content/services/<slug>/<service>.md` | One per service, in config order |

Both are **generated**, by `pnpm --filter @site-factory/copy emit --all` (or
`pnpm copy:emit` from the root). Edit the prospect record and re-emit rather
than editing the markdown, for the same reason as step 2 — the guard runs
during generation, not after it.

Service front-matter needs `title`, `summary` and at least one `highlights`
entry — the schema in `src/content.config.ts` enforces it at build time, and
the emitter always writes all three.

### 5. Drop in images (3 min)

Replace the files in `public/images/`. Each placeholder is labelled with its
slot and the exact pixel size it should be, so the aspect ratio cannot go
wrong:

| File | Size | Slot |
|---|---|---|
| `hero.svg` | 1920×1080 (16:9) | Home hero. Preloaded — this is the LCP element |
| `service-<slug>.svg` | 800×600 (4:3) | One per service |
| `story.svg` | 1200×800 (3:2) | About page and home teaser |
| `og.svg` | 1200×630 (1.91:1) | Social share preview |
| `gallery-N.svg` | 800×800 (1:1) | Gallery, if enabled |
| `logo.svg` | square | Header and footer |
| `favicon.svg` (in `public/`) | square | Browser tab |

Two things to get right:

- **Keep the `width`/`height` attributes in step with the real files.** They
  are what hold the layout still while images load; wrong values reintroduce
  layout shift and cost the performance score.
- **`og.svg` must become a PNG or JPG before launch.** Social platforms do not
  render SVG previews. Update `brand.ogImage` when you swap it.

`pnpm gen:placeholders` regenerates the placeholder set if you need it back.

### 6. Set the two colours and the font pair (2 min)

`theme.colors.primary` and `theme.colors.accent` are the only colour values in
the project. Every shade — the darker footer, the tinted nav highlight, the
hover states — is derived from those two in CSS, in `BaseLayout.astro`.

```sh
pnpm check:contrast
```

That asserts WCAG AA across all eight pairings the template actually renders
and exits non-zero if any fails. Run it every time you change a colour. Current
seed palette:

```
primary #0f4c81   accent #b45309

PASS   8.86:1  (min 4.5)  primary text on white
PASS   8.86:1  (min 4.5)  white text on primary
PASS  11.48:1  (min 4.5)  white text on primary-dark (footer, CTA band)
PASS   7.87:1  (min 4.5)  primary text on primary-wash (active nav, chips)
PASS   5.02:1  (min 4.5)  accent text on white
PASS   5.02:1  (min 4.5)  white text on accent (primary button)
PASS   6.80:1  (min 4.5)  accent-dark on white (eyebrows, icons, focus ring)
PASS   6.04:1  (min 3.0)  accent-dark on primary-wash (icons on trust strip)
```

#### Fonts

The default build uses system font stacks: no webfont request, nothing fetched
from any third-party font host, and instant first paint.

To use real brand fonts, self-host them — drop `.woff2` files into
`public/fonts/` and describe them in `theme.fonts.faces[]`. `BaseLayout.astro`
emits the `@font-face` rules and preloads each file. Do not swap in a hosted
font stylesheet: it costs a third-party connection on the critical path and
sends every visitor's IP to that host.

### 7. Deploy the Worker and set its secrets (5 min)

Full instructions in [`worker/README.md`](worker/README.md). In short: create
the KV namespace, fill in `wrangler.jsonc`, set `RESEND_API_KEY` and
`TURNSTILE_SECRET_KEY` with `wrangler secret put`, `wrangler deploy`, then
paste the URL into `forms.workerEndpoint`.

**No secret ever goes in a file in this repo.** While `workerEndpoint` is
empty the form still validates and tells the visitor to call or email instead.

For a **demo** — a site being shown to a prospect who has not signed anything —
you do not deploy a Worker per prospect. Deploy
[`worker-demo/`](worker-demo/README.md) once and build with one env var:

```sh
DEMO_FORM_ENDPOINT=https://…workers.dev pnpm build:all
```

Every prospect's form then posts to that one endpoint, tagged with their slug,
and the mail comes to you. Unset, nothing changes and each client's own `forms`
block governs — a real client build can never inherit the demo endpoint by
accident.

### 8. Go live: flip `seo.noindex` (1 min)

```ts
seo: {
  noindex: false,   // was true
  siteUrl: 'https://theclientsdomain.com',   // was https://example.invalid
}
```

The two are independent, and only `noindex` is the lock. Set `siteUrl` as
soon as the client's real domain is verified — canonicals and JSON-LD `@id`
are better off naming the business's actual identity than a fake one, and
`noindex` keeps the build out of the index either way. K-H and AMS already
have theirs set while still locked.

That one flag controls three things at once, so they cannot drift apart:

- the `<meta name="robots" content="noindex,nofollow">` on every page,
- `robots.txt` (`Disallow: /` → `Allow: /` plus a sitemap reference),
- whether `@astrojs/sitemap` runs at all.

**Only flip it with the client's sign-off.** While it is `true`, Lighthouse
scores SEO below 100 — that is the lock working, not a defect. See "Scores"
below.

#### The marker check will stop you

`pnpm build` runs `scripts/check-markers.mjs` after every build. Its rule:

| `seo.noindex` | Markers in the output |
|---|---|
| `true` | fine — that is what a mockup is for |
| `false` | **build fails**, listing every file and line |

Both `[verify with client]` and the legacy `PLACEHOLDER` count. So the moment
you flip `noindex` to `false`, every unconfirmed value on the site becomes a
build error with a file and line number, and you cannot publish a site with
somebody's guessed phone number on it by forgetting to re-read it.

Fix the values, or flip `noindex` back. **Do not delete the check.**

### 9. Verify

```sh
pnpm typecheck        # astro check
pnpm build
pnpm check:contrast
pnpm check:contact-links   # every number tappable, no dead sms: link
pnpm preview --port 4321   # then, in another terminal:
SITE_CLIENT=<slug> pnpm check:overflow
```

`check:overflow` requires `SITE_CLIENT`: like the other browser gates it now
verifies the served build names that slug before it measures, and a guard with
nothing to compare against is not a guard (issue #37).

From the repo root, for a site that is going to be demoed on a phone:

```sh
pnpm verify:offline -- --client <slug> --local   # every route, connection cut
pnpm pitch -- --client <slug>                    # their Lighthouse score vs ours
```

---

## Tap-to-call and tap-to-text

Every phone number on the site is a `tel:` link, and
`scripts/check-contact-links.mjs` fails the build if one is not — a number
printed as text is one a customer has to memorise and retype, which on a phone
is where the enquiry is lost.

Text links are opt-in per client:

```ts
business: {
  phone: '(201) 555 0142',
  phoneHref: '+12015550142',
  smsHref: '+12015550142',        // ONLY if this number receives texts
  smsBody: 'Hi — about a job…',   // optional prefill
}
```

Leave `smsHref` unset unless somebody has confirmed the number receives SMS.
Most shop numbers are landlines; a text to a landline is delivered nowhere and
answered never, which is worse in front of a customer than no text link at all.
Unset, no "Text us" link renders anywhere and the check enforces that too. All
five current prospect configs leave it unset for exactly this reason.

## Offline: `features.offline`

`features.offline: true` emits `/sw.js` and registers it, so the site keeps
working on a dead connection after one visit. This exists because these sites
get shown on a phone inside a workshop, where reception is often nothing.

HTML is network-first (a connected phone always gets the current build);
images, fonts and the form bundle are cache-first. Form POSTs are never
intercepted — offline, the form says so rather than faking a success.

The cost: for one navigation after a redeploy, a phone can still see the
previous build. The cache name carries a build hash and old caches are deleted
on activate, so the window is narrow, not zero. Set the flag to `false` and the
page ships exactly as it did before the flag existed — including unregistering
a worker left over from an earlier build.

Prove it rather than assume it:

```sh
pnpm verify:offline -- --client <slug> --local
```

---

## DNS — read before touching anything

> ### NEVER touch MX records.
> Mail routing is the client's business email. One wrong MX edit silently kills
> their inbox — no bounce, no error, just mail that stops arriving, often not
> noticed for days. Only ever add or adjust the **A / AAAA / CNAME** records
> for the site itself. If a change seems to require an MX edit, stop and ask.
>
> ### The client keeps registrar ownership.
> They stay the account holder on their own domain. We get delegated access, or
> they paste in the records we send them. **We never transfer a domain into our
> account.** A web supplier holding a client's domain is how a working
> relationship turns into a hostage situation, and it is not a position we put
> anyone in — including ourselves.

Records you will normally touch, and nothing else:

| Type | Purpose |
|---|---|
| `A` / `AAAA` | Apex domain → host |
| `CNAME` | `www` → apex, or → the hosting provider's target |
| `TXT` | Only for a host's domain-verification challenge |

Leave `MX`, `SPF`/`DKIM`/`DMARC` `TXT` records, and anything you do not
recognise, exactly as they are.

---

## Scores

Lighthouse 12, against `astro build` output served by `astro preview`, on a
real Chrome install. Every route, both presets:

| preset | route | perf | a11y | best-practices | seo |
|---|---|---|---|---|---|
| mobile | `/` | 100 | 100 | 100 | 100 |
| mobile | `/services` | 100 | 100 | 100 | 100 |
| mobile | `/about` | 100 | 100 | 100 | 100 |
| mobile | `/contact` | 100 | 100 | 100 | 100 |
| desktop | `/` | 100 | 100 | 100 | 100 |
| desktop | `/services` | 100 | 100 | 100 | 100 |
| desktop | `/about` | 100 | 100 | 100 | 100 |
| desktop | `/contact` | 100 | 100 | 100 | 100 |

**One caveat, stated plainly.** Those SEO numbers are measured with the
`is-crawlable` audit excluded, because `seo.noindex` is deliberately `true` on
this mockup. Run without that exclusion, SEO scores **69** — and `is-crawlable`
is the *only* failing audit in the entire report, across all four categories.
Flipping the flag at step 8 is what turns 69 into 100; nothing else changes.

Horizontal overflow, via `pnpm check:overflow` (real Chrome, `scrollWidth`
compared against the viewport, plus per-element bounding boxes so a wide
element is named rather than silently clipped):

```
PASS  320px  /  /services  /about  /contact  /404
PASS  390px  /  /services  /about  /contact  /404
```

---

## What this template will not do

Constraints, not omissions:

- **No map embed and no map API call.** `business.mapUrl` renders as a plain
  anchor if you set it. An embedded map is a third-party iframe on every
  contact page view; it costs performance and tracks the visitor.
- **No hosted webfonts.** Self-host or use system stacks. See step 6.
- **No fabricated review markup.** `LocalBusinessJsonLd.astro` deliberately
  omits `aggregateRating` and `review`. Search engines treat those as factual
  claims, and we will not emit ones we cannot attribute to a real, verifiable
  review. `geo` and `priceRange` are omitted for the same reason.
- **No deploy target in the repo.** No adapter, no Pages project name, no real
  ids in `wrangler.jsonc`. This build cannot publish itself anywhere by
  accident.
- **No analytics, no tag manager, no third-party script of any kind.** The
  only outbound request the default build can make is to Cloudflare Turnstile,
  and only when `forms.turnstileSiteKey` is set.

---

## Structure

```
clients/
  index.ts                  the client registry + SITE_CLIENT resolution
  <slug>.config.ts          one per client — every client-specific value
  EQUIVALENCE.md            byte-equivalence proof for the K-H refactor
site.config.ts              resolves the active client; components import this
src/types/site.ts           the SiteConfig contract
src/lib/business.ts         yearsInBusiness() — never hard-code an age
src/content.config.ts       content collection schemas
src/content/
  about/<client>/about.md         the story, per client
  services/<client>/<slug>.md     one per service, per client
src/layouts/BaseLayout.astro   head, theme custom properties, skip link, chrome
src/components/
  Seo.astro                 title, description, canonical, OG, Twitter, robots
  LocalBusinessJsonLd.astro  structured data, built from config
  Header.astro              nav; mobile menu is a <details> — no JS
  Footer.astro
  PageHeader.astro          the dark band at the top of every inner page
  Hero.astro TrustStrip.astro ServicesGrid.astro StoryTeaser.astro
  Testimonials.astro CtaBand.astro Icon.astro
  Equipment.astro           renders nothing when equipment is absent
  Updates.astro             renders nothing when updates is absent
  TextUsLink.astro          sms: link — renders nothing without business.smsHref
  ContactForm.tsx           the form island: validation, success state, offline
src/pages/
  index.astro services.astro about.astro contact.astro 404.astro
  gallery/[...slug].astro   built only when features.gallery is true
  robots.txt.ts             generated from seo.noindex
  sw.js.ts                  the service worker, built when features.offline
scripts/
  build-all.mjs             builds every registered client
  check-markers.mjs         blocks a live build carrying unconfirmed values
  check-contrast.mjs        WCAG AA assertion for the two brand colours
  check-overflow.mjs        horizontal overflow check at 320px and 390px
  check-contact-links.mjs   every phone number must be tappable
  gen-placeholders.mjs      regenerates public/images placeholders
worker/                     Cloudflare Worker for one client's contact form
worker-demo/                the shared demo endpoint behind every prospect demo
```

## Commands

| Command | Does |
|---|---|
| `pnpm dev` | Dev server on :4321 |
| `pnpm build` | Build the client in `SITE_CLIENT` (default K-H) to `dist/<slug>/`, then run the marker and fabrication checks |
| `pnpm build:all` | Build and check every registered client |
| `pnpm check:markers` | Marker check alone — `--all` for every built client |
| `pnpm check:fabrication` | Assert every claim in the built pages traces to a sourced fact — `--all` for every built client |
| `pnpm preview` | Serve `dist/` — what Lighthouse should measure |
| `pnpm typecheck` | `astro check` |
| `pnpm check:contrast` | WCAG AA assertion on the two brand colours |
| `SITE_CLIENT=<slug> pnpm check:overflow` | Horizontal overflow check (needs `pnpm preview` running) |
| `pnpm check:contact-links` | Every phone number is inside a `tel:`/`sms:` link — `--all` for every built client |
| `pnpm gen:placeholders` | Regenerate placeholder images |
| `pnpm clean` | Remove `dist/` and `.astro/` |


---

## Design families

Three config-driven looks for local service businesses, sharing one set of
components and one contract:

| Preset | Look | Built for |
|---|---|---|
| **Forge** | Near-black carbon, brushed-steel bands, condensed caps, hot accent | Machine shops, welding, fabrication |
| **Precision** | White and graphite, blueprint grid, drawing-office corner ticks, measured blue | Contractors, HVAC, electrical |
| **Heritage** | Cream and deep forest, serif display, double sign-painter's rules | Legacy shops, second-generation trades |

Every family renders the *same markup*. A family is a token set plus a handful
of decorative rules scoped to `[data-theme="..."]` in `src/styles/design.css`.
That is deliberate: a fix to the FAQ accordion or the sticky call bar lands in
all three at once, and no family can drift into worse accessibility than its
siblings.

### Sections

Hero (three layouts: `split`, `full-bleed`, `stacked-panel`), sticky mobile
call bar with click-to-call, stat counters, services grid, reviews, gallery,
service area, FAQ accordion, before/after slider, open-now badge, full footer.
Every one is `{ enabled: ... }` in the config, and `order` decides the sequence.

### Where the values come from

```
src/design/presets.json      the three presets: palettes, accent swatches,
                             font pairings, allowed layouts
clients/design/<slug>.design.json    a full per-prospect payload
clients/design/<slug>.brief.json     or a brief, composed with the client's
                                     existing SiteConfig by derive.ts
```

A prospect config **chooses**; it does not author. `theme.accent` and
`theme.fontPairing` are ids that must exist in the chosen preset — there is no
free colour input anywhere, in the config or the UI. That is what makes the
contrast gate possible: a finite set of combinations is a set that can be
enumerated and proved.

### Commands

```sh
pnpm build:client ks-welding      # one client
pnpm build:all                    # all of them, + marker and contrast gates
pnpm check:contrast               # 234 AA assertions over the whole matrix
SITE_CLIENT=<slug> pnpm check:overflow   # 320px / 390px, every route
pnpm gen:brand                    # icon set, webmanifest and OG card per client
pnpm compare                      # dist/compare.html - three families side by side
pnpm record:switch                # dist/theme-switch.webm
```

### The customizer

`features.customizer: true` turns on a preview panel: a prospect switches
preset, accent and lettering and the page changes instantly, then sends the
combination back. It works by emitting every combination as static CSS keyed
on `<html data-theme|data-accent|data-font>`, so switching is three attribute
writes with no reload and no layout shift.

It is a **pitch-build feature**. When the flag is false or absent, the panel,
its script and the whole matrix are not emitted at all. `SITE_DELIVERED=1`
forces it off regardless of the config, so a stale flag cannot leak a
customizer into a delivered site.

### Honesty rules that the design layer inherits

- Nothing fetches anything. No Google property is contacted at build or run
  time, and no review is taken from any platform. The reviews section renders
  what the config holds, and its attribution line (`sourceLabel`) is a config
  string so no component can assert a source we have not verified.
- Every review keeps `status` and `sourceNote`. `Review`/`AggregateRating`
  JSON-LD is emitted **only** when a real aggregate exists and every item is
  `verified` - a paraphrase is never marked up as a customer quotation.
- The before/after slider renders only when both photographs are declared
  genuine. Placeholders render nothing rather than passing stock art off as
  the shop's work.
- The open-now badge is computed in the browser, in the shop's own IANA
  timezone, and does not render at all without one. A badge baked at build
  time asserts something about the moment we built, not the moment somebody
  is reading.
- Stat counters take their numbers from config only. There is no default.
