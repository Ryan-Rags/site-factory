import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Walk up from `start` until the pnpm workspace root is found. Every package
 * resolves shared paths through here so output lands in the same place no
 * matter which directory a command was invoked from.
 */
export function findRepoRoot(
  start: string = dirname(fileURLToPath(import.meta.url)),
): string {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(
        `Could not find the repo root: no pnpm-workspace.yaml above ${start}`,
      );
    }
    dir = parent;
  }
}

export const repoRoot: string = findRepoRoot();

export const dataDir: string = join(repoRoot, "data");
/** Real lead data. Gitignored — third-party business data is never committed. */
export const leadsFile: string = join(dataDir, "businesses.csv");
export const noSiteFile: string = join(dataDir, "no-site.csv");
/** The tracked fixture. */
export const sampleLeadsFile: string = join(dataDir, "businesses.sample.csv");

/** Generated audit artifacts. Gitignored. */
export const auditDir: string = join(repoRoot, "audit");
export const auditOutDir: string = join(auditDir, "out");
export const auditCacheDir: string = join(auditDir, ".cache");
export const auditReportFile: string = join(auditDir, "report.md");

/** Generated outreach artifacts. Gitignored. */
export const outreachDir: string = join(repoRoot, "outreach");
export const outreachSkippedFile: string = join(outreachDir, "skipped.md");
