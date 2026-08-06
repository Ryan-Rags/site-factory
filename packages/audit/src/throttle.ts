const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Enforces the crawl limit from CLAUDE.md: at most one page navigation per
 * second per domain, and at most ten navigations per site. A Lighthouse run
 * counts as a single navigation even though it issues many sub-requests, which
 * is the reading approved in Q4.
 *
 * Sub-resource requests the browser makes on its own are not navigations and
 * are not counted; the standalone HEAD requests the broken-link check issues
 * are throttled through {@link wait} for politeness without consuming budget.
 */
export class NavigationBudget {
  readonly minIntervalMs: number;
  readonly maxPerHost: number;
  #lastAt = new Map<string, number>();
  #used = new Map<string, number>();

  constructor(minIntervalMs = 1000, maxPerHost = 10) {
    this.minIntervalMs = minIntervalMs;
    this.maxPerHost = maxPerHost;
  }

  used(host: string): number {
    return this.#used.get(host) ?? 0;
  }

  remaining(host: string): number {
    return this.maxPerHost - this.used(host);
  }

  /** Space requests to this host without consuming navigation budget. */
  async wait(host: string): Promise<void> {
    const last = this.#lastAt.get(host);
    if (last !== undefined) {
      const remaining = this.minIntervalMs - (Date.now() - last);
      if (remaining > 0) await sleep(remaining);
    }
    this.#lastAt.set(host, Date.now());
  }

  /** Space *and* consume one navigation. Throws once the site cap is hit. */
  async acquire(host: string): Promise<void> {
    const used = this.used(host);
    if (used >= this.maxPerHost) {
      throw new Error(
        `Navigation budget exhausted for ${host}: ${this.maxPerHost} page navigations/site.`,
      );
    }
    await this.wait(host);
    this.#used.set(host, used + 1);
  }
}
