import { freePort } from "@site-factory/audit";
import type { Browser } from "playwright";

import { assess, type AssessOptions, type AssessOutcome } from "./run.js";

/**
 * The browser the audit stage runs on, and the DevTools port that has to travel
 * with it.
 *
 * Playwright hands back a `Browser` object; Lighthouse does not use it. It
 * attaches over the DevTools protocol to a TCP port, and the browser only opens
 * that port if `--remote-debugging-port` was passed **at launch** — it cannot be
 * turned on afterwards. So the port has to be chosen before the launch and then
 * carried alongside the browser to whoever runs Lighthouse.
 *
 * Getting that wrong fails silently, which is why the two are returned together
 * here rather than tracked separately by each caller. `runLighthouse` cannot
 * connect, `lighthouseCheck` records all four Lighthouse checks as
 * `unavailable`, and `scoreSite` — correctly — computes neglect only over the
 * checks that returned a verdict. The result is a plausible neglect score
 * measured over the probe checks alone, with nothing thrown and nothing logged.
 *
 * `packages/audit`'s CLI has always done this. The sweep did not.
 *
 * `freePort` is `@site-factory/audit`'s, not a copy of it — the port and the
 * Lighthouse run that consumes it belong to the same package.
 */

/**
 * Just enough of playwright's `BrowserType` to launch one. Narrowed to what is
 * used so tests can pass a stand-in and assert on the launch arguments without
 * starting a real browser.
 */
export interface BrowserLauncher {
  launch(options: { args: string[] }): Promise<Browser>;
}

export interface AuditBrowser {
  browser: Browser;
  /** The port the browser is listening on, for Lighthouse to attach to. */
  debugPort: number;
}

/**
 * Launch Chromium with a DevTools port open, and report which port that is.
 *
 * `launcher` defaults to playwright's `chromium`, imported lazily so a `--help`
 * or a sweep that audits nothing never pays for loading it.
 */
export async function launchAuditBrowser(
  launcher?: BrowserLauncher | undefined,
): Promise<AuditBrowser> {
  const debugPort = await freePort();
  const browserType: BrowserLauncher = launcher ?? (await import("playwright")).chromium;
  const browser = await browserType.launch({
    args: [`--remote-debugging-port=${debugPort}`],
  });
  return { browser, debugPort };
}

export type AssessFn = (options: AssessOptions) => Promise<AssessOutcome>;

export interface AuditStageOptions extends Omit<AssessOptions, "browser" | "debugPort"> {
  /** Test seam. Defaults to playwright's `chromium`. */
  launcher?: BrowserLauncher | undefined;
  /** Test seam. Defaults to `assess`. */
  assessImpl?: AssessFn | undefined;
}

/**
 * The sweep's whole audit stage: own a browser with a debugging port open, run
 * the assessment through it, and close the browser however that turns out.
 *
 * A caller cannot forget to pass the port on, because it never has the port —
 * that is the point of the function.
 */
export async function runAuditStage(options: AuditStageOptions): Promise<AssessOutcome> {
  const { launcher, assessImpl, ...rest } = options;
  const { browser, debugPort } = await launchAuditBrowser(launcher);
  try {
    return await (assessImpl ?? assess)({ ...rest, browser, debugPort });
  } finally {
    await browser.close();
  }
}
