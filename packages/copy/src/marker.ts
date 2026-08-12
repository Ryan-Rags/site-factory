/**
 * The one marker spelling in this repo.
 *
 * It lived in `packages/template/src/types/site.ts` first. It moved here
 * because the copy engine is what *emits* markers now, and the template is
 * what renders them — a constant should sit with the thing that produces it,
 * not the thing that displays it. `site.ts` re-exports this value under the
 * same name, so every existing `import { VERIFY_MARKER } from '../src/types/site'`
 * keeps working and keeps meaning the same string.
 *
 * There is deliberately no second spelling. A marker the gate does not know
 * about is a marker that ships: `packages/template/scripts/check-markers.mjs`
 * matches on literal text, so any new wording would sail past it and land on
 * a real business's live site under that business's name.
 *
 * `PLACEHOLDER` is not re-declared here. It is legacy, K-H-only, and the
 * regeneration in this change retires the last of it; the gate still refuses
 * it so that an old config resurrected from history cannot go live.
 */
export const VERIFY_MARKER = '[verify with client]';

/**
 * The marker plus what it is standing in for, e.g.
 * `Certifications — [verify with client]`.
 *
 * Always prefer this to the bare marker. A reader who meets a naked
 * `[verify with client]` mid-paragraph knows something is missing but not
 * what; a reader who meets `Weekend hours — [verify with client]` knows what
 * question to ask the owner, which is the entire point of the mechanism.
 */
export function marked(subject: string): string {
  return `${subject} — ${VERIFY_MARKER}`;
}
