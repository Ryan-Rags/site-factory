/**
 * The one browser session a client gets, and the navigation accounting that
 * goes with it.
 *
 * A fresh context per client, for the reason `verify-offline.mjs` records: a
 * service worker registered by one demo must not be able to serve another's
 * pages and make a check pass by accident.
 *
 * The debugging port is opened **at launch** and carried, because that is the
 * only time it can be. `packages/audit/src/port.ts` and known-issues #3 both
 * record what happens without it — Lighthouse cannot attach, every LH-derived
 * value silently reads `unavailable`, and nothing is thrown or logged — and the
 * ledger of 2026-08-12 made `debugPort` required for exactly that reason. The
 * port this session launched with is reported alongside the scores, so the run
 * can be checked rather than trusted.
 *
 * Navigations are the scarce resource: claude.md allows ten per site, and every
 * `visit()` here spends one through the shared `Politeness` gate. The ledger
 * for one client is
 *
 *     /            1   service-worker registration + board shot
 *     /services/   1   the worker's second load + board shot
 *     /about/      1   board shot
 *     /contact/    1   board shot
 *     lighthouse   1
 *     customizer   4   three legal cells + one illegal (design clients only)
 *                 ---
 *                  9   of 10
 *
 * one spare, deliberately: a suite that fails a client because it ran out of
 * budget rather than because the client is broken is reporting on itself.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { MOBILE, hostOf } from './fleet.mjs';

/** `/services/` -> `services`, `/` -> `home`. Stable, and safe as a filename. */
export const routeKey = (route) =>
  route === '/' ? 'home' : route.replace(/^\/|\/$/g, '').replace(/\//g, '-');

export async function openSession({ slug, origin, politeness, chromium, freePort, shotsDir }) {
  const port = await freePort();
  const browser = await chromium.launch({
    args: [`--remote-debugging-port=${port}`],
  });
  const context = await browser.newContext({ viewport: { ...MOBILE } });
  const page = await context.newPage();
  const host = hostOf(origin);
  mkdirSync(shotsDir, { recursive: true });

  const shots = [];

  /**
   * One page navigation: budget spent, then the goto, then optionally the shot.
   *
   * `waitUntil: 'load'` rather than `networkidle`, for the reason
   * `compare.mjs` documents: a page that never reaches network idle is a page
   * that loads fine with something long-polling on it, and calling that "would
   * not load" overstates our side.
   */
  async function visit(route, { shot = true, query = '' } = {}) {
    await politeness.navigate(host);
    const url = `${origin}${route}${query}`;
    const record = { route, url, status: 0, error: '', file: null, fromServiceWorker: null };
    try {
      const response = await page.goto(url, { waitUntil: 'load', timeout: 45_000 });
      record.status = response ? response.status() : 0;
      record.fromServiceWorker = response ? response.fromServiceWorker() : null;
      await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {});
      if (shot) {
        const file = `${slug}-${routeKey(route)}.png`;
        await page.screenshot({ path: join(shotsDir, file), fullPage: true });
        record.file = file;
        shots.push(record);
      }
    } catch (err) {
      record.error = err.message.split('\n')[0];
      if (shot) shots.push(record);
    }
    return record;
  }

  return {
    port,
    page,
    context,
    browser,
    shots,
    visit,
    async close() {
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
    },
  };
}
