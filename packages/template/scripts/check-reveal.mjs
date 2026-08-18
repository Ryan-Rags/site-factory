/**
 * The reveal animation must never cost anybody the content.
 *
 * `Reveal.astro` hides `[data-reveal]` elements and fades them in as they cross
 * the fold. That is a decoration, and a decoration is only acceptable while it
 * cannot take the page away from anyone. Three ways it could, and one assertion
 * each:
 *
 *   1. FIRES ONCE. An element that re-hides when the reader scrolls back up is
 *      a page that dissolves behind them. Scroll to the bottom, back to the
 *      top, back down: nothing that was revealed may lose `.is-revealed`, and
 *      no revealed element's opacity may drop below 1 again.
 *
 *   2. NOTHING ABOVE THE FOLD IS PRE-HIDDEN. This is the assertion that
 *      justifies the gate. `[data-reveal-ready]` is stamped on `<html>` by the
 *      inline script, and from that moment the CSS hides every un-revealed
 *      `[data-reveal]`. An element already inside the first screen therefore
 *      paints blank until an IntersectionObserver callback reaches it — a real
 *      flash on a slow phone, and a permanently blank first screen if the
 *      observer never fires. Measured at `DOMContentLoaded`, which is after the
 *      inline script has run: exactly the window in which the damage is done.
 *
 *   3. REDUCED MOTION IS THE WHOLE PAGE, IMMEDIATELY. With
 *      `prefers-reduced-motion: reduce`, every `[data-reveal]` must already be
 *      at opacity 1 with no transition, and the counters must be painted at
 *      their final values rather than sitting at zero. Somebody who asked the
 *      operating system for less motion must not be given less information.
 *
 * Run against a served build, with the same served-slug guard the other browser
 * gates carry — `astro preview` walks to the next free port silently, and a
 * gate that cannot prove which build it measured can report green on another
 * worktree's site.
 *
 * THE SETTLE WINDOW COMES FROM THE CONTRACT, NOT FROM A LITERAL.
 *
 * This file used to wait a hard-coded 800ms after scrolling, with a comment
 * deriving it from `design.css`'s 620ms transition and 160ms delay ceiling.
 * Both of those are now per-motion-preset, so the wait is read from the served
 * page's `data-motion-preset` and the `motion` block in `presets.json`.
 *
 * Measured before it was changed, and the measurement corrected the premise —
 * see `docs/evidence/reveal-settle-window.md`. A 900ms reveal did NOT break the
 * 800ms gate: opacity is read only after a *second* full settle, so a revealed
 * element has ~1.75s to finish and anything shorter than that passes whatever
 * the literal says. The gate failed at 8s and not before.
 *
 * So this change is not "the old number was wrong". It is that the old number
 * was not doing the job its comment claimed, and a gate whose correctness rests
 * on an accident of its own scroll pattern is a gate that will go blind quietly.
 * Deriving the window from the contract makes the correctness stated, and lets
 * `still` skip a wait it provably does not need.
 *
 * NO CONTRACT, NO RUN. A motion preset with no `reveal.settle` fails here
 * rather than inheriting 800ms. A gate that quietly defaults is how a suite
 * stops checking the thing it was written for.
 *
 * Usage:
 *   SITE_CLIENT=<slug> pnpm exec astro build
 *   SITE_CLIENT=<slug> pnpm preview --port 4321     # in one terminal
 *   SITE_CLIENT=<slug> pnpm check:reveal            # in another
 *
 * Set CHROME_PATH if Chrome is not at the platform default.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

import { assertServedSlug } from './lib/served-slug.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, '..');

const BASE = process.env['PREVIEW_URL'] ?? 'http://localhost:4321';
const SLUG = process.env['SITE_CLIENT'] ?? 'ks-welding';

const VIEWPORTS = [320, 390, 768, 1024, 1440];
const ROUTES = ['/', '/services', '/about', '/contact', '/gallery', '/404'];

const presetFile = JSON.parse(
  readFileSync(join(pkgRoot, 'src', 'design', 'presets.json'), 'utf8'),
);

/**
 * The motion contract, by id, with every field this gate depends on present.
 *
 * Validated up front rather than at the point of use, so a malformed preset
 * fails before a browser is launched and says which field is missing.
 */
function motionContract(id) {
  const found = (presetFile.motion ?? []).find((m) => m.id === id);
  if (!found)
    fatal(
      `The served page reports data-motion-preset="${id}", which is not a motion preset in\n` +
        `  src/design/presets.json (has: ${(presetFile.motion ?? []).map((m) => m.id).join(', ') || 'none'}).`,
    );
  if (!found.reveal || typeof found.reveal.settle !== 'number')
    fatal(
      `Motion preset "${id}" declares no \`reveal.settle\`. This gate does not default —\n` +
        `  a settle window it made up would be a wait nobody chose, on a timing nobody stated.`,
    );
  return found;
}

function fatal(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

/* ------------------------------------------------------- orthogonality ---- *
 *
 * The claim that licenses running this as a SUM.
 *
 * The motion axis is checked over one representative route set per preset —
 * 3 × routes — instead of 3 × the 272-cell theme matrix. That is only honest
 * if the axes genuinely do not interact, so the claim is proved statically
 * rather than asserted in a comment, and in BOTH directions:
 *
 *   1. no rule emitted for a theme cell may mention `data-motion-preset`;
 *   2. no `[data-motion-preset]` rule may mention `data-theme`, `data-scheme`,
 *      `data-accent` or `data-font`.
 *
 * Direction 2 is read off the served page, which is where a violation would
 * actually live. Direction 1 is the same scan from the other side: any
 * `data-motion-preset` occurring inside a selector that also names another
 * axis fails, whichever file it came from.
 *
 * Cheap, exact, and it fails before the browser work rather than after it.
 * ------------------------------------------------------------------------- */
const OTHER_AXES = ['data-theme', 'data-scheme', 'data-accent', 'data-font'];

function assertOrthogonalSelectors(css) {
  // Selectors are everything before a `{`, per rule. Good enough here because
  // the emitted matrix and design.css are both plain rule lists.
  const offenders = [];
  for (const match of css.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
    const selector = match[1].trim();
    if (!selector.includes('data-motion-preset')) continue;
    const also = OTHER_AXES.filter((axis) => selector.includes(axis));
    if (also.length > 0) offenders.push({ selector, also });
  }
  return offenders;
}

const CHROME_CANDIDATES = [
  process.env['CHROME_PATH'],
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

const executablePath = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!executablePath) {
  console.error('No Chrome found. Set CHROME_PATH to your Chrome binary.');
  process.exit(1);
}

/* -------------------------------------------------------------------- report */

let failures = 0;
let checks = 0;
const seen = new Map();

function fail(where, message) {
  failures++;
  const key = message.replace(/\d+(\.\d+)?/g, 'N');
  if (!seen.has(key)) console.error(`  ✗ ${where}: ${message}`);
  seen.set(key, (seen.get(key) ?? 0) + 1);
}

function assert(where, ok, message) {
  checks++;
  if (!ok) fail(where, message);
}

/*
 * The pre-hidden probe, installed before any of the page's own script runs.
 *
 * It has to be a document-start hook rather than something evaluated after
 * `goto` resolves: by then the observer has long since fired and every
 * above-the-fold element is revealed, so the measurement would always come back
 * clean and the gate would be worthless.
 */
const PROBE = `
window.__revealProbe = null;
document.addEventListener('DOMContentLoaded', function () {
  var out = [];
  var els = document.querySelectorAll('[data-reveal]');
  for (var i = 0; i < els.length; i++) {
    var el = els[i];
    var r = el.getBoundingClientRect();
    // Inside the first screen, and actually occupying space.
    var inFold = r.top < window.innerHeight && r.bottom > 0 && r.width > 0 && r.height > 0;
    if (!inFold) continue;
    out.push({
      cls: el.getAttribute('class') || el.tagName.toLowerCase(),
      revealed: el.classList.contains('is-revealed'),
      opacity: Number(getComputedStyle(el).opacity),
      top: Math.round(r.top),
    });
  }
  window.__revealProbe = out;
});
`;

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ['--no-sandbox', '--hide-scrollbars'],
});

try {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(PROBE);
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

  const response = await page.goto(BASE, { waitUntil: 'networkidle0' });
  if (!response || response.status() >= 400) {
    console.error(`Cannot reach ${BASE} — HTTP ${response?.status() ?? 'no response'}.`);
    process.exit(1);
  }

  await assertServedSlug(page, { slug: SLUG, base: BASE });

  /*
   * Which motion contract this page is under, and the orthogonality proof.
   *
   * A delivered build carries no `data-motion-preset` at all — its four motion
   * properties sit on the `design.css` fallbacks, which are lively's numbers —
   * so absence resolves to the default rather than failing. An attribute that
   * IS present must name a real preset; a typo fails here rather than being
   * silently waited out at the wrong length.
   */
  const served = await page.evaluate(() => ({
    motion: document.documentElement.getAttribute('data-motion-preset'),
    css: [...document.querySelectorAll('style')].map((s) => s.textContent ?? '').join('\n'),
  }));

  const offenders = assertOrthogonalSelectors(served.css);
  if (offenders.length > 0) {
    console.error(
      `✗ The motion axis is not orthogonal, so this gate cannot run as a SUM.\n` +
        `  ${offenders.length} selector(s) combine data-motion-preset with another axis:`,
    );
    for (const o of offenders.slice(0, 10))
      console.error(`    ${o.selector}   (also names ${o.also.join(', ')})`);
    console.error(
      `\n  Either keep the axes separate, or change this gate to a product over the\n` +
        `  theme matrix and accept the cost. Do not delete the assertion.`,
    );
    process.exit(1);
  }

  const motionId = served.motion ?? presetFile.defaultMotion;
  const contract = motionContract(motionId);
  const SETTLE = contract.reveal.settle;

  /** Routes this build actually emits. A missing one is check:links' problem. */
  const available = ['/404'];
  for (const route of ROUTES) {
    if (route === '/404') continue;
    const probe = await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
    if ((probe?.status() ?? 404) < 400) available.push(route);
  }
  const missing = ROUTES.filter((r) => !available.includes(r));

  console.log(
    `reveal: ${SLUG} at ${BASE}\n` +
      `  motion "${motionId}"${served.motion === null ? ' (no attribute — a delivered build)' : ''}` +
      `, settle ${SETTLE}ms from the contract\n` +
      `  ${available.length} route(s) × ${VIEWPORTS.length} viewports, plus a reduced-motion pass\n` +
      (missing.length > 0 ? `  not emitted by this client: ${missing.join(', ')}\n` : ''),
  );

  /* --- 1 and 2, at every viewport on every route ------------------------- */

  for (const width of VIEWPORTS) {
    await page.setViewport({ width, height: 900, deviceScaleFactor: 1, isMobile: width < 768 });

    for (const route of available) {
      const where = `${width}px ${route}`;
      await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle0' });

      // 2 — nothing inside the first screen was hidden at DOMContentLoaded.
      const preHidden = await page.evaluate(() => window.__revealProbe ?? []);
      for (const el of preHidden) {
        assert(
          where,
          el.revealed || el.opacity >= 1,
          `[data-reveal] "${el.cls}" at y=${el.top} is inside the first screen but was ` +
            `unrevealed at DOMContentLoaded (opacity ${el.opacity}) — it paints blank until ` +
            `the observer reaches it, and stays blank if it never does`,
        );
      }

      // 1 — reveal is a one-way door. Down, up, down again.
      /*
       * Scroll the whole page, then wait the contract's settle window before
       * reading anything.
       *
       * `SETTLE` is `motion.reveal.settle` for the preset the served page is
       * in: 800ms for lively (today's number, restated as data rather than as
       * a literal in a selector nobody owns), 1200ms for calm, 0 for still,
       * which has no transition to wait for at all.
       *
       * Sampling before a transition finishes is how the first version of this
       * gate reported thirteen elements "falling back to opacity 0.97" — every
       * one of them simply still mid-fade. A gate that reports a transition in
       * progress as a regression is worse than no gate, because the next real
       * one gets ignored with it.
       */
      const settle = async () => {
        await page.evaluate(async (wait) => {
          const step = window.innerHeight;
          for (let y = 0; y < document.body.scrollHeight; y += step) {
            window.scrollTo(0, y);
            await new Promise((r) => setTimeout(r, 40));
          }
          window.scrollTo(0, document.body.scrollHeight);
          await new Promise((r) => setTimeout(r, wait));
        }, SETTLE);
      };

      await settle();
      const afterDown = await page.evaluate(() =>
        [...document.querySelectorAll('[data-reveal]')].map((el) =>
          el.classList.contains('is-revealed'),
        ),
      );

      await page.evaluate(async () => {
        window.scrollTo(0, 0);
        await new Promise((r) => setTimeout(r, 150));
      });
      await settle();

      const read = () =>
        page.evaluate(() =>
          [...document.querySelectorAll('[data-reveal]')].map((el) => ({
            revealed: el.classList.contains('is-revealed'),
            opacity: Number(getComputedStyle(el).opacity),
          })),
        );

      let afterUpDown = await read();

      /*
       * Tell mid-fade apart from re-hiding before naming a cause.
       *
       * This gate could not previously distinguish the two, and said the wrong
       * one: an 8s reveal produced 155 reports of elements "being re-hidden
       * behind the reader" that were in fact still rising, at opacity 0.996.
       * See `docs/evidence/reveal-settle-window.md`.
       *
       * So anything below 1 gets one more settle window and a second read. If
       * it rose, the page is slower than its contract says and that is the
       * failure to report; if it did not, it really is being re-hidden. One
       * extra wait, only on a page that is already about to fail.
       */
      const lagging = afterUpDown.some((el, i) => afterDown[i] && (el?.opacity ?? 0) < 1);
      let second = null;
      if (lagging) {
        await page.evaluate(
          async (wait) => new Promise((r) => setTimeout(r, wait)),
          Math.max(SETTLE, 400),
        );
        second = await read();
      }

      for (let i = 0; i < afterDown.length; i++) {
        if (!afterDown[i]) continue;
        assert(
          where,
          afterUpDown[i]?.revealed === true,
          `a [data-reveal] element lost .is-revealed after scrolling up and back down — ` +
            `the reveal is re-running instead of firing once`,
        );

        const first = afterUpDown[i]?.opacity ?? 0;
        if (first >= 1) {
          checks++;
          continue;
        }
        const later = second?.[i]?.opacity ?? first;
        assert(
          where,
          later >= 1,
          later > first
            ? `a revealed [data-reveal] element was still at opacity ${first} after the ` +
              `"${motionId}" settle window of ${SETTLE}ms and only reached ${later} later — ` +
              `the page is slower than its motion contract declares`
            : `a revealed [data-reveal] element fell back to opacity ${first} — ` +
              `it is being re-hidden behind the reader`,
        );
      }
    }
    process.stdout.write(`  swept ${available.length} route(s) at ${width}px\n`);
  }

  /* --- 3, the reduced-motion pass ---------------------------------------- */

  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.setViewport({ width: 390, height: 900, deviceScaleFactor: 1, isMobile: true });

  for (const route of available) {
    const where = `reduced-motion ${route}`;
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle0' });

    const state = await page.evaluate(() => ({
      hidden: [...document.querySelectorAll('[data-reveal]')]
        .map((el) => ({
          cls: el.getAttribute('class') || el.tagName.toLowerCase(),
          opacity: Number(getComputedStyle(el).opacity),
          transition: getComputedStyle(el).transitionProperty,
        }))
        .filter((el) => el.opacity < 1),
      counters: [...document.querySelectorAll('[data-count-to]')].map((el) => ({
        want: Number(el.getAttribute('data-count-to')),
        got: Number((el.textContent ?? '').trim()),
      })),
      revealReady: document.documentElement.hasAttribute('data-reveal-ready'),
    }));

    for (const el of state.hidden) {
      fail(
        where,
        `[data-reveal] "${el.cls}" is at opacity ${el.opacity} under reduced motion — ` +
          `a reader who asked for less motion is being given less page`,
      );
    }
    checks++;

    for (const counter of state.counters) {
      assert(
        where,
        counter.got === counter.want,
        `a counter reads ${counter.got} but its final value is ${counter.want} — ` +
          `under reduced motion the figure must be painted, not animated`,
      );
    }
  }
  process.stdout.write(`  swept ${available.length} route(s) under reduced motion\n`);

  /* --- 4, the motion axis, as a SUM -------------------------------------- */
  /*
   * Each motion preset over one representative route set, at one viewport.
   *
   * 3 × routes, not 3 × the 272-cell theme matrix. The static assertion at the
   * top of this run is what makes that honest: no selector combines
   * `data-motion-preset` with any other axis, so a preset that holds the
   * invariants on one cell holds them on all of them.
   *
   * Pitch builds only. A delivered page has no `data-motion-preset` and no
   * `[data-motion-preset]` block, so `?motion=` would change nothing and a
   * "pass" here would be measuring the same page three times.
   */
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  await page.setViewport({ width: 390, height: 900, deviceScaleFactor: 1, isMobile: true });

  if (served.motion === null) {
    process.stdout.write(`  motion axis: not on this build (delivered) — nothing to sweep\n`);
  } else {
    for (const preset of presetFile.motion) {
      const wait = motionContract(preset.id).reveal.settle;

      for (const route of available) {
        const where = `motion/${preset.id} ${route}`;
        const sep = route.includes('?') ? '&' : '?';
        await page.goto(`${BASE}${route}${sep}motion=${preset.id}`, { waitUntil: 'networkidle0' });

        // The page must actually be in the preset we asked for, or the rest of
        // this sweep is three readings of the default.
        const got = await page.evaluate(() =>
          document.documentElement.getAttribute('data-motion-preset'),
        );
        assert(
          where,
          got === preset.id,
          `asked for ?motion=${preset.id} but the page is in "${got}" — the sweep would ` +
            `otherwise report the default three times and call it three presets`,
        );

        // Invariant 2 — nothing inside the first screen was pre-hidden. A
        // slower preset does not license a blank first screen; it makes one
        // worse. This is the invariant that justifies the whole decoration.
        const preHidden = await page.evaluate(() => window.__revealProbe ?? []);
        for (const el of preHidden) {
          assert(
            where,
            el.revealed || el.opacity >= 1,
            `[data-reveal] "${el.cls}" at y=${el.top} is inside the first screen but was ` +
              `unrevealed at DOMContentLoaded (opacity ${el.opacity})`,
          );
        }

        // Invariant 1 — fires once, at this preset's own settle window.
        const sweep = async () => {
          await page.evaluate(async (ms) => {
            const step = window.innerHeight;
            for (let y = 0; y < document.body.scrollHeight; y += step) {
              window.scrollTo(0, y);
              await new Promise((r) => setTimeout(r, 40));
            }
            window.scrollTo(0, document.body.scrollHeight);
            await new Promise((r) => setTimeout(r, ms));
          }, wait);
        };
        await sweep();
        const down = await page.evaluate(() =>
          [...document.querySelectorAll('[data-reveal]')].map((el) =>
            el.classList.contains('is-revealed'),
          ),
        );
        await page.evaluate(async () => {
          window.scrollTo(0, 0);
          await new Promise((r) => setTimeout(r, 150));
        });
        await sweep();
        const back = await page.evaluate(() =>
          [...document.querySelectorAll('[data-reveal]')].map((el) => ({
            revealed: el.classList.contains('is-revealed'),
            opacity: Number(getComputedStyle(el).opacity),
          })),
        );
        for (let i = 0; i < down.length; i++) {
          if (!down[i]) continue;
          assert(
            where,
            back[i]?.revealed === true && (back[i]?.opacity ?? 0) >= 1,
            `a revealed [data-reveal] element came back at opacity ${back[i]?.opacity} — ` +
              `"${preset.id}" is re-hiding content behind the reader`,
          );
        }

        /*
         * The two things CSS cannot do, which is the whole reason
         * `Reveal.astro` reads the attribute at all.
         *
         * Under `counters: paint` the figure must already be final — a counter
         * sitting at 0 because no observer fired is the still preset silently
         * withholding information rather than withholding motion.
         */
        if (preset.counters === 'paint') {
          const counters = await page.evaluate(() =>
            [...document.querySelectorAll('[data-count-to]')].map((el) => ({
              want: Number(el.getAttribute('data-count-to')),
              got: Number((el.textContent ?? '').trim()),
            })),
          );
          for (const c of counters) {
            assert(
              where,
              c.got === c.want,
              `a counter reads ${c.got} but its final value is ${c.want} — under ` +
                `"${preset.id}" the figure must be painted, not animated`,
            );
          }
        }

        /*
         * Under `carousel: off` the reviews rail must not move on its own.
         * Measured rather than inferred from the script: read scrollLeft,
         * wait past the configured autoplay delay, read it again.
         */
        if (preset.carousel === 'off') {
          const moved = await page.evaluate(async () => {
            const rail = document.querySelector('[data-carousel]');
            if (!rail) return null;
            const delay = Number(rail.getAttribute('data-autoplay') || 0);
            if (!delay) return null;
            const before = rail.scrollLeft;
            await new Promise((r) => setTimeout(r, delay + 600));
            return { before, after: rail.scrollLeft };
          });
          if (moved) {
            assert(
              where,
              moved.after === moved.before,
              `the reviews rail advanced from ${moved.before} to ${moved.after} under ` +
                `"${preset.id}" — the carousel timer is running when the contract says off`,
            );
          }
        }
      }
      process.stdout.write(
        `  swept ${available.length} route(s) under motion "${preset.id}" (settle ${wait}ms)\n`,
      );
    }
  }
} finally {
  await browser.close();
}

console.log();
if (failures > 0) {
  const kinds = [...seen.entries()].sort((a, b) => b[1] - a[1]);
  console.error(`${kinds.length} distinct failure(s), ${failures} occurrence(s) of ${checks} checks:`);
  for (const [kind, count] of kinds) console.error(`  ${String(count).padStart(5)} ×  ${kind}`);
  console.error(
    `\n✗ The reveal decoration is costing somebody the content. See Reveal.astro.\n`,
  );
  process.exit(1);
}
console.log(`✓ ${checks} reveal checks passed — fires once, nothing pre-hidden, reduced motion whole.`);
