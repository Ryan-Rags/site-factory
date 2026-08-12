# Shared demo form Worker

One Cloudflare Worker behind **every** prospect demo. A demo site posts the
same contact form as a real client site, plus one extra field — `prospectId`,
the build's client slug — and this Worker tags the notification email with it.

**This is a stub with placeholder ids.** It cannot deploy as written. Fill in
`MAIL_TO`, `PROSPECT_RECIPIENTS` and the KV namespace id from your own dashboard
first — in `wrangler.local.jsonc`, not here.

## Why this exists next to `../worker/`

They answer different questions.

| | `../worker/` | this one |
|---|---|---|
| Deployments | one per client | one, total |
| Delivers to | the client's inbox | whoever `prospectId` routes to, plus me |
| Origins | that client's site | every `*.pages.dev` demo |
| Knows about prospects | nothing | validates `prospectId` against a list, then routes on it |
| Form fields | one fixed shape | per prospect |
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
| 5 | Validation | Server-side mirror of `ContactForm.tsx`, against **that prospect's** field rules (`PROSPECT_FIELDS`) |
| 6 | KV backup | Written **before** the email, keyed `demo:<prospectId>:<iso>:<uuid>`, 90-day TTL, including the resolved recipient |
| 7 | Resend → the shop | Recipient resolved from `PROSPECT_RECIPIENTS`, falling back to `MAIL_TO`, plus `BCC_ALWAYS`. Failure → 502 and a log line with the KV key. A visitor is never shown the success animation for a message nobody was notified about |
| 8 | Resend → the visitor | The receipt, only when `CONFIRMATIONS_ENABLED` **and** `MAIL_FROM` is on a verified domain **and** they gave an email. It cannot change the response: the lead is already delivered |

The rate limiter is KV-based and therefore approximate — a race lets a few
extra through. That is a deliberate trade against a Durable Object; the point
is a ceiling if a demo URL is found by a bot, not exact accounting.

## Environment

### Vars — in `wrangler.jsonc`, committed, not secret

| Name | Meaning |
|------|---------|
| `ALLOWED_ORIGINS` | Comma-separated exact origins. Includes localhost for local work |
| `ALLOWED_ORIGIN_SUFFIXES` | Comma-separated host suffixes, e.g. `pages.dev`. New prospect demos work without a redeploy |
| `KNOWN_PROSPECTS` | Comma-separated slugs allowed to post. Kept in step with `clients/index.ts` by `scripts/check-form-fields.mjs` |
| `PROSPECT_RECIPIENTS` | `slug=address,slug=address`. Whose lead is whose. See below |
| `MAIL_TO` | The fallback recipient — your inbox — for every prospect with no entry above |
| `BCC_ALWAYS` | Optional. Copied on every lead, deduped against the recipient |
| `PROSPECT_FIELDS` | `slug=name!,phone,email!,…`. Per-prospect field rules. See below |
| `CONFIRMATIONS_ENABLED` | `true` sends the visitor a receipt. Inert on a `resend.dev` sender |
| `MAIL_FROM` | Sender. See below |
| `MAX_UPLOAD_MB` | Server-side cap. Keep in step with `forms.maxUploadMB` |
| `PROSPECT_RATE_PER_HOUR` | Submissions accepted per prospect per hour |

None of these is a secret, but two of them are *personal*: `PROSPECT_RECIPIENTS`
and `MAIL_TO` are inboxes, one of which may be a client's. The committed
`wrangler.jsonc` keeps `PLACEHOLDER` values and stays the readable template; the
real ones live in the gitignored `wrangler.local.jsonc` beside it, deployed with
`wrangler deploy -c wrangler.local.jsonc`.

### Secrets — never committed

| Name | Set with | Effect if unset |
|------|----------|-----------------|
| `RESEND_API_KEY` | `wrangler secret put RESEND_API_KEY` | No email is sent; 502 to the visitor, submission retained in KV |

For `wrangler dev`, put it in `worker-demo/.dev.vars` (gitignored) instead. It
never belongs in either `wrangler.jsonc`.

## Routing: whose lead is whose

Every demo used to mail one inbox, because every prospect was a pitch. The
moment a shop says yes that stops being true, and both facts have to hold on the
same deployment: their leads reach them, and yours keep reaching you.

```jsonc
"PROSPECT_RECIPIENTS": "kh-machine-works=owner@khmachineworks.example,ks-welding=simon@ks.example",
"MAIL_TO": "you@yourdomain.com",     // everyone else — still being pitched
"BCC_ALWAYS": "you@yourdomain.com"   // so a live client's leads stay visible
```

- Unknown `prospectId` is still a **422**, before any of this. Routing happens
  after that gate, so an unrecognised id can never select a recipient.
- A slug with no entry falls back to `MAIL_TO`.
- A malformed entry is skipped with a log line and the rest still route — one
  typo must not take every prospect's form down.
- `BCC_ALWAYS` is dropped when it equals the recipient, so a lead that already
  comes to you does not arrive twice.
- `check-form-fields.mjs` fails the build if a recipient key is not a known
  prospect. A typo'd key silently falls back to `MAIL_TO`: the lead survives, but
  the routing is a lie, and that is worth failing a build over.

## Per-prospect form fields

`PROSPECT_FIELDS` is the server's copy of `forms.fields` in a client's config:

```
zz-fixture-phone-optional=name!,phone,email!,message!,file
```

`!` means required, a listed field is rendered and accepted, an unlisted one is
hidden, and a prospect with no entry gets the defaults (name and message
required, phone/email as an either-or pair, service and file optional).

Two rules the Worker will not bend:

- **A submission must be impossible without a phone number or an email
  address.** Rules that would accept one are thrown away at parse time and
  replaced with the defaults, loudly. The same invariant fails the build in
  `src/lib/form-fields.ts` and in `scripts/check-form-fields.mjs`, so it should
  never reach the Worker in the first place.
- **A hidden field posted anyway is ignored, not rejected.** These sites
  register a service worker, so a phone in a workshop can hold a cached copy of
  a form built before the fields changed. The value is not validated, and it is
  not thrown away either: it goes to KV and into the notification under
  "Sent, but not asked for by this form".

## About `MAIL_FROM` on Resend's free tier

Resend will only send from a domain you have verified, with one exception:
`onboarding@resend.dev`, which needs no DNS setup at all and delivers **only to
the email address that owns the Resend account**. For a demo endpoint whose
entire job is to mail me, that is the right default and it is what ships here.

Set `MAIL_TO` to your Resend account address or nothing will arrive.

When you have a verified domain, change `MAIL_FROM` to something on it
(`demos@yourdomain.com`) and delivery to other addresses starts working. No
code change.

## The visitor's receipt, and the domain flip

Somebody types a message into a phone, taps send, sees a tick, and has no
evidence any of it happened. The receipt is that evidence: one short plain-text
message saying which shop has their enquiry and that a call is coming, with
`reply_to` set to the routed recipient so an answer reaches the shop.

It is **off by default**, and switching it on takes two things, in this order.

### 1. Verify a domain on Resend

Until this is done, `CONFIRMATIONS_ENABLED` does nothing at all. That is not a
bug: from `onboarding@resend.dev`, Resend delivers only to the Resend account
owner, so a "receipt" would reach you and never the visitor — a silent failure,
which is worse than a loud one. The Worker refuses that combination and logs
why.

1. Resend dashboard → **Domains** → **Add Domain** (e.g. `yourdomain.com`, or a
   subdomain like `mail.yourdomain.com` to keep it away from your main mail).
2. Resend shows the DNS records to create. At your DNS host, add:
   - **DKIM** — a `TXT` record (Resend gives the name and the long key value).
   - **SPF** — a `TXT` record on the sending domain, typically
     `v=spf1 include:amazonses.com ~all`. If you already have an SPF record,
     **add the include to the existing one** rather than creating a second:
     two SPF records on one name is itself a failure.
   - **MX** — only for the bounce/feedback subdomain Resend names, if it asks.
   - **DMARC** (recommended) — `TXT` on `_dmarc.yourdomain.com`, starting at
     `v=DMARC1; p=none; rua=mailto:you@yourdomain.com` so you can watch what
     happens before enforcing anything.
   Behind Cloudflare DNS, set every one of these to **DNS only** (grey cloud).
3. Wait for propagation and press **Verify** in Resend. Minutes usually, up to
   a day if your host is slow.
4. Set `MAIL_FROM` to an address on that domain — `receipts@yourdomain.com`.
   The business name is used as the display name, so it arrives as
   `"K-H Machine Works" <receipts@yourdomain.com>`.

### 2. Flip the flag

```jsonc
"CONFIRMATIONS_ENABLED": "true"
```

Then send one real enquiry through a demo and check three things: the
notification still reaches the routed inbox, the receipt reaches the address you
typed into the form, and replying to the receipt addresses the shop.

What a receipt will never do: send an SMS. Numbers collected by these forms are
for calling. And a failed receipt never turns a delivered lead into an error —
it is logged and the visitor still sees the success card, because by then the
lead is in KV and in the shop's inbox.

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

## Local testing

```sh
cd packages/template/worker-demo
cp wrangler.jsonc wrangler.local.jsonc     # then put real addresses in the copy
wrangler dev -c wrangler.local.jsonc       # http://127.0.0.1:8787
```

`wrangler dev` writes local state to `worker-demo/.wrangler/`, which is
gitignored — after any real testing it holds actual submissions. The abuse table
in `PLAN-lead-flow-2.md` is the transcript of one such run, including how to
read a stored submission back out of the local KV.

## Backlog

`src/lib/validate.ts` no longer matches `../worker/src/index.ts`'s `validate()`:
this one now takes per-prospect rules and that one is still a fixed shape. They
still must not disagree about what a valid enquiry *is*, and nothing enforces
that but a comment and this paragraph. Extracting one shared module is worth
doing and is now overdue; it stayed out of this change for the same reason as
last time — the single-client Worker is what a real client gets, and a demo-side
change has no business rewriting it.
