/**
 * §3.5 — the service worker, live.
 *
 * `verify-offline.mjs` owns the full route-by-route offline sweep. This is the
 * registration-and-cache smoke of it, pointed at the deployed origin: does the
 * worker the build declares actually register on the site as served, does it
 * fill a cache, and does it control a subsequent navigation.
 *
 * Two details are load-bearing and both are borrowed rather than rediscovered:
 *
 * 1. **The 10 s race.** `navigator.serviceWorker.ready` never resolves when
 *    registration failed — a missing or broken `/sw.js` leaves it pending
 *    forever rather than rejecting. Without the race the suite hangs instead of
 *    reporting the exact failure it exists to catch.
 *
 * 2. **The second load is a different route, not a reload.** `verify-offline`
 *    reloads to catch "a worker that only serves the page it was registered
 *    on"; navigating to `/services/` and asserting *that* response came through
 *    the worker makes the same claim more directly, and spends the navigation
 *    on a page the board needs a screenshot of anyway. `sw.js` is network-first
 *    for navigations, so `fromServiceWorker()` means the worker handled the
 *    request — which is the property being asserted — not that the bytes came
 *    from cache.
 *
 * Whether a client *should* have a worker is decided from the live page, not
 * from a config: `ServiceWorker.astro` emits either a register script or an
 * unregister script, so the served HTML says which build this is.
 */
import { FINDING, assertion, finding, request, summarise } from '../fleet.mjs';

/** `verify-offline.mjs`'s "actually rendered" probe, unchanged. */
function inspectPage() {
  const h1 = document.querySelector('h1');
  const root = getComputedStyle(document.documentElement);
  const styled = root.getPropertyValue('--color-primary') || root.getPropertyValue('--d-accent');
  return {
    h1: h1 ? h1.textContent.trim() : '',
    brandColour: styled.trim(),
  };
}

export function declaresWorker(html) {
  if (/serviceWorker\s*\.\s*register/.test(html)) return 'register';
  if (/serviceWorker\s*\.\s*getRegistrations/.test(html)) return 'unregister';
  return 'neither';
}

export async function run(ctx, session) {
  const { slug, origin, politeness, pages } = ctx;
  const assertions = [];
  const findings = [];

  const declared = declaresWorker(pages.get('/').body);

  // The first visit. This navigation also produces the board's `/` screenshot.
  const first = await session.visit('/');
  assertions.push(
    assertion('/ loads in a browser', first.status === 200, first.error || first.status, 200),
  );

  const swFile = await request(`${origin}/sw.js`, { politeness });

  if (declared !== 'register') {
    // Not a pass and not a skip: a build that ships no registration while its
    // siblings do is worth saying out loud.
    assertions.push(
      assertion(
        'the live build registers a service worker',
        false,
        declared === 'unregister'
          ? 'the live page unregisters workers (features.offline is off in this build)'
          : 'the live page neither registers nor unregisters a worker',
        'a registration script',
        `/sw.js answered ${swFile.status}`,
      ),
    );
    findings.push(
      finding(
        FINDING.OFFLINE,
        `${slug}: the live home page ships no service-worker registration ` +
          `(/sw.js → ${swFile.status}). The demo does not work without a connection.`,
      ),
    );
    return summarise('offline', 'Service worker', assertions, findings, { declared });
  }

  assertions.push(
    assertion('the live build registers a service worker', true, 'register script present'),
    assertion('/sw.js is served', swFile.status === 200, swFile.error || swFile.status, 200),
  );

  /*
   * Wait for activation, then for the precache to settle. `ready` resolves on
   * activation; the precache is a set of fetches started in `install`, so this
   * waits for the cache to stop growing rather than for a fixed sleep.
   */
  const state = await session.page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return { registered: false, reason: 'no serviceWorker API' };
    const ready = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((resolve) => setTimeout(() => resolve(null), 10_000)),
    ]);
    if (!ready || !ready.active) {
      return { registered: false, reason: 'no active registration within 10s' };
    }
    let previous = -1;
    let entries = 0;
    let name = '';
    for (let i = 0; i < 40; i += 1) {
      const names = await caches.keys();
      name = names[0] ?? '';
      const cache = names.length ? await caches.open(names[0]) : null;
      entries = cache ? (await cache.keys()).length : 0;
      if (entries > 0 && entries === previous) break;
      previous = entries;
      await new Promise((r) => setTimeout(r, 250));
    }
    return { registered: true, scriptURL: ready.active.scriptURL, cache: name, entries };
  });

  assertions.push(
    assertion(
      'a service worker is active',
      state.registered === true,
      state.registered ? state.scriptURL : state.reason,
      'an active registration',
    ),
  );

  if (!state.registered) {
    findings.push(
      finding(FINDING.OFFLINE, `${slug}: /sw.js is served but never activated — ${state.reason}`),
    );
    return summarise('offline', 'Service worker', assertions, findings, { declared, ...state });
  }

  assertions.push(
    assertion('the worker filled a cache', state.entries > 0, `${state.entries} entries in ${state.cache}`, '> 0 entries'),
  );

  // The second load, on a different route: a worker that only serves its
  // registration page fails here.
  const second = await session.visit('/services/');
  assertions.push(
    assertion('/services/ loads in a browser', second.status === 200, second.error || second.status, 200),
    assertion(
      '/services/ was served through the worker',
      second.fromServiceWorker === true,
      String(second.fromServiceWorker),
      'true',
      'sw.js is network-first for navigations; this asserts the worker handled it',
    ),
  );

  const facts = await session.page.evaluate(inspectPage).catch(() => ({ h1: '', brandColour: '' }));
  assertions.push(
    assertion('/services/ rendered', facts.h1 !== '', facts.h1 || '(no <h1> text)', 'a non-empty <h1>'),
    assertion(
      '/services/ has its brand custom property applied',
      facts.brandColour !== '',
      facts.brandColour || '(missing)',
      'a non-empty --color-primary or --d-accent',
      'the inlined stylesheet arrived; a 200 that is visibly broken fails here',
    ),
  );

  if (assertions.some((a) => !a.ok)) {
    findings.push(
      finding(FINDING.OFFLINE, `${slug}: the live service worker did not behave as the build declares`),
    );
  }

  return summarise('offline', 'Service worker', assertions, findings, {
    declared,
    cache: state.cache,
    entries: state.entries,
  });
}
