/**
 * Live fetch primitives, and the politeness gate every live-smoke check goes
 * through.
 *
 * Two rules govern everything in this directory:
 *
 * 1. **Every expectation is derived from the live response.** Nothing here may
 *    read `packages/template/dist/`. The deployed artifact and the local build
 *    are demonstrably different things — the live `kh-machine-works` declares
 *    `og:image = https://www.khmachineworks.com/og/kh-machine-works.png` while
 *    the local build declares `…/images/og.svg` — so a check that took its
 *    expectation from `dist/` would be grading a build nobody is serving and
 *    could report green on a deploy nobody has looked at.
 *
 * 2. **Read-only, and slowly.** Every request is a GET, a HEAD or an OPTIONS,
 *    with exactly one exception: the honeypot POST in `checks/form.mjs`, which
 *    is short-circuited by the Worker before it can create anything. Rate
 *    limits are claude.md's: at most one page navigation per second per domain
 *    and ten per site.
 *
 * The one number worth explaining is the two-tier interval. `NavigationBudget`
 * spaces everything by a single `minIntervalMs`, and this suite has two kinds
 * of traffic with different costs: browser navigations (expensive, and what
 * claude.md's "1/sec/domain" is about) and bare `fetch` probes (a single
 * response, no sub-resources). PLAN-live-smoke §2 set 500 ms. So the budget is
 * constructed at 500 ms — which is what bare probes get — and navigations are
 * additionally held to a 1000 ms floor here, so the suite is never faster than
 * claude.md's limit on the traffic that limit names. See `navigate()`.
 */
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { repoRoot } from '../pitch/paths.mjs';

/** The phone viewport `shoot.mjs` and `verify-offline.mjs` already use. */
export const MOBILE = { width: 390, height: 844 };

/**
 * The routes every client emits. `/gallery/` is deliberately absent: no client
 * in the registry sets `features.gallery`, and `routeSetFor()` reads the live
 * page's own nav rather than hard-coding a second list if one ever does.
 */
export const ROUTES = ['/', '/services/', '/about/', '/contact/'];

/** A URL that exists on no client, to prove the designed 404 is what answers. */
export const MISSING_ROUTE = '/definitely-not-a-page';

/** The `<h1>` of `src/pages/404.astro` — the marker `verify-offline.mjs` keys on. */
export const NOT_FOUND_H1 = "That page isn't here.";

export const hostOf = (url) => {
  try {
    return new URL(url).host;
  } catch {
    return String(url);
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Borrow `@site-factory/audit`'s built output rather than re-implementing its
 * Lighthouse call and its budget. Same reasoning as `scripts/pitch/compare.mjs`:
 * a second copy of those settings would drift, and two numbers produced
 * differently are not a measurement of the same thing.
 */
export async function loadAudit() {
  const dist = join(repoRoot, 'packages', 'audit', 'dist', 'index.js');
  try {
    return await import(pathToFileURL(dist).href);
  } catch (err) {
    throw new Error(
      `Could not load packages/audit/dist. Run \`pnpm -r build\` first.\n${err.message}`,
    );
  }
}

/** Playwright lives in packages/audit's tree; pnpm does not hoist it. */
export async function loadPlaywright() {
  const require = createRequire(join(repoRoot, 'packages', 'audit', 'package.json'));
  const mod = await import(pathToFileURL(require.resolve('playwright')).href);
  return mod.chromium ? mod : mod.default;
}

/**
 * The rate limit, plus the accounting that lets the report prove it was kept.
 *
 * `budget` is `@site-factory/audit`'s `NavigationBudget`, unmodified — the same
 * object the audit CLI and the pitch comparison use. What this class adds is
 * the navigation floor described in the file header and a ledger, so the report
 * can print what was actually spent per host instead of asserting politeness.
 */
export class Politeness {
  constructor(NavigationBudget, { probeIntervalMs = 500, navIntervalMs = 1000, maxPerHost = 10 } = {}) {
    this.budget = new NavigationBudget(probeIntervalMs, maxPerHost);
    this.probeIntervalMs = probeIntervalMs;
    this.navIntervalMs = navIntervalMs;
    this.maxPerHost = maxPerHost;
    /** host -> { probes, navigations, lastNavAt, minNavGapMs } */
    this.hosts = new Map();
  }

  #entry(host) {
    let e = this.hosts.get(host);
    if (!e) {
      e = { probes: 0, navigations: 0, lastNavAt: 0, minNavGapMs: Infinity };
      this.hosts.set(host, e);
    }
    return e;
  }

  /** Space a bare request. Costs politeness time, not navigation budget. */
  async probe(host) {
    await this.budget.wait(host);
    this.#entry(host).probes += 1;
  }

  /**
   * Space *and* consume one page navigation.
   *
   * The extra floor: `NavigationBudget` was constructed at the 500 ms probe
   * interval, and claude.md's limit is one *navigation* per second per domain.
   * Sleeping the difference here keeps both — probes at 500 ms, navigations at
   * 1000 ms — without a second budget object that would track its own,
   * separate idea of how many navigations a host has had.
   */
  async navigate(host) {
    const e = this.#entry(host);
    if (e.lastNavAt !== 0) {
      const owed = this.navIntervalMs - (Date.now() - e.lastNavAt);
      if (owed > 0) await sleep(owed);
    }
    await this.budget.acquire(host);
    const now = Date.now();
    if (e.lastNavAt !== 0) e.minNavGapMs = Math.min(e.minNavGapMs, now - e.lastNavAt);
    e.lastNavAt = now;
    e.navigations += 1;
  }

  remaining(host) {
    return this.budget.remaining(host);
  }

  /** What was spent, per host, for the report. */
  ledger() {
    return [...this.hosts.entries()].map(([host, e]) => ({
      host,
      probes: e.probes,
      navigations: e.navigations,
      maxPerHost: this.maxPerHost,
      minNavGapMs: Number.isFinite(e.minNavGapMs) ? e.minNavGapMs : null,
    }));
  }
}

/**
 * One live request, recorded rather than thrown.
 *
 * A network error is data here, not an exception: "the host does not resolve"
 * is one of the findings this suite exists to produce, and a throw would lose
 * the URL that failed. Every field the checks assert on comes off this object.
 */
export async function request(url, { politeness, method = 'GET', headers = {}, body, redirect = 'follow', read = 'text' } = {}) {
  const host = hostOf(url);
  if (politeness) await politeness.probe(host);

  const record = {
    url,
    method,
    status: 0,
    ok: false,
    headers: {},
    body: '',
    bytes: null,
    contentType: '',
    error: '',
    redirectedTo: '',
  };

  try {
    const res = await fetch(url, { method, headers, body, redirect });
    record.status = res.status;
    record.ok = res.status >= 200 && res.status < 300;
    for (const [k, v] of res.headers) record.headers[k.toLowerCase()] = v;
    record.contentType = record.headers['content-type'] ?? '';
    if (res.redirected || (res.url && res.url !== url)) record.redirectedTo = res.url;
    if (method === 'HEAD') {
      // Nothing to read, and reading would hang on some servers.
    } else if (read === 'bytes') {
      record.bytes = Buffer.from(await res.arrayBuffer());
    } else {
      record.body = await res.text();
    }
  } catch (err) {
    // `fetch` wraps DNS and TLS failures in a generic TypeError; the cause
    // carries the code that actually says what happened, and that code is the
    // finding — "ENOTFOUND" and "CERT_HAS_EXPIRED" are different problems.
    const cause = err?.cause?.code ?? err?.cause?.message ?? '';
    record.error = cause ? `${err.message} (${cause})` : err.message;
  }
  return record;
}

/** `<link rel="canonical">` on the live page — the origin the build was made for. */
export function canonicalOrigin(html) {
  const href = /<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i.exec(html)?.[1]
    ?? /<link[^>]+href=["']([^"']+)["'][^>]*rel=["']canonical["']/i.exec(html)?.[1];
  if (!href) return null;
  try {
    return new URL(href).origin;
  } catch {
    return null;
  }
}

/**
 * Which client this live origin is actually serving.
 *
 * `check-switching.mjs` reads the slug out of the manifest link for exactly
 * this reason and records why: a gate that can report green on the wrong build
 * is worse than no gate. The risk is different here — not a moved port, but a
 * Pages project name that was substituted at deploy time (`-preview-rr`) or a
 * project pointed at another client's `dist/` — and the answer is the same. The
 * template emits `/icons/<slug>/site.webmanifest`, so the served build names
 * itself.
 */
export function servedSlug(html) {
  const href = /<link[^>]+rel=["']manifest["'][^>]*href=["']([^"']+)["']/i.exec(html)?.[1] ?? '';
  return /\/icons\/([^/]+)\//.exec(href)?.[1] ?? null;
}

/**
 * The route set, read off the live home page's own nav, unioned with ROUTES.
 *
 * Hard-coding the four routes twice is what §3.1 set out to avoid: a client who
 * one day sets `features.gallery` would otherwise get a suite that silently
 * never looked at the extra page. Only same-origin, non-anchor paths count, and
 * everything is normalised to the slashed spelling the build emits.
 */
export function routeSetFor(html) {
  const found = new Set(ROUTES);
  for (const m of html.matchAll(/<nav[\s\S]*?<\/nav>/gi)) {
    for (const a of m[0].matchAll(/href=["'](\/[^"'#?]*)["']/gi)) {
      const path = a[1].endsWith('/') ? a[1] : `${a[1]}/`;
      // Assets are linked from nav on no client, but a defensive filter here
      // costs nothing and keeps a stray `/favicon.ico` out of the route list.
      if (/\.[a-z0-9]{2,5}$/i.test(path)) continue;
      found.add(path);
    }
  }
  return [...found].sort((a, b) => (a === '/' ? -1 : b === '/' ? 1 : a.localeCompare(b)));
}

/** One assertion, as the report prints it. */
export const assertion = (label, ok, value, expected = null, note = '') => ({
  label,
  ok,
  value,
  expected,
  note,
});

/**
 * Findings are grouped by class so two clients broken the same way read as one
 * problem. The names are fixed here rather than written at each call site,
 * because a class that gets spelled two ways stops grouping and the report
 * quietly goes back to being a list.
 */
export const FINDING = {
  NOT_DEPLOYED: 'not-deployed',
  WRONG_BUILD: 'wrong-build-served',
  ROUTE: 'route-broken',
  HEADERS: 'security-headers',
  POSTURE: 'demo-posture',
  OG: 'og-image',
  OG_ORIGIN: 'og-image-origin',
  OFFLINE: 'offline',
  FORM: 'form-path',
  CUSTOMIZER: 'customizer',
  LIGHTHOUSE: 'lighthouse',
};

export const finding = (cls, detail) => ({ class: cls, detail });

/**
 * A check's verdict, computed from its own assertions.
 *
 * `unavailable` is not a pass. It is carried separately so the fleet table can
 * distinguish "measured and correct" from "could not be measured", which is the
 * distinction the whole repo is built around — an unmeasured property is never
 * reported as a good one.
 */
export function summarise(name, title, assertions, findings = [], data = {}) {
  const failed = assertions.filter((a) => !a.ok);
  return {
    name,
    title,
    status: failed.length === 0 ? 'pass' : 'fail',
    assertions,
    findings,
    data,
  };
}

/** A check that could not run at all — reported as such, never as a pass. */
export function unavailable(name, title, reason, findings = []) {
  return {
    name,
    title,
    status: 'unavailable',
    reason,
    assertions: [],
    findings,
    data: {},
  };
}

/** A check that does not apply to this client, with the reason it does not. */
export function notApplicable(name, title, reason) {
  return { name, title, status: 'n/a', reason, assertions: [], findings: [], data: {} };
}
