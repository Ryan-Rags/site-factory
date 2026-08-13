/**
 * §3.2 — the live security headers, against the policy this build's own pages
 * derive. Never against a hand-written list.
 *
 * The derivation is imported from `packages/template/scripts/lib/csp.mjs` — the
 * module `gen-headers.mjs` writes from and `check-headers.mjs` re-derives from.
 * A third opinion in this file would be the exact failure that module's header
 * warns about: the gate would then be checking one opinion against another
 * instead of checking the served headers against the served pages.
 *
 * `measureClient()` is not usable here because it reads a `dist` directory. The
 * live equivalent is the same union over the same pages — fetch each route,
 * resolve the site origin from the live `<link rel="canonical">`, `measurePage`
 * each, `mergeMeasurement` into one, `buildPolicy`. Identical derivation, taken
 * from the artifact actually being served.
 *
 * **Why the full policy and not just the required-header map.** Reconnaissance
 * found that two of the four required headers pass live on a site with no
 * `_headers` file at all: Cloudflare Pages supplies `X-Content-Type-Options`
 * and `Referrer-Policy` on `*.pages.dev` by itself. A check that asserted only
 * `check-headers.mjs`'s `REQUIRED_HEADERS` would score a CSP-less site 2/4 and
 * read as "mostly fine" — "green ≠ correct" reproducing inside the tool built
 * to prevent it. So every directive is asserted by name, and every header is
 * reported with its provenance.
 *
 * Not asserted: HSTS. Ledger 2026-08-12 — it belongs to the zone, not to a
 * project answering on `*.pages.dev`.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  DENIED_FEATURES,
  buildPolicy,
  emptyMeasurement,
  measurePage,
  mergeMeasurement,
} from '../../../packages/template/scripts/lib/csp.mjs';
import { FINDING, assertion, canonicalOrigin, finding, summarise } from '../fleet.mjs';
import { repoRoot } from '../../pitch/paths.mjs';

/** Mirrors `check-headers.mjs`'s map, imported in spirit and asserted live. */
const REQUIRED_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY',
};

/**
 * The two headers Cloudflare Pages supplies on `*.pages.dev` with no `_headers`
 * file present. This is the judgement Brief 4 flags: it rests on knowing what
 * Pages does, supported by the two facts below rather than asserted. It is
 * never used to *pass* anything — only to label a header the site did not
 * produce, so a green cannot be read as ours.
 */
const PLATFORM_SUPPLIED = new Set(['x-content-type-options', 'referrer-policy']);

/** Directives that are policy, not measurement. `check-headers.mjs`'s list. */
const FIXED_DIRECTIVES = {
  'default-src': "'self'",
  'frame-ancestors': "'none'",
  'form-action': "'self'",
  'base-uri': "'none'",
  'object-src': "'none'",
  'worker-src': "'self'",
  'manifest-src': "'self'",
  'style-src': "'self' 'unsafe-inline'",
};

const directives = (csp) => {
  const out = new Map();
  for (const part of String(csp).split(';')) {
    const trimmed = part.trim();
    if (trimmed === '') continue;
    const at = trimmed.indexOf(' ');
    if (at < 0) out.set(trimmed.toLowerCase(), '');
    else out.set(trimmed.slice(0, at).toLowerCase(), trimmed.slice(at + 1).trim());
  }
  return out;
};

/**
 * The evidence behind the `platform (inferred)` label, checked rather than
 * assumed: this repo produces no static header file, so a header present live
 * on a site carrying none of our generated ones did not come from here.
 */
function repoProducesNoStaticHeaders() {
  return !existsSync(join(repoRoot, 'packages', 'template', 'public', '_headers'));
}

export async function run(ctx) {
  const { slug, pages } = ctx;
  const assertions = [];
  const findings = [];

  const home = pages.get('/');
  const siteOrigin = canonicalOrigin(home.body);

  // The union over every page fetched in §3.1 — `_headers` applies to `/*`, so
  // the policy has to satisfy every page, not whichever one we looked at.
  const merged = emptyMeasurement();
  const measured = [];
  for (const [route, res] of pages) {
    if (!res.ok || !/^text\/html/i.test(res.contentType)) continue;
    mergeMeasurement(merged, measurePage(res.body, siteOrigin));
    measured.push(route);
  }

  const expected = directives(buildPolicy(merged));
  const live = home.headers;
  const liveCsp = live['content-security-policy'];
  const livePermissions = live['permissions-policy'];

  /*
   * Whether the deploy is carrying our `_headers` at all. CSP and
   * Permissions-Policy are produced by `gen-headers.mjs` and by nothing else in
   * this repo or on the platform, so either one appearing live means the file
   * is in effect. That distinction is what decides provenance below.
   */
  const ourHeadersInEffect = liveCsp !== undefined || livePermissions !== undefined;
  const platformInferred = repoProducesNoStaticHeaders();

  const provenance = {};
  const label = (name, value) => {
    if (value === undefined) return 'absent';
    if (ourHeadersInEffect) return 'build';
    if (PLATFORM_SUPPLIED.has(name) && platformInferred) {
      return 'platform (inferred: not produced by this repo)';
    }
    return 'present, provenance unknown';
  };
  for (const name of [...Object.keys(REQUIRED_HEADERS), 'permissions-policy', 'content-security-policy']) {
    provenance[name] = label(name, live[name]);
  }

  assertions.push(
    assertion(
      'the deploy carries this repo\'s generated _headers',
      ourHeadersInEffect,
      ourHeadersInEffect ? 'yes' : 'no — no CSP and no Permissions-Policy on the live response',
      'yes',
      `derived from ${measured.length} live page(s): ${measured.join(', ')}`,
    ),
  );

  /* --- the required headers, each with its provenance --------------------- */

  for (const [name, want] of Object.entries(REQUIRED_HEADERS)) {
    const got = live[name];
    assertions.push(
      assertion(
        `${name}`,
        got === want,
        got === undefined ? 'absent' : got,
        want,
        provenance[name],
      ),
    );
  }

  if (livePermissions === undefined) {
    assertions.push(
      assertion('permissions-policy', false, 'absent', `${DENIED_FEATURES.length} features denied`, provenance['permissions-policy']),
    );
  } else {
    const missing = DENIED_FEATURES.filter(
      (f) => !new RegExp(`\\b${f}=\\(\\)`).test(livePermissions),
    );
    assertions.push(
      assertion(
        'permissions-policy denies every feature in DENIED_FEATURES',
        missing.length === 0,
        missing.length === 0 ? `all ${DENIED_FEATURES.length} denied` : `does not deny ${missing.join(', ')}`,
        `all ${DENIED_FEATURES.length} denied`,
        provenance['permissions-policy'],
      ),
    );
  }

  /* --- the CSP, directive by directive ------------------------------------ */

  if (liveCsp === undefined) {
    assertions.push(
      assertion(
        'content-security-policy',
        false,
        'absent',
        `${expected.size} directives derived from the live pages`,
        'the pages need it; the deploy does not carry it',
      ),
    );
    // Every directive is reported anyway, so the report says what is missing
    // rather than only that something is.
    for (const [name, want] of expected) {
      assertions.push(assertion(`csp ${name}`, false, 'absent', want));
    }
  } else {
    const got = directives(liveCsp);

    // Standing invariants first — these are policy and measurement must not be
    // able to weaken them. Same list `check-headers.mjs` refuses.
    const scriptSrc = got.get('script-src') ?? '';
    for (const banned of ["'unsafe-inline'", "'unsafe-eval'", "'strict-dynamic'", "'unsafe-hashes'"]) {
      assertions.push(
        assertion(`csp script-src does not contain ${banned}`, !scriptSrc.includes(banned), scriptSrc || '(absent)', `no ${banned}`),
      );
    }
    assertions.push(
      assertion('csp script-src has no wildcard', !/\*/.test(scriptSrc), scriptSrc || '(absent)', 'no *'),
      assertion("csp script-src includes 'self'", scriptSrc.includes("'self'"), scriptSrc || '(absent)', "'self'"),
    );
    for (const [name, value] of got) {
      if (name === 'style-src') continue;
      assertions.push(
        assertion(
          `csp ${name} does not contain 'unsafe-inline'`,
          !value.includes("'unsafe-inline'"),
          value,
          "no 'unsafe-inline'",
        ),
      );
    }
    for (const [name, want] of Object.entries(FIXED_DIRECTIVES)) {
      const value = got.get(name);
      assertions.push(assertion(`csp ${name}`, value === want, value ?? 'absent', want));
    }

    // Then drift: every directive the live pages need, with the value they need.
    for (const [name, want] of expected) {
      const value = got.get(name);
      assertions.push(
        assertion(`csp ${name} matches the live pages`, value === want, value ?? 'absent', want),
      );
    }
    for (const name of got.keys()) {
      if (expected.has(name)) continue;
      assertions.push(
        assertion(`csp ${name} is needed by the live pages`, false, got.get(name), 'not present — the pages do not need it'),
      );
    }
  }

  if (assertions.some((a) => !a.ok)) {
    const absent = [...Object.keys(REQUIRED_HEADERS), 'permissions-policy', 'content-security-policy']
      .filter((n) => live[n] === undefined);
    findings.push(
      finding(
        FINDING.HEADERS,
        absent.length > 0
          ? `${slug}: absent live — ${absent.join(', ')}. Present: ` +
            Object.entries(provenance)
              .filter(([, p]) => p !== 'absent')
              .map(([n, p]) => `${n} (${p})`)
              .join(', ')
          : `${slug}: live headers disagree with the policy the live pages derive`,
      ),
    );
  }

  return summarise('headers', 'Security headers', assertions, findings, {
    siteOrigin,
    provenance,
    derivedFrom: measured,
    expectedPolicy: buildPolicy(merged),
    livePolicy: liveCsp ?? null,
  });
}
