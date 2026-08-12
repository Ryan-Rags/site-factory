#!/usr/bin/env node
/**
 * Domain safety, before anybody points a client at a domain.
 *
 * A domain carries whatever the last owner did with it. Buying an expired name
 * cheaply is buying its history too: an adult site, a link farm, a phishing
 * host, a penalty. None of that is visible in a WHOIS record or on the parked
 * page the registrar shows you, and all of it is visible to a search engine on
 * day one. A client who is told "your new site is live" and then finds it
 * ranking for something obscene — or flagged red in Chrome — is a client we
 * have actively harmed.
 *
 * Two questions, from two sources:
 *
 *   1. What was here before?  The Wayback Machine's CDX index, plus a small
 *      sample of archived page titles across the years. The titles are the part
 *      that actually catches it: a domain whose 2011 captures are titled like
 *      an adult site is carrying reputation no summary statistic reveals.
 *
 *   2. Is it flagged now?  Google Safe Browsing v4 `threatMatches:find`.
 *
 * It reports. It never blocks, and it never decides — a `review` verdict is an
 * instruction to go and look, not a refusal.
 *
 * **Never fabricates.** Anything not measured prints `unavailable`, never an
 * estimate. A domain-safety report that guesses is worse than none, because it
 * gets believed.
 *
 * Politeness: read-only GETs, at most one request per second, at most 12 in a
 * run, and results cached to disk. CLAUDE.md requires that of our own site
 * audits; a third-party archive that owes us nothing gets the same.
 *
 * Safe Browsing needs a key, from `.env` as `SAFE_BROWSING_API_KEY`. Without it
 * that half is reported `unavailable` and the Wayback half still runs — the
 * script never silently degrades into a green tick it did not earn.
 *
 * Usage:
 *   node scripts/domain-safety/check.mjs <domain> [--json] [--no-cache]
 *   node scripts/domain-safety/check.mjs example.com --stub-safe-browsing <url>
 *
 * `--stub-safe-browsing` points the API call at a local endpoint, which is how
 * the request shape and both response paths are tested without a real key
 * going anywhere near a test run. See `scripts/domain-safety/stub-server.mjs`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');
const cacheDir = join(here, '.cache');

const UA = 'site-factory-domain-safety/1.0 (+read-only pre-purchase check)';
const MAX_REQUESTS = 12;
const MIN_INTERVAL_MS = 1000;

let requestsMade = 0;
let lastRequestAt = 0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** One polite, budgeted, cached GET. */
async function politeGet(url, { cache = true, json = false } = {}) {
  const key = Buffer.from(url).toString('base64url').slice(0, 120);
  const cacheFile = join(cacheDir, `${key}.txt`);
  if (cache && existsSync(cacheFile)) return readFileSync(cacheFile, 'utf8');

  if (requestsMade >= MAX_REQUESTS) {
    throw new Error(`request budget spent (${MAX_REQUESTS}) — not hammering a third party`);
  }
  const wait = MIN_INTERVAL_MS - (Date.now() - lastRequestAt);
  if (wait > 0) await sleep(wait);

  requestsMade += 1;
  lastRequestAt = Date.now();
  const res = await fetch(url, {
    headers: { 'user-agent': UA, ...(json ? { accept: 'application/json' } : {}) },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
  const text = await res.text();
  if (cache) {
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(cacheFile, text, 'utf8');
  }
  return text;
}

/** `KEY=value` pairs from `.env`, without adding a dependency. */
function readEnvFile() {
  const file = join(repoRoot, '.env');
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    out[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
  return out;
}

/* ----------------------------------------------------------------- wayback */

/**
 * What the domain used to be.
 *
 * `collapse=timestamp:4` gives at most one capture per year, which is the right
 * resolution for "what kind of site was this" and keeps the response small.
 */
async function wayback(domain, opts) {
  const cdx =
    `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(domain)}` +
    `&matchType=domain&output=json&fl=timestamp,original,statuscode,mimetype` +
    `&filter=statuscode:200&filter=mimetype:text/html&collapse=timestamp:4&limit=200`;

  let rows;
  try {
    rows = JSON.parse(await politeGet(cdx, { cache: opts.cache, json: true }));
  } catch (err) {
    return { status: 'unavailable', reason: String(err.message ?? err) };
  }

  if (!Array.isArray(rows) || rows.length <= 1) {
    return { status: 'ok', captures: 0, first: null, last: null, years: [], titles: [] };
  }

  const [, ...data] = rows; // first row is the header
  const stamps = data.map((r) => r[0]).sort();
  const years = [...new Set(stamps.map((s) => s.slice(0, 4)))];

  /*
   * Sample titles across the whole span rather than the most recent ones. The
   * failure being looked for is a *change* of character — a machine shop that
   * was something else in 2012 — and the recent captures are exactly the ones
   * that look fine.
   */
  const picks = [];
  const wanted = Math.min(5, years.length);
  for (let i = 0; i < wanted; i += 1) {
    const year = years[Math.floor((i * (years.length - 1)) / Math.max(1, wanted - 1))];
    const stamp = stamps.find((s) => s.startsWith(year));
    if (stamp && !picks.includes(stamp)) picks.push(stamp);
  }

  const titles = [];
  for (const stamp of picks) {
    try {
      const html = await politeGet(`https://web.archive.org/web/${stamp}id_/http://${domain}/`, {
        cache: opts.cache,
      });
      const title = /<title[^>]*>([\s\S]{0,200}?)<\/title>/i.exec(html)?.[1] ?? '';
      titles.push({
        year: stamp.slice(0, 4),
        title: title.replace(/\s+/g, ' ').trim() || '(no title)',
      });
    } catch (err) {
      titles.push({ year: stamp.slice(0, 4), title: 'unavailable', reason: String(err.message) });
    }
  }

  return {
    status: 'ok',
    captures: data.length,
    first: stamps[0]?.slice(0, 4) ?? null,
    last: stamps[stamps.length - 1]?.slice(0, 4) ?? null,
    years,
    titles,
  };
}

/**
 * Words that mean "look at this properly before buying".
 *
 * Deliberately a prompt, not a verdict. This flags a title for a human to read;
 * it does not decide anything, and a hit is not an accusation — plenty of
 * legitimate businesses trip a keyword list. The alternative, which is nobody
 * ever reading the history at all, is what produces the inherited-reputation
 * disaster this script exists to prevent.
 */
const REVIEW_WORDS = [
  'porn', 'xxx', 'adult', 'escort', 'casino', 'poker', 'betting', 'viagra',
  'cialis', 'pharmacy', 'replica', 'payday loan', 'crypto giveaway', 'forex',
  'webcam', 'hookup', 'torrent', 'warez', 'essay writing',
];

/* ----------------------------------------------------------- safe browsing */

async function safeBrowsing(domain, key, endpointBase) {
  if (!key) {
    return {
      status: 'unavailable',
      reason:
        'SAFE_BROWSING_API_KEY is not set in .env — this half was not checked, and no ' +
        'conclusion about it should be drawn',
    };
  }

  const endpoint = `${endpointBase}?key=${encodeURIComponent(key)}`;
  const body = {
    client: { clientId: 'site-factory', clientVersion: '1.0.0' },
    threatInfo: {
      threatTypes: [
        'MALWARE',
        'SOCIAL_ENGINEERING',
        'UNWANTED_SOFTWARE',
        'POTENTIALLY_HARMFUL_APPLICATION',
      ],
      platformTypes: ['ANY_PLATFORM'],
      threatEntryTypes: ['URL'],
      threatEntries: [
        { url: `http://${domain}/` },
        { url: `https://${domain}/` },
        { url: `http://www.${domain}/` },
        { url: `https://www.${domain}/` },
      ],
    },
  };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': UA },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      return { status: 'unavailable', reason: `Safe Browsing returned HTTP ${res.status}` };
    }
    const data = await res.json();
    const matches = data.matches ?? [];
    return {
      status: 'ok',
      flagged: matches.length > 0,
      matches: matches.map((m) => ({ type: m.threatType, url: m.threat?.url })),
    };
  } catch (err) {
    return { status: 'unavailable', reason: String(err.message ?? err) };
  }
}

/* ------------------------------------------------------------------ report */

function verdict(history, sb) {
  const reasons = [];

  if (sb.status === 'ok' && sb.flagged) {
    reasons.push(`Google Safe Browsing flags this domain (${sb.matches.map((m) => m.type).join(', ')})`);
    return { level: 'avoid', reasons };
  }

  if (history.status === 'ok') {
    for (const t of history.titles ?? []) {
      const hit = REVIEW_WORDS.find((w) => t.title.toLowerCase().includes(w));
      if (hit) reasons.push(`archived ${t.year} title contains "${hit}": ${t.title.slice(0, 80)}`);
    }
    if ((history.captures ?? 0) > 0 && (history.years?.length ?? 0) >= 3) {
      // Not a problem in itself — stated so the reader knows there IS a history
      // to read, rather than assuming a clean name.
      reasons.push(
        `${history.captures} archived capture(s) across ${history.years.length} year(s) ` +
          `(${history.first}–${history.last}) — read the titles below before buying`,
      );
    }
  }

  const unknown = [history.status, sb.status].filter((s) => s !== 'ok').length;
  if (reasons.some((r) => r.startsWith('archived'))) return { level: 'review', reasons };
  if (unknown > 0) return { level: 'review', reasons: [...reasons, 'some checks were unavailable'] };
  return { level: reasons.length > 0 ? 'review' : 'clear', reasons };
}

function printReport(domain, history, sb, v) {
  const line = (label, value) => console.log(`  ${label.padEnd(18)} ${value}`);
  console.log(`\nDomain safety — ${domain}\n${'-'.repeat(40 + domain.length)}`);

  if (history.status === 'ok') {
    line('Wayback', history.captures === 0 ? 'no captures — no archived history' : `${history.captures} capture(s), ${history.first}–${history.last}`);
    for (const t of history.titles ?? []) line(`  ${t.year}`, t.title.slice(0, 90));
  } else {
    line('Wayback', `unavailable — ${history.reason}`);
  }

  if (sb.status === 'ok') {
    line('Safe Browsing', sb.flagged ? `FLAGGED: ${sb.matches.map((m) => m.type).join(', ')}` : 'no threats listed');
  } else {
    line('Safe Browsing', `unavailable — ${sb.reason}`);
  }

  console.log(`\n  VERDICT: ${v.level.toUpperCase()}`);
  for (const r of v.reasons) console.log(`    · ${r}`);
  if (v.level === 'clear') console.log('    · nothing found against this domain in the checks that ran');
  console.log(
    `\n  This is a report, not a decision. "review" means go and look at the\n` +
      `  archived pages yourself before buying. See docs/go-live.md.\n`,
  );
}

/* -------------------------------------------------------------------- main */

const argv = process.argv.slice(2);
const domain = argv.find((a) => !a.startsWith('-'));
if (!domain) {
  console.error('Usage: node scripts/domain-safety/check.mjs <domain> [--json] [--no-cache]');
  process.exit(1);
}

const asJson = argv.includes('--json');
const cache = !argv.includes('--no-cache');
const stubAt = argv.indexOf('--stub-safe-browsing');
const endpointBase =
  stubAt >= 0 ? argv[stubAt + 1] : 'https://safebrowsing.googleapis.com/v4/threatMatches:find';

const clean = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();

const env = { ...readEnvFile(), ...process.env };
// A stub run must never pick up a real key from .env by accident.
const key = stubAt >= 0 ? (env['SAFE_BROWSING_API_KEY'] ? 'stub-key-not-the-real-one' : 'stub-key') : env['SAFE_BROWSING_API_KEY'];

const history = await wayback(clean, { cache });
const sb = await safeBrowsing(clean, key, endpointBase);
const v = verdict(history, sb);

if (asJson) {
  console.log(JSON.stringify({ domain: clean, history, safeBrowsing: sb, verdict: v }, null, 2));
} else {
  printReport(clean, history, sb, v);
}

// Always exits 0: this reports, it does not gate. A go-live decision belongs to
// a person who has read it.
process.exit(0);
