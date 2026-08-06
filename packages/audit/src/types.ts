/**
 * Bump when a check's meaning changes. The cache key is slug + this version,
 * so a bump invalidates stale results rather than silently mixing them.
 */
export const CHECK_VERSION = 1;

/**
 * `unavailable` is a first-class outcome, not an error path. A check that
 * could not complete is recorded as such and excluded from scoring; it is
 * never downgraded to a `fail` or guessed at.
 */
export type CheckStatus = "pass" | "fail" | "unavailable";

export interface CheckResult {
  id: string;
  /** Short technical name, used in the report table. */
  label: string;
  status: CheckStatus;
  /** The measured value, or the reason the check could not run. */
  evidence: string;
  /** Relative contribution to the neglect score when this check fails. */
  weight: number;
  /**
   * The problem in plain English, for the report one-pager and outreach.
   * Only meaningful when `status` is `fail`.
   */
  plain: string;
}

export type ValueBasis = "ratings" | "neutral-no-rating-data";

export interface AuditResult {
  slug: string;
  name: string;
  requestedUrl: string;
  finalUrl: string;
  niche: string;
  city: string;
  phone: string;
  rating: string;
  reviewCount: string;

  checkVersion: number;
  auditedAt: string;

  /** False when the site could not be loaded at all. */
  reachable: boolean;
  /** Why the site could not be loaded, when `reachable` is false. */
  unreachableReason: string;

  checks: CheckResult[];

  /** 0-1, share of decided weight that failed. Undefined when nothing decided. */
  neglect: number | undefined;
  valueMultiplier: number;
  valueBasis: ValueBasis;
  /** 0-100. Zero when nothing could be decided. */
  score: number;

  /** Paths relative to the repo root, or empty when not captured. */
  screenshotDesktop: string;
  screenshotMobile: string;

  /** Headings actually found on the page, for the mockup brief. */
  services: string[];
}

/** Checks that were decided, worst first. */
export function failedChecks(result: AuditResult): CheckResult[] {
  return result.checks
    .filter((c) => c.status === "fail")
    .sort((a, b) => b.weight - a.weight);
}

export function countByStatus(result: AuditResult): Record<CheckStatus, number> {
  const counts: Record<CheckStatus, number> = { pass: 0, fail: 0, unavailable: 0 };
  for (const check of result.checks) counts[check.status] += 1;
  return counts;
}
