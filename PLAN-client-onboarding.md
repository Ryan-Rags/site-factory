# PLAN — client onboarding intake

**Stream:** `docs/client-onboarding` · docs only · no code, no gates touched.

## Goal

One file, `docs/client-onboarding.md`: everything we have to get from a client
between "yes" and the first real build. Written to be usable two ways without
being written twice — read aloud on a call, or pasted into a Google Form.

## Shape

Five sections, in the order the prompt names them:

1. **Business facts** — the evidence the fabrication guard needs. Every field
   the copy engine can print under the client's name, phrased as the question
   that clears it (`unconfirmed()` already stores questions this way). Plus the
   standing rule: the client's `REPORT.md` block is read out in this same call.
2. **Photos** — the slots in `packages/template/README.md` step 5, in plain
   words, with the honesty constraints that attach to gallery and before/after.
3. **Access & accounts** — registrar and who actually controls it, GBP, review
   link / Place ID. Hands off to `go-live.md`, does not restate it.
4. **Preferences** — family/scheme/accent captured by the customizer URL, pages
   wanted, and anything they insist the site says (which goes through the
   evidence rule like everything else).
5. **Plan + billing contact.**

## Constraints held

- **Never fabricate.** The doc names no plan tier and no price, because the repo
  holds neither. Section 5 ships the capture fields with the tier list left as
  an explicit blank for Ryan to fill once. Inventing "Starter/Pro" here would be
  the fabrication guard defeated in the one file that exists to enforce it.
- **No client data.** Every example is a fixture slug or an invented value.
- **Cross-references, not copies.** Registrar/DNS/GBP mechanics live in
  `go-live.md`; this file collects the *answers* that step needs and links.
- Marker spelling is `[verify with client]`, one repo-wide.

## Ownership

Granted: `docs/client-onboarding.md`. Plus `docs/decisions.md` (append-only, the
one ruling this stream settles) — named in the PR as expected, not cross-boundary.

## Gates

Docs-only diff. `pnpm build:all` / typecheck run anyway on the merged state, to
show the change is inert.
