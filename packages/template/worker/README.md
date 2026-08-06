# Contact form Worker

Cloudflare Worker that receives the contact form POST from the site, backs the
submission up to KV, and emails it via [Resend](https://resend.com).

**This is a stub with placeholder ids.** It cannot deploy anywhere as written —
`wrangler deploy` rejects the `PLACEHOLDER_*` values rather than publishing to
somebody else's account. Fill them in from your own dashboard first.

> This directory is deliberately excluded from the site's `astro check` (see
> `../tsconfig.json`). It targets the Workers runtime, not the browser, and
> needs `@cloudflare/workers-types` — which is a dependency of `wrangler`,
> installed per deployment rather than in this monorepo. Run `wrangler deploy
> --dry-run` for its own typecheck.

## What it does, in order

| # | Step | Notes |
|---|------|-------|
| 1 | Method + `Origin` check | Any origin not in `ALLOWED_ORIGINS` gets a 403 and no CORS headers |
| 2 | Honeypot | A filled `company` field returns `200 {ok:true}` so the bot does not retry |
| 3 | Field validation | Server-side mirror of the client rules. The client copy is a courtesy; this one counts |
| 4 | Turnstile | **Placeholder** — see below |
| 5 | KV backup | Written **before** the email, so a mail outage never loses a lead |
| 6 | Resend send | Failure returns 502 and logs the KV key — we never tell a customer it arrived when nobody was notified |

## Turnstile is a deliberate placeholder

`verifyTurnstile()` contains the real `siteverify` call, correctly written. It
is short-circuited on the first line while `TURNSTILE_SECRET_KEY` is unset:

```ts
if (!env.TURNSTILE_SECRET_KEY) return true; // <-- the short-circuit
```

That means a fresh deployment works before the captcha is configured. Set the
secret and verification becomes live with no code change. On a Turnstile
outage the function **fails open** and relies on the honeypot — a comment in
the source marks the one line to change if you would rather fail closed and
lose real submissions during an outage.

## Environment

### Vars — in `wrangler.jsonc`, not secret, committed

| Name | Meaning |
|------|---------|
| `ALLOWED_ORIGINS` | Comma-separated origins allowed to POST. Include `http://localhost:4321` for local work |
| `MAIL_TO` | Where enquiries are delivered — the client's inbox |
| `MAIL_FROM` | Sending address on a domain verified in Resend |
| `MAX_UPLOAD_MB` | Server-side upload cap. Keep in step with `forms.maxUploadMB` in `site.config.ts` |

### Secrets — never committed, never in any file in this repo

| Name | Set with | Effect if unset |
|------|----------|-----------------|
| `RESEND_API_KEY` | `wrangler secret put RESEND_API_KEY` | No email is sent; the Worker returns 502 and the lead stays in KV |
| `TURNSTILE_SECRET_KEY` | `wrangler secret put TURNSTILE_SECRET_KEY` | Turnstile verification is skipped (see above) |

### Bindings

| Binding | Type | Required | Purpose |
|---------|------|----------|---------|
| `SUBMISSIONS` | KV namespace | yes | Backup copy of every submission, 2-year TTL |
| `UPLOADS` | R2 bucket | no | Keeps the uploaded photo itself. Without it, only the file's metadata is retained and the bytes go out with the email alone |

## Deploying

```sh
npm install -g wrangler         # or: npx wrangler@latest
wrangler login

# 1. Create the KV namespace and paste the id into wrangler.jsonc
wrangler kv namespace create SUBMISSIONS

# 2. Optional: create the R2 bucket, then uncomment r2_buckets in wrangler.jsonc
wrangler r2 bucket create your-contact-uploads

# 3. Fill in name, ALLOWED_ORIGINS, MAIL_TO, MAIL_FROM in wrangler.jsonc

# 4. Set the secrets — these are prompted for, never typed into a file
wrangler secret put RESEND_API_KEY
wrangler secret put TURNSTILE_SECRET_KEY

# 5. Ship it
wrangler deploy
```

Then paste the deployed Worker URL into `forms.workerEndpoint` in
`../site.config.ts` and rebuild the site. While that field is empty the form
validates client-side and tells the visitor to call or email instead.

## Local development

```sh
wrangler dev            # http://localhost:8787
```

Point `forms.workerEndpoint` at `http://localhost:8787` and run `pnpm dev` in
the package root. `ALLOWED_ORIGINS` already includes `http://localhost:4321`.

`wrangler dev` writes local state to `worker/.wrangler/`, which is gitignored.

## Data handling

- Submissions carry customer contact details. They live in KV with a two-year
  TTL — long enough to be a real backup, short enough that we are not holding
  personal data indefinitely.
- Nothing in this directory should ever contain a real key, id, inbox address
  or customer record when committed. `wrangler.jsonc` is committed;
  `wrangler secret` values are not.
