/**
 * Renders what a shared link looked like before and after the og:image fix.
 *
 * Four of eight clients pointed `og:image` at `/images/og.svg` — a file whose
 * own aria-label reads "Social share image placeholder" — while their generated
 * 1200×630 brand card sat unused in `public/og/`. Facebook, X, LinkedIn,
 * iMessage, WhatsApp and Slack all decline to render SVG cards, so those links
 * unfurled with no image at all.
 *
 * "Unfurled blank" is the sort of claim that deserves a picture rather than a
 * sentence, so this draws the two side by side in the shape a messaging app
 * actually uses: the before pane omits the image exactly as a client would see
 * it, because that is the point.
 *
 *   node scripts/demo/unfurl-compare.mjs [slug] [--out <file>]
 */
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

const argv = process.argv.slice(2);
const slug = argv.find((a) => !a.startsWith('-')) ?? 'kh-machine-works';
const outAt = argv.indexOf('--out');
const outFile =
  outAt >= 0
    ? argv[outAt + 1]
    : join(pkgRoot, '..', '..', 'docs', 'evidence', 'trust-seo', `unfurl-${slug}.png`);

const card = join(pkgRoot, 'public', 'og', `${slug}.png`);
if (!existsSync(card)) {
  console.error(`✗ no generated card at public/og/${slug}.png — run pnpm gen:brand ${slug}`);
  process.exit(1);
}

const html = readFileSync(join(pkgRoot, 'dist', slug, 'index.html'), 'utf8');
const meta = (prop) =>
  new RegExp(`<meta[^>]+property=["']${prop}["'][^>]*content=["']([^"']*)["']`, 'i').exec(html)?.[1] ??
  '';
const title = meta('og:title');
const description = meta('og:description');
const url = meta('og:url');
const host = (() => {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
})();

const cardDataUri = `data:image/png;base64,${readFileSync(card).toString('base64')}`;

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const pane = (label, sub, imageHtml, tone) => `
  <section class="pane">
    <div class="label ${tone}">${esc(label)}</div>
    <div class="sub">${esc(sub)}</div>
    <div class="card">
      ${imageHtml}
      <div class="meta">
        <div class="host">${esc(host.toUpperCase())}</div>
        <div class="title">${esc(title)}</div>
        <div class="desc">${esc(description)}</div>
      </div>
    </div>
  </section>`;

const page = `
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0; width: 1600px; height: 980px; background: #eef1f5;
    font-family: ui-sans-serif, system-ui, "Segoe UI", Roboto, Arial, sans-serif;
    display: flex; gap: 48px; padding: 56px; align-items: flex-start;
  }
  .pane { flex: 1; }
  .label { font-size: 26px; font-weight: 800; letter-spacing: .04em; }
  .label.bad { color: #b42318; }
  .label.good { color: #067647; }
  .sub { font-size: 18px; color: #667085; margin-top: 8px; height: 48px; }
  .card {
    margin-top: 18px; background: #fff; border: 1px solid #d0d5dd; border-radius: 14px;
    overflow: hidden; box-shadow: 0 10px 26px rgba(16,24,40,.10);
  }
  .card img { display: block; width: 100%; height: 372px; object-fit: cover; }
  .blank {
    height: 372px; display: flex; align-items: center; justify-content: center;
    background: repeating-linear-gradient(45deg, #f2f4f7, #f2f4f7 12px, #e9edf3 12px, #e9edf3 24px);
    color: #98a2b3; font-size: 22px; font-weight: 600; border-bottom: 1px solid #eaecf0;
  }
  .meta { padding: 20px 22px 24px; }
  .host { font-size: 15px; color: #667085; letter-spacing: .08em; }
  .title { font-size: 25px; font-weight: 700; color: #101828; margin-top: 8px; line-height: 1.25; }
  .desc { font-size: 19px; color: #475467; margin-top: 10px; line-height: 1.45; }
</style>
${pane(
  'BEFORE — og:image: /images/og.svg',
  'No major platform renders an SVG card. The link arrives with no image.',
  '<div class="blank">no image rendered</div>',
  'bad',
)}
${pane(
  `AFTER — og:image: /og/${slug}.png`,
  'The generated 1200x630 brand card, which existed all along.',
  `<img src="${cardDataUri}" alt="">`,
  'good',
)}
`;

const { chromium } = await import('playwright');
mkdirSync(dirname(outFile), { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1600, height: 980 } });
const p = await context.newPage();
await p.setContent(page, { waitUntil: 'load' });
await p.screenshot({ path: outFile });
await browser.close();

console.log(`✓ ${slug}: unfurl comparison written to ${outFile}`);
