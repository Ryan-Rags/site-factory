import { auditOutDir, uniqueSlug, type LeadRow } from "@site-factory/discover";
import type { Browser } from "playwright";

import { runChecks } from "./checks.js";
import { runLighthouse } from "./lighthouse.js";
import { checkLinks, faviconReachable } from "./network.js";
import { probeSite } from "./probe.js";
import { scoreSite } from "./score.js";
import { NavigationBudget } from "./throttle.js";
import { CHECK_VERSION, type AuditResult } from "./types.js";

/** Stable slugs, assigned in file order so they survive across runs. */
export function assignSlugs(rows: readonly LeadRow[]): Map<LeadRow, string> {
  const taken = new Set<string>();
  const slugs = new Map<LeadRow, string>();
  for (const row of rows) slugs.set(row, uniqueSlug(row.name, taken));
  return slugs;
}

export interface AuditOneOptions {
  browser: Browser;
  /** CDP port the browser is listening on, for Lighthouse to attach to. */
  debugPort: number;
  row: LeadRow;
  slug: string;
  now: Date;
}

/**
 * Audit one site. Three page navigations at most: desktop load, mobile load,
 * and the Lighthouse run — well inside the ten-per-site cap.
 */
export async function auditOne(opts: AuditOneOptions): Promise<AuditResult> {
  const budget = new NavigationBudget();
  const probe = await probeSite({
    browser: opts.browser,
    url: opts.row.url,
    slug: opts.slug,
    budget,
    outDir: auditOutDir,
  });

  const target = probe.finalUrl || opts.row.url;
  const lighthouse = probe.loaded
    ? await (async () => {
        await budget.acquire(probe.host);
        return runLighthouse(target, opts.debugPort);
      })()
    : { scores: undefined, error: "Site could not be loaded." };

  const links = probe.loaded
    ? await checkLinks(probe.sameHostLinks, probe.host, budget)
    : undefined;

  const faviconFallback =
    probe.loaded && !probe.hasFaviconTag
      ? await faviconReachable(target, budget)
      : undefined;

  const checks = runChecks({ probe, lighthouse, links, faviconFallback, now: opts.now });
  const score = scoreSite({
    checks,
    rating: opts.row.rating,
    reviewCount: opts.row.review_count,
  });

  return {
    slug: opts.slug,
    name: opts.row.name,
    requestedUrl: opts.row.url,
    finalUrl: probe.finalUrl,
    niche: opts.row.niche,
    city: opts.row.city,
    phone: opts.row.phone,
    rating: opts.row.rating,
    reviewCount: opts.row.review_count,

    checkVersion: CHECK_VERSION,
    auditedAt: opts.now.toISOString(),

    reachable: probe.loaded,
    unreachableReason: probe.loadError,

    checks,
    neglect: score.neglect,
    valueMultiplier: score.valueMultiplier,
    valueBasis: score.valueBasis,
    score: score.score,

    screenshotDesktop: probe.screenshotDesktop,
    screenshotMobile: probe.screenshotMobile,

    services: Array.from(new Set(probe.headings)).slice(0, 8),
  };
}
