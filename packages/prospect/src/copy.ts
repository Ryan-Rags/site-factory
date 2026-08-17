import { FabricationError, generate, type Generated } from "@site-factory/copy";

import { buildRecord } from "./record.js";
import type { ProspectConfig } from "./types.js";

/**
 * Run the copywriting engine over an ingested prospect — or explain, in one
 * line the operator will actually read, why it did not run.
 *
 * `@site-factory/copy` was built for hand-authored records: five businesses
 * whose every fact somebody had checked. Pointing it at ingested data is the
 * whole point of this module, and it is also where the two halves can fail to
 * meet. Three things can go wrong, and each degrades rather than throws:
 *
 *  1. **No pack for the niche.** The engine has three: machine shops, welding
 *     and fabrication, general contractors. A plumber gets no FAQ and no
 *     service-area section — *not* a generic one. An FAQ assembled from
 *     questions nobody has answered is worse than no FAQ, because a visitor
 *     reads an FAQ expecting the answers to be true.
 *  2. **Too thin a record.** No name, no town, no phone: there is no headline
 *     to write.
 *  3. **The fabrication guard fires.** `assertPublishable` refuses a sentence
 *     that makes a claim the record cannot source. If that happens on ingested
 *     data it is the guard doing its job on input it was not designed for, and
 *     the right response is to publish none of that copy and say so loudly —
 *     not to publish the sentences that happened to pass.
 *
 * In every case the demo is still built, from `project.ts`'s own deliberately
 * conservative copy. What is lost is the good FAQ and the town sections; what
 * is never risked is a claim nobody made.
 */

export interface CopyResult {
  /** Which pack ran, or `null` when none did. */
  pack: string | null;
  /** Absent when no pack ran or the pack answered nothing. */
  faq?: Generated["faq"];
  serviceAreas?: {
    heading: string;
    intro: string;
    towns: Generated["serviceAreas"];
    widerLine?: string;
  };
  seo?: Generated["seo"];
  pages?: Generated["pages"];
  /** Lines for the run summary and `demo.json`. Always populated. */
  notes: string[];
  /** Questions the record could not answer. Ask them on the call. */
  droppedQuestions: Generated["droppedQuestions"];
  seoWarnings: Generated["seoWarnings"];
}

export function writeCopy(prospect: ProspectConfig): CopyResult {
  const empty = (notes: string[]): CopyResult => ({
    pack: null,
    notes,
    droppedQuestions: [],
    seoWarnings: [],
  });

  const built = buildRecord(prospect);

  if (!built.ok) {
    const notes = [...built.notes];
    if (built.pack !== null && built.gaps.length > 0) {
      notes.push(
        `copy engine did not run: the ${built.pack} pack needs ` +
          `${built.gaps.map((g) => g.field).join(", ")}, and ` +
          `${built.gaps.length === 1 ? "it is" : "they are"} not available ` +
          `(${built.gaps.map((g) => g.reason).filter(Boolean).join("; ")})`,
      );
    }
    notes.push("no FAQ and no service-area section were emitted, and nothing was made up to fill them");
    return empty(notes);
  }

  let generated: Generated;
  try {
    generated = generate(built.record);
  } catch (err) {
    const why =
      err instanceof FabricationError
        ? `the fabrication guard refused a generated sentence — ${err.message}`
        : `the copy engine failed — ${(err as Error).message}`;
    return empty([
      ...built.notes,
      `copy engine aborted: ${why}`,
      `no FAQ, service-area section or generated SEO was emitted for this prospect. ` +
        `This is the guard working; the sentence it refused is the thing to look at.`,
    ]);
  }

  const notes = [...built.notes];
  const result: CopyResult = {
    pack: built.pack,
    seo: generated.seo,
    pages: generated.pages,
    notes,
    droppedQuestions: generated.droppedQuestions,
    seoWarnings: generated.seoWarnings,
  };

  // An empty list is an absent key, never an empty section. The template
  // renders nothing for an absent `faq`, and renders an empty heading with no
  // questions under it for `faq: []`.
  if (generated.faq.length > 0) {
    result.faq = generated.faq;
    notes.push(`copy: ${generated.faq.length} FAQ entries from the ${built.pack} pack`);
  } else {
    notes.push(
      `copy: the ${built.pack} pack could not answer a single question from what we know, ` +
        `so no FAQ section was emitted`,
    );
  }

  if (generated.area.towns.length > 0) {
    const areas: NonNullable<CopyResult["serviceAreas"]> = {
      heading: generated.area.heading,
      intro: generated.area.intro,
      towns: generated.area.towns,
    };
    if (generated.area.widerLine !== null) areas.widerLine = generated.area.widerLine;
    result.serviceAreas = areas;
    notes.push(
      `copy: service-area sections for ${generated.area.towns.map((t) => t.town).join(", ")}`,
    );
  } else {
    notes.push("copy: no confirmed service-area towns, so no service-area section was emitted");
  }

  if (generated.droppedQuestions.length > 0) {
    notes.push(
      `copy: ${generated.droppedQuestions.length} question(s) dropped for want of an answer — ` +
        `see demo.json, they are worth asking on the call`,
    );
  }
  for (const warning of generated.seoWarnings) {
    notes.push(
      `copy: seo.${warning.field} is ${warning.length} characters against a ${warning.budget} budget — it will be truncated in listings`,
    );
  }
  // The title-tier decisions. Separate from the warnings above because they are
  // not overruns: they are the engine narrowing a title on purpose so the
  // build's metadata gate passes, and the operator should know which of a batch
  // went out with a shorter title than the formula wanted.
  notes.push(...generated.seoNotes.map((note) => `copy: ${note}`));

  return result;
}
