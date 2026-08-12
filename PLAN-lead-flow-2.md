# PLAN-lead-flow-2 — leads reach the right human

Branch: `feat/lead-flow-2`, worktree `D:/sf-lead-flow-2`. Finish = push + PR.
**No deploys. No merge.** Stop at the PR.

Goal, in one line: a lead leaves the visitor, reaches the shop that should
answer it (and me), the visitor gets told it arrived, and which fields the form
asks for stops being one hard-coded shape for every client.

---

## 0. What exists today (read, not assumed)

| Thing | State on `main` @ `c26fdd2` |
|---|---|
| `worker-demo/src/index.ts` | Origin gate → honeypot → `prospectId` ∈ `KNOWN_PROSPECTS` (else 422) → KV rate limit → `validate()` → KV write → Resend. One `MAIL_TO` for every prospect. |
| `worker-demo/src/lib/email.ts` | One send. `to: [env.MAIL_TO]`, `reply_to` the visitor, `tags: [{prospect}]`. No bcc, no second message. |
| `worker-demo/src/lib/validate.ts` | Fixed rules for everyone: `name` ≥2, `message` ≥10, phone-or-email, phone ≥10 digits, email shape, file size/type. |
| `wrangler.jsonc` | Committed with `PLACEHOLDER@example.com` / `PLACEHOLDER_KV_NAMESPACE_ID`. Real values live in gitignored `worker-demo/wrangler.local.jsonc` (see `packages/template/.gitignore`). |
| `MAIL_FROM` | `onboarding@resend.dev` — Resend's no-DNS sender, which delivers **only** to the Resend account owner. |
| `ContactForm.tsx` | One fixed field set: name, phone, email, service, message, file. Client validation mirrors the Worker's. |
| `contact.astro` | The only page that renders a form. Home page (`index.astro`, legacy path) and `CtaBand.astro` have buttons and `tel:` links, no form. |
| K-H | `kh-machine-works` carries a **derived** `design` block (`designFor(...)`), so its home renders `DesignHome`, not the legacy composition. Confirmed at `clients/kh-machine-works.config.ts:328`. |
| Byte-lock | `clients/EQUIVALENCE.md` pins `dist/kh-machine-works` output. Anything added here must be *off by default* or K-H's proof breaks. |
| Gates | `astro check`, `check-markers`, `check-contrast`, `check-contact-links`, `check-overflow`. `wrangler deploy --dry-run` is the Worker's only typecheck (no `@cloudflare/workers-types` in the lockfile). |

**Correction to my own reading of the task:** K-H is a *design-family* build, not
the legacy one. So "K-H demo shows the home quick-form" means the quick form has
to render in the **design** home path (`DesignHome.astro`), not only in
`index.astro`. Both paths get it — see §4.

---

## 1. Per-prospect routing (`worker-demo`)

New `src/lib/routing.ts`:

```ts
parseRecipients(value: string): Map<string, string>   // "slug=a@x.com,slug2=b@y.com"
routeFor(prospectId, env): { to: string; bcc: string[] }
```

- New var `PROSPECT_RECIPIENTS` — comma-separated `slug=address` pairs. A string,
  not a JSON object var, so the gate script in §3 can read it out of a `.jsonc`
  file with comments in it without a JSONC parser (no new dependency).
- Unknown/absent slug → `MAIL_TO`. A malformed entry is skipped with a
  `console.error`, never silently swallowed, and never fails the request: a lead
  going to my inbox instead of the client's is recoverable, a dropped lead is not.
- New var `BCC_ALWAYS` — optional, mine. Deduped against the resolved `to`, so
  once I am also the recipient the mail does not arrive twice.
- **One address per prospect.** Multi-recipient (`a@x|b@x`) is deliberately not
  built; nobody has asked for two people on one shop's leads, and the parser gets
  a second delimiter the moment they do.
- Unknown `prospectId` still 422, unchanged. Routing happens *after* that gate,
  so an unknown prospect can never reach a recipient at all.
- Committed `wrangler.jsonc` gets `PLACEHOLDER` addresses, exactly like `MAIL_TO`
  today. **My real gmail goes in `wrangler.local.jsonc` only** — gitignored, and
  a personal address is client-ish data that does not belong in a public file.
- `email.ts` takes the resolved `{to, bcc}` instead of reading `env.MAIL_TO`.
  Subject and `reply_to` (the visitor) unchanged.

## 2. Visitor confirmation, behind a flag

New `src/lib/confirm.ts`, called after the notification send, never before.

Sends only when **all** hold:
1. `CONFIRMATIONS_ENABLED` is `true`/`1`,
2. `MAIL_FROM`'s domain is not `resend.dev` (i.e. not the `onboarding@` sender —
   from that address Resend delivers to the account owner only, so a "receipt"
   to a visitor would silently never arrive),
3. `RESEND_API_KEY` is set,
4. the visitor actually gave an email address, and it passed validation,
5. the notification to the shop succeeded.

Shape: short, plain text, no images, no tracking.

- from: `<Business Name> <address-from-MAIL_FROM>` — display name from the
  submitted `prospectName`, address parsed out of `MAIL_FROM` so a `Name <addr>`
  value there does not double up.
- subject: `Thanks — <Business> got your message`
- body: three lines. "Thanks <name> — <Business> has your message and will call
  you soon." + when it was received + "reply to this email if you need to add
  anything."
- `reply_to`: **the routed recipient** from §1, so a reply lands with the shop.
- No phone number in the receipt. The Worker does not know the shop's number and
  I am not taking one from the posted form to interpolate into outbound mail.
- **No SMS. Anywhere.** Numbers collected here are for calling.
- A failed confirmation is logged and ignored: the lead is already delivered and
  the visitor already saw the success card. It must never turn a delivered lead
  into a 502.
- Rate limiting: the existing per-prospect hourly cap already bounds this — the
  confirmation cannot be sent more often than a submission is accepted.

`worker-demo/README.md` gains a section: verifying a domain on Resend (SPF/DKIM
records, waiting for verification), swapping `MAIL_FROM`, then flipping
`CONFIRMATIONS_ENABLED` — and the explicit statement that the flag does nothing
while `MAIL_FROM` is `onboarding@resend.dev`.

## 3. Per-client form schema

### Config (`src/types/site.ts`)

```ts
export type FormFieldName = 'name' | 'phone' | 'email' | 'service' | 'message' | 'file';
export type FormFieldRule = 'required' | 'optional' | 'hidden';

export interface Forms {
  // ...existing
  /** Absent → the historical field set, unchanged. */
  fields?: Partial<Record<FormFieldName, FormFieldRule>>;
}
```

Optional, and absent it resolves to exactly today's behaviour
(`name: required, message: required, phone/email: either-or, service/file:
optional`). That is what keeps the K-H byte-lock intact and costs the other
seven configs nothing.

### The invariant

> No configuration may produce a lead nobody can answer.

Resolved rules are legal iff a valid submission is **impossible** without at
least one of phone/email. Concretely:

| phone | email | verdict |
|---|---|---|
| optional | optional | **legal** — the "either/or" rule applies, as today |
| required | anything | legal |
| anything | required | legal |
| optional | hidden | **illegal** — a lead with neither is submittable |
| hidden | hidden | illegal |
| hidden | optional | illegal |

Enforced in three places, because one is not enough:
1. `src/lib/form-fields.ts` — `resolveFields()` throws at build time with the
   client slug and the offending pair.
2. `scripts/check-form-fields.mjs` — a new gate (below).
3. `worker-demo/src/lib/fields.ts` — an illegal per-prospect rule set is
   **rejected and replaced with the default rules**, with a `console.error`. Fail
   closed toward a contactable lead, never open.

### The Worker's copy

New var `PROSPECT_FIELDS`, one string:

```
kts-machine-shop=name!,email!,phone,service,message!,file
```

`!` = required, listed = rendered/accepted, absent = hidden. A prospect not
listed uses the default rules. `validate()` becomes
`validate(form, maxBytes, rules)`.

Hidden fields are **ignored, not rejected** — a phone cached the old page from a
service worker and posting a stale field set must not 422 in front of a
customer. A non-empty hidden field is still written to KV and still appears in
the notification body under `(not asked for by this form)`, because a human typed
it and it may be the only way to reach them.

### The gate — `scripts/check-form-fields.mjs`

Same technique as `check-contact-links.mjs` (regex over the TS configs; Node
cannot import them). Fails the build when:
- any client's resolved rules break the invariant;
- a client's `forms.fields` and the Worker's `PROSPECT_FIELDS` disagree — the
  two are separate files and nothing but this check keeps them honest;
- a `PROSPECT_RECIPIENTS` key is not in `KNOWN_PROSPECTS` (a typo'd key silently
  falls back to `MAIL_TO`: the lead survives, the routing is a lie);
- `KNOWN_PROSPECTS` is missing a slug in `clients/index.ts`.

Runs over the committed `wrangler.jsonc` and, when present, the gitignored
`wrangler.local.jsonc` — the second is the one that actually deploys. Wired into
`pnpm --filter @site-factory/template build` and its own `check:form-fields`
script.

### `ContactForm.tsx`

Takes `fields: ResolvedFields` and renders from it. Labels gain/lose the `*`
from the rules rather than from hard-coded markup; the "either/or" hint under
email only renders when the either/or rule is in play; client validation reads
the same resolved rules the Worker will apply.

## 4. Quick-quote block

`forms.quickQuote?: { enabled: boolean; heading: string; blurb?: string;
buttonText: string; placements: ('home' | 'cta')[] }` — absent or
`enabled: false` renders nothing at all, which is every existing client until a
config opts in.

Not a second component with a second copy of the submit logic. `ContactForm`
gains `layout: 'full' | 'compact'`; the quick block is that component with a
reduced field set and a one-row layout. One validation path, one fetch, one
success state — a divergence between a "quick" form and the real one is exactly
the bug this repo keeps designing against.

Its fields are **derived, not configured**: name, the client's own contact
channel(s) per §3, and a one-line message. It therefore inherits the invariant
rather than being able to violate it — a phone-optional/email-required client's
quick form asks for email, not phone.

Placements:
- `home` — legacy path: a section in `index.astro` after `TrustStrip`. Design
  path: a section in `DesignHome.astro`, rendered in the design family's own
  styling, before the footer. K-H is the design path.
- `cta` — inside `CtaBand.astro` (legacy) and the design families' CTA area,
  beside the existing buttons, not replacing them.
- Posts to the same endpoint with the same `prospectId`/`prospectName`.
- **Sticky call bar untouched**, per the brief.

Only the demo prospect(s) named in §6 get `quickQuote.enabled: true` in this
pass, so no other client's built output moves.

## 5. Abuse table re-run

`wrangler dev` + curl, transcript appended to this file. Every existing row from
`PLAN-demo-support.md` re-run (routing changed the code path they cover), plus:

| New case | Expected |
|---|---|
| known prospect with a recipient mapped | 200, `to` = that address |
| known prospect with **no** mapping | 200, `to` = `MAIL_TO` |
| `BCC_ALWAYS` set, different from `to` | 200, bcc present once |
| `BCC_ALWAYS` set, equal to `to` | 200, no duplicate bcc |
| malformed `PROSPECT_RECIPIENTS` entry | 200, entry skipped + logged, others still route |
| unknown prospect | 422 `unknown_prospect`, no send attempted |
| phone-optional prospect, email only | 200 |
| phone-optional prospect, phone only, no email | 422 `validation_failed {email}` |
| phone-optional prospect, neither | 422 `validation_failed` |
| field hidden for that prospect but posted anyway | 200, value carried into the body, not validated |
| illegal rule set for a prospect | falls back to default rules + logged, submission still contactable |
| `CONFIRMATIONS_ENABLED` off | one send only |
| on, `MAIL_FROM=onboarding@resend.dev` | one send only (flag inert, logged) |
| on, verified-domain `MAIL_FROM`, visitor gave email | two sends; receipt `reply_to` = routed recipient |
| on, verified domain, visitor gave phone only | one send |
| confirmation send fails | still 200 — the lead was delivered |

## 6. Acceptance mapping

| Ask | How it is shown |
|---|---|
| K-H demo shows the home quick-form | `kh-machine-works` gets `quickQuote.enabled` + `placements: ['home','cta']`, built and screenshotted |
| routes to my gmail | `PROSPECT_RECIPIENTS` entry in `wrangler.local.jsonc`, proved by the dev transcript (address redacted in the committed transcript) |
| second prospect, phone-optional, validated server-side | `kts-machine-shop`: `phone: 'optional', email: 'required'` |
| confirmation exercised in dev with the flag on | see the question below |
| README covers the domain flip | `worker-demo/README.md` |

## 7. Deliberately not done

- The single-client `worker/` is untouched, again. Its `validate()` still
  duplicates the demo one; that de-duplication is already in the demo README's
  backlog and doing it here would drag a real client's Worker into a demo change.
- No new dependency, no lockfile change, so still no true `tsc` for the Workers
  (`wrangler deploy --dry-run` remains the typecheck).
- No multi-recipient routing (§1).
- No Turnstile changes.
- No deploys, no PR merge.

## 8. Ownership + shared files

This stream writes under `packages/template/**`, which the stream table assigns
to `feat/template`. `feat/demo-support` already crossed the same line for the
same reason (the demo Worker lives in that package). Stated, not assumed away —
whoever merges will need the grant.

Shared files touched: **`packages/template/package.json`** (one new gate script
+ the build chain) and **`packages/template/.gitignore`** (add
`worker-demo/.dev.vars`, so a local Resend key for `wrangler dev` cannot be
committed). Neither is on CLAUDE.md's shared list — that list names *root*
`package.json` and *root* `.gitignore` — but both are flagged here and will be in
the PR body. Root configs, lockfile, `clients/*` for non-demo clients and
`scripts/deploy/**` are untouched. `pnpm install --frozen-lockfile` in the
worktree, so the lockfile cannot move.

Self-merge is off the table regardless: the diff touches
`packages/template/src/types/**`, which condition 2 of the merge policy names.
Stop at the PR.

---

## Questions before I write code

1. **Resend.** Do you have a verified domain on Resend yet, and if so what
   from-address should the receipt use? And may I use a real `RESEND_API_KEY`
   locally to send one or two test confirmations to your own address?
   - **If yes** — I put the key in gitignored `worker-demo/.dev.vars`, send two
     real messages, and the transcript shows a real receipt.
   - **If no / no answer** — I run the table with an invalid key and a
     verified-*looking* `MAIL_FROM`. That proves the gating logic and the payload
     the second call would carry, and I will write in the transcript, plainly,
     that no confirmation was actually delivered rather than implying it was.
     This is my default so I am not blocked.
2. **Second prospect.** I have picked `kts-machine-shop` for the phone-optional
   demonstration, which changes what that prospect's demo form asks for. Say so
   if you would rather it were a different shop, or a throwaway ninth config that
   nobody pitches.

Everything else I have decided and stated above. Say go and I will build it.
