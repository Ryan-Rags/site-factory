import type { CheapSignals } from "./types.js";

/**
 * Which live sites get audited when the cap cannot cover them all.
 *
 * A full `auditOne` is three navigations including a Lighthouse run — tens of
 * seconds each. A county sweep across three niches surfaces more live sites
 * than one run can audit, so something has to choose, and the rule is that the
 * choosing is **explicit and free**.
 *
 * ## Free means free
 *
 * Every signal below was already paid for by the one status GET. Ranking never
 * adds a navigation — if it did, the cap would be self-defeating: we would
 * spend the crawl budget deciding how to spend the crawl budget.
 *
 * That constraint is why this is a heuristic and not a measurement. It is a
 * guess at which sites will turn out to be neglected, made from what a single
 * page load happened to reveal. The audit is the measurement; this only
 * decides what the audit gets pointed at first.
 */

/** One ordering criterion, in the order applied. Printed in the run header. */
export interface RankCriterion {
  id: string;
  /** Points added when the signal fires. Higher sorts earlier. */
  points: number;
  description: string;
}

/**
 * The ordering, as data, so the run header can print exactly what it did.
 *
 * Weights are ordinal, not calibrated — they encode "http-only is a stronger
 * hint of neglect than a short title", nothing more precise. They never enter
 * the score; they only sort the audit queue.
 */
export const RANK_CRITERIA: readonly RankCriterion[] = [
  {
    id: "insecure",
    points: 40,
    description: "served over http:, not https: — the strongest cheap hint of an unmaintained site",
  },
  {
    id: "no-viewport-meta",
    points: 30,
    description: "no viewport meta tag, so the site almost certainly has no mobile layout",
  },
  {
    id: "no-business-jsonld",
    points: 15,
    description: "no LocalBusiness/Organization structured data",
  },
  {
    id: "thin-content",
    points: 10,
    description: "under 150 words of prose outside nav, header and footer",
  },
  {
    id: "no-description",
    points: 8,
    description: "missing or empty meta description",
  },
  {
    id: "weak-title",
    points: 5,
    description: "title under 15 or over 65 characters",
  },
  {
    id: "no-contact-link",
    points: 4,
    description: "no tel: or mailto: link on the home page",
  },
];

const THIN_CONTENT_WORDS = 150;
const TITLE_MIN = 15;
const TITLE_MAX = 65;

/** Which criteria fired for one site. */
export function criteriaFor(signals: CheapSignals | undefined): string[] {
  if (signals === undefined) return [];
  const fired: string[] = [];
  if (signals.insecure) fired.push("insecure");
  if (!signals.hasViewportMeta) fired.push("no-viewport-meta");
  if (!signals.hasBusinessJsonLd) fired.push("no-business-jsonld");
  if (signals.contentWords < THIN_CONTENT_WORDS) fired.push("thin-content");
  if (signals.descriptionLength === 0) fired.push("no-description");
  if (signals.titleLength < TITLE_MIN || signals.titleLength > TITLE_MAX) fired.push("weak-title");
  if (!signals.hasContactLink) fired.push("no-contact-link");
  return fired;
}

export function provisionalRank(signals: CheapSignals | undefined): number {
  const fired = new Set(criteriaFor(signals));
  let points = 0;
  for (const c of RANK_CRITERIA) if (fired.has(c.id)) points += c.points;
  return points;
}

export interface RankedCandidate<T> {
  item: T;
  points: number;
  fired: string[];
  /** True when no cheap signals existed and discovery order decided it. */
  degraded: boolean;
}

/**
 * Order live sites for the audit queue.
 *
 * When a site yielded no cheap signals at all — the page loaded but the
 * evaluation returned nothing usable — it cannot be ranked, and its position
 * is decided by nothing better than where it fell in the sweep. That is
 * recorded as `degraded` rather than dressed up as a judgement; the run header
 * says how many were ordered that way.
 *
 * Sort is stable within equal points, so discovery order is the documented
 * tie-break rather than an accident of the sort implementation.
 */
export function rankForAudit<T extends { status: { signals?: CheapSignals | undefined } }>(
  items: readonly T[],
): RankedCandidate<T>[] {
  return items
    .map((item, index) => {
      const signals = item.status.signals;
      const fired = criteriaFor(signals);
      return {
        item,
        points: provisionalRank(signals),
        fired,
        degraded: signals === undefined,
        index,
      };
    })
    .sort((a, b) => (b.points - a.points) || (a.index - b.index))
    .map(({ item, points, fired, degraded }) => ({ item, points, fired, degraded }));
}

/** The block printed in the run header, so the ordering is never implicit. */
export function renderOrdering(degradedCount: number, total: number): string {
  const lines = [
    "Audit queue ordering — cheap signals only, from the status GET. No extra navigations.",
  ];
  for (const c of RANK_CRITERIA) {
    lines.push(`  +${String(c.points).padStart(2)}  ${c.id.padEnd(20)} ${c.description}`);
  }
  lines.push("  tie-break: sweep discovery order (stable sort)");
  if (degradedCount > 0) {
    lines.push(
      `  NOTE: ${degradedCount} of ${total} live site(s) yielded no cheap signals, so their ` +
        "position is discovery order and nothing more. They are not ranked, only queued.",
    );
  }
  return lines.join("\n");
}

export { THIN_CONTENT_WORDS, TITLE_MIN, TITLE_MAX };
