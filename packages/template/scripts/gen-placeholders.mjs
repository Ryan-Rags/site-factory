/**
 * Regenerates the placeholder images in public/images/.
 *
 * They are flat SVGs labelled with the slot name and the exact pixel size the
 * real photo should be, so whoever swaps them in cannot get the aspect ratio
 * wrong. Run with: node scripts/gen-placeholders.mjs
 *
 * Note: og.svg is a placeholder only. Social platforms do not render SVG
 * previews — replace it with a 1200x630 PNG or JPG before going live.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'public', 'images');
mkdirSync(outDir, { recursive: true });

const INK = '#0f4c81';
const ACCENT = '#b45309';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Diagonal-hatch placeholder card with the slot name and its dimensions. */
function placeholder({ w, h, label }) {
  const titleSize = Math.round(Math.min(w, h) * 0.075);
  const subSize = Math.round(titleSize * 0.62);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(label)} placeholder">
  <defs>
    <pattern id="h" width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="28" height="28" fill="#eef2f7"/>
      <line x1="0" y1="0" x2="0" y2="28" stroke="#d7e0ea" stroke-width="10"/>
    </pattern>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#h)"/>
  <rect x="6" y="6" width="${w - 12}" height="${h - 12}" fill="none" stroke="${INK}" stroke-width="4" stroke-dasharray="18 12" opacity="0.55"/>
  <text x="50%" y="47%" text-anchor="middle" font-family="ui-sans-serif, system-ui, Segoe UI, Arial, sans-serif" font-size="${titleSize}" font-weight="700" fill="${INK}">${esc(label)}</text>
  <text x="50%" y="47%" dy="${Math.round(titleSize * 1.15)}" text-anchor="middle" font-family="ui-monospace, Consolas, monospace" font-size="${subSize}" fill="${ACCENT}">${w} x ${h} — replace with a real photo</text>
</svg>
`;
}

const files = {
  'hero.svg': placeholder({ w: 1920, h: 1080, label: 'Hero — shop floor' }),
  'story.svg': placeholder({ w: 1200, h: 800, label: 'Story — the shop' }),
  'og.svg': placeholder({ w: 1200, h: 630, label: 'Social share image' }),
  'service-precision-machining.svg': placeholder({ w: 800, h: 600, label: 'Precision machining' }),
  'service-repairs-rebuilds.svg': placeholder({ w: 800, h: 600, label: 'Repairs & rebuilds' }),
  'service-custom-fabrication.svg': placeholder({ w: 800, h: 600, label: 'Custom fabrication' }),
  'service-welding-fitting.svg': placeholder({ w: 800, h: 600, label: 'Welding & fitting' }),
};

for (let i = 1; i <= 6; i += 1) {
  files[`gallery-${i}.svg`] = placeholder({ w: 800, h: 800, label: `Gallery ${i}` });
}

// The logo is a neutral monogram mark, not a reproduction of any real logo.
// Replace with the client's actual artwork.
files['logo.svg'] = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="Logo placeholder">
  <rect width="64" height="64" rx="10" fill="${INK}"/>
  <path d="M20 18v28M20 32l14-14M20 32l14 14" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M44 18v28" fill="none" stroke="${ACCENT}" stroke-width="5" stroke-linecap="round"/>
</svg>
`;

for (const [name, contents] of Object.entries(files)) {
  writeFileSync(join(outDir, name), contents, 'utf8');
}

// Favicon lives at the public root, matching brand.favicon in site.config.ts.
writeFileSync(join(here, '..', 'public', 'favicon.svg'), files['logo.svg'], 'utf8');

console.log(`Wrote ${Object.keys(files).length + 1} placeholder files.`);
