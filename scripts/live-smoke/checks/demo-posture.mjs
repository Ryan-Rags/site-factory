/**
 * §3.3 — the demo lock, live.
 *
 * These sites carry a real business's name. Indexing a mockup puts a page we
 * authored about someone else's shop into search results under their name, so
 * "a sitemap appeared" is a failure here rather than a note — and it is a live
 * switch that can flip without anyone noticing, because `@astrojs/sitemap` is a
 * dependency of the template and `astro.config.mjs` includes it the moment
 * `seo.noindex` goes false.
 *
 * All three assertions are made against the live response, not against the
 * config that was compiled hours ago:
 *
 *   - `<meta name="robots">` on every route contains noindex and nofollow
 *   - /robots.txt disallows everything for `User-agent: *`
 *   - /sitemap-index.xml and /sitemap-0.xml are 404
 */
import { FINDING, assertion, finding, request, summarise } from '../fleet.mjs';

const robotsMeta = (html) => {
  const m = /<meta[^>]+name=["']robots["'][^>]*>/i.exec(html);
  if (!m) return null;
  return /content=["']([^"']*)["']/i.exec(m[0])?.[1] ?? '';
};

/**
 * `Disallow: /` under `User-agent: *`, read as a robots.txt parser would.
 *
 * A substring test for "Disallow: /" would pass on a file whose only disallow
 * sits under a different agent group, which is not the same claim at all.
 */
export function disallowsEverything(text) {
  let inStar = false;
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (line === '') continue;
    const at = line.indexOf(':');
    if (at < 0) continue;
    const key = line.slice(0, at).trim().toLowerCase();
    const value = line.slice(at + 1).trim();
    if (key === 'user-agent') {
      inStar = value === '*';
      continue;
    }
    if (inStar && key === 'disallow' && value === '/') return true;
  }
  return false;
}

export async function run(ctx) {
  const { slug, origin, politeness, pages } = ctx;
  const assertions = [];
  const findings = [];

  for (const [route, res] of pages) {
    if (!res.ok || !/^text\/html/i.test(res.contentType)) continue;
    const content = robotsMeta(res.body);
    const ok = content !== null && /noindex/i.test(content) && /nofollow/i.test(content);
    assertions.push(
      assertion(`${route} meta robots`, ok, content ?? '(no meta robots)', 'noindex, nofollow'),
    );
    if (!ok) {
      findings.push(
        finding(
          FINDING.POSTURE,
          `${slug}: ${route} is not locked out of search — meta robots is "${content ?? 'absent'}"`,
        ),
      );
    }
  }

  const robots = await request(`${origin}/robots.txt`, { politeness });
  const robotsOk = robots.status === 200 && disallowsEverything(robots.body);
  assertions.push(
    assertion(
      '/robots.txt disallows / for User-agent: *',
      robotsOk,
      robots.status !== 200
        ? robots.error || `HTTP ${robots.status}`
        : robots.body.trim().split(/\r?\n/).join(' · '),
      'User-agent: * → Disallow: /',
    ),
  );
  if (!robotsOk) {
    findings.push(
      finding(FINDING.POSTURE, `${slug}: /robots.txt does not disallow crawling (HTTP ${robots.status})`),
    );
  }

  for (const path of ['/sitemap-index.xml', '/sitemap-0.xml']) {
    const res = await request(`${origin}${path}`, { politeness });
    const ok = res.status === 404;
    assertions.push(assertion(`${path} is absent`, ok, res.error || res.status, 404));
    if (!ok) {
      findings.push(
        finding(
          FINDING.POSTURE,
          `${slug}: ${path} answered ${res.status} — a demo carrying a sitemap is a demo ` +
            `asking to be indexed under a real business's name.`,
        ),
      );
    }
  }

  return summarise('posture', 'Demo posture', assertions, findings);
}
