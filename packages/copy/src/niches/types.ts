/**
 * What a niche pack is.
 *
 * A pack holds the things that are true of a *trade* rather than of a
 * business: what the work is called, what a customer of that trade is
 * actually worried about, and what they need to bring to get a useful answer.
 * None of it asserts anything about any particular shop — that is the whole
 * reason it can be written once and reused.
 *
 * The dividing line is enforced downstream by `assertPublishable`: a pack
 * that tries to smuggle in "certified welders" or "24-hour turnaround" fails
 * generation for every client that uses it, loudly, on the first run.
 */
import type { Fact, Hours, NicheId, ProspectRecord, TraitId } from '../types.js';

/**
 * Everything a generator is allowed to look at, plus the small helpers that
 * would otherwise be re-implemented (slightly differently) in every pack.
 */
export interface CopyContext {
  record: ProspectRecord;
  /** The shop's own name for itself, short form. */
  name: string;
  town: string;
  /** `Bergen County` etc., or `undefined` when we hold no county. */
  county: string | undefined;
  /** Confirmed service titles, in config order. */
  serviceTitles: string[];
  /** `true` when the trait is present *and* sourced. */
  has: (trait: TraitId) => boolean;
  /** The sourced wording for a trait, or `undefined`. */
  trait: (trait: TraitId) => string | undefined;
  hours: Hours[] | undefined;
  phone: string;
  email: string | undefined;
  foundedYear: number | undefined;
  /** `a, b and c` — no Oxford comma; this is how the shops themselves write. */
  list: (items: string[]) => string;
  /** Sentence-case join of service titles, lowercased where mid-sentence. */
  servicesSentence: () => string;
}

/**
 * One service, described.
 *
 * `body` is the long-form prose for `src/content/services/<client>/<slug>.md`.
 * It is a function of context because a service description that never names
 * the town or the shop reads like a brochure for the trade, which is exactly
 * what a prospect's current site already does badly.
 */
export interface ServiceTemplate {
  /** Default title. A shop's own name for the service overrides it. */
  title: string;
  oneLiner: string;
  /** One-sentence summary for the service page's lede. */
  summary: (ctx: CopyContext) => string;
  /** Paragraphs. Joined with a blank line into the markdown body. */
  body: (ctx: CopyContext) => string[];
  /** Bullets beside the prose. Must survive the fabrication guard unaided. */
  highlights: (ctx: CopyContext) => string[];
  /** Alt text for the service image. Describes the picture, not the business. */
  imageAlt: string;
  icon: IconName;
  image: string;
}

/** Mirrors the template's `IconName`. Structural, so no import across packages. */
export type IconName =
  | 'precision'
  | 'clock'
  | 'shield'
  | 'wrench'
  | 'gear'
  | 'truck'
  | 'badge'
  | 'phone';

/**
 * One question from the bank.
 *
 * `answer` returns `null` when this record cannot support a true answer. That
 * is not a failure — it is the mechanism. An FAQ is the one part of a site a
 * customer reads expecting a real answer, so an entry that hedges costs more
 * trust than the missing entry would.
 */
export interface FaqTemplate {
  id: string;
  question: (ctx: CopyContext) => string;
  answer: (ctx: CopyContext) => string | null;
  /** Asked of the owner when the answer comes back `null`. */
  ifMissing: string;
}

export interface NichePack {
  id: NicheId;
  /** The trade noun, singular: `machine shop`, `welding shop`, `contractor`. */
  noun: string;
  /** The trade as a gerund phrase: `precision machining`, `welding`. */
  work: string;
  /** What the customer brings or has: `the part`, `the job`, `the project`. */
  object: string;
  /** Taxonomy keyed by service slug. */
  taxonomy: Record<string, ServiceTemplate>;
  /** The question bank. At least eight; per-client output is what survives. */
  faq: FaqTemplate[];
  /**
   * The opening sentences of a town section — *several* of them, and that is
   * the point.
   *
   * A single template with the town name substituted in produces eight blocks
   * that differ by one word. That is near-duplicate content, it is what
   * search engines demote service-area pages for, and a reader scrolling past
   * the third identical paragraph has learned what generated the page.
   *
   * So a pack returns a set of true things it can say about working in a
   * town, and the generator rotates through them. Every variant has to stand
   * on its own — this is variety in what is said, not in how it is phrased.
   */
  townLines: (ctx: CopyContext, town: string) => string[];
}

/** Sugar for packs that need a founded-year clause only when there is one. */
export function since(year: Fact<number> | undefined): string {
  return year === undefined ? '' : ` since ${year.value}`;
}
