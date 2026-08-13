/**
 * §3.6 — the form path, proved with one honeypot POST that creates nothing.
 *
 * **Scope, stated here and again in the report header:** this exercises the
 * shared *demo* Worker (`packages/template/worker-demo`), which is what every
 * prospect demo posts to. It has never touched the single-tenant
 * `packages/template/worker` a real client eventually gets. A green here is not
 * coverage of that path.
 *
 * **The endpoint is read out of the live contact page**, not out of
 * `.env.deploy`. It arrives in the browser as a prop on the contact form's
 * island, which is the same attribute `csp.mjs`'s `measurePage` parses to find
 * `connect-src` — so the derivation is imported rather than repeated. Reading
 * it live means the suite tests the endpoint the deployed site actually posts
 * to, and needs no secret to run.
 *
 * **Why a honeypot POST is safe.** `worker-demo/src/index.ts` checks the
 * honeypot at step 2 — before the prospect-id gate, before the rate limiter,
 * before the KV write, before R2 and before Resend — and answers `200
 * {"ok":true}` while discarding the submission. So one request proves method
 * gating, origin gating, CORS and the Worker being reachable and answering,
 * while creating no KV record, no email, no upload and no rate-limit
 * consumption.
 *
 * **What is never sent.** No name, no phone, no email, no message, no file. The
 * only populated fields are `company` (the honeypot) and `prospectId`. One POST
 * per client per run, enforced by the counter below rather than by convention.
 */
import { measurePage } from '../../../packages/template/scripts/lib/csp.mjs';
import { FINDING, assertion, canonicalOrigin, finding, hostOf, request, summarise, unavailable } from '../fleet.mjs';

/** The dot-boundary case `worker-demo/src/lib/http.ts` documents and refuses. */
const HOSTILE_ORIGIN = 'https://evil-preview.pages.dev.attacker.com';

/** slug -> POSTs made this process. The hard cap §3.6 asks for. */
const postsMade = new Map();

/**
 * The Worker URL, from the live contact page.
 *
 * `measurePage` returns the *origins* it would put in `connect-src`; the full
 * URL is then recovered from the same decoded props, so an endpoint that one
 * day carries a path still resolves. A page with no island props, or with none
 * pointing off-origin, returns null and the check reports that rather than
 * guessing.
 */
export function endpointFrom(html, siteOrigin) {
  const measured = measurePage(html, siteOrigin);
  const origins = [...measured.connectHosts];
  if (origins.length === 0) return null;

  for (const m of html.matchAll(/<astro-island[^>]*\bprops\s*=\s*["']([^"']*)["']/gi)) {
    const decoded = m[1].replace(/&quot;/g, '"').replace(/&#38;/g, '&').replace(/&amp;/g, '&');
    for (const u of decoded.matchAll(/https?:\/\/[^\s"'`<>\\]+/g)) {
      if (origins.some((o) => u[0].startsWith(o))) return u[0].replace(/\/+$/, '');
    }
  }
  return origins[0];
}

export async function run(ctx) {
  const { slug, origin, politeness, pages } = ctx;
  const assertions = [];
  const findings = [];

  const contact = pages.get('/contact/');
  if (!contact || !contact.ok) {
    return unavailable('form', 'Form path', 'the live /contact/ did not answer, so no endpoint could be read', [
      finding(FINDING.FORM, `${slug}: /contact/ did not answer; the form endpoint is unreadable`),
    ]);
  }

  const endpoint = endpointFrom(contact.body, canonicalOrigin(pages.get('/').body));
  assertions.push(
    assertion(
      'the live /contact/ carries a form endpoint',
      endpoint !== null,
      endpoint ?? '(no off-origin endpoint in any island prop)',
      'a Worker URL',
      'read from <astro-island props>, the same attribute measurePage parses',
    ),
  );
  if (!endpoint) {
    findings.push(
      finding(
        FINDING.FORM,
        `${slug}: the live contact page posts nowhere — no endpoint in any island prop. ` +
          `The form a prospect is being shown does nothing a Worker ever sees.`,
      ),
    );
    return summarise('form', 'Form path', assertions, findings);
  }

  const workerHost = hostOf(endpoint);

  /* --- preflight, the real origin ---------------------------------------- */

  const preflight = await request(endpoint, {
    politeness,
    method: 'OPTIONS',
    headers: { Origin: origin, 'Access-Control-Request-Method': 'POST' },
  });
  const acao = preflight.headers['access-control-allow-origin'];
  assertions.push(
    assertion('preflight status', preflight.status === 204, preflight.error || preflight.status, 204),
    assertion('preflight Access-Control-Allow-Origin echoes this demo', acao === origin, acao ?? 'absent', origin),
    assertion(
      'preflight Access-Control-Allow-Methods includes POST',
      /POST/i.test(preflight.headers['access-control-allow-methods'] ?? ''),
      preflight.headers['access-control-allow-methods'] ?? 'absent',
      'POST',
    ),
    assertion('preflight Vary', (preflight.headers['vary'] ?? '') === 'Origin', preflight.headers['vary'] ?? 'absent', 'Origin'),
  );

  /* --- preflight, a hostile origin --------------------------------------- */

  const hostile = await request(endpoint, {
    politeness,
    method: 'OPTIONS',
    headers: { Origin: HOSTILE_ORIGIN, 'Access-Control-Request-Method': 'POST' },
  });
  const hostileAcao = hostile.headers['access-control-allow-origin'];
  assertions.push(
    assertion(
      'a suffix-lookalike origin gets no CORS grant',
      hostileAcao === undefined,
      hostileAcao ?? 'absent',
      'absent',
      `sent Origin: ${HOSTILE_ORIGIN} — the dot-boundary case lib/http.ts refuses`,
    ),
  );
  if (hostileAcao !== undefined) {
    findings.push(
      finding(
        FINDING.FORM,
        `${slug}: the demo Worker granted CORS to ${HOSTILE_ORIGIN}. The suffix ` +
          `allowlist is matching on substring, not at a dot boundary.`,
      ),
    );
  }

  /* --- the one honeypot POST --------------------------------------------- */

  const already = postsMade.get(slug) ?? 0;
  if (already >= 1) {
    assertions.push(
      assertion('one honeypot POST per client per run', false, `${already + 1} attempted`, '1'),
    );
  } else {
    postsMade.set(slug, already + 1);

    // Populated fields: the honeypot, and the id that shapes the request like a
    // real one. Nothing else. The honeypot short-circuits before `prospectId`
    // is even read.
    const body = new FormData();
    body.set('company', 'live-smoke honeypot — discard');
    body.set('prospectId', slug);

    const post = await request(endpoint, {
      politeness,
      method: 'POST',
      headers: { Origin: origin },
      body,
    });
    const text = post.body.trim();
    assertions.push(
      assertion('honeypot POST status', post.status === 200, post.error || post.status, 200),
      assertion('honeypot POST body', text === '{"ok":true}', text || '(empty)', '{"ok":true}'),
      assertion(
        'POST Access-Control-Allow-Origin echoes this demo',
        post.headers['access-control-allow-origin'] === origin,
        post.headers['access-control-allow-origin'] ?? 'absent',
        origin,
      ),
    );
  }

  if (assertions.some((a) => !a.ok) && findings.length === 0) {
    findings.push(
      finding(
        FINDING.FORM,
        `${slug}: the demo Worker at ${workerHost} did not answer the contact path as expected`,
      ),
    );
  }

  return summarise('form', 'Form path', assertions, findings, { endpoint, workerHost });
}
