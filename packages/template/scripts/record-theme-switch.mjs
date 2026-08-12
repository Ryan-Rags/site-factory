/**
 * Record the customizer switching families, as a video.
 *
 * The claim "switching is instant, with no reload and no layout shift" is not
 * one a screenshot can support and not one a reader should have to take on
 * trust. This drives the real panel in a real browser at a phone viewport and
 * writes a video of it.
 *
 * Usage:
 *   pnpm build:client ks-welding
 *   SITE_CLIENT=ks-welding pnpm preview --port 4321   # in one terminal
 *   node scripts/record-theme-switch.mjs              # in another
 *
 * Output: `dist/theme-switch.webm` (a build artifact, never part of a client
 * site — it sits at the root of `dist/`, and each Pages project publishes a
 * single `dist/<slug>/` directory).
 */
import { mkdirSync, readdirSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, '..');
const outDir = join(pkgRoot, 'dist');
const tmpDir = join(outDir, '.video');

const BASE = process.env['PREVIEW_URL'] ?? 'http://localhost:4321';

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('playwright is not installed. Run `pnpm add -D playwright` in packages/template.');
  process.exit(1);
}

mkdirSync(tmpDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 412, height: 860 },
  deviceScaleFactor: 2,
  recordVideo: { dir: tmpDir, size: { width: 412, height: 860 } },
});
const page = await context.newPage();

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

const toggle = page.locator('#d-cust-toggle');
if ((await toggle.count()) === 0) {
  console.error(
    'No customizer on this build. It records the pitch build — check `features.customizer`\n' +
      'in the client config, and that SITE_DELIVERED is not set.',
  );
  await context.close();
  await browser.close();
  process.exit(1);
}

await toggle.click();
await page.waitForTimeout(600);

// Each family, then an accent, then a lettering change — the three controls,
// in the order a prospect actually tries them.
for (const preset of ['precision', 'heritage', 'forge']) {
  await page.locator(`label[for="d-theme-${preset}"]`).click();
  await page.waitForTimeout(1100);
}

const accents = page.locator('.d-cust__opts input[name="d-accent"]:not([disabled]) + label');
const accentCount = await accents.count();
if (accentCount > 1) {
  await accents.nth(1).click();
  await page.waitForTimeout(900);
}

const fonts = page.locator('.d-cust__opts input[name="d-font"]:not([disabled]) + label');
if ((await fonts.count()) > 1) {
  await fonts.nth(1).click();
  await page.waitForTimeout(900);
}

// Close the panel and scroll, so the recording shows the whole page in the
// chosen combination rather than just the hero behind an open panel.
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
await page.mouse.wheel(0, 1600);
await page.waitForTimeout(1400);

await context.close();
await browser.close();

const file = readdirSync(tmpDir).find((f) => f.endsWith('.webm'));
if (!file) {
  console.error('No video was written.');
  process.exit(1);
}
renameSync(join(tmpDir, file), join(outDir, 'theme-switch.webm'));
console.log('✓ dist/theme-switch.webm');
