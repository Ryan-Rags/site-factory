/**
 * Canonical form used as a dedupe fallback for rows that predate `place_id`.
 * Scheme is preserved (an http-only site is a real audit finding), but host
 * case, a leading `www.`, a trailing slash and any fragment are not identity.
 */
export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withScheme);
    u.hash = "";
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    if (u.pathname === "/") u.pathname = "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return trimmed.toLowerCase();
  }
}

/** Hostname of a lead URL, or undefined when it cannot be parsed. */
export function hostOf(raw: string): string | undefined {
  const normalized = normalizeUrl(raw);
  if (!normalized) return undefined;
  try {
    return new URL(normalized).hostname;
  } catch {
    return undefined;
  }
}
