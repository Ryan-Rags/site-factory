import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { describe, test } from 'node:test';

import { launchAuditBrowser, runAuditStage } from '../dist/index.js';

/**
 * The sweep's browser launcher, and the port it has to hand onward.
 *
 * Lighthouse does not drive the browser Playwright hands back; it attaches over
 * the DevTools protocol to a port the browser only opens if
 * `--remote-debugging-port` was passed **at launch**. Miss it and nothing
 * throws: `runLighthouse` fails to connect, `lighthouseCheck` records all four
 * Lighthouse checks as `unavailable`, and `scoreSite` computes neglect over the
 * probe checks alone — a plausible-looking number measured over two thirds of
 * the checks. That is what shipped in the sweep CLI until this branch: it
 * launched bare and let `assess` fall back to a 9222 nobody was listening on.
 *
 * These tests lock the two halves that have to stay married: the port is opened
 * at launch, and the *same* port is the one handed to `assess`. They use an
 * injected launcher rather than a real browser — the wiring is the subject, and
 * `e2e-sites.test.mjs` already runs the real thing.
 */

/** A stand-in for playwright's `chromium`, recording what it was launched with. */
function fakeLauncher() {
  const calls = [];
  const browser = {
    closed: false,
    async close() {
      this.closed = true;
    },
  };
  return {
    calls,
    browser,
    launch(options) {
      calls.push(options);
      return Promise.resolve(browser);
    },
  };
}

/** The port named in `--remote-debugging-port=NNNN`, or undefined if absent. */
function portFromArgs(options) {
  const flag = (options?.args ?? []).find((a) => a.startsWith('--remote-debugging-port='));
  return flag === undefined ? undefined : Number(flag.split('=')[1]);
}

const emptyOutcome = () => ({
  assessments: [],
  skippedByCap: 0,
  degradedRanking: 0,
  warnings: [],
});

describe('launchAuditBrowser', () => {
  test('opens a remote debugging port at launch', async () => {
    const launcher = fakeLauncher();
    await launchAuditBrowser(launcher);

    assert.equal(launcher.calls.length, 1);
    const port = portFromArgs(launcher.calls[0]);
    assert.ok(
      port !== undefined,
      'launched without --remote-debugging-port: Lighthouse would have nothing to attach to',
    );
  });

  test('reports the very port it opened, so the two cannot drift apart', async () => {
    const launcher = fakeLauncher();
    const { debugPort } = await launchAuditBrowser(launcher);

    assert.equal(
      debugPort,
      portFromArgs(launcher.calls[0]),
      'the reported port must be the one the browser is actually listening on',
    );
  });

  test('the port is a real, free, ephemeral one rather than a hardcoded default', async () => {
    const launcher = fakeLauncher();
    const { debugPort } = await launchAuditBrowser(launcher);

    assert.equal(Number.isInteger(debugPort), true);
    assert.ok(debugPort > 1024 && debugPort <= 65535, `implausible port ${debugPort}`);

    // It was free when chosen, so it must still be bindable here.
    await new Promise((resolve, reject) => {
      const server = createServer();
      server.once('error', reject);
      server.listen(debugPort, '127.0.0.1', () => server.close(resolve));
    });
  });

  test('returns the browser the launcher produced', async () => {
    const launcher = fakeLauncher();
    const { browser } = await launchAuditBrowser(launcher);
    assert.equal(browser, launcher.browser);
  });
});

describe('runAuditStage', () => {
  /** The regression this branch exists to prevent. */
  test('hands assess the port the browser was actually launched on', async () => {
    const launcher = fakeLauncher();
    const seen = [];

    await runAuditStage({
      results: [],
      auditCap: 0,
      launcher,
      assessImpl: async (options) => {
        seen.push(options);
        return emptyOutcome();
      },
    });

    assert.equal(seen.length, 1);
    assert.equal(
      seen[0].debugPort,
      portFromArgs(launcher.calls[0]),
      'assess was given a different port from the one the browser opened — ' +
        'every Lighthouse check would read unavailable, silently',
    );
    assert.equal(seen[0].browser, launcher.browser, 'assess must audit through the launched browser');
  });

  test('passes the caller options through untouched', async () => {
    const launcher = fakeLauncher();
    const seen = [];
    const now = new Date('2026-08-12T12:00:00Z');

    await runAuditStage({
      results: [],
      auditCap: 7,
      dataDirOverride: 'test/fixtures/no-such-dir',
      now,
      launcher,
      assessImpl: async (options) => {
        seen.push(options);
        return emptyOutcome();
      },
    });

    assert.equal(seen[0].auditCap, 7);
    assert.equal(seen[0].dataDirOverride, 'test/fixtures/no-such-dir');
    assert.equal(seen[0].now, now);
    assert.equal('launcher' in seen[0], false, 'the launcher is not an assess option');
    assert.equal('assessImpl' in seen[0], false, 'the test seam must not leak into assess');
  });

  test('returns what assess returned', async () => {
    const launcher = fakeLauncher();
    const outcome = await runAuditStage({
      results: [],
      auditCap: 0,
      launcher,
      assessImpl: async () => ({ ...emptyOutcome(), degradedRanking: 3 }),
    });
    assert.equal(outcome.degradedRanking, 3);
  });

  test('closes the browser when the audit succeeds', async () => {
    const launcher = fakeLauncher();
    await runAuditStage({
      results: [],
      auditCap: 0,
      launcher,
      assessImpl: async () => emptyOutcome(),
    });
    assert.equal(launcher.browser.closed, true);
  });

  test('closes the browser when the audit throws — a leaked chromium outlives the run', async () => {
    const launcher = fakeLauncher();
    await assert.rejects(
      runAuditStage({
        results: [],
        auditCap: 0,
        launcher,
        assessImpl: async () => {
          throw new Error('audit blew up');
        },
      }),
      /audit blew up/,
    );
    assert.equal(launcher.browser.closed, true);
  });
});
