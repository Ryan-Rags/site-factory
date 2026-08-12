/**
 * Origin gating and JSON replies.
 *
 * The demo endpoint's origin problem is different from a single client's. A
 * client Worker knows its one site's origin and can enumerate it. This one is
 * shared by every prospect demo, and a new Pages project appears every time a
 * new prospect is worked up — so an enumerated list would need a Worker
 * redeploy per prospect, and the first time that was forgotten the form would
 * fail in front of somebody.
 *
 * So: exact origins, plus a short list of allowed *host suffixes*. The suffix
 * check is deliberately narrow — https only, and the hostname must end with
 * the suffix at a dot boundary, so `evil-preview.pages.dev.attacker.com` and
 * `notmypages.dev` both fail.
 */

export interface OriginRules {
  exact: string[];
  suffixes: string[];
}

export function parseList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function originAllowed(origin: string, rules: OriginRules): boolean {
  if (rules.exact.includes(origin)) return true;

  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  // Localhost is only ever reachable over http, and it is only ever on the
  // exact list; everything matched by suffix is a public host and must be TLS.
  if (url.protocol !== 'https:') return false;

  return rules.suffixes.some(
    (suffix) => url.hostname === suffix || url.hostname.endsWith(`.${suffix}`),
  );
}

export function corsHeaders(origin: string | null, rules: OriginRules): Record<string, string> {
  if (!origin || !originAllowed(origin, rules)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function json(
  body: unknown,
  status: number,
  headers: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}
