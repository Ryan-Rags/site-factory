import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import type { Browser } from "playwright";

import { auditOutDir } from "./paths.js";

/**
 * Before/after screenshots.
 *
 * Both sides are shot at the same two viewports the audit package uses —
 * 1440x900 desktop and 390x844 mobile, full page. That is not a detail: the
 * pair goes in front of the prospect side by side, and shooting the two halves
 * at different sizes would make the comparison a lie.
 */

export const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const;

export type ViewportName = (typeof VIEWPORTS)[number]["name"];

/** Rate limit for third-party navigations: CLAUDE.md, 1/sec/domain. */
const THIRD_PARTY_INTERVAL_MS = 1100;
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const NAV_TIMEOUT_MS = 30_000;
/** Best-effort quiet period after `load`. Never fatal — see below. */
const SETTLE_TIMEOUT_MS = 8_000;

interface ShotOutcome {
  ok: boolean;
  error?: string;
}

async function shoot(
  browser: Browser,
  url: string,
  file: string,
  viewport: { width: number; height: number },
): Promise<ShotOutcome> {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  try {
    // `load`, not `networkidle`, and for a concrete reason: the sites worth
    // showing a "before" of are exactly the ones that never go idle. K-H's
    // Wix site keeps a socket busy indefinitely, so a `networkidle` wait timed
    // out and reported their perfectly reachable homepage as unloadable —
    // losing the strongest half of the pitch. `packages/audit/src/probe.ts`
    // settled on `load` for the same reason; this now matches it.
    const response = await page.goto(url, { waitUntil: "load", timeout: NAV_TIMEOUT_MS });
    if (!response) return { ok: false, error: "no response" };
    await page.waitForLoadState("networkidle", { timeout: SETTLE_TIMEOUT_MS }).catch(() => undefined);
    // Lazy images below the fold render empty in a full-page shot unless the
    // page has actually been scrolled through first.
    await page.evaluate(async () => {
      const step = window.innerHeight;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForLoadState("networkidle", { timeout: SETTLE_TIMEOUT_MS }).catch(() => undefined);
    await page.screenshot({ path: file, fullPage: true });
    return { ok: true };
  } catch (err) {
    // The real message, not a generic one: "could not be loaded" was reported
    // for a site that had loaded fine seconds earlier, which sent the reader
    // looking at the wrong thing entirely.
    return { ok: false, error: (err as Error).message.split("\n")[0] ?? "unknown error" };
  } finally {
    await context.close();
  }
}

export interface ShotSet {
  desktop?: string;
  mobile?: string;
  /**
   * Where the shots came from, for the manifest and the card.
   *
   * `on-disk` is its own value and not folded into `audit-cache`: they are
   * different provenances — one is the audit package's crawl, the other is
   * this pipeline's own earlier capture of the same site — and a manifest that
   * called the second one the first would be recording something untrue about
   * where a picture came from.
   */
  source: "audit-cache" | "on-disk" | "captured" | "none";
  /** Why there is no before shot, when there is none. */
  reason?: string;
}

/** The new demo, served from disk on localhost. No rate limit applies. */
export async function captureAfter(
  browser: Browser,
  origin: string,
  outDir: string,
): Promise<ShotSet> {
  mkdirSync(outDir, { recursive: true });
  const out: ShotSet = { source: "captured" };
  for (const viewport of VIEWPORTS) {
    const file = join(outDir, `after-${viewport.name}.png`);
    const result = await shoot(browser, origin, file, {
      width: viewport.width,
      height: viewport.height,
    });
    if (result.ok) out[viewport.name] = file;
  }
  return out;
}

/**
 * Their current homepage.
 *
 * Reuses `audit/out/<slug>/` when the audit package has already been there —
 * that is a page navigation we do not need to repeat against someone else's
 * server. Failing that, it reuses the before-shots THIS pipeline already left
 * in `outDir` on an earlier run. Otherwise it captures the two shots itself,
 * one second apart.
 *
 * The second source was added for the #61 rebuild, which re-ran all 50 demos
 * to change one image. 30 of them have a live site, so a plain re-run meant 60
 * navigations against third parties to re-learn what was already on disk —
 * and worse, it put yesterday's evidence at the mercy of today's uptime: a
 * shop whose site is down this morning would have had a real "before" replaced
 * by `none`, silently degrading the leave-behind. A re-run must never be able
 * to make a demo worse.
 *
 * A prospect with no current website returns `source: 'none'` with a reason.
 * That is an expected outcome, not a failure: three of the five prospects in
 * this repo have no site at all, and inventing a "before" for them would be
 * the single most dishonest thing this pipeline could do.
 */
export async function captureBefore(
  browser: Browser,
  slug: string,
  siteUrl: string | undefined,
  outDir: string,
): Promise<ShotSet> {
  mkdirSync(outDir, { recursive: true });

  const cached: ShotSet = { source: "audit-cache" };
  let foundCached = false;
  for (const viewport of VIEWPORTS) {
    const from = join(auditOutDir, slug, `${viewport.name}.png`);
    if (!existsSync(from)) continue;
    const to = join(outDir, `before-${viewport.name}.png`);
    copyFileSync(from, to);
    cached[viewport.name] = to;
    foundCached = true;
  }
  if (foundCached) return cached;

  const onDisk: ShotSet = { source: "on-disk" };
  let foundOnDisk = false;
  for (const viewport of VIEWPORTS) {
    const file = join(outDir, `before-${viewport.name}.png`);
    if (!existsSync(file)) continue;
    onDisk[viewport.name] = file;
    foundOnDisk = true;
  }
  if (foundOnDisk) return onDisk;

  if (!siteUrl) {
    return {
      source: "none",
      reason: "this prospect has no current website, so there is no 'before' to show",
    };
  }

  const out: ShotSet = { source: "captured" };
  let captured = false;
  let lastError = "no error reported";
  for (const [index, viewport] of VIEWPORTS.entries()) {
    if (index > 0) await sleep(THIRD_PARTY_INTERVAL_MS);
    const file = join(outDir, `before-${viewport.name}.png`);
    const result = await shoot(browser, siteUrl, file, {
      width: viewport.width,
      height: viewport.height,
    });
    if (result.ok) {
      out[viewport.name] = file;
      captured = true;
    } else if (result.error) {
      lastError = result.error;
    }
  }
  if (!captured) {
    return { source: "none", reason: `their site at ${siteUrl} could not be captured: ${lastError}` };
  }
  return out;
}
