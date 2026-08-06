/**
 * Screenshot a built client at the two audit viewports.
 *
 * The viewports (1440x900 desktop, 390x844 mobile, both full-page) are the
 * ones `packages/audit/src/probe.ts` uses for the "before" shots. Keeping them
 * identical is the whole point: the before/after pair goes in front of a lead
 * side by side, and a mismatched viewport would make the comparison a lie.
 *
 * Playwright is reused from `packages/audit` rather than added as a new root
 * dependency — same browser, already installed. No rate limit applies: every
 * navigation here is to our own build on 127.0.0.1.
 */
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { repoRoot } from './paths.mjs';

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

/**
 * Playwright lives in `packages/audit`'s dependency tree, and pnpm does not
 * hoist it to the root. Resolving through that package's `package.json` is
 * how a root-level script borrows it without a second copy in the lockfile.
 *
 * `require.resolve` returns an absolute filesystem path; the ESM loader needs
 * a URL. On Windows `d:\...` is read as the `d:` protocol without this.
 */
async function loadPlaywright() {
  const require = createRequire(join(repoRoot, 'packages', 'audit', 'package.json'));
  try {
    // Playwright's entry point is CommonJS, so its exports may arrive on
    // `default` rather than as named ESM bindings depending on how Node's
    // interop reads the module.
    const mod = await import(pathToFileURL(require.resolve('playwright')).href);
    return mod.chromium ? mod : mod.default;
  } catch (err) {
    throw new Error(
      `Could not load playwright from packages/audit. Run \`pnpm install\` first.\n${err.message}`,
    );
  }
}

/**
 * Shoot `origin` at both viewports into `outDir` as `after-<viewport>.png`.
 * Returns the filenames written.
 */
export async function shootSite(origin, outDir) {
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch();
  const written = [];

  try {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 1,
      });
      const page = await context.newPage();
      try {
        await page.goto(origin, { waitUntil: 'networkidle', timeout: 30_000 });
        // Images are lazy below the fold; a full-page shot would capture empty
        // boxes without this. Scroll through, then return to the top so the
        // hero is where a visitor would see it.
        await page.evaluate(async () => {
          const step = window.innerHeight;
          for (let y = 0; y < document.body.scrollHeight; y += step) {
            window.scrollTo(0, y);
            await new Promise((r) => setTimeout(r, 60));
          }
          window.scrollTo(0, 0);
        });
        await page.waitForLoadState('networkidle');
        const name = `after-${vp.name}.png`;
        await page.screenshot({ path: join(outDir, name), fullPage: true });
        written.push(name);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  return written;
}
