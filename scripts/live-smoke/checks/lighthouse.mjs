/**
 * §3.8 — Lighthouse against the live `/`, through `packages/audit`'s harness.
 *
 * The harness is imported rather than reproduced: four categories, Moto G4
 * emulation, simulated throttling. Two numbers produced differently are not a
 * measurement of the same thing, and a second copy of those settings would
 * drift from the one every other score in this repo comes from.
 *
 * Bars:
 *
 *   accessibility   ≥ 90, fail below
 *   best-practices  ≥ 90, fail below
 *   seo             reported, no bar
 *   performance     reported, no bar; absent only under the rule below
 *
 * **Why `seo` has no bar.** These builds are `noindex` by design. The
 * `is-crawlable` deduction is the demo lock doing its job — known-issues #2
 * records `main` scoring 69 for precisely that reason — so a bar there would
 * fail every client for being correctly configured. The number is printed on
 * every client so the day the lock comes off, the movement is visible. The bar
 * arrives when a go-live smoke exists, where 100/100/100/100 is already
 * demonstrated on the go-live fixture.
 *
 * **The known-issue rule, and why it discriminates by signature.** A
 * `performance` of `undefined` is a failure *unless* the LHR shows the specific
 * shape known-issues #2 documents: the LCP audit reporting `NO_LCP`, with the
 * other weighted performance audits scoring — save for `total-blocking-time`,
 * which may also be unscored, and only in `NO_LCP`'s company. A known issue
 * never fails smoke; an unknown one always does — which is only possible if the
 * rule keys on the signature rather than on the category name. And the waiver is
 * checked against the document that grants it: if `docs/known-issues.md` no
 * longer carries a `NO_LCP` entry, the allowance is refused and an absent
 * performance score fails. A waiver outliving its issue is how a suite goes
 * quietly blind.
 *
 * **Why `total-blocking-time` is in the signature and nothing else is.** It was
 * measured there: five of five red clients on the live fleet reported `NO_LCP`
 * and exactly one companion casualty, `total-blocking-time`, with every other
 * weighted audit scoring (known-issues #2 addendum, PR #24). The pair is
 * accepted because it was observed, not because both are lantern metrics and
 * the coincidence is suggestive — the ruling of 2026-08-12 in
 * `docs/decisions.md` turns on precisely that distinction. Why the two fall
 * together remains unproven, and widening on the hypothesis rather than the
 * measurement is what that ruling forbids.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { FINDING, assertion, finding, summarise } from '../fleet.mjs';
import { repoRoot } from '../../pitch/paths.mjs';

const BAR = { accessibility: 90, 'best-practices': 90 };
const REPORTED_ONLY = ['seo', 'performance'];
const KNOWN_ISSUES = join(repoRoot, 'docs', 'known-issues.md');

/** Is the waiver still granted by the document that grants it? */
export function noLcpWaiverStands(file = KNOWN_ISSUES) {
  if (!existsSync(file)) return false;
  return /NO_LCP/.test(readFileSync(file, 'utf8'));
}

/**
 * The one audit that may be unscored beside LCP, and only beside LCP.
 * Widening this list is a documented ruling, never a convenience.
 */
const WAIVED_COMPANION = 'total-blocking-time';

/**
 * Does this LHR carry known-issues #2's signature, and nothing else?
 *
 * "The other performance audits scored" is the half that stops this from being
 * a blanket excuse: an LHR where LCP errored *and* three other audits also
 * failed to run is a broken run, not the documented emulation defect. The
 * `NO_LCP` test above it is the other half, and it comes first — so
 * `total-blocking-time` unscored on its own never reaches the allowance, and
 * the companion cannot become an excuse in its own right.
 */
export function isKnownNoLcp(lhr) {
  const lcp = lhr?.audits?.['largest-contentful-paint'];
  if (!lcp || !/NO_LCP/.test(String(lcp.errorMessage ?? ''))) return { known: false, reason: 'no NO_LCP error on the LCP audit' };

  const refs = lhr?.categories?.performance?.auditRefs ?? [];
  const others = refs
    .filter((ref) => (ref.weight ?? 0) > 0 && ref.id !== 'largest-contentful-paint')
    .map((ref) => ({ id: ref.id, audit: lhr.audits?.[ref.id] }));
  const unscored = others.filter((o) => typeof o.audit?.score !== 'number').map((o) => o.id);
  if (others.length === 0) return { known: false, reason: 'the performance category listed no other weighted audits' };

  // Exactly the measured pair, or nothing. `total-blocking-time` is subtracted
  // from the unscored set rather than searched for in it: a run where it failed
  // *and* something else did is a third casualty, which the ruling refuses.
  const beyondTheCompanion = unscored.filter((id) => id !== WAIVED_COMPANION);
  if (beyondTheCompanion.length > 0) {
    return { known: false, reason: `other performance audits also failed to score: ${unscored.join(', ')}` };
  }
  if (unscored.length > 0) {
    return {
      known: true,
      reason: `NO_LCP with ${WAIVED_COMPANION} unscored — the pair measured on the live fleet — and ${others.length - unscored.length} other weighted performance audit(s) scored`,
    };
  }
  return { known: true, reason: `NO_LCP with ${others.length} other weighted performance audit(s) scored` };
}

export async function run(ctx, session, audit) {
  const { slug, origin, politeness } = ctx;
  const assertions = [];
  const findings = [];
  const url = `${origin}/`;

  await politeness.navigate(new URL(origin).host);
  const outcome = await audit.runLighthouse(url, session.port);

  // The port is asserted, not assumed: a browser launched without
  // `--remote-debugging-port` opens no port at all, and the failure mode is
  // silent (known-issues #3). Reporting the port the session launched with, and
  // that Lighthouse was told to use, is what makes that checkable.
  assertions.push(
    assertion(
      'Lighthouse attached to the port this session opened',
      outcome.scores !== undefined || outcome.error === '',
      `port ${session.port}`,
      `port ${session.port}`,
      outcome.error || 'the browser was launched with --remote-debugging-port',
    ),
  );

  if (!outcome.scores) {
    assertions.push(assertion('Lighthouse ran', false, outcome.error || 'no scores returned', 'four category scores'));
    findings.push(finding(FINDING.LIGHTHOUSE, `${slug}: Lighthouse produced no scores — ${outcome.error}`));
    return summarise('lighthouse', 'Lighthouse', assertions, findings, { port: session.port, url });
  }

  const scores = outcome.scores;

  for (const [category, bar] of Object.entries(BAR)) {
    const value = scores[category];
    const ok = typeof value === 'number' && value >= bar;
    assertions.push(assertion(`lighthouse ${category}`, ok, value ?? 'unavailable', `≥ ${bar}`));
    if (!ok) {
      findings.push(
        finding(
          FINDING.LIGHTHOUSE,
          `${slug}: ${category} ${value ?? 'unavailable'} against a bar of ${bar}`,
        ),
      );
    }
  }

  let performanceNote = '';
  for (const category of REPORTED_ONLY) {
    const value = scores[category];
    if (typeof value === 'number') {
      assertions.push(
        assertion(
          `lighthouse ${category}`,
          true,
          value,
          'reported, no bar',
          category === 'seo' ? 'no bar while every demo is noindex — see the header' : '',
        ),
      );
      continue;
    }

    if (category === 'seo') {
      assertions.push(assertion('lighthouse seo', false, 'unavailable', 'a score'));
      findings.push(finding(FINDING.LIGHTHOUSE, `${slug}: Lighthouse returned no seo score`));
      continue;
    }

    // performance, absent. The rule.
    const waiver = noLcpWaiverStands();
    const signature = isKnownNoLcp(outcome.lhr);
    const allowed = waiver && signature.known;
    performanceNote = allowed
      ? 'unavailable (known: NO_LCP, docs/known-issues.md #2)'
      : `unavailable — ${waiver ? signature.reason : 'docs/known-issues.md no longer carries a NO_LCP entry, so the allowance is refused'}`;
    assertions.push(
      assertion(
        'lighthouse performance',
        allowed,
        performanceNote,
        allowed ? 'unavailable, allowed by known-issues #2' : 'a score',
        signature.reason,
      ),
    );
    if (!allowed) {
      findings.push(
        finding(
          FINDING.LIGHTHOUSE,
          `${slug}: no performance score, and it is not known-issues #2 — ${performanceNote}`,
        ),
      );
    }
  }

  return summarise('lighthouse', 'Lighthouse', assertions, findings, {
    port: session.port,
    url,
    scores,
    performanceNote,
  });
}
