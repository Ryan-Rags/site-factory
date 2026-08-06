import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import type { LeadRow } from "@site-factory/discover";

import { CHECK_VERSION, countByStatus, failedChecks, type AuditResult } from "./types.js";

/** Screenshot paths are stored repo-relative; the report sits inside `audit/`. */
function fromReport(repoRelativePath: string): string {
  return repoRelativePath.replace(/^audit\//, "");
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

const VALUE_NOTE =
  "_No rating or review data for this business, so the value half of the score " +
  "used a neutral multiplier. The score below reflects site neglect only._";

function renderOnePager(result: AuditResult): string {
  const lines: string[] = [];
  const counts = countByStatus(result);

  lines.push(`## ${result.name}`);
  lines.push("");
  lines.push(`- **Score:** ${result.score}/100`);
  lines.push(`- **URL:** ${result.requestedUrl || "(none)"}`);
  if (result.finalUrl && result.finalUrl !== result.requestedUrl) {
    lines.push(`- **Resolved to:** ${result.finalUrl}`);
  }
  lines.push(
    `- **Checks:** ${counts.fail} failed, ${counts.pass} passed, ${counts.unavailable} unavailable`,
  );
  lines.push("");

  if (!result.reachable) {
    lines.push(
      `> **Site could not be reached.** ${result.unreachableReason}`,
    );
    lines.push(">");
    lines.push(
      "> Every check is recorded as `unavailable`. No finding is inferred from a site that could not be loaded.",
    );
    lines.push("");
    return lines.join("\n");
  }

  if (result.valueBasis === "neutral-no-rating-data") {
    lines.push(VALUE_NOTE);
    lines.push("");
  }

  if (result.screenshotDesktop || result.screenshotMobile) {
    if (result.screenshotDesktop) {
      lines.push(`![Desktop, 1440x900](${fromReport(result.screenshotDesktop)})`);
      lines.push("");
    }
    if (result.screenshotMobile) {
      lines.push(`![Mobile, 390x844](${fromReport(result.screenshotMobile)})`);
      lines.push("");
    }
  }

  const worst = failedChecks(result).slice(0, 3);
  if (worst.length > 0) {
    lines.push("### What a visitor runs into");
    lines.push("");
    worst.forEach((check, i) => {
      lines.push(`${i + 1}. ${check.plain}`);
    });
    lines.push("");
  } else {
    lines.push("### What a visitor runs into");
    lines.push("");
    lines.push("Nothing failed that we could measure.");
    lines.push("");
  }

  lines.push("<details><summary>All checks</summary>");
  lines.push("");
  lines.push("| Check | Status | Evidence |");
  lines.push("| --- | --- | --- |");
  for (const check of result.checks) {
    lines.push(
      `| ${escapeCell(check.label)} | ${check.status} | ${escapeCell(check.evidence)} |`,
    );
  }
  lines.push("");
  lines.push("</details>");
  lines.push("");
  return lines.join("\n");
}

export interface ReportInput {
  results: readonly AuditResult[];
  /** Leads with no website; they get no audit and are listed separately. */
  noWebsite: readonly LeadRow[];
  generatedAt: string;
}

export function renderReport(input: ReportInput): string {
  const ranked = [...input.results].sort((a, b) => b.score - a.score);
  const lines: string[] = [];

  lines.push("# Audit report");
  lines.push("");
  lines.push(
    `Generated ${input.generatedAt} · check version ${CHECK_VERSION} · ${ranked.length} site(s) audited.`,
  );
  lines.push("");
  lines.push(
    "Scores combine how neglected a site is with how established the business is. " +
      "Checks that could not complete are `unavailable` and are excluded from the score rather than counted as failures.",
  );
  lines.push("");

  lines.push("| # | Business | Score | Failed | Passed | Unavailable | Site |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");
  ranked.forEach((result, i) => {
    const counts = countByStatus(result);
    const site = result.reachable ? result.requestedUrl : `${result.requestedUrl} (unreachable)`;
    lines.push(
      `| ${i + 1} | ${escapeCell(result.name)} | ${result.score} | ${counts.fail} | ${counts.pass} | ${counts.unavailable} | ${escapeCell(site)} |`,
    );
  });
  lines.push("");

  if (input.noWebsite.length > 0) {
    lines.push("## Leads with no website");
    lines.push("");
    lines.push(
      "These were not audited — there is nothing to audit. They belong in `data/no-site.csv`.",
    );
    lines.push("");
    for (const row of input.noWebsite) {
      lines.push(`- ${row.name}${row.city ? ` (${row.city})` : ""}`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  for (const result of ranked) {
    lines.push(renderOnePager(result));
  }

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n")}\n`;
}

export function writeReport(file: string, contents: string): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, contents, "utf8");
}
