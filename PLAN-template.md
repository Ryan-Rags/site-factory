# Phase 1a — `packages/template` (branch `feat/template`, worktree `D:/sf-template`)

Config-driven client site template. Seed client: **K-H Machine Works Inc**,
North Bergen NJ. This build is a **pitch mockup** — nothing public, nothing
indexed.

## STOP — branch state does not match the brief

Checked after `git fetch --all --prune`:

- `main` and `origin/main` are both at `38f8303` ("Scaffold pnpm monorepo
  skeleton"). **The pipeline merge has not landed.** `feat/pipeline` is at
  `6c717b9`, pushed to `origin/feat/pipeline`, 1 commit ahead of `main`,
  unmerged.
- Consequently the rebase was a no-op: `feat/template` is 0 ahead / 0 behind
  `origin/main`. No conflict, but also nothing gained. If I self-merge
  `feat/template` first, template lands on `main` ahead of pipeline and
  pipeline's shared-file edits (`claude.md`, `README.md`, `.gitignore`,
  root `package.json`, `pnpm-lock.yaml`) become someone's merge problem.
  **Waiting for you to merge pipeline first, unless you say otherwise.**
- **The ownership / merge protocol is not written down anywhere.** `claude.md`
  on `main` has no ownership matrix and no merge procedure — only "work stays
  on your assigned branch". `feat/pipeline`'s version of `claude.md` doesn't
  add one either (it only rewords the audit rate-limit line). So "self-merge
  per protocol, shared files need grant" has no text to follow. My assumption
  unless told otherwise: I own `packages/template/**` and `PLAN-template.md`
  outright; anything else (root `package.json`, `pnpm-workspace.yaml`,
  `pnpm-lock.yaml`, `README.md`, `claude.md`, `.gitignore`) I touch only with
  an explicit grant from you. Note that adding Astro deps **will** rewrite
  `pnpm-lock.yaml` — that is a shared file, so I need that grant to build at
  all.
- Housekeeping done: a prior session had left the plan appended to the root
  `PLAN.md` in this worktree (uncommitted). Per your instruction that file is
  off-limits to this stream, so I moved the content to `PLAN-template.md` and
  restored `PLAN.md` to its committed state. Nothing was lost.

## STOP — questions before I write code

1. **Path.** You said `/template`; the workspace declares `packages/template`.
   I plan to build in **`packages/template/`** (every path below is relative to
   it, so `template/site.config.ts` → `packages/template/site.config.ts`).
   Say the word if you actually want a root-level `/template` instead.
2. **Testimonials — the real blocker.** CLAUDE.md forbids touching any Google
   property, and forbids fabricating data. So I cannot read K-H's actual Google
   reviews to paraphrase them. Options:
   - (a) You paste the two review texts into the chat / a file and I paraphrase
     those. Cleanest, and the only version that is genuinely true.
   - (b) I write two testimonials from the details you gave (5.0★, commercial
     customer, "saved an expensive return trip"), each clearly marked in
     `site.config.ts` as `status: "placeholder — verify with client before
     sending"`, and the README's 30-min checklist makes replacing them a
     required step. Nothing false ships unflagged, but the words are mine, not
     the reviewer's.

   **Default if you don't answer: (b).** Tell me now if you want (a).
3. **Existing package stub.** `packages/template` is currently a plain `tsc`
   package with `src/index.ts` and a `dist/` build. I will replace its
   `package.json` scripts with Astro's (`astro build`, `astro check`) and delete
   the stub `src/index.ts` / `tsconfig.json` in favour of Astro's. Root
   `pnpm build` still works because it just runs `-r build`.
4. **Lighthouse.** I'll run `lighthouse` (npx, devDep-free) against `astro
   preview` on the built output, desktop preset, and paste the four real
   numbers. Chrome is present on this machine
   (`C:\Program Files\Google\Chrome\Application\chrome.exe`), so this should
   run for real; if a run fails I report "unavailable" rather than invent
   scores. Given mobile-first is the pitch, I'll report the **mobile** preset
   as the headline four numbers and desktop alongside.

## Stack

Astro 5 static output, `@astrojs/react` for islands only, `@astrojs/tailwind`
(Tailwind 3), `@astrojs/sitemap`, `astro:assets` for images. TypeScript strict.
No database, no CMS, no runtime fetch. Only React island: the contact form
(client-side validation + file upload + submit state). Everything else ships as
zero-JS static HTML.

## Config surface — single source of truth

`site.config.ts` (typed, `satisfies SiteConfig`), consumed by every page and by
the JSON-LD/meta/sitemap generators:

```
business    name, legalName, tagline, foundedYear, phone, email, address,
            serviceArea[], hours[], googleMapsUrl?
theme       colors { primary, accent } (2 colors, as required) + neutral ramp
            derived; fonts { heading, body } (2-font pair, self-hosted woff2)
brand       logo, favicon, imagesDir, ogImage
hero        headline, subhead, ctaPrimary, ctaSecondary, image
trustStrip  4 items (icon + label)
services[]  slug, title, oneLiner, body, icon, image
about       headline + path to content/about.md
testimonials[]  quote, attribution, role, rating, sourceNote, status
certifications[]  label, detail
cta         headline, body, buttonText
seo         titleTemplate, defaultDescription, noindex: true  ← mockup lock
features    gallery: false (flip to true to enable the Gallery page)
forms       workerEndpoint, maxUploadMB, acceptedFileTypes
```

Long-form prose stays in `content/*.md` (Astro content collections, schema-
validated): `about.md`, `services/*.md` (4 files), optional `gallery.md`.
Rule: **no client-specific string appears in any `.astro` file.** A new client
= edit `site.config.ts` + `content/` + drop images in `public/images/`.

Theme applies via CSS custom properties emitted from config into a `<style>`
block on the base layout, so Tailwind classes reference `bg-primary` etc. and
the two colors change in one place. Contrast: I'll assert AA (≥4.5:1 body,
≥3:1 large/UI) for the seed palette and note the check in the README.

## Pages

- `/` — hero, trust strip, services grid (4), story teaser, testimonials, CTA band
- `/services` — full grid + per-service detail sections (from `content/services/`)
- `/about` — story from `content/about.md`, certifications, service area
- `/contact` — hours, phone/email, map link (plain anchor, no embed), form island
- `/gallery` — built only when `features.gallery` is true
- `404`

Shared: `BaseLayout.astro` (semantic `header`/`nav`/`main`/`footer`, skip link,
`:focus-visible` rings, `prefers-reduced-motion` respected), `Seo.astro`
(per-page title/description/canonical/OG/Twitter), `LocalBusinessJsonLd.astro`
(`@type: LocalBusiness`, name/address/geo-less/telephone/openingHours/
areaServed/foundingDate, all from config).

`sitemap` via `@astrojs/sitemap`; `robots.txt` = `Disallow: /` + `<meta
name="robots" content="noindex,nofollow">` on every page while
`seo.noindex` is true, with a one-line "flip this when going live" comment.
No `wrangler.toml` / Pages config with a real project name — nothing that could
publish this by accident.

## Contact form + Worker stub

`src/components/ContactForm.tsx` (React island): name, phone, email, service
select, message, **file upload "photo of your part"** (single file, image/* +
pdf, ≤ `maxUploadMB`, client-side type/size check + preview + a11y-labelled
error text), Turnstile widget placeholder div, `multipart/form-data` POST to
`forms.workerEndpoint`, honeypot field, disabled/pending/success/error states
announced via `aria-live`.

`worker/` — Cloudflare Worker stub, TypeScript, `wrangler.jsonc` with
placeholder ids only:
1. method/origin check, honeypot, field validation (server-side, mirrors client)
2. Turnstile verification — **placeholder**, real `siteverify` call written but
   short-circuited behind `TURNSTILE_SECRET_KEY` being unset, clearly commented
3. Resend send (`RESEND_API_KEY`, attachment passthrough, size cap)
4. KV backup log — write the submission JSON + upload metadata to KV before
   sending, so a Resend outage never loses a lead; R2 note for the file itself
5. `worker/README.md` documenting every env var/binding, local `wrangler dev`,
   and that no secret is ever committed

## Images

`public/images/` placeholders at the real aspect ratios you'll swap:
hero 16:9 (1920×1080), service cards 4:3 (800×600), story 3:2 (1200×800),
og 1.91:1 (1200×630), logo SVG, gallery 1:1. Generated as lightweight SVGs
labelled with their slot + dimensions. `astro:assets` handles width/height,
`loading="lazy"`/`decoding="async"` below the fold, hero eager + preloaded.

## `README.md` — "new client in 30 minutes"

Numbered checklist: copy package → fill `site.config.ts` (with a field-by-field
table) → rewrite `content/*.md` → drop images → set 2 colors + font pair →
deploy Worker + set 4 secrets → flip `seo.noindex` → run Lighthouse. Plus:

> ### DNS — read before touching anything
> **NEVER touch MX records.** Mail routing is the client's business email; one
> wrong MX edit silently kills their inbox. Only ever add/adjust the A/AAAA/
> CNAME records for the site itself.
> **The client keeps registrar ownership.** They stay the account holder; we
> get delegated access or they paste records we send. We never transfer a
> domain into our account.

## Acceptance

`pnpm build` clean from repo root · `astro check` clean · Lighthouse ≥95
perf/a11y/best-practices/SEO on the built output with the four real numbers
reported · README checklist present with the DNS warning · robots noindex ·
no secrets, no deploy target, no fabricated review text.

## Commit / push

Work stays in `D:/sf-template` on `feat/template`; branch asserted before each
commit; pushed before I report done. `main` untouched.
