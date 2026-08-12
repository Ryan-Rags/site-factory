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
}): DemoManifest {
  const { prospect } = input;
  const colors = prospect.brand.colors.status === "known" ? prospect.brand.colors.value : null;
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
