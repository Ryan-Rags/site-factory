/**
 * Which human a lead is for.
 *
 * The endpoint started life mailing everything to one inbox — mine — because
 * every prospect was a pitch and I was the only person who would ever read one.
 * That stops being true the moment a shop says yes: their leads have to reach
 * them, and mine have to keep reaching me, and both facts have to hold on the
 * same deployment at the same time.
 *
 * So a lead now has a recipient looked up from `prospectId`, a fallback for
 * every prospect that has none, and an optional permanent bcc so a live client's
 * leads stay visible to me without a second deployment or a forwarding rule in
 * somebody else's mailbox.
 *
 * The map is a string var, not a JSON object var, for one concrete reason: the
 * build gate that keeps this file and the client configs in step
 * (`scripts/check-form-fields.mjs`) reads `wrangler.jsonc` — a file with
 * comments in it — with a regex, and a plain string is something a regex can
 * read honestly. A JSON object var would need a JSONC parser, which would need
 * a dependency, which would need the lockfile.
 *
 * Nothing here is a secret. Real addresses live in the gitignored
 * `wrangler.local.jsonc`; the committed file carries placeholders.
 */

/** `slug=addr,slug=addr`. Whitespace around either side is ignored. */
export function parseRecipients(value: string | undefined): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of (value ?? '').split(',')) {
    const pair = entry.trim();
    if (!pair) continue;

    const at = pair.indexOf('=');
    const slug = at === -1 ? '' : pair.slice(0, at).trim();
    const address = at === -1 ? '' : pair.slice(at + 1).trim();

    /*
     * A malformed entry is skipped and logged rather than thrown. The
     * alternative — failing the request — would turn one typo in a config var
     * into every prospect's form going down, when the fallback below already
     * delivers the lead somewhere a person is reading.
     */
    if (!slug || !address || !address.includes('@')) {
      console.error(`PROSPECT_RECIPIENTS: skipping malformed entry ${JSON.stringify(pair)}`);
      continue;
    }
    map.set(slug, address);
  }
  return map;
}

export interface Route {
  to: string;
  bcc: string[];
  /** For the log line: which rule produced `to`. Never shown to a visitor. */
  via: 'map' | 'fallback';
}

/**
 * Resolve where one prospect's leads go.
 *
 * `prospectId` has already been checked against `KNOWN_PROSPECTS` by the time
 * this is called — an unknown prospect is refused before routing, so this can
 * never invent a recipient for a slug the endpoint does not serve.
 */
export function routeFor(
  prospectId: string,
  env: { PROSPECT_RECIPIENTS?: string | undefined; MAIL_TO: string; BCC_ALWAYS?: string | undefined },
): Route {
  const mapped = parseRecipients(env.PROSPECT_RECIPIENTS).get(prospectId);
  const to = (mapped ?? env.MAIL_TO ?? '').trim();

  const always = (env.BCC_ALWAYS ?? '').trim();
  // Copying myself on a lead that already comes to me delivers it twice and
  // reads as a bug in the client's eyes if they ever see the headers.
  const bcc = always && always.toLowerCase() !== to.toLowerCase() ? [always] : [];

  return { to, bcc, via: mapped ? 'map' : 'fallback' };
}
