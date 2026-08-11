/**
 * The fabrication guard.
 *
 * Types stop you inventing a *value*. They do not stop you writing a
 * *sentence* that contains an invented value — `'Serving Bergen County since
 * 1985'` is a plain string and every type in this package will accept it.
 * This module is what closes that gap: every string the engine is about to
 * publish is scanned for the shapes a factual claim takes, and any claim that
 * cannot be traced to a `Fact` on the prospect record throws at generation
 * time.
 *
 * The failure mode this is built for is not a careless author. It is the
 * plausible sentence: a line that reads so naturally nobody re-reads it, and
 * that asserts a certification the shop does not hold. That is the sentence
 * that gets a client sued, and it is invisible in review precisely because it
 * sounds like every other line on the page.
 *
 * The scan is deliberately noisy. A false positive costs one allowance entry
 * with a source next to it; a false negative costs a false claim published
 * under a real business's name. Those are not symmetric, so the patterns err
 * toward catching too much.
 */
import type { Fact, ProspectRecord } from './types.js';
import { isFact } from './types.js';
import { VERIFY_MARKER } from './marker.js';

/**
 * The shapes a factual claim takes in local-service copy.
 *
 * Each entry is a pattern plus the question a reviewer should ask when it
 * fires. Order is not significant; every pattern is tested against every
 * string.
 */
const CLAIM_PATTERNS: { name: string; re: RegExp }[] = [
  // Any year. Founding dates, "est.", copyright lines in copy.
  { name: 'a year', re: /\b(?:1[89]\d{2}|20\d{2})\b/g },
  // Spans of time: "38 years", "four decades", "three generations".
  {
    name: 'a span of time',
    re: /\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)[\s-]+(?:years?|decades?|generations?)\b/gi,
  },
  // Credentials. The expensive kind of false claim.
  {
    name: 'a credential',
    re: /\b(?:ISO|ASME|AWS|NADCAP|OSHA|AS9100|ITAR|certified|certification|accredited|licen[cs]ed|licen[cs]e|bonded|insured|insurance|registrar|approved\s+vendor)\b/gi,
  },
  // Ownership and status claims. Legally meaningful; often set-aside eligible.
  {
    name: 'an ownership or status claim',
    re: /\b(?:family[\s-]?(?:owned|run)|woman[\s-]?owned|women[\s-]?owned|veteran[\s-]?owned|minority[\s-]?owned|WOSB|MBE|WBE|union[\s-]?shop|second[\s-]generation)\b/gi,
  },
  // Superlatives and rankings.
  {
    name: 'a superlative or ranking',
    re: /\b(?:best|#\s?1|number\s+one|top[\s-]rated|highest[\s-]rated|cheapest|lowest\s+price|largest|biggest|leading|premier|award[\s-]winning|voted|most\s+trusted)\b/gi,
  },
  // Promises we would have to honour.
  {
    name: 'a guarantee',
    re: /\b(?:guarantee[ds]?|warrant(?:y|ies|ed)|money[\s-]back|satisfaction\s+guaranteed|no[\s-]risk)\b/gi,
  },
  // Prices, including the free ones. "Free estimate" is a price commitment.
  {
    name: 'a price claim',
    re: /\b(?:free|no\s+charge|no\s+cost|\$\d|\d+\s*%\s*off|discount|competitive\s+pric\w+|affordable|cheap)\b/gi,
  },
  // Measured performance: turnaround times, tolerances, uptime, volumes.
  {
    name: 'a measured capability',
    re: /(?:±\s?[\d.]+|\b\d+\s*(?:hours?|hrs?|days?|weeks?)\b|\b24\/7\b|\bsame[\s-]day\b|\bnext[\s-]day\b|\bsame[\s-]week\b|\bover\s+\d+|\b\d+\s*\+)/gi,
  },
  // Review and customer-count claims.
  {
    name: 'a review or customer-count claim',
    re: /\b(?:\d+(?:\.\d)?\s*(?:stars?|★)|\d+\s+(?:reviews?|customers?|clients?|projects?|parts?\s+made))\b/gi,
  },
];

/**
 * The strings a given prospect is allowed to say.
 *
 * Built from the record's `Fact`s only. A claim in generated copy passes if
 * the matched text appears inside one of these — so `Since 1987` passes for a
 * shop whose `foundedYear` is a sourced 1987, and fails for one whose
 * founding year we never confirmed, with no special-casing anywhere.
 */
export function allowancesFor(record: ProspectRecord): string[] {
  const out: string[] = [];
  const push = (f: Fact<unknown> | undefined): void => {
    if (f !== undefined) out.push(String(f.value));
  };

  push(record.foundedYear);
  push(record.people);
  // Identity facts. A phone number is a sourced fact that happens to contain
  // four digits in a row — `(973) 345-1800` tripped the year pattern before
  // this line existed, which is the guard being noisy in exactly the way it
  // was designed to be. The fix is to source the numerals, not to loosen the
  // pattern: a business named "1920 Machine Works" needs the same allowance.
  push(record.phone);
  push(record.email);
  push(record.tradingName);
  push(record.legalName);
  for (const t of Object.values(record.traits)) if (isFact(t)) out.push(t.value);
  for (const c of record.certifications) if (isFact(c)) out.push(`${c.value.label} ${c.value.detail}`);
  for (const s of record.services) if (s.detail !== undefined) out.push(s.detail.value);

  // The owner's own published words. If their site says "family-owned since
  // 1918", we are allowed to say it back to them — that is a quotation, not a
  // claim we originated. The `VoiceNote.source` is what makes it one.
  for (const v of record.voice) out.push(v.phrase);

  // Hours are a sourced fact, so the numerals in an hours sentence are too.
  if (isFact(record.hours)) {
    for (const h of record.hours.value) {
      if (h.opens !== undefined && h.closes !== undefined) out.push(`${h.opens} ${h.closes}`);
    }
  }
  return out;
}

/**
 * A claim sitting behind a marker is not a claim.
 *
 * `Certifications — [verify with client]` contains the word "certifications"
 * and asserts nothing: the marker is doing the work, and the gate in
 * `check-markers.mjs` will stop it going live. So a string containing the
 * marker is exempt — but only that string, and only because the live-build
 * gate exists downstream. Delete that gate and this exemption becomes a hole.
 */
function isMarked(text: string): boolean {
  return text.includes(VERIFY_MARKER);
}

export class FabricationError extends Error {
  constructor(
    readonly field: string,
    readonly claim: string,
    readonly kind: string,
    text: string,
  ) {
    super(
      `Unsourced claim in ${field}: "${claim}" reads as ${kind}, and nothing on ` +
        `the prospect record supports it.\n` +
        `  Text: ${text}\n` +
        `  Fix one of three ways:\n` +
        `    1. add the fact to the prospect record with its evidence, or\n` +
        `    2. mark it — unconfirmed(field, question) — so it renders as ${VERIFY_MARKER}, or\n` +
        `    3. rewrite the line so it does not make the claim.\n` +
        `  Do not weaken this check to get a build through.`,
    );
    this.name = 'FabricationError';
  }
}

/**
 * Throw unless every claim in `text` traces to `allowed`.
 *
 * Called on every string the engine emits. Generation failing loudly is the
 * point: a copy engine that silently degrades is one that ships the degraded
 * version.
 */
export function assertPublishable(text: string, field: string, allowed: string[]): string {
  if (isMarked(text)) return text;

  const haystack = allowed.map((a) => a.toLowerCase());
  for (const { name, re } of CLAIM_PATTERNS) {
    // `re` is a module-level /g regex reused across calls; reset before each
    // use or `lastIndex` from the previous string silently skips matches.
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
      const claim = m[0];
      const needle = claim.toLowerCase();
      if (!haystack.some((a) => a.includes(needle))) {
        throw new FabricationError(field, claim, name, text);
      }
    }
  }
  return text;
}

/** `assertPublishable` over every string in an object, for whole-output checks. */
export function assertAllPublishable(
  values: Record<string, string | string[]>,
  allowed: string[],
): void {
  for (const [field, v] of Object.entries(values)) {
    for (const [i, s] of (Array.isArray(v) ? v : [v]).entries()) {
      assertPublishable(s, Array.isArray(v) ? `${field}[${i}]` : field, allowed);
    }
  }
}
