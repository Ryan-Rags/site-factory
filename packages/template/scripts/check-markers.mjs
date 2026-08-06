/**
 * Refuses to let an unconfirmed value go live.
 *
 * Every client config carries values we have not confirmed with the client.
 * They are marked — `[verify with client]`, or the older `PLACEHOLDER` that
 * the K-H config still uses — precisely so that they are impossible to miss.
 * The failure this guards against is the quiet one: somebody flips
 * `seo.noindex` to false to publish a site, and a marker nobody re-read ships
 * to a real domain under a real business's name.
 *
 * The rule is deliberately blunt:
 *
 *   noindex: true   → markers are FINE. That is what a mockup is for.
 *   noindex: false  → a single marker anywhere in the built output FAILS.
 *
 * Marker-freedom is therefore never something you remember to check. It is a
 * precondition of going live, enforced on the actual built bytes rather than
 * on the config — because the output is what the client's customers read.
 *
 * Usage:
 *   node scripts/check-markers.mjs              # the client SITE_CLIENT selected
 *   node scripts/check-markers.mjs <slug>       # one named client
 *   node scripts/check-markers.mjs --all        # every client present in dist/
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const distRoot = join(here, '..', 'dist');

/**
 * Both markers are equally disqualifying. `PLACEHOLDER` is legacy — it exists
 * only because the K-H config predates `[verify with client]` and its output
 * is byte-locked as the multi-client refactor's equivalence proof. New
 * configs use the bracketed form.
 */
const MARKERS = ['[verify with client]', 'PLACEHOLDER'];

/** Only text output can carry a marker a human would read. */
const TEXT_EXT = /\.(html?|txt|xml|json|js|css|svg|webmanifest)$/i;

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (TEXT_EXT.test(name)) out.push(full);
  }
  return out;
}

/** `noindex` is read back off the built HTML, not off the config. */
function isNoindex(files) {
  const html = files.filter((f) => f.endsWith('.html'));
  if (html.length === 0) return null;
  return html.every((f) => /<meta[^>]+name=["']robots["'][^>]+noindex/i.test(readFileSync(f, 'utf8')));
}

function checkClient(slug) {
  const dir = join(distRoot, slug);
  const files = walk(dir);
  const noindex = isNoindex(files);

  if (noindex === null) {
    console.error(`✗ ${slug}: no HTML in dist/${slug} — nothing to check. Did the build run?`);
    return false;
  }

  const hits = [];
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const marker of MARKERS) {
      let from = 0;
      for (;;) {
        const at = text.indexOf(marker, from);
        if (at === -1) break;
        const line = text.slice(0, at).split('\n').length;
        hits.push({ file: relative(distRoot, file), line, marker });
        from = at + marker.length;
      }
    }
  }

  if (noindex) {
    const note = hits.length ? `${hits.length} marker(s), which is fine while noindex` : 'no markers';
    console.log(`✓ ${slug}: noindex build — ${note}.`);
    return true;
  }

  if (hits.length === 0) {
    console.log(`✓ ${slug}: LIVE build (noindex off) and marker-free.`);
    return true;
  }

  console.error(`\n✗ ${slug}: LIVE build (noindex off) contains ${hits.length} unconfirmed value(s).`);
  console.error(`  This build would publish text nobody confirmed with the client.\n`);
  for (const h of hits.slice(0, 40)) {
    console.error(`    ${h.file}:${h.line}  ${h.marker}`);
  }
  if (hits.length > 40) console.error(`    … and ${hits.length - 40} more`);
  console.error(
    `\n  Fix the values in clients/<slug>.config.ts and src/content/<slug>/,\n` +
      `  or set seo.noindex back to true. Do not delete this check.\n`,
  );
  return false;
}

// Default to the client this build just produced, not to everything in dist/.
// Checking every directory would fail a good build because some *other*
// client's stale output is sitting there from an earlier run.
const requested = process.argv[2];
let slugs;
try {
  if (requested === '--all') {
    slugs = readdirSync(distRoot).filter((d) => statSync(join(distRoot, d)).isDirectory());
  } else {
    slugs = [requested || process.env.SITE_CLIENT || 'kh-machine-works'];
  }
} catch {
  console.error(`No dist/ directory. Run a build first.`);
  process.exit(1);
}

if (slugs.length === 0) {
  console.error('No built clients found in dist/. Run a build first.');
  process.exit(1);
}

const results = slugs.map(checkClient);
process.exit(results.every(Boolean) ? 0 : 1);
