import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { auditCacheDir } from "@site-factory/discover";

import { CHECK_VERSION, type AuditResult } from "./types.js";

function cacheFile(slug: string): string {
  return join(auditCacheDir, `${slug}.json`);
}

/**
 * Read a cached result, but only if it was produced by the current check
 * version. A stale entry is treated as a miss rather than migrated, because
 * the checks it recorded no longer mean the same thing.
 */
export function readCached(slug: string): AuditResult | undefined {
  const file = cacheFile(slug);
  if (!existsSync(file)) return undefined;
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as AuditResult;
    if (parsed.checkVersion !== CHECK_VERSION) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

/**
 * Written per site rather than at the end of the run, so an interrupted run
 * resumes instead of starting over.
 */
export function writeCached(result: AuditResult): void {
  mkdirSync(auditCacheDir, { recursive: true });
  writeFileSync(cacheFile(result.slug), `${JSON.stringify(result, null, 2)}\n`, "utf8");
}

/** Every cached result for the current check version. */
export function readAllCached(slugs: readonly string[]): AuditResult[] {
  const out: AuditResult[] = [];
  for (const slug of slugs) {
    const cached = readCached(slug);
    if (cached) out.push(cached);
  }
  return out;
}
