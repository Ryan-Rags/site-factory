import {
  fact,
  isBergenTown,
  nicheFor,
  partitionTowns,
  type Fact,
  type NicheId,
  type ProspectRecord,
  type ServiceFact,
} from "@site-factory/copy";

import type { Field, ProspectConfig } from "./types.js";
import { isKnown, valueOf } from "./types.js";

/**
 * The bridge between what we ingested and what the copy engine will write.
 *
 * Two packages, two ways of saying the same thing. `ProspectConfig` holds a
 * {@link Field} per value — a source, a retrieval date and a note, or an
 * explicit `unavailable` with a reason. `ProspectRecord` holds a `Fact` — a
 * value and the evidence for it, where a fact constructed without evidence is
 * a compile error.
 *
 * The conversion is deliberately mechanical, and that is the point: there is
 * exactly one place where an ingested value becomes something the copy engine
 * may print, and it is impossible to pass through it without carrying the
 * source along. An `unavailable` field does not become an empty string — it
 * becomes an absent key, and the copy engine's whole design is that an absent
 * key means the subject is never raised.
 *
 * What is deliberately *not* built here:
 *
 *  - `traits` — a walk-in policy, a rush service, family ownership. Nothing we
 *    ingest tells us any of these, and the engine keys its FAQ off them. An
 *    inferred trait would be a claim about how a business operates, invented
 *    by a matcher.
 *  - `certifications`, `people`, `voice` — same reason.
 *
 * They stay empty and the copy comes out shorter. That is the correct output
 * for a business nobody has spoken to yet.
 */

/**
 * Niches the copy engine has a pack for, matched from the free-text niche the
 * lead row or the operator supplied.
 *
 * Ordered, first match wins, specific before general — the same rule
 * `NICHE_STYLES` follows. `welding` sits above `machine` so that "welding and
 * machine shop" lands on the welding pack rather than on whichever appears
 * first in the string.
 */
const NICHE_MATCHERS: { id: NicheId; match: RegExp }[] = [
  { id: "welding-fabrication", match: /weld|fabricat|sheet ?metal|iron ?work|forge/i },
  { id: "machine-shop", match: /machin|cnc|tool ?(and|&) ?die|tool ?room|lathe|milling/i },
  {
    id: "general-contractor",
    match: /contractor|construction|remodel|renovat|carpent|roof|siding|builder|general ?build/i,
  },
];

/** The pack id for a free-text niche, or `null` when we have no pack. */
export function nicheIdFor(niche: string | undefined): NicheId | null {
  if (niche === undefined || niche.trim() === "") return null;
  return NICHE_MATCHERS.find((m) => m.match.test(niche))?.id ?? null;
}

/**
 * Evidence text for a value that came off a `Field`.
 *
 * `Fact.evidence` is documented as "where this came from, in plain words a
 * reviewer can check", and it explicitly rules out a source with no date. The
 * `Field` already carries all three parts, so this is a formatting job rather
 * than a judgement — which is exactly what it should be.
 */
function evidenceOf(field: Field<unknown>, what: string): string {
  if (!isKnown(field)) return "";
  const where = field.note ?? `the ${field.source} source`;
  return `${what}: ${where} (${field.source}, retrieved ${field.retrievedAt})`;
}

/** A `Fact` from a known field, or `undefined` from an unavailable one. */
function factOf<T>(field: Field<T>, what: string): Fact<T> | undefined {
  if (!isKnown(field)) return undefined;
  return fact(field.value, evidenceOf(field, what));
}

/**
 * Why a record could not be built.
 *
 * Reported rather than thrown. A prospect too thin for the copy engine is a
 * normal outcome — the demo is still built, from the projection's own
 * conservative copy — and the operator needs the reason in the run summary,
 * not a stack trace.
 */
export interface RecordGap {
  field: string;
  reason: string;
}

export type RecordResult =
  | { ok: true; record: ProspectRecord; pack: NicheId; notes: string[] }
  | { ok: false; gaps: RecordGap[]; pack: NicheId | null; notes: string[] };

/**
 * The four values the copy engine cannot write a sentence without.
 *
 * `tradingName`, `town`, `region` and `phone` are non-optional on
 * `ProspectRecord` for a reason: every headline is "what + where", every
 * service-area section names a town, and the CTA is a phone number. A record
 * missing one of them would have to be filled with something, and there is
 * nothing honest to fill it with.
 */
export function buildRecord(prospect: ProspectConfig): RecordResult {
  const notes: string[] = [];
  const gaps: RecordGap[] = [];

  const nicheText = valueOf(prospect.niche);
  const pack = nicheIdFor(nicheText);
  if (pack === null) {
    notes.push(
      nicheText === undefined
        ? `no niche was recorded for this prospect, so no copy pack could be selected`
        : `no copy pack for niche "${nicheText}" — the engine has packs for ` +
          `machine shops, welding and fabrication, and general contractors`,
    );
    return { ok: false, gaps, pack: null, notes };
  }

  const tradingName = factOf(prospect.businessName, "the business name");
  if (tradingName === undefined) {
    gaps.push({ field: "businessName", reason: prospect.businessName.status === "unavailable" ? prospect.businessName.reason : "" });
  }

  const address = valueOf(prospect.address);
  if (address === undefined) {
    gaps.push({
      field: "address",
      reason:
        prospect.address.status === "unavailable"
          ? prospect.address.reason
          : "no address was available",
    });
  } else {
    if (address.locality.trim() === "") gaps.push({ field: "address.locality", reason: "the address has no town" });
    if (address.region.trim() === "") gaps.push({ field: "address.region", reason: "the address has no state" });
  }

  const phone = factOf(prospect.phone, "the phone number");
  if (phone === undefined) {
    gaps.push({
      field: "phone",
      reason: prospect.phone.status === "unavailable" ? prospect.phone.reason : "",
    });
  }

  if (tradingName === undefined || address === undefined || phone === undefined || gaps.length > 0) {
    return { ok: false, gaps, pack, notes };
  }

  const addressEvidence = evidenceOf(prospect.address, "the address");
  const town = fact(address.locality, addressEvidence);
  const region = fact(address.region, addressEvidence);

  // The legal name is a distinct fact, and where we do not hold one the
  // trading name stands in *with that substitution stated*. A legal name
  // silently equal to the trading name is a claim about how the business is
  // registered, which we would have no basis for.
  const legalName =
    factOf(prospect.legalName, "the legal name") ??
    fact(
      tradingName.value,
      `${tradingName.evidence} — no separate legal name was found, so the trading name stands in; confirm with the owner`,
    );

  // Service towns: whatever a source gave us for the service area, with the
  // home town first. Nothing is added — a neighbouring town we were not told
  // about is exactly the invented detail the service-area generator is built
  // to avoid.
  const areaField = prospect.serviceArea;
  const rawTowns = valueOf(areaField) ?? [];
  const towns = [address.locality, ...rawTowns.filter((t) => t !== address.locality)].filter(
    (t) => t.trim() !== "",
  );
  const { bergen, other } = partitionTowns(towns);

  const record: ProspectRecord = {
    slug: prospect.id,
    niche: pack,
    tradingName,
    legalName,
    town,
    region,
    phone,
    services: servicesFor(prospect, pack, notes),
    traits: {},
    certifications: [],
    serviceTowns: bergen,
    wider: other,
    voice: [],
  };

  // Bergen County is a matter of public record for the municipalities in
  // `BERGEN_MUNICIPALITIES`, which is why it can be stated without having been
  // told. A town outside that list gets no county line at all rather than a
  // guessed one.
  if (isBergenTown(address.locality)) {
    record.county = fact(
      "Bergen County",
      `${address.locality} is a Bergen County, NJ municipality — public record`,
    );
  }

  const foundedYear = factOf(prospect.foundedYear, "the founding year");
  if (foundedYear !== undefined) record.foundedYear = foundedYear;
  const email = factOf(prospect.email, "the email address");
  if (email !== undefined) record.email = email;
  const hours = factOf(prospect.hours, "the opening hours");
  if (hours !== undefined) record.hours = hours;

  const rating = valueOf(prospect.ratingSummary);
  if (rating !== undefined) {
    // Read for routing only — the engine uses it to decide whether
    // review-shaped copy makes sense, and never prints it.
    record.profile = { rating: rating.rating, reviewCount: rating.count };
  }

  if (bergen.length === 0 && other.length > 0) {
    notes.push(
      `no Bergen County towns in the service area — the service-area section is a wider-area line rather than town blocks`,
    );
  }

  return { ok: true, record, pack, notes };
}

/**
 * Services, mapped onto the niche pack's taxonomy where they match.
 *
 * A service that matches a taxonomy entry gets that entry's prose. One that
 * does not gets a description built from its title alone — never a paragraph
 * borrowed from a service the shop does not offer. The engine reports the
 * unmapped ones, and they land in the run summary.
 */
function servicesFor(prospect: ProspectConfig, pack: NicheId, notes: string[]): ServiceFact[] {
  const taxonomy = nicheFor(pack).taxonomy;
  const byTitle = new Map<string, string>();
  for (const [key, template] of Object.entries(taxonomy)) {
    byTitle.set(template.title.toLowerCase(), key);
  }

  const services = valueOf(prospect.services) ?? [];
  const out: ServiceFact[] = [];
  let unmapped = 0;

  for (const service of services) {
    const key =
      (taxonomy[service.slug] !== undefined ? service.slug : undefined) ??
      byTitle.get(service.title.trim().toLowerCase());
    const entry: ServiceFact = { slug: service.slug, title: service.title };
    if (key !== undefined) entry.taxonomy = key;
    else unmapped += 1;
    out.push(entry);
  }

  if (unmapped > 0) {
    notes.push(
      `${unmapped} of ${services.length} service(s) matched no entry in the ${pack} taxonomy — ` +
        `they are described from their own titles, not from a template for a different service`,
    );
  }
  return out;
}
