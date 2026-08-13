/**
 * §3.9 — `report.md`.
 *
 * Every measured value is printed even when it passed, because the artifact is
 * meant to be evidence and not a verdict: "og:image 1200×630 image/png" is
 * something a reader can check, and "✓ og:image" is something they have to
 * take on trust. The header states the limits of the run up front — what the
 * expectations are derived from, what the form check does and does not cover,
 * and which numbers are reported without being enforced — so a green cannot be
 * read as a claim the suite never made.
 */
import { CHECK_ORDER, CHECK_TITLES } from './checks/index.mjs';

const MARK = { pass: '✓', fail: '✗', unavailable: 'unavailable', 'n/a': 'n/a', skipped: '—' };

const mark = (status) => MARK[status] ?? status;

/**
 * Table cells are truncated; nothing else is.
 *
 * A CSP with six script hashes is 500 characters, and repeating it on each of
 * the ten standing-invariant rows turns the one section a reader most needs
 * into a wall. The full policy is printed once, in a code block under the same
 * heading, so the value is still in the report — it is only the repetition that
 * is dropped, and a truncated cell says so.
 */
const CELL_LIMIT = 160;

const esc = (s) => {
  const flat = String(s ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ');
  return flat.length <= CELL_LIMIT ? flat : `${flat.slice(0, CELL_LIMIT)}… (${flat.length} chars)`;
};

function header(run) {
  return `# Live smoke — ${run.clients.length} demo${run.clients.length === 1 ? '' : 's'}, ${run.startedAt}

**Verdict: ${run.ok ? 'PASS' : 'FAIL'}** — ${run.failing} of ${run.clients.length} client(s) failed at least one check.

## How to read this report

**Every expectation below is derived from the live response, never from local
\`dist/\`.** A deploy and the build that produced it are different artifacts the
moment one lags the other, and these have been: reconnaissance on 2026-08-12,
before the fleet was redeployed from \`main@c301f2c\`, found the live
\`kh-machine-works\` declaring \`og:image =
https://www.khmachineworks.com/og/kh-machine-works.png\` while the same client
in the checkout declared \`…/images/og.svg\` — two different artifacts, one of
them the only one anybody would ever see. Those two agree again now; the
redeploy closed that particular gap. That is the reason the rule is structural
rather than a reaction to one incident: nothing tells you which of the two
states you are in except asking the live site. So the CSP is re-derived from the
live pages, the route list is read from the live nav, the form endpoint is read
from the live contact page, and the card is parsed from the bytes the live URL
returns.

Four limits on what a green here means:

1. **\`not-deployed\` is a failure, not a skip,** and it is reported as its own
   findings class. A client on the registry whose project does not answer is
   exactly the thing this suite exists to surface; it is separated from broken
   deploys so the two cannot be confused.
2. **The form check covers the shared *demo* Worker only** —
   \`packages/template/worker-demo\`, which every prospect demo posts to. It has
   never touched the single-tenant \`packages/template/worker\` a real client
   eventually gets. A green here is not coverage of that path.
3. **\`seo\` is reported and not enforced.** Every demo is \`noindex\` by
   design, so the \`is-crawlable\` deduction is the demo lock working and a bar
   would fail every client for being correctly configured. The bar arrives when
   a go-live smoke exists.
4. **Header provenance is partly inference.** A header present live on a site
   carrying none of this repo's generated headers is labelled \`platform
   (inferred: not produced by this repo)\` — supported by the absence of any
   static header file here and its presence live, which is strong, but is still
   inference rather than measurement.

Politeness: read-only GET/HEAD/OPTIONS throughout, with one exception — a
single honeypot POST per client, which \`worker-demo\` discards at step 2
before the prospect-id gate, the rate limiter, the KV write and Resend. Page
navigations are spaced at least 1000 ms per domain and capped at 10 per site;
bare probes are spaced 500 ms. What was actually spent is at the bottom.
`;
}

function fleetTable(run) {
  const head = `| client | ${CHECK_ORDER.map((c) => CHECK_TITLES[c]).join(' | ')} |`;
  const rule = `| --- | ${CHECK_ORDER.map(() => '---').join(' | ')} |`;
  const rows = run.clients.map((client) => {
    if (client.status === 'not-deployed') {
      return `| \`${client.slug}\` | ${CHECK_ORDER.map(() => 'not-deployed').join(' | ')} |`;
    }
    const cells = CHECK_ORDER.map((name) => {
      const check = client.checks.find((c) => c.name === name);
      return check ? mark(check.status) : mark('skipped');
    });
    return `| \`${client.slug}\` | ${cells.join(' | ')} |`;
  });
  return [head, rule, ...rows].join('\n');
}

function clientSection(client) {
  const lines = [`### \`${client.slug}\` — ${client.origin}`, ''];

  if (client.status === 'not-deployed') {
    lines.push(
      `**not-deployed.** ${client.reason}`,
      '',
      'A client registered in `clients/index.ts` whose Pages project does not answer.',
      'Fatal, and reported as its own findings class so it is not read as a broken deploy.',
      '',
    );
    return lines.join('\n');
  }

  lines.push(`Verdict: **${client.status === 'pass' ? 'pass' : 'fail'}**`, '');

  for (const check of client.checks) {
    lines.push(`#### ${check.title} — ${mark(check.status)}`, '');
    if (check.status === 'n/a' || check.status === 'unavailable') {
      lines.push(`${check.reason}`, '');
    }
    if (check.assertions.length > 0) {
      lines.push('| | assertion | measured | expected | note |', '| --- | --- | --- | --- | --- |');
      for (const a of check.assertions) {
        lines.push(
          `| ${a.ok ? '✓' : '✗'} | ${esc(a.label)} | ${esc(a.value)} | ${esc(a.expected ?? '')} | ${esc(a.note)} |`,
        );
      }
      lines.push('');
    }
    if (check.name === 'headers' && check.data.expectedPolicy) {
      lines.push(
        'Policy derived from the live pages:',
        '',
        '```',
        check.data.expectedPolicy,
        '```',
        '',
        `Live: ${check.data.livePolicy ? `\`${check.data.livePolicy}\`` : '**no Content-Security-Policy on the live response**'}`,
        '',
      );
    }
    if (check.name === 'lighthouse' && check.data.scores) {
      const s = check.data.scores;
      lines.push(
        `Scores (mobile, port ${check.data.port}): performance ${s.performance ?? (check.data.performanceNote || 'unavailable')}, ` +
          `accessibility ${s.accessibility ?? 'unavailable'}, best-practices ${s['best-practices'] ?? 'unavailable'}, ` +
          `seo ${s.seo ?? 'unavailable'}.`,
        '',
      );
    }
  }
  return lines.join('\n');
}

function findingsSection(run) {
  const byClass = new Map();
  for (const client of run.clients) {
    for (const f of client.findings) {
      if (!byClass.has(f.class)) byClass.set(f.class, []);
      byClass.get(f.class).push(f.detail);
    }
  }
  if (byClass.size === 0) return '## Findings\n\nNone. Every client passed every check.\n';

  const lines = ['## Findings', ''];
  lines.push(
    'Grouped by class, so two clients broken the same way read as one problem',
    'rather than as two.',
    '',
  );
  for (const [cls, details] of [...byClass.entries()].sort()) {
    lines.push(`### ${cls} — ${details.length} client(s)`, '');
    for (const d of details) lines.push(`- ${d}`);
    lines.push('');
  }
  return lines.join('\n');
}

function ledgerSection(run) {
  const lines = [
    '## Politeness ledger',
    '',
    'Navigations are what claude.md caps at 10 per site and 1 per second per',
    'domain. Probes are bare fetches, spaced but uncounted — the reading',
    "`packages/audit/src/throttle.ts` already documents for the broken-link checker.",
    '',
    '| host | navigations | cap | min gap between navigations | probes |',
    '| --- | --- | --- | --- | --- |',
  ];
  for (const row of run.ledger) {
    lines.push(
      `| ${row.host} | ${row.navigations} | ${row.maxPerHost} | ${row.minNavGapMs === null ? 'n/a (one navigation)' : `${row.minNavGapMs} ms`} | ${row.probes} |`,
    );
  }
  lines.push('');
  return lines.join('\n');
}

export function renderReport(run) {
  return [
    header(run),
    '## Fleet',
    '',
    fleetTable(run),
    '',
    '## Per client',
    '',
    ...run.clients.map(clientSection),
    findingsSection(run),
    ledgerSection(run),
    `---\n\nRun finished ${run.finishedAt}. Suite: \`scripts/live-smoke\`.\n`,
  ].join('\n');
}
