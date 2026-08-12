# Shared demo form Worker

One Cloudflare Worker behind **every** prospect demo. A demo site posts the
same contact form as a real client site, plus one extra field — `prospectId`,
the build's client slug — and this Worker tags the notification email with it.

**This is a stub with placeholder ids.** It cannot deploy as written. Fill in
`MAIL_TO` and the KV namespace id from your own dashboard first.

## Why this exists next to `../worker/`

They answer different questions.

| | `../worker/` | this one |
|---|---|---|
| Deployments | one per client | one, total |
| Delivers to | the client's inbox | mine |
| Origins | that client's site | every `*.pages.dev` demo |
| Knows about prospects | nothing | validates `prospectId` against a list |
| Lifetime | ships with a client site | lives as long as I am pitching |

Folding both into one Worker with a mode flag would put a demo's rules one
misconfigured var away from a real client's mail. They stay separate.

## Request flow

| # | Step | Notes |
|---|------|-------|
| 1 | Method + `Origin` | Exact origins **or** an allowed host suffix (https, dot boundary). Anything else: 403, no CORS headers |
| 2 | Honeypot | A filled `company` field returns `200 {ok:true}` so the bot does not retry |
| 3 | `prospectId` | Must match `^[a-z0-9][a-z0-9-]{1,63}$` **and** be in `KNOWN_PROSPECTS`. This is what stops a shared endpoint being an open relay |
| 4 | Rate limit | `PROSPECT_RATE_PER_HOUR` per prospect, counted in KV |
| 5 | Validation | Server-side mirror of `ContactForm.tsx` |
| 6 | KV backup | Written **before** the email, keyed `demo:<prospectId>:<iso>:<uuid>`, 90-day TTL |
| 7 | Resend | Failure → 502 and a log line with the KV key. A visitor is never shown the success animation for a message nobody was notified about |

The rate limiter is KV-based and therefore approximate — a race lets a few
extra through. That is a deliberate trade against a Durable Object; the point
is a ceiling if a demo URL is found by a bot, not exact accounting.

## Environment

### Vars — in `wrangler.jsonc`, committed, not secret

| Name | Meaning |
|------|---------|
| `ALLOWED_ORIGINS` | Comma-separated exact origins. Includes localhost for local work |
| `ALLOWED_ORIGIN_SUFFIXES` | Comma-separated host suffixes, e.g. `pages.dev`. New prospect demos work without a redeploy |
| `KNOWN_PROSPECTS` | Comma-separated slugs allowed to post. **Keep in step with `clients/index.ts`** |
| `MAIL_TO` | Where demo enquiries land — your inbox |
| `MAIL_FROM` | Sender. See below |
| `MAX_UPLOAD_MB` | Server-side cap. Keep in step with `forms.maxUploadMB` |
| `PROSPECT_RATE_PER_HOUR` | Submissions accepted per prospect per hour |

### Secrets — never committed

| Name | Set with | Effect if unset |
|------|----------|-----------------|
| `RESEND_API_KEY` | `wrangler secret put RESEND_API_KEY` | No email is sent; 502 to the visitor, submission retained in KV |

### About `MAIL_FROM` on Resend's free tier

Resend will only send from a domain you have verified, with one exception:
`onboarding@resend.dev`, which needs no DNS setup at all and delivers **only to
the email address that owns the Resend account**. For a demo endpoint whose
entire job is to mail me, that is the right default and it is what ships here.

Set `MAIL_TO` to your Resend account address or nothing will arrive.

When you have a verified domain, change `MAIL_FROM` to something on it
(`demos@yourdomain.com`) and delivery to other addresses starts working. No
code change.

## Deploying

```sh
cd packages/template/worker-demo
wrangler kv namespace create SUBMISSIONS      # paste the id into wrangler.jsonc
wrangler secret put RESEND_API_KEY
wrangler deploy --dry-run                     # typechecks against workers-types
wrangler deploy
```

Then point the demo builds at it — one env var, no per-client config change:

```sh
DEMO_FORM_ENDPOINT=https://site-factory-demo-form.<subdomain>.workers.dev pnpm --filter @site-factory/template build:all
```

With `DEMO_FORM_ENDPOINT` set, every prospect's contact form goes live against
this Worker — including the ones whose own config says `forms.mode: 'disabled'`,
which is the correct setting for a mockup with nowhere to send and the wrong one
for a demo whose purpose is a form that works. Unset, nothing changes and each
client's own `forms` block governs. See `site.config.ts`.

## Typechecking

Like `../worker/`, this directory is outside the site's `astro check`. It
targets the Workers runtime and needs `@cloudflare/workers-types`, which comes
with `wrangler` per deployment rather than living in this monorepo. Its
typecheck is `wrangler deploy --dry-run`.

## Backlog

`src/lib/validate.ts` duplicates `../worker/src/index.ts`'s `validate()`
verbatim. The two must not disagree about what a valid enquiry is, and right
now nothing enforces that but a comment. Extracting one shared module is worth
doing; it was left out of this change so the single-client Worker stayed
untouched.
