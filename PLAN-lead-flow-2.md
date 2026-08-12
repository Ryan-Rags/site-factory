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

---

# Execution record

Approved 2026-08-12 with both questions answered:

1. **Resend** — the domain verification is in progress on Ryan's side. Proceed
   with the stated default: no real key is handled by me at any point, a
   verified-*looking* `MAIL_FROM` (`receipts@DOMAIN_TBD.test`) proves the gate
   and the payload, and **no receipt was delivered to anyone**. When the domain
   verifies, Ryan sets `MAIL_FROM`, flips `CONFIRMATIONS_ENABLED` and runs the
   live end-to-end receipt himself from the deployed demo. Key custody is his.
2. **Second prospect** — a throwaway ninth config, `zz-fixture-phone-optional`,
   not KTS. The five pitchable demos stay uniform. It is in `KNOWN_PROSPECTS`
   with a comment marking it a fixture, and it is never deployed.

## What changed from the plan while building it

- **The quick block's contact fields are narrowed, not inherited wholesale.**
  The plan said the compact form inherits the client's contact rules. Rendering
  *both* halves of an either/or pair in a "quick" block makes it most of a
  contact form again, so `quickFields()` collapses the pair to a **required
  phone number** and hides the other field. It can only tighten what is asked
  for, never loosen it, so a legal rule set stays legal — and there is an
  assertion in the function saying so. For a client with asymmetric rules (the
  fixture: email required, phone optional) the quick block asks for the email
  and drops the phone.
- **The honeypot was invisible-by-Tailwind.** `className="hidden"` is a
  Tailwind utility, and a design-family page does not load Tailwind — only
  `BaseLayout` imports `global.css`. On the contact page that was fine, because
  the contact page is a base-layout page; putting the island on a design-family
  home page would have rendered the honeypot **on screen**, asking a real
  customer for their company and then discarding their message when they
  answered. Fixed with the native `hidden` attribute alongside the class.
- **`design.css` gained a `.d-quick` block** for the same reason: the island's
  Tailwind classes are inert on a design page, and the block would otherwise
  render as browser defaults in the middle of a pitch demo.
- **A ninth config broke two Node-side gates' assumptions**, both about configs
  that inherit via spread. `check-form-fields.mjs` follows the spread. The
  pre-existing `check-contact-links.mjs` does not — see "Flagged" below.
- **`build-all.mjs` skips `zz-fixture-*`.** `scripts/deploy/deploy-mockups.mjs`
  publishes every directory under `dist/`, so keeping the fixture out of `dist/`
  during a batch build is what makes "never deployed" a property of the pipeline
  rather than a note in a README.

## Gates

| Gate | Result |
|---|---|
| `astro check` | 0 errors, 0 warnings, 4 hints (all pre-existing) |
| `pnpm build:all` | 8/8 clients built and checked (fixture skipped, by design) |
| `check-markers.mjs` (per client, in the batch) | pass |
| `check-contrast.mjs` | 240 checks passed (WCAG AA) |
| `check-form-fields.mjs` (new) | pass over 9 configs + both wrangler configs |
| `check-contact-links.mjs` — fixture build | pass |
| `check-contact-links.mjs --all` | **fails, pre-existing** — see Flagged |
| `wrangler deploy --dry-run` | bundles clean, 39.08 KiB / gzip 10.65 KiB |

The fixture builds on its own and passes every per-client gate:

```
SITE_CLIENT=zz-fixture-phone-optional pnpm --filter @site-factory/template build
✓ 9 client(s): every form keeps a contact channel, and worker-demo/wrangler.jsonc agree with them.
✓ zz-fixture-phone-optional: noindex build — no markers.
✓ 240 contrast checks passed (WCAG AA).
✓ zz-fixture-phone-optional: every page taps through to tel:+15550100199, no sms link
```

### The new gate, caught doing its job

The first `wrangler.local.jsonc` written for the dev run had a deliberately
malformed routing entry in it. The gate refused the build:

```
✗ worker-demo/wrangler.local.jsonc: PROSPECT_RECIPIENTS entry "broken-entry-no-address" is not slug=address
1 problem(s) in the form field rules.
```

That is the negative test for the routing half. The runtime's skip-and-continue
behaviour for the same input is proved against the module below, since the gate
will not let a config carrying one reach a build.

## Abuse table — `wrangler dev -c wrangler.local.jsonc`, probed with curl

Every row from `PLAN-demo-support.md` was re-run (routing changed the code path
they cover), plus the new ones. `RESEND_API_KEY` was deliberately **not set**,
so no request left the machine and a valid submission stops at the mail step
with a 502 — the same shape as the previous transcript. Recipients are
stand-ins on `.test`.

| Case | Expected | Got |
|---|---|---|
| Origin `https://attacker.example` | 403 | 403 `origin_not_allowed` |
| Origin `https://evil.pages.dev.attacker.com` | 403 | 403 `origin_not_allowed` |
| Origin `http://kh-preview.pages.dev` (no TLS) | 403 | 403 `origin_not_allowed` |
| Origin `https://kh-preview.pages.dev` (suffix ok) | past the gate | 422 `unknown_prospect` |
| `prospectId=not-a-client` | 422 | 422 `unknown_prospect` |
| no `prospectId` | 422 | 422 `unknown_prospect` |
| `prospectId=../../etc` | 422 | 422 `unknown_prospect` |
| honeypot `company` filled | 200 (bot believes it worked) | 200 `{ok:true}` |
| kh: 2-character message | 422 | 422 `validation_failed {message}` |
| kh: no phone and no email | 422 | 422 `validation_failed {contact}` |
| kh: 5-digit phone | 422 | 422 `validation_failed {phone}` |
| kh: valid, phone only | past validation | 502 `delivery_failed` |
| kh: valid, email only | past validation | 502 `delivery_failed` |
| **kh (mapped recipient)** | routes to the mapped inbox | `Email not sent to kh-owner@example.test … retained in KV` |
| **ks-welding (mapped)** | routes to its own inbox | `Email not sent to ks-owner@example.test …` |
| **kts-machine-shop (unmapped)** | falls back to `MAIL_TO` | `Email not sent to fallback-inbox@example.test …` |
| **fixture: email only** | accepted | 502 `delivery_failed` (past validation) |
| **fixture: phone only, no email** | 422 | 422 `validation_failed {email}` |
| **fixture: neither** | 422 | 422 `validation_failed {email}` |
| **fixture: `not-an-address`** | 422 | 422 `validation_failed {email}` |
| **fixture: hidden `service` posted anyway** | accepted, value kept | 502 (past validation), `extras.service` in KV |
| 21st submission in an hour | 429 | 429 `rate_limited` (19th and 20th: 502) |
| different prospect, same hour | unaffected | 502 (i.e. past the limiter) |

The stored submission for the hidden-field row, read back out of the local KV —
note `service: ""` among the collected fields, the value preserved under
`extras`, and the resolved recipient recorded with the lead:

```
$ wrangler kv key get "demo:zz-fixture-phone-optional:…" --binding SUBMISSIONS --local -c wrangler.local.jsonc
{"prospectId":"zz-fixture-phone-optional","prospectName":"zz-fixture-phone-optional",
 "name":"Bob","phone":"","email":"bob@example.test","service":"",
 "message":"Testing the asymmetric rules","file":null,
 "extras":{"service":"welding"},"receivedAt":"2026-08-12T18:22:21.997Z",
 "userAgent":"curl/8.15.0","country":"","origin":"http://localhost:4321",
 "routedTo":"fallback-inbox@example.test"}
```

## Confirmation path — exercised against the modules, not over the wire

`wrangler dev` cannot reach step 8 without a live Resend key, because step 7
fails first and correctly short-circuits. So the receipt was exercised by
importing the **real** modules (`node --experimental-strip-types`) with `fetch`
stubbed to capture the payload. **No confirmation email was delivered to
anybody, and no Resend API key was handled at any point.**

| Case | Result |
|---|---|
| flag off, verified sender | skip — `CONFIRMATIONS_ENABLED is off` |
| flag on, `onboarding@resend.dev` | skip — resend.dev delivers only to the account owner |
| flag on, `a@mail.resend.dev` | skip — the subdomain is caught too |
| flag on, no API key | skip — `RESEND_API_KEY is not set` |
| flag on, verified sender, visitor gave no email | skip — `the visitor gave no email address` |
| flag on, verified sender, visitor gave email | **SEND** |
| flag on, `MAIL_FROM` carries a display name | **SEND** (address parsed out, no doubling) |

Captured payloads:

```
notification to          | ["kh-owner@example.test"]
notification bcc         | ["always-bcc@example.test"]
notification reply_to    | visitor@example.test          (the visitor)
notification subject     | [DEMO kh-machine-works] K-H Machine Works — Bob Fixture

receipt from             | "K-H Machine Works" <receipts@DOMAIN_TBD.test>
receipt to               | ["visitor@example.test"]
receipt reply_to         | kh-owner@example.test         (the routed shop, not the sender)
receipt subject          | Thanks — K-H Machine Works got your message
receipt body             | Thanks, Bob — K-H Machine Works has your message.
                         |
                         | Someone will call you back soon. If you need to add anything, just reply to
                         | this email and it goes straight to them.
                         |
                         | — K-H Machine Works
```

Routing, the same way:

```
route for kh-machine-works              | kh-owner@example.test (map), bcc ["always-bcc@example.test"]
route for kts-machine-shop (unmapped)   | fallback-inbox@example.test (fallback)
BCC_ALWAYS equal to the recipient       | []            (deduped, no double delivery)
malformed entry skipped, others survive | kh-machine-works, ks-welding
```

Two fail-closed paths, also from the modules:

```
PROSPECT_FIELDS[bad-shop]: phone=optional email=hidden would accept a lead with no way
to reply — falling back to the default field rules.
bad-shop resolved to: {"name":"required","phone":"optional","email":"optional",
                       "service":"optional","message":"required","file":"optional"}
```

```
business name "Evil\r\nBcc: attacker@example.test <x>"
  → from: "\"Evil Bcc: attacker@example.test x\" <receipts@DOMAIN_TBD.test>"
```

The business name arrives on the form, so it is visitor-reachable input that
ends up in a subject line and in a sender's display name. CR/LF and every other
control character are stripped, the length is capped, and the display name is
emitted as a quoted string.

## Built output

- **K-H home page** — two quick blocks, as configured (`placements: ['home',
  'cta']`): one after the hero, one above the footer, both rendered through
  `DesignHome` because K-H carries a design block. Each asks for name, phone
  and one line; email is hidden because the either/or pair collapses to a
  required phone in the compact layout. Fields present in
  `dist/kh-machine-works/index.html`: `company` (honeypot), `name`, `phone`,
  `message` — twice.
- **Fixture home page** — one quick block, fields `name`, `email`, `message`.
  No phone field at all, derived from that config's own rules.
- Every other client's home page is unchanged: no config opts in, so nothing
  renders — not an empty section, nothing.

## Flagged for Ryan

1. **`check-contact-links.mjs --all` fails, and did before this branch.** It
   regexes a `business:` block out of each config, and the three design-family
   comparison builds (`ks-welding-forge` / `-precision` / `-heritage`) have none
   — they are `{ ...ksWelding, … }`. So `--all` has been broken since the design
   families landed; per-client runs, which is what `pnpm build` does, are fine.
   The fix is the spread-following logic already written in
   `check-form-fields.mjs`. Not done here: that gate belongs to another stream,
   and quietly editing gate scripts is what the merge policy asks me not to do.
2. **A fixture build left in `dist/` would be deployed.** `build:all` skips it,
   but if you build the fixture by hand and then run `deploy:mockups`, that
   script publishes every directory under `dist/`. Either remove
   `dist/zz-fixture-phone-optional` first, or grant a one-line skip in
   `scripts/deploy/deploy-mockups.mjs` — I did not touch that file.
3. **Existing clients' built HTML moved slightly** even where behaviour did not:
   the contact page's island props are now spread from one object so their
   serialised order changed, and the honeypot gained a `hidden` attribute.
   `clients/EQUIVALENCE.md` is a record of the refactor at the commit it landed
   rather than an automated gate, so nothing fails — but K-H's bytes are no
   longer identical to that table's, and this is the change that did it.
4. **The two `validate()` copies have now genuinely diverged** (per-prospect
   here, fixed-shape in `../worker/`). The backlog entry is updated to say so.

## Deliberately not done

- The single-client `worker/` is untouched.
- No new dependency, no lockfile change, so still no true `tsc` for the Workers.
- No multi-recipient routing (one address per prospect).
- No Turnstile changes, no sticky-call-bar changes, no SMS anywhere.
- No deploys. No merge. Stop at the PR.
