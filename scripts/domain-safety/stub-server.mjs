#!/usr/bin/env node
/**
 * A local stand-in for Google Safe Browsing v4 `threatMatches:find`.
 *
 * The real API needs a key, and the standing rule is that keys stay with their
 * owner: nothing in a development run should ever hold one. So the request
 * shape, the key gating, the clean path and the flagged path are all proved
 * against this instead, and exactly one live call — the one that needs the real
 * key — is left for the person who has it.
 *
 * That is not a weaker test than calling the real thing. What can actually be
 * wrong here is the request body, the parsing of `matches`, and what the script
 * concludes from each outcome. All three are exercised below, including the
 * flagged path, which a live call against a healthy domain would never reach.
 *
 * It also asserts the request looks like the one Google documents, so a stub
 * run cannot pass on a body the real API would reject.
 *
 *   node scripts/domain-safety/stub-server.mjs [--port 0] [--mode clean|flagged|error]
 *
 * Prints the URL it is listening on as its first line.
 */
import { createServer } from 'node:http';

const argv = process.argv.slice(2);
const at = (flag, fallback) => {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : fallback;
};
const mode = at('--mode', 'clean');
const port = Number(at('--port', '0'));

const server = createServer((req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(405).end('POST only');
    return;
  }
  const url = new URL(req.url, 'http://127.0.0.1');
  const key = url.searchParams.get('key');

  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    // Assert the request is the documented shape. A stub that accepts anything
    // would let a malformed body pass here and fail against the real API.
    const problems = [];
    if (!key) problems.push('no ?key= on the request');
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      problems.push('body is not JSON');
    }
    if (body) {
      if (!body.client?.clientId) problems.push('client.clientId missing');
      const ti = body.threatInfo;
      if (!ti) problems.push('threatInfo missing');
      else {
        if (!Array.isArray(ti.threatTypes) || ti.threatTypes.length === 0) {
          problems.push('threatInfo.threatTypes missing');
        }
        if (!Array.isArray(ti.threatEntries) || ti.threatEntries.length === 0) {
          problems.push('threatInfo.threatEntries missing');
        }
        for (const e of ti.threatEntries ?? []) {
          if (!e.url) problems.push('a threatEntry has no url');
        }
      }
    }

    if (problems.length > 0) {
      console.error(`STUB: malformed request — ${problems.join('; ')}`);
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { message: problems.join('; ') } }));
      return;
    }

    console.error(
      `STUB: well-formed request, ${body.threatInfo.threatEntries.length} URL(s), mode=${mode}`,
    );

    if (mode === 'error') {
      res.writeHead(503, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'stubbed outage' } }));
      return;
    }

    // Google returns `{}` — no `matches` key at all — when nothing is listed.
    // Returning `{"matches": []}` here would let a bug that mishandles the
    // real, emptier response pass.
    const payload =
      mode === 'flagged'
        ? {
            matches: [
              {
                threatType: 'SOCIAL_ENGINEERING',
                platformType: 'ANY_PLATFORM',
                threatEntryType: 'URL',
                threat: { url: body.threatInfo.threatEntries[0].url },
                cacheDuration: '300s',
              },
            ],
          }
        : {};

    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(payload));
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`http://127.0.0.1:${server.address().port}/v4/threatMatches:find`);
});
