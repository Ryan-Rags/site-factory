/**
 * §3.1 — every route answers, and the 404 is ours.
 *
 * The status check is the easy half. The half that matters is the 404: a
 * request for a page that does not exist must land on the template's own
 * designed page, not on Cloudflare's generic one. Both return 404, both look
 * fine to a status assertion, and only one of them is a page a prospect can be
 * shown. It is identified by the `<h1>` `verify-offline.mjs` already keys on.
 *
 * This check also collects the HTML every later check reads, so the four route
 * fetches are spent once rather than once per check.
 */
import {
  FINDING,
  MISSING_ROUTE,
  NOT_FOUND_H1,
  assertion,
  finding,
  request,
  routeSetFor,
  servedSlug,
  summarise,
} from '../fleet.mjs';

const decode = (s) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ');

export const firstH1 = (html) => {
  const m = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  return m ? decode(m[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim() : '';
};

export async function run(ctx) {
  const { origin, politeness, slug } = ctx;
  const assertions = [];
  const findings = [];

  // The home page first: its nav decides the route list, and its manifest link
  // says which client is actually being served.
  const home = await request(`${origin}/`, { politeness });
  ctx.pages.set('/', home);

  if (!home.ok) {
    // Handled by the caller as `not-deployed`; this branch exists so the check
    // still returns a shape rather than throwing past the report.
    assertions.push(
      assertion('/ answers 200', false, home.error || `HTTP ${home.status}`, '200'),
    );
    findings.push(finding(FINDING.ROUTE, `${slug}: / did not answer (${home.error || home.status})`));
    return summarise('routes', 'Routes', assertions, findings, { routes: ['/'] });
  }

  const served = servedSlug(home.body);
  assertions.push(
    assertion(
      'the live origin serves this client',
      served === slug,
      served ?? '(no manifest link)',
      slug,
      'read from <link rel="manifest"> → /icons/<slug>/',
    ),
  );
  if (served !== slug) {
    findings.push(
      finding(
        FINDING.WRONG_BUILD,
        `${slug}: ${origin} serves "${served ?? 'an unrecognised build'}". Every ` +
          `assertion below would be about another client's site.`,
      ),
    );
  }

  const routes = routeSetFor(home.body);
  assertions.push(
    assertion('/ status', home.status === 200, home.status, 200),
    assertion(
      '/ content-type',
      /^text\/html/i.test(home.contentType),
      home.contentType || '(none)',
      'text/html',
    ),
  );

  for (const route of routes) {
    if (route === '/') continue;
    const res = await request(`${origin}${route}`, { politeness });
    ctx.pages.set(route, res);
    const okStatus = res.status === 200;
    const okType = /^text\/html/i.test(res.contentType);
    assertions.push(
      assertion(`${route} status`, okStatus, res.error || res.status, 200),
      assertion(`${route} content-type`, okType, res.contentType || '(none)', 'text/html'),
    );
    if (!okStatus || !okType) {
      findings.push(
        finding(
          FINDING.ROUTE,
          `${slug}: ${route} answered ${res.error || `${res.status} ${res.contentType}`}`,
        ),
      );
    }
  }

  // The designed 404.
  const missing = await request(`${origin}${MISSING_ROUTE}`, { politeness });
  const h1 = firstH1(missing.body);
  const okStatus = missing.status === 404;
  const okPage = h1 === NOT_FOUND_H1;
  assertions.push(
    assertion(`${MISSING_ROUTE} status`, okStatus, missing.error || missing.status, 404),
    assertion(
      `${MISSING_ROUTE} is the template's own 404 page`,
      okPage,
      h1 || '(no <h1>)',
      NOT_FOUND_H1,
    ),
  );
  if (!okStatus || !okPage) {
    findings.push(
      finding(
        FINDING.ROUTE,
        `${slug}: an unknown URL returned ${missing.status} with <h1> ` +
          `"${h1 || '(none)'}" — a generic host 404, not the designed page.`,
      ),
    );
  }

  return summarise('routes', 'Routes', assertions, findings, { routes, servedSlug: served });
}
