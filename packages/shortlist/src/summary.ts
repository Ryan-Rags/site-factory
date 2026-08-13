import type { Assessment, WebsiteStatus } from "./types.js";

/** The run's output, as printed. */

const STATUSES: readonly WebsiteStatus[] = ["none", "dead", "parked", "live"];

export interface HistogramBand {
  /** Inclusive lower bound; the band covers [floor, floor+9], 100 in the top. */
  floor: number;
  label: string;
  total: number;
  byStatus: Record<WebsiteStatus, number>;
}

/**
 * Counts per 10-point band, broken out by website status.
 *
 * The distribution is the sanity check the first real run needs. If the bands
 * are not roughly ordered by status — none/dead/parked clustering high, live
 * clustering low — then either the classifier or the tiering is wrong, and
 * that is far easier to see here than by reading 600 rows.
 */
export function histogram(assessments: readonly Assessment[]): HistogramBand[] {
  const bands: HistogramBand[] = [];
  for (let floor = 0; floor <= 90; floor += 10) {
    bands.push({
      floor,
      label: floor === 90 ? "90-100" : `${floor}-${floor + 9}`,
      total: 0,
      byStatus: { none: 0, dead: 0, parked: 0, live: 0 },
    });
  }

  for (const a of assessments) {
    const index = Math.min(9, Math.max(0, Math.floor(a.score / 10)));
    const band = bands[index];
    if (!band) continue;
    band.total += 1;
    band.byStatus[a.status.status] += 1;
  }
  return bands;
}

export function renderHistogram(assessments: readonly Assessment[]): string {
  const bands = histogram(assessments);
  const max = Math.max(1, ...bands.map((b) => b.total));
  const width = 32;

  const lines = ["Score distribution (count per 10-point band)"];
  lines.push(`  ${"band".padEnd(8)} ${"n".padStart(5)}  ${"none/dead/parked/live".padEnd(24)} `);

  for (const band of [...bands].reverse()) {
    const bar = "#".repeat(Math.round((band.total / max) * width));
    const split = STATUSES.map((s) => band.byStatus[s]).join("/");
    lines.push(
      `  ${band.label.padEnd(8)} ${String(band.total).padStart(5)}  ${split.padEnd(24)} ${bar}`,
    );
  }
  return lines.join("\n");
}

export interface StatusTally {
  status: WebsiteStatus;
  count: number;
}

export function tallyByStatus(assessments: readonly Assessment[]): StatusTally[] {
  return STATUSES.map((status) => ({
    status,
    count: assessments.filter((a) => a.status.status === status).length,
  }));
}

/** The top N, each with the one line that explains its rank. */
export function renderTop(assessments: readonly Assessment[], n: number): string {
  const top = [...assessments].sort((a, b) => b.score - a.score).slice(0, n);
  if (top.length === 0) return "No prospects scored.";

  const lines = [`Top ${top.length} of ${assessments.length}`];
  top.forEach((a, i) => {
    const rank = String(i + 1).padStart(3);
    const score = String(a.score).padStart(3);
    const where = a.result.town;
    const status = a.status.status.padEnd(6);
    lines.push(`${rank}. [${score}] ${a.result.name} — ${where} · ${status} · ${a.result.nicheLabel}`);
    lines.push(`      ${a.reasons.join(" · ")}`);
    const phone = a.result.phone || "no phone";
    lines.push(`      ${phone}${a.result.website ? `  ${a.result.website}` : ""}`);
    if (a.identity.warning) lines.push(`      ${a.identity.warning}`);
  });
  return lines.join("\n");
}

export function renderStatusTally(assessments: readonly Assessment[]): string {
  const tally = tallyByStatus(assessments);
  const audited = assessments.filter((a) => a.audited).length;
  const liveTotal = assessments.filter((a) => a.status.status === "live").length;
  const parts = tally.map((t) => `${t.status}=${t.count}`).join("  ");
  return (
    `Website status: ${parts}\n` +
    `Audited: ${audited} of ${liveTotal} live site(s)` +
    (audited < liveTotal
      ? ` — ${liveTotal - audited} not audited (cap), scored at the live floor with the reason recorded`
      : "")
  );
}
