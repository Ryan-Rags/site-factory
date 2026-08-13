/**
 * Write `dist/compare.html` — every family, side by side.
 *
 * The acceptance test for the design system is not "does Forge build" but
 * "can somebody see them all at once and say which one is theirs". This page
 * is that view: one live iframe per family, each labelled, scrollable
 * independently, with a direct link to open any of them full size.
 *
 * Iframes rather than screenshots because the point is the *behaviour* — the
 * sticky call bar, the FAQ accordion, the scroll reveal, the carousel. A
 * screenshot of five heroes proves nothing that matters.
 *
 * ONE CLIENT, LOADED ONCE PER FAMILY, WITH URL PARAMETERS.
 *
 * This used to point at `ks-welding-forge`, `-precision` and `-heritage` —
 * three client directories that are one real business spread three ways. That
 * pattern does not survive two more families: it would mean authoring
 * `ks-welding-meridian` and `ks-welding-apex`, two more delivered builds of a
 * real shop that exist only to be looked at beside each other.
 *
 * So the page now loads the ONE pitch build, `ks-welding`, once per family as
 * `./ks-welding/?theme=<family>`. That build already emits every family's CSS
 * and its no-flash script already resolves `?theme` before first paint — this
 * page is simply the first consumer to ask for several cells at once. A sixth
 * family costs nothing here.
 *
 * The three `ks-welding-*` directories are left exactly as they are. They are
 * delivered output and deleting them would move shipped bytes; they become
 * redundant once this page uses parameters, and that is a separate ruling with
 * a follow-up issue against it.
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

/**
 * The pitch build every pane loads. It has to be a customizer build: a
 * delivered one emits a single `:root` block and would render the same family
 * in every frame while the labels claimed otherwise — the worst failure
 * available to a page whose entire job is comparison.
 */
const SLUG = 'ks-welding';

if (!existsSync(join(distRoot, SLUG, 'index.html'))) {
  console.error(`Not built yet: ${SLUG}. Run \`pnpm build:all\` first.`);
  process.exit(1);
}

/*
 * Fail loudly rather than render identical panes.
 *
 * `?theme=` only does anything on a build that shipped the matrix, and
 * `data-scheme` is emitted on pitch builds alone — so its presence is the
 * cheapest true test of "this build can switch". Without this check, a
 * compare page generated against a delivered `ks-welding` would look
 * completely normal and be five copies of one design.
 */
const home = readFileSync(join(distRoot, SLUG, 'index.html'), 'utf8');
if (!/<html[^>]*\sdata-scheme=/.test(home)) {
  console.error(
    `${SLUG} was built without the customizer, so ?theme= would change nothing and every\n` +
      `pane would render the same family under a different label. Rebuild it as a pitch\n` +
      `build (features.customizer) before generating this page.`,
  );
  process.exit(1);
}

/** Every family the matrix offers, in the order `presets.json` declares them. */
const builds = presets.presets.map((p) => ({ preset: p.id }));

const cards = builds
  .map(({ preset }) => {
    const p = presets.presets.find((x) => x.id === preset);
    // The family alone. Tone, accent and pairing are left to that family's own
    // defaults, which is what "show me this family" ought to mean — and the
    // panel inside each frame can still take it anywhere from there.
    const url = `./${SLUG}/?theme=${encodeURIComponent(p.id)}`;
    return `      <section class="pane">
        <header>
          <h2>${p.label}</h2>
          <p>${p.blurb}</p>
          <a href="${url}" target="_blank" rel="noopener">Open full size →</a>
        </header>
        <div class="frame">
          <iframe src="${url}" title="${p.label} — K&amp;S Welding &amp; Fabricating"
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
<title>${builds.length} families — K&amp;S Welding &amp; Fabricating</title>
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
  /* Five panes only fit side by side on a very wide desktop; below that
     they wrap to three and then to one, which is the reading order. */
  @media (min-width: 1900px) { .grid { grid-template-columns: repeat(5, 1fr); } }
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
  <h1>K&amp;S Welding &amp; Fabricating — ${builds.length} design families</h1>
  <p class="intro">
    The same business, the same confirmed content, the same components — and the
    same single build, loaded once per family with a different
    <code>?theme=</code>. Everything that differs between these panes is a theme
    selection: a preset, an accent, a font pairing and a hero layout. Scroll each
    pane — the sticky call bar, the FAQ accordion and the scroll reveals are
    live, and the panel inside any pane will take it anywhere else.
  </p>
  <div class="grid">
${cards}
  </div>
  <footer>
    Every pane is the same <code>noindex</code> mockup. Review text is paraphrased from
    relayed feedback and is labelled as such; nothing here was taken from any
    review platform. Images are placeholders pending the shop's own photographs.
  </footer>
</body>
</html>
`;

writeFileSync(join(distRoot, 'compare.html'), html);
console.log('✓ dist/compare.html — serve dist/ and open /compare.html');
