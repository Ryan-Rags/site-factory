import { type Browser, chromium } from "playwright";

/**
 * One Chromium, borrowed for the length of a callback.
 *
 * Playwright is already the audit package's screenshot engine; the demo
 * pipeline uses the same browser for four jobs — palette extraction, the
 * "before" shot of a live site, the "after" shot of the built demo, and
 * rendering the two cards — rather than adding an image library for any of
 * them. Nothing here is a new capability; it is the browser we already run.
 */
export async function withBrowser<T>(fn: (browser: Browser) => Promise<T>): Promise<T> {
  const browser = await chromium.launch();
  try {
    return await fn(browser);
  } finally {
    await browser.close();
  }
}

/** Screenshot one HTML string at a fixed size. Used for both cards. */
export async function shootHtml(
  browser: Browser,
  html: string,
  file: string,
  size: { width: number; height: number },
): Promise<void> {
  const context = await browser.newContext({
    viewport: size,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  try {
    await page.setContent(html, { waitUntil: "load" });
    // Fonts settle a frame or two after `load`; without this the card can be
    // captured mid-swap with the fallback stack still measured.
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: file });
  } finally {
    await context.close();
  }
}
