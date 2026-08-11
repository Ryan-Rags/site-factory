/**
 * Render a client's icon set and social card.
 *
 * What a texted demo link looks like when it unfurls is part of the pitch. An
 * unbranded grey placeholder in iMessage is the first thing a prospect sees,
 * and until now every client shared one generic `og.svg` — which several
 * platforms will not render at all, because they do not accept SVG for
 * `og:image`.
 *
 * This script renders two things per client, both from the client's own
 * resolved preset so they match the site they link to:
 *
 *   public/icons/<slug>/icon-512.png        PWA / Android
 *   public/icons/<slug>/icon-192.png        PWA / Android
 *   public/icons/<slug>/apple-touch-icon.png  iOS home screen (180×180)
 *   public/icons/<slug>/favicon-32.png      legacy favicon
 *   public/icons/<slug>/site.webmanifest
 *   public/og/<slug>.png                    1200×630 social card
 *
 * `DesignLayout` already links the first four and the manifest; `Seo.astro`
 * already wires `brand.ogImage` to `og:image` and `twitter:image` with
 * `summary_large_image`, so pointing `ogImage` at the generated PNG is the
 * whole integration — no change to `Seo.astro` at all.
 *
 * Playwright is a **devDependency of this package only**. Nothing it produces
 * is a runtime dependency: the output is static PNG, and the shipped pages
 * stay zero-dependency. That is what "no new dependencies" was protecting.
 *
 * Usage:
 *   node scripts/gen-brand-assets.mjs                 # every registered client
 *   node scripts/gen-brand-assets.mjs ks-welding      # one client
 *
 * It is deliberately NOT part of `pnpm build`: it needs a browser, it writes
 * into `public/`, and its output changes only when a client's brand or preset
 * changes. Run it when you add a client, and commit what it emits.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, '..');

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error(
    'playwright is not installed. Run `pnpm add -D playwright` in packages/template,\n' +
      'then `pnpm exec playwright install chromium`.',
  );
  process.exit(1);
}

/* ------------------------------------------------------------------ inputs */

const presets = JSON.parse(readFileSync(join(pkgRoot, 'src', 'design', 'presets.json'), 'utf8'));

/**
 * Client name, logo and theme selection, scraped from the TypeScript configs.
 *
 * Reading the source rather than importing it keeps this a plain Node script
 * with no build step, the same trade `check-contrast.mjs` and
 * `build-all.mjs` already make. Anything it cannot find is skipped with a
 * message rather than guessed at.
 */
function clientInfo(slug, depth = 0) {
  const configPath = join(pkgRoot, 'clients', `${slug}.config.ts`);
  if (!existsSync(configPath)) return null;
  const src = readFileSync(configPath, 'utf8');

  /*
   * A config that spreads another client's — the three K&S comparison builds
   * do — carries a theme but no business literals. Follow the import to the
   * config it spreads rather than skipping the client: these are exactly the
   * builds whose social card matters, since they are what gets sent to a
   * prospect side by side.
   */
  let name = /name:\s*'([^']+)'/.exec(src)?.[1] ?? /name:\s*"([^"]+)"/.exec(src)?.[1];
  let inherited = null;
  if (!name && depth < 3) {
    const parent = /from '\.\/([a-z0-9-]+)\.config'/.exec(src)?.[1];
    inherited = parent ? clientInfo(parent, depth + 1) : null;
    name = inherited?.name;
  }
  if (!name) return null;

  // The theme may live in the client's own design JSON, or — for the K&S
  // comparison builds — in the `inFamily(...)` call in the config itself.
  const inline = /preset:\s*'([^']+)',\s*accent:\s*'([^']+)'/.exec(src);
  let preset = inline?.[1];
  let accent = inline?.[2];

  if (!preset) {
    for (const suffix of ['.design.json', '.brief.json']) {
      const p = join(pkgRoot, 'clients', 'design', slug + suffix);
      if (!existsSync(p)) continue;
      const theme = JSON.parse(readFileSync(p, 'utf8')).theme;
      preset = theme?.preset;
      accent = theme?.accent;
      break;
    }
  }
  if (!preset) return null;

  const themePreset = presets.presets.find((p) => p.id === preset);
  if (!themePreset) return null;
  const swatch = themePreset.accents.find((a) => a.id === accent) ?? themePreset.accents[0];

  const tagline = /tagline:\s*'([^']+)'/.exec(src)?.[1] ?? inherited?.tagline ?? '';
  const locality = /locality:\s*'([^']+)'/.exec(src)?.[1] ?? inherited?.locality ?? '';
  const region = /region:\s*'([^']+)'/.exec(src)?.[1] ?? inherited?.region ?? '';

  return { slug, name, tagline, locality, region, palette: themePreset.palette, swatch, preset };
}

const logoSvg = readFileSync(join(pkgRoot, 'public', 'images', 'logo.svg'), 'utf8');
const logoDataUri = `data:image/svg+xml;base64,${Buffer.from(logoSvg).toString('base64')}`;

/* ------------------------------------------------------------------ render */

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function iconHtml(info) {
  const { palette, swatch } = info;
  return `<!doctype html><html><body style="margin:0">
<div style="width:512px;height:512px;display:flex;align-items:center;justify-content:center;
            background:${palette.primary};">
  <div style="width:360px;height:360px;display:flex;align-items:center;justify-content:center;
              border-radius:64px;background:${swatch.accent};">
    <img src="${logoDataUri}" width="240" height="240" alt="">
  </div>
</div></body></html>`;
}

function ogHtml(info) {
  const { palette, swatch, name, tagline, locality, region } = info;
  const place = [locality, region].filter(Boolean).join(', ');
  return `<!doctype html><html><body style="margin:0">
<div style="width:1200px;height:630px;box-sizing:border-box;padding:72px;
            background:${palette.base};color:${palette.ink};
            font-family:ui-sans-serif,system-ui,'Segoe UI',Roboto,Arial,sans-serif;
            display:flex;flex-direction:column;justify-content:space-between;
            border-bottom:16px solid ${swatch.accent};">
  <div style="display:flex;align-items:center;gap:20px;">
    <img src="${logoDataUri}" width="72" height="72" alt="">
    <span style="font-size:28px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;
                 color:${swatch.accent};">${esc(place)}</span>
  </div>
  <div>
    <div style="font-size:76px;line-height:1.05;font-weight:800;letter-spacing:-.02em;">
      ${esc(name)}
    </div>
    <div style="margin-top:24px;font-size:32px;line-height:1.35;max-width:900px;
                color:${palette.inkMuted};">${esc(tagline)}</div>
  </div>
</div></body></html>`;
}

const manifest = (info) => ({
  name: info.name,
  short_name: info.name.length > 12 ? info.name.slice(0, 12) : info.name,
  icons: [
    { src: `/icons/${info.slug}/icon-192.png`, sizes: '192x192', type: 'image/png' },
    { src: `/icons/${info.slug}/icon-512.png`, sizes: '512x512', type: 'image/png' },
  ],
  theme_color: info.palette.primary,
  background_color: info.palette.base,
  display: 'standalone',
  start_url: '/',
});

/* --------------------------------------------------------------------- run */

const requested = process.argv[2];
const slugs = requested
  ? [requested]
  : readFileSync(join(pkgRoot, 'clients', 'index.ts'), 'utf8')
      .split('\n')
      .map((line) => /^\s*'([a-z0-9-]+)':/.exec(line)?.[1])
      .filter(Boolean);

const browser = await chromium.launch();
let made = 0;

for (const slug of slugs) {
  const info = clientInfo(slug);
  if (!info) {
    console.warn(`- ${slug}: no design theme found, skipped`);
    continue;
  }

  const iconDir = join(pkgRoot, 'public', 'icons', slug);
  const ogDir = join(pkgRoot, 'public', 'og');
  mkdirSync(iconDir, { recursive: true });
  mkdirSync(ogDir, { recursive: true });

  const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
  await page.setContent(iconHtml(info));
  const icon = await page.locator('body > div').screenshot({ type: 'png' });
  writeFileSync(join(iconDir, 'icon-512.png'), icon);

  // The smaller sizes are the same artwork rendered at the target size rather
  // than a downscale, so the logo stays crisp at 32px.
  for (const [size, file] of [
    [192, 'icon-192.png'],
    [180, 'apple-touch-icon.png'],
    [32, 'favicon-32.png'],
  ]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      iconHtml(info).replace(/512px/g, `${size}px`).replace(
        /360px/g,
        `${Math.round(size * 0.7)}px`,
      ).replace(/64px/g, `${Math.round(size * 0.125)}px`).replace(
        /width="240" height="240"/,
        `width="${Math.round(size * 0.47)}" height="${Math.round(size * 0.47)}"`,
      ),
    );
    writeFileSync(
      join(iconDir, file),
      await page.locator('body > div').screenshot({ type: 'png' }),
    );
  }

  writeFileSync(
    join(iconDir, 'site.webmanifest'),
    JSON.stringify(manifest(info), null, 2) + '\n',
  );

  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(ogHtml(info));
  writeFileSync(
    join(ogDir, `${slug}.png`),
    await page.locator('body > div').screenshot({ type: 'png' }),
  );

  await page.close();
  console.log(`✓ ${slug}: icons + og card (${info.preset}/${info.swatch.id})`);
  made++;
}

await browser.close();
console.log(`\n${made}/${slugs.length} clients rendered.`);
