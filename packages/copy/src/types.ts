/**
 * The typed contract between "what we actually know about a prospect" and
 * "what we are willing to print under their name".
 *
 * The whole package exists to keep those two things apart. A local business's
 * website is read as the business speaking, so a sentence we invented is not a
 * draft — it is the business making a claim it never made. Everything below is
 * shaped to make that hard to do by accident.
 */

/**
 * A thing we know, and how we know it.
 *
 * `evidence` is required by the type, not optional-with-a-lint. A fact
 * constructed without a source is a compile error, which is the cheapest
 * possible moment to catch a fabrication. `fact()` additionally rejects an
 * empty or whitespace-only source string at runtime, so `fact(x, '')` — the
 * obvious way to defeat the type — fails too.
 */
export interface Fact<T = string> {
  readonly value: T;
  /**
   * Where this came from, in plain words a reviewer can check: the client's
   * own site with a retrieval date, the lead row, a phone call, a directory
   * listing. "Seems right" and "from the old site" without a date are not
   * evidence; they are how a stale value becomes a permanent one.
   */
  readonly evidence: string;
}

/**
 * Something a good site would state, that we cannot source.
 *
 * It carries the *question that would clear it* rather than a description of
 * the hole. "Are you ISO certified?" is actionable on a phone call;
 * "certifications unknown" is a status report. `REPORT.md` is generated from
 * these questions, and the operator reads it with the owner on the line.
 */
export interface Unconfirmed {
  readonly unconfirmed: true;
  /** The question to put to the owner, phrased as you would actually ask it. */
  readonly question: string;
  /** Where the answer belongs, e.g. `certifications[0].label`. */
  readonly field: string;
}

/** Either we can source it or we cannot. There is no third state. */
export type Maybe<T> = Fact<T> | Unconfirmed;

export function fact<T>(value: T, evidence: string): Fact<T> {
  if (evidence.trim() === '') {
    throw new Error(
      `fact(${JSON.stringify(value)}) was given no evidence. ` +
        `Every published value needs a source a reviewer can check. ` +
        `If there is no source, use unconfirmed() and let it become a marker.`,
    );
  }
  return { value, evidence };
}

/**
 * The prefix that marks second-hand evidence.
 *
 * Some facts on these records did not come from a primary source in this run.
 * They were carried across from the existing approved mockup configs, which
 * an earlier stream wrote from each shop's own live site. That is real
 * provenance — but it is one hop longer than "we read it on their site this
 * week", and a value can have gone stale in between.
 *
 * Carrying such a value is legitimate; losing track of the fact that it was
 * carried is not. `REPORT.md` lists every one of these separately under
 * "read back to the owner", so the weaker basis stays visible instead of
 * dissolving into the general population of sourced facts.
 */
export const CARRIED = 'CARRIED:';

/** A fact inherited from the existing approved mockup copy. See {@link CARRIED}. */
export function carried<T>(value: T, where: string): Fact<T> {
  return fact(value, `${CARRIED} ${where}`);
}

export function isCarried(f: Fact<unknown>): boolean {
  return f.evidence.startsWith(CARRIED);
}

export function unconfirmed(field: string, question: string): Unconfirmed {
  if (question.trim() === '') {
    throw new Error(`unconfirmed("${field}") needs the question that would clear it.`);
  }
  return { unconfirmed: true, question, field };
}

export function isFact<T>(m: Maybe<T> | undefined): m is Fact<T> {
  return m !== undefined && !(m as Unconfirmed).unconfirmed;
}

export function isUnconfirmed<T>(m: Maybe<T> | undefined): m is Unconfirmed {
  return m !== undefined && (m as Unconfirmed).unconfirmed === true;
}

/** `fact.value` when present, otherwise `undefined`. */
export function value<T>(m: Maybe<T> | undefined): T | undefined {
  return isFact(m) ? m.value : undefined;
}

// ---------------------------------------------------------------------------
// The prospect record — the engine's only input
// ---------------------------------------------------------------------------

export type NicheId = 'machine-shop' | 'welding-fabrication' | 'general-contractor';

/**
 * The things a local service business can be true about itself that change
 * what the copy is allowed to say.
 *
 * This is a closed set on purpose. Every trait here is queried by name
 * somewhere in a niche pack's FAQ or trust block, so adding a trait means
 * deciding what copy it unlocks — which is exactly the decision that should
 * not be made by typing a new string into a config.
 */
export type TraitId =
  /** Customers can turn up without an appointment. */
  | 'walk-ins'
  /** Single pieces accepted; no minimum order quantity. */
  | 'no-minimum'
  /** Urgent/line-down work is actively taken, not merely tolerated. */
  | 'rush'
  /** Ongoing production runs, not just one-offs. */
  | 'production-runs'
  /** Can work from a sample or a broken part when there is no drawing. */
  | 'from-the-part'
  /** A photo is enough to start a quote. */
  | 'quote-from-photo'
  /** Work is done at the customer's site as well as in the shop. */
  | 'on-site'
  /** Quoting costs the customer nothing. A price claim — source it. */
  | 'free-quotes'
  /** Family ownership. Legally meaningful for set-asides; always sourced. */
  | 'family-run'
  /** The customer deals with the owner directly. */
  | 'owner-led';

/** Structurally compatible with the template's `Hours`. */
export interface Hours {
  day: string;
  opens?: string;
  closes?: string;
  closed?: boolean;
}

/**
 * Coordinates for `LocalBusiness.geo`.
 *
 * This package never populates it. Geo comes from one place — the discovery
 * pipeline's single Places ingestion path — and arrives here already on the
 * record. The copy engine consumes a prospect record; it does not fetch, and
 * it holds no API key. `source` is mandatory so that a coordinate pair in a
 * config can always be traced back to the run that produced it.
 */
export interface Geo {
  latitude: number;
  longitude: number;
  source: string;
}

/** One service the prospect actually offers. */
export interface ServiceFact {
  /** Matches `src/content/services/<client>/<slug>.md` and `services[].slug`. */
  slug: string;
  /** The shop's own name for it where we have one. */
  title: string;
  /**
   * Which entry in the niche pack's taxonomy this is, which is what lets the
   * engine write a description at all. An unmapped service gets a description
   * built only from `title` and the confirmed detail below — never a borrowed
   * paragraph from a service the shop does not offer.
   */
  taxonomy?: string;
  /** Confirmed specifics: materials, processes, capacities, in their words. */
  detail?: Fact<string>;
}

/**
 * Phrasing from the prospect's own material that we intend to keep.
 *
 * A rewrite that improves clarity and loses the owner's voice has failed at
 * the thing the owner will notice first. These are the lines we carry through
 * verbatim or near-verbatim, each with the source it came from, so a reviewer
 * can confirm we kept their words rather than ours.
 */
export interface VoiceNote {
  /** The phrase, as they wrote or said it. */
  phrase: string;
  /** Where it came from. Same standard as `Fact.evidence`. */
  source: string;
  /**
   * Whose words these actually are.
   *
   * `owner` — traceable to something the business itself published or said.
   * These are quotations, and they are the only ones that genuinely preserve
   * a voice.
   *
   * `ours-pending-confirmation` — prose *we* wrote about them, from their
   * public description of themselves. It may read well and be entirely
   * accurate and it is still not their voice, so it is a draft awaiting the
   * owner's word rather than a preserved one. `REPORT.md` lists the two
   * separately, because a rewrite that quietly reclassifies our sentences as
   * theirs is how a site ends up sounding like its agency.
   */
  attributed: 'owner' | 'ours-pending-confirmation';
}

/** A page of the prospect's existing site, as retrieved. Never re-fetched here. */
export interface SourceDoc {
  url: string;
  /** ISO-8601. A retrieval with no date cannot be judged stale. */
  retrievedAt: string;
  text: string;
}

/**
 * The public profile numbers.
 *
 * Passed through from the lead row. The engine reads them for *routing*
 * decisions (a shop with no reviews should not get review-shaped copy) and
 * never prints them: an aggregate rating rendered on the site is structured
 * data we would have to stand behind, and it moves without warning.
 */
export interface ProfileData {
  placeId?: string;
  rating?: number;
  reviewCount?: number;
}

export interface ProspectRecord {
  /** Must equal the template client slug and the `audit/out/<slug>/` dir. */
  slug: string;
  niche: NicheId;

  tradingName: Fact<string>;
  legalName: Fact<string>;
  /** Locality, e.g. `Elmwood Park`. Half of every "what + where" headline. */
  town: Fact<string>;
  region: Fact<string>;
  /** e.g. `Bergen County`. Used for the county-level line, never invented. */
  county?: Fact<string>;
  phone: Fact<string>;

  foundedYear?: Fact<number>;
  email?: Fact<string>;
  hours?: Fact<Hours[]>;
  geo?: Fact<Geo>;

  services: ServiceFact[];

  /**
   * What makes this shop worth calling, where we can source it.
   *
   * Keyed rather than a free list, because the FAQ and the trust strip both
   * need to *ask* whether a shop takes walk-ins — and a generator matching on
   * the words of a free-text differentiator would answer "yes" to
   * `'No walk-ins'`. The key is the query surface; the `Fact` value is the
   * wording that gets printed. An `Unconfirmed` entry becomes a marker; an
   * absent key means the copy simply never raises the subject.
   */
  traits: Partial<Record<TraitId, Maybe<string>>>;
  certifications: Maybe<{ label: string; detail: string }>[];
  /** Who the customer actually deals with, where confirmed. */
  people?: Fact<string>;

  /** Towns to write service-area sections for. Operator-confirmed, in order. */
  serviceTowns: string[];
  /** Broader areas for `areaServed` that are not Bergen municipalities. */
  wider: string[];

  voice: VoiceNote[];
  existingCopy?: SourceDoc[];
  profile?: ProfileData;
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

export interface FaqItem {
  question: string;
  /** Plain text. Rendered inside `<details>`; no markup is parsed. */
  answer: string;
}

/** One town's block on the service-area section. */
export interface TownSection {
  town: string;
  /** Two or three sentences. Never asserts a distance, drive time or landmark. */
  body: string;
}

/** Title and description for one page. `%s` templating happens in the template. */
export interface PageSeo {
  /** The `%s` value — the template wraps it with `seo.titleTemplate`. */
  title: string;
  description: string;
}

export interface SeoOutput {
  defaultDescription: string;
  home: PageSeo;
  services: PageSeo;
  about: PageSeo;
  contact: PageSeo;
  /** `imageAlt` for every image the config names, keyed by the image's role. */
  alt: Record<string, string>;
}

/** One remaining question, for `REPORT.md`. */
export interface MarkerReport {
  field: string;
  question: string;
}

export interface CopyOutput {
  faq: FaqItem[];
  serviceAreas: TownSection[];
  seo: SeoOutput;
  /** Every marker this run emitted, and the one question that clears each. */
  markers: MarkerReport[];
  /**
   * Questions from the bank that were dropped because the record could not
   * answer them. Not markers — an FAQ padded to eight with hedged non-answers
   * is worse than an FAQ of six that are true. Reported so the operator can
   * ask, and a later run can include them.
   */
  droppedQuestions: MarkerReport[];
}
