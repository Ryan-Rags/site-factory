import { hostOf } from "@site-factory/discover";

import type { NavigationBudget } from "./throttle.js";

const REQUEST_TIMEOUT_MS = 10_000;
/** Cap from the plan: at most ten link targets probed per site. */
export const MAX_LINK_TARGETS = 10;

export interface LinkCheck {
  url: string;
  status: number | undefined;
  ok: boolean;
  error: string;
}

export interface BrokenLinkReport {
  checked: number;
  skipped: number;
  broken: LinkCheck[];
  /** True when nothing could be probed at all, so the check is unavailable. */
  inconclusive: boolean;
}

async function head(url: string): Promise<LinkCheck> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
    });
    // Some servers reject HEAD outright; that is not a broken link.
    const methodRejected = res.status === 405 || res.status === 501;
    return {
      url,
      status: res.status,
      ok: res.ok || methodRejected,
      error: "",
    };
  } catch (err: unknown) {
    return {
      url,
      status: undefined,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Probe up to {@link MAX_LINK_TARGETS} same-host links with HEAD requests,
 * spaced one second apart. These are not page navigations so they do not
 * consume navigation budget, but they are throttled the same way.
 */
export async function checkLinks(
  links: readonly string[],
  host: string,
  budget: NavigationBudget,
): Promise<BrokenLinkReport> {
  const targets = links.slice(0, MAX_LINK_TARGETS);
  const skipped = Math.max(0, links.length - targets.length);
  const broken: LinkCheck[] = [];
  let conclusive = 0;

  for (const url of targets) {
    await budget.wait(host);
    const result = await head(url);
    if (result.status !== undefined) conclusive += 1;
    if (!result.ok) broken.push(result);
  }

  return {
    checked: targets.length,
    skipped,
    broken,
    inconclusive: targets.length > 0 && conclusive === 0,
  };
}

/**
 * Whether `/favicon.ico` resolves, used only when the page has no icon link
 * tag. Undefined means the request itself failed, which is not evidence.
 */
export async function faviconReachable(
  pageUrl: string,
  budget: NavigationBudget,
): Promise<boolean | undefined> {
  const host = hostOf(pageUrl);
  if (!host) return undefined;
  try {
    const origin = new URL(pageUrl).origin;
    await budget.wait(host);
    const result = await head(`${origin}/favicon.ico`);
    if (result.status === undefined) return undefined;
    return result.status >= 200 && result.status < 400;
  } catch {
    return undefined;
  }
}
