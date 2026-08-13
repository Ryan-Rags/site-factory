/**
 * @site-factory/audit — read-only scoring of an existing business site.
 *
 * Every network interaction is a GET (or HEAD), rate limited per domain. A
 * check that cannot complete is recorded as `unavailable`; audit data is never
 * inferred, defaulted or fabricated.
 */

export const PACKAGE_NAME = "@site-factory/audit";

export { CHECK_VERSION, countByStatus, failedChecks } from "./types.js";
export type { AuditResult, CheckResult, CheckStatus, ValueBasis } from "./types.js";

export { readAllCached, readCached, writeCached } from "./cache.js";
export { CHECK_COUNT, runChecks } from "./checks.js";
export type { SiteEvidence } from "./checks.js";
export { scoreSite } from "./score.js";
export type { Score, ScoreInput } from "./score.js";
export { NavigationBudget } from "./throttle.js";
export { probeSite } from "./probe.js";
export type { PageProbe, ProbeOptions } from "./probe.js";
export { LH_CATEGORIES, runLighthouse } from "./lighthouse.js";
export type { LighthouseCategory, LighthouseOutcome, LighthouseScores } from "./lighthouse.js";
export { freePort } from "./port.js";
export { MAX_LINK_TARGETS, checkLinks, faviconReachable } from "./network.js";
export type { BrokenLinkReport, LinkCheck } from "./network.js";
export { renderReport, writeReport } from "./report.js";
export type { ReportInput } from "./report.js";
export { assignSlugs, auditOne } from "./run.js";
export type { AuditOneOptions } from "./run.js";
