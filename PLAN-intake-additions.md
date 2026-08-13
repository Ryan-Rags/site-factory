# PLAN — intake additions

Docs only. Three additions across two files, all of them things the repo could
not have invented for itself and that Ryan has now supplied.

Branch: `docs/intake-additions`, worktree `D:\sf-intake-additions`, off `main`
at `13eefe5`.

## Granted paths

- `docs/client-onboarding.md` — §2 and §5 only
- `docs/go-live.md` — one new handoff step

Nothing else. No code, no template edits, no config.

---

## 1. `client-onboarding.md` §5 — the plan table

The table currently ships with blank rows and an HTML comment saying who fills
them, per the ruling of 2026-08-13 (`docs/decisions.md`, PR #39 Brief 1): *"the
blank is filled once, by Ryan, in a later edit."* This is that edit.

Two plans, stated as Ryan's prices, in his terms, with nothing added:

- **A** — $3,000 one time. Year one fully included: hosting, SSL, security,
  domain, up to 2 content edits/month, Google Business Profile kept in sync,
  support by text. Then an optional $99/month care plan.
- **B** — $500 deposit + $200/month, the same inclusions. Six-month minimum,
  then cancel any time. Price locked for 24 months.

No third tier, no "from", no anchor pricing, and no invented consequence for
declining the care plan — he did not say what that is, so the document does not
say either. The HTML comment goes, because its instruction has been carried out.

**Ledger consequence, and it is the one judgment item in this stream.** The
2026-08-13 line above says *"`docs/client-onboarding.md` names no plan tier and
no price"*, and after this edit that sentence is false. `docs/decisions.md` is
append-only, so the fix is a new dated line, never an edit to the old one —
but `docs/decisions.md` is not a granted path here and the task says nothing
beyond the two files. Carried to the PR's Decision Brief with the exact line
drafted, rather than written unasked. This alone holds the PR out of the green
lane.

## 2. `client-onboarding.md` §2 — "No photos?"

A new final subsection of §2, after the existing "not there yet" paragraph,
which it elaborates. Five points, in Ryan's order:

1. Default offer: Ryan shoots them at the walk-in/handoff — ~10 minutes of phone
   shots: exterior, workspace, 3–5 work examples, team if willing.
2. Their Google Business photos may seed the build, but each one is
   owner-confirmed or swapped before go-live. This is the existing attribution
   ruling of 2026-08-11 applied, not a new rule: Places photos are ingested and
   not published because no component renders a visible credit near an image.
   Owner confirmation is what converts one into a photo we may publish.
3. Real stock for atmosphere only — never standing in for their shop, team or
   work.
4. AI imagery only for abstract backgrounds and textures. Never the trade, the
   shop, a tool, a part or a person.
5. Nothing at all → the site ships text-forward with `features.gallery: false`,
   which the template README confirms emits no gallery HTML and no nav link. No
   placeholder hole ever goes live.

Existing §2 prose is not rewritten. Point 5 is worded so it reconciles with the
paragraph above it rather than contradicting it: placeholders are a mockup
state, and go-live is where they stop being one.

## 3. `go-live.md` — the handoff step

New `## 8. Handoff: send a test lead from the owner's machine`, inserted before
"After launch", which renumbers to `## 9`. Checked: no internal cross-reference
and no file in the repo cites a go-live section number above 5, so the
renumbering breaks nothing.

Three steps: submit a test lead together on the owner's machine; if it lands in
spam, mark Not Spam and add a filter (`from: mail.raghubans.com` → inbox, label
"Website Leads"); confirm reply-to reaches the owner's inbox.

**One thing verified rather than assumed.** "Confirm reply-to reaches the
owner's inbox" is written against what the Workers actually send:
`worker/src/index.ts` and `worker-demo/src/lib/email.ts` both set the lead
notification's `reply_to` to the address the *form* carried, and only when one
was given. So the step is written as: the owner submits the test lead under
their own email, then hits Reply on the notification and confirms it arrives
back in their own inbox — which is exactly what proves the header is wired, and
also warns that a test lead submitted with no email address proves nothing
about reply.

---

## Gates

Docs-only, but the full suite runs on the merged state regardless — the rule is
that green pre-merge does not count, and "docs cannot break a gate" is the kind
of assumption that is right until `check:links` reads a docs path.

- `pnpm -r typecheck`
- `pnpm test`
- `pnpm --filter @site-factory/template build:all` (the whole per-client chain)

## Not doing

- No `docs/decisions.md` line (see §1 — Brief item).
- No rewrite of existing §2 or §5 prose beyond the stated additions.
- No issue filed: nothing here is a defect, and the ledger item is a ruling for
  the Brief, not a queue item.
