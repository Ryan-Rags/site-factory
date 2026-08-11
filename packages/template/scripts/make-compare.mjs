/**
 * Write `dist/compare.html` — the three families, side by side.
 *
 * The acceptance test for the design system is not "does Forge build" but
 * "can somebody see all three at once and say which one is theirs". This page
 * is that view: three live iframes of the three K&S builds, each labelled,
 * scrollable independently, with a direct link to open any of them full size.
 *
 * Iframes rather than screenshots because the point is the *behaviour* — the
 * sticky call bar, the FAQ accordion, the scroll reveal, the carousel. A
 * screenshot of three heroes proves nothing that matters.
 *
 * Serve `dist/` and open `/compare.html`:
 *   pnpm build:all && pnpm compare && npx serve dist
 *
 * The page is a build artifact, not a client site: it is never deployed with a
 * client's build, because it lives at the root of `dist/` rather than inside
 * `dist/<slug>/`, and each Pages project is published from a single client
 * directory.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, '..');
const distRoot = join(pkgRoot, 'dist');

const presets = JSON.parse(readFileSync(join(pkgRoot, 'src', 'design', 'presets.json'), 'utf8'));

const builds = [
  { slug: 'ks-welding-forge', preset: 'forge' },
  { slug: 'ks-welding-precision', preset: 'precision' },
  { slug: 'ks-welding-heritage', preset: 'heritage' },
];

const missing = builds.filter((b) => !existsSync(join(distRoot, b.slug, 'index.html')));
if (missing.length > 0) {
  console.error(
    `Not built yet: ${missing.map((m) => m.slug).join(', ')}. Run \`pnpm build:all\` first.`,
  );
  process.exit(1);
}

const cards = builds
  .map(({ slug, preset }) => {
    const p = presets.presets.find((x) => x.id === preset);
    return `      <section class="pane">
        <header>
          <h2>${p.label}</h2>
          <p>${p.blurb}</p>
          <a href="./${slug}/" target="_blank" rel="noopener">Open full size →</a>
        </header>
        <div class="frame">
          <iframe src="./${slug}/" title="${p.label} — K&amp;S Welding &amp; Fabricating"
                  loading="lazy"></iframe>
        </div>
      </section>`;
  })
  .join('\n');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Three families — K&amp;S Welding &amp; Fabricating</title>
<style>
  :root { color-scheme: light dark; }
  body {
    margin: 0; padding: 2rem 1.5rem 3rem;
    font: 16px/1.5 ui-sans-serif, system-ui, 'Segoe UI', Roboto, Arial, sans-serif;
    background: #14161a; color: #e8eaee;
  }
  h1 { font-size: 1.5rem; margin: 0 0 .5rem; }
  .intro { max-width: 62ch; color: #a8b0ba; margin: 0 0 2rem; }
  .grid { display: grid; gap: 1.5rem; }
  /* Each pane is a phone-width viewport: the families are designed
     mobile-first and this is the width the acceptance test cares about. */
  @media (min-width: 1180px) { .grid { grid-template-columns: repeat(3, 1fr); } }
  .pane { background: #1b1e24; border: 1px solid #2a2f36; border-radius: 10px; overflow: hidden; }
  .pane header { padding: 1.1rem 1.25rem; border-bottom: 1px solid #2a2f36; }
  .pane h2 { margin: 0 0 .4rem; font-size: 1.1rem; }
  .pane p { margin: 0 0 .6rem; font-size: .85rem; line-height: 1.5; color: #a8b0ba; }
  .pane a { color: #e2551f; font-weight: 600; font-size: .85rem; text-decoration: none; }
  .pane a:hover { text-decoration: underline; }
  .frame { height: 78vh; min-height: 560px; background: #fff; }
  iframe { width: 100%; height: 100%; border: 0; display: block; }
  footer { margin-top: 2.5rem; font-size: .85rem; color: #8a929c; max-width: 70ch; }
</style>
</head>
<body>
  <h1>K&amp;S Welding &amp; Fabricating — three design families</h1>
  <p class="intro">
    The same business, the same confirmed content, the same components. Everything
    that differs between these three is a theme selection in a JSON config: a
    preset, an accent, a font pairing and a hero layout. Scroll each pane —
    the sticky call bar, the FAQ accordion and the scroll reveals are live.
  </p>
  <div class="grid">
${cards}
  </div>
  <footer>
    All three are <code>noindex</code> mockups. Review text is paraphrased from
    relayed feedback and is labelled as such; nothing here was taken from any
    review platform. Images are placeholders pending the shop's own photographs.
  </footer>
</body>
</html>
`;

writeFileSync(join(distRoot, 'compare.html'), html);
console.log('✓ dist/compare.html — serve dist/ and open /compare.html');
