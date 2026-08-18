/**
 * Prove the server is serving the client the caller is about to grade.
 *
 * `astro preview` walks to the next free port silently, this repo is worked on
 * in a dozen worktrees at once, and a browser gate that reports green against
 * another stream's build is worse than no gate at all — it is a gate that
 * costs an afternoon before anybody works out which build it measured. That
 * has now happened three recorded times: PR #19 (known-issues #3), PR #21, and
 * again in `fix/launch-blockers`. Ruled 2026-08-13: every browser gate
 * verifies the served slug before it measures. Issue #37 is the backfill.
 *
 * The check itself is four lines, which is exactly why it had been copied into
 * three gates and forgotten in the fourth. It lives here now so that writing a
 * fifth browser gate means importing this rather than remembering it.
 *
 * WHAT IDENTIFIES A BUILD: `DesignLayout` links
 * `/icons/<slug>/site.webmanifest`, so a served page names its own client. The
 * slug is read out of that href rather than out of any page text, because the
 * text is the thing under test and an assertion that reads its own subject
 * proves nothing.
 *
 * Works with both drivers this repo uses: the browser gates run
 * `puppeteer-core` and the live suite runs Playwright, and `page.evaluate` is
 * the same call on each.
 */

/**
 * The slug the currently-loaded page belongs to, or `null` when the page
 * carries no manifest link this recognises.
 *
 * @param page a puppeteer or playwright `Page`, already navigated.
 */
export async function servedSlug(page) {
  return page.evaluate(() => {
    const manifest = document.querySelector('link[rel="manifest"]')?.getAttribute('href') ?? '';
    return /\/icons\/([^/]+)\//.exec(manifest)?.[1] ?? null;
  });
}

/**
 * Assert the loaded page belongs to `slug`, or stop.
 *
 * Exits the process rather than throwing, by default, because that is what the
 * three gates carrying this check already did and a gate's job on a mismatch
 * is to stop being trusted immediately. `onMismatch: 'throw'` is for a caller
 * that measures two origins and wants to say which end was wrong.
 *
 * @param page      a navigated `Page`.
 * @param slug      the client the caller intends to measure.
 * @param base      the URL that was navigated, for the message.
 * @param label     optional prefix when a caller checks more than one origin.
 * @param onMismatch `'exit'` (default) or `'throw'`.
 */
export async function assertServedSlug(page, { slug, base, label = '', onMismatch = 'exit' }) {
  const served = await servedSlug(page);
  if (served === slug) return served;

  /*
   * The fuller of the two messages the copies carried, kept for everyone: it
   * names the cause, and the cause is not guessable from the symptom. Somebody
   * reading "is serving another client" has to already know that `astro
   * preview` moves ports silently to know what to do about it.
   */
  const where = label ? `${label}: ${base}` : base;
  const message =
    `${where} is serving "${served ?? 'an unrecognised build'}", not "${slug}".\n` +
    `Another preview server is probably on that port — astro preview moves to the\n` +
    `next free one silently. Start yours on a known port and set PREVIEW_URL.`;

  if (onMismatch === 'throw') throw new Error(message);
  console.error(message);
  process.exit(1);
}
