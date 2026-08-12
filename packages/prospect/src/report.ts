import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative } from "node:path";

import { repoRoot } from "./paths.js";
import { unavailableFields } from "./schema.js";
import type { ProspectConfig } from "./types.js";

/**
 * The run manifest, and the summary a human reads.
 *
 * Both are built around the same idea: the interesting output of a demo run is
 * not the URL, it is the list of things we could not find out. A demo that
 * looks finished but is quietly missing the phone number is worse than one
 * that says so.
 */

/** Wall-clock milliseconds per stage, plus the total. Set by `run.ts`. */
export interface RunTimings {
  ingest: number;
  project: number;
  build: number;
  shots: number;
  deploy: number;
  cards: number;
  total: number;
}

export interface DemoManifest {
  id: string;
  generatedAt: string;
  businessName: string;
  liveUrl: string | null;
  project: string | null;
  verified: boolean;
  preset: string | null;
  brandCreatedByUs: boolean;
  colors: { primary: string; accent: string } | null;

  /**
   * What is at their listed address: `live`, `parked`, `dead` or `none`.
   *
   * Read by `scripts/pitch/compare.mjs`, which must not run Lighthouse against
   * a parking page and present the result as their site's score — an empty
   * page scores well precisely because it is empty, and "their site beat the
   * demo on performance" would be an artefact of the domain having lapsed.
   */
  websiteStatus: string | null;
  /** Why the classification came out the way it did. */
  websiteStatusReason: string | null;

  /** Which copy pack ran, or `null` when none did. */
  copyPack: string | null;
  /** The copy engine's account of itself, for the operator. */
  copyNotes: string[];
  /** Questions the record could not answer. Worth asking on the call. */
  droppedQuestions: { field: string; question: string }[];
  /** Titles and descriptions that overrun their listing budget. */
  seoWarnings: { field: string; length: number; budget: number; text: string }[];

  /** Structural parity with the five hand-authored clients, at a glance. */
  hasDesign: boolean;
  hasFaq: boolean;
  hasServiceAreas: boolean;

  timings: RunTimings | null;
  cards: { qr: string | null; comparison: string | null };
  shots: {
    before: { desktop: string | null; mobile: string | null; source: string; reason?: string };
    after: { desktop: string | null; mobile: string | null };
  };
  unavailable: { field: string; reason: string }[];
  conflicts: ProspectConfig["conflicts"];
  log: string[];
}

const rel = (file: string | undefined | null): string | null =>
  file ? relative(repoRoot, file).split("\\").join("/") : null;

export function writeManifest(file: string, manifest: DemoManifest): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

export function buildManifest(input: {
  prospect: ProspectConfig;
  liveUrl: string | null;
  project: string | null;
  verified: boolean;
  qrCard: string | null;
  comparisonCard: string | null;
  before: { desktop?: string; mobile?: string; source: string; reason?: string };
  after: { desktop?: string; mobile?: string };
  log: string[];
  /** Absent when the run failed before the projection ran. */
  copy?: {
    pack: string | null;
    notes: string[];
    droppedQuestions: { field: string; question: string }[];
    seoWarnings: { field: string; length: number; budget: number; text: string }[];
  };
  site?: { design?: unknown; faq?: unknown[]; serviceAreas?: unknown } | undefined;
  timings?: RunTimings | undefined;
}): DemoManifest {
  const { prospect } = input;
  const colors = prospect.brand.colors.status === "known" ? prospect.brand.colors.value : null;
  const status = prospect.websiteStatus;
  const before: DemoManifest["shots"]["before"] = {
    desktop: rel(input.before.desktop),
    mobile: rel(input.before.mobile),
    source: input.before.source,
  };
  if (input.before.reason) before.reason = input.before.reason;

  return {
    id: prospect.id,
    generatedAt: prospect.generatedAt,
    businessName:
      prospect.businessName.status === "known" ? prospect.businessName.value : prospect.id,
    liveUrl: input.liveUrl,
    project: input.project,
    verified: input.verified,
    preset: prospect.preset.status === "known" ? prospect.preset.value : null,
    brandCreatedByUs: prospect.brand.createdByUs,
    colors,
    websiteStatus: status.status === "known" ? status.value : null,
    websiteStatusReason: status.status === "known" ? (status.note ?? null) : status.reason,
    copyPack: input.copy?.pack ?? null,
    copyNotes: input.copy?.notes ?? [],
    droppedQuestions: input.copy?.droppedQuestions ?? [],
    seoWarnings: input.copy?.seoWarnings ?? [],
    hasDesign: input.site?.design !== undefined,
    hasFaq: (input.site?.faq?.length ?? 0) > 0,
    hasServiceAreas: input.site?.serviceAreas !== undefined,
    timings: input.timings ?? null,
    cards: { qr: rel(input.qrCard), comparison: rel(input.comparisonCard) },
    shots: {
      before,
      after: { desktop: rel(input.after.desktop), mobile: rel(input.after.mobile) },
    },
    unavailable: unavailableFields(prospect),
    conflicts: prospect.conflicts,
    log: input.log,
  };
}

/** One screen per prospect, printed at the end of its run. */
export function printSummary(manifest: DemoManifest): void {
  const line = (label: string, value: string): void => {
    console.log(`  ${label.padEnd(14)} ${value}`);
  };

  console.log(`\n${manifest.businessName}  (${manifest.id})`);
  line("demo", manifest.liveUrl ? `${manifest.liveUrl}${manifest.verified ? "" : "  (NOT VERIFIED)"}` : "not deployed");
  line("qr card", manifest.cards.qr ?? "—");
  line("comparison", manifest.cards.comparison ?? "—");
  line(
    "before",
    manifest.shots.before.desktop
      ? `${manifest.shots.before.desktop} (${manifest.shots.before.source})`
      : `none — ${manifest.shots.before.reason ?? "no reason recorded"}`,
  );
  line(
    "brand",
    manifest.colors
      ? `${manifest.colors.primary} / ${manifest.colors.accent}` +
          (manifest.brandCreatedByUs ? "   ← BRAND CREATED BY US" : "")
      : "—",
  );
  line("preset", manifest.preset ?? "—");
  line(
    "their site",
    manifest.websiteStatus === null
      ? "not checked"
      : `${manifest.websiteStatus.toUpperCase()}${
          manifest.websiteStatus === "parked" || manifest.websiteStatus === "dead"
            ? "   ← treated as NO WEBSITE"
            : ""
        }`,
  );
  if (
    manifest.websiteStatusReason &&
    manifest.websiteStatus !== null &&
    manifest.websiteStatus !== "live"
  ) {
    console.log(`                 ${manifest.websiteStatusReason}`);
  }

  // Structural parity with the hand-authored five, in one line. This is the
  // thing the whole stream is for, so it is printed whether or not it is good
  // news — a demo missing a design block should be as visible as one missing a
  // phone number.
  line(
    "parity",
    [
      `design ${manifest.hasDesign ? "yes" : "NO"}`,
      `faq ${manifest.hasFaq ? "yes" : "no"}`,
      `service areas ${manifest.hasServiceAreas ? "yes" : "no"}`,
      `copy pack ${manifest.copyPack ?? "none"}`,
    ].join("  ·  "),
  );
  if (manifest.timings) {
    const t = manifest.timings;
    const secs = (ms: number): string => `${(ms / 1000).toFixed(1)}s`;
    line("time", `${secs(t.total)} total`);
    console.log(
      `                 ingest ${secs(t.ingest)} · project ${secs(t.project)} · build ${secs(t.build)} · ` +
        `shots ${secs(t.shots)} · deploy ${secs(t.deploy)} · cards ${secs(t.cards)}`,
    );
  }

  // The notes already say "copy:" where that is the useful prefix; adding a
  // second one produced "copy: copy: 7 FAQ entries".
  for (const note of manifest.copyNotes) console.log(`  ${note.startsWith("copy:") ? "" : "copy: "}${note}`);

  if (manifest.droppedQuestions.length > 0) {
    console.log(`  ${manifest.droppedQuestions.length} question(s) to ask the owner:`);
    for (const q of manifest.droppedQuestions) console.log(`    ${q.question}`);
  }

  if (manifest.conflicts.length > 0) {
    console.log(`  sources disagreed on ${manifest.conflicts.length} field(s):`);
    for (const c of manifest.conflicts) {
      console.log(`    ${c.field}: kept "${c.kept.value}" (${c.kept.source}), saw "${c.discarded.value}" (${c.discarded.source})`);
    }
  }

  if (manifest.unavailable.length > 0) {
    console.log(`  ${manifest.unavailable.length} field(s) unavailable:`);
    for (const u of manifest.unavailable) console.log(`    ${u.field}: ${u.reason}`);
  }
}
