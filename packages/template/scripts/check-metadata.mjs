/**
 * Metadata hygiene, checked on the built bytes.
 *
 * The failures this guards against are all quiet ones. A canonical that points
 * at the wrong origin splits a site's ranking signal between two URLs. A
 * missing `og:image:alt` costs nothing visible and everything to somebody
 * reading a shared link through a screen reader. And an `og:image` pointing at
 * a placeholder SVG — which is what four of the eight clients shipped until
 * this gate was written — means the client's link unfurls blank in every
 * messaging app anybody would actually paste it into, because Facebook, X,
 * LinkedIn, iMessage, WhatsApp and Slack all decline to render SVG cards.
 *
 * None of that shows up in a browser. All of it shows up in front of a
 * customer.
 *
 * Everything here is read from `dist/`, never from the config, for the same
 * reason `check-markers.mjs` does: the output is what the client's customers
 * get, and a gate that reads the config is a gate that agrees with the config
 * even when the build disagrees with both.
 *
 * ONE ASSERTION IS NOT ABOUT THE ARTIFACT. On a `noindex` build the card's
 * *origin* is checked against the origin that build will be served from —
 * `https://<slug>-preview.pages.dev`. Everything else here can be settled by
 * reading `dist/`; that one cannot, because the file was always correct and it
 * was the address in the tag that was wrong. See the block at "the card's
 * origin" below, and issue #25.
 *
 * Usage:
 *   node scripts/check-metadata.mjs              # the client SITE_CLIENT selected
 *   node scripts/check-metadata.mjs <slug>       # one named client
 *   node scripts/check-metadata.mjs --all        # every client present in dist/
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { previewOriginFor } from '../src/lib/preview-origin.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const pkgRoot = join(here, '..');
const distRoot = join(pkgRoot, 'dist');

/** Meta tags every page must carry, by the attribute that identifies them. */
const REQUIRED_PROPERTY = [
  'og:type',
  'og:site_name',
  'og:title',
  'og:description',
  'og:url',
  'og:image',
  'og:image:width',
  'og:image:height',
  'og:image:alt',
  'og:locale',
];
const REQUIRED_NAME = [
  'description',
  'twitter:card',
  'twitter:title',
  'twitter:description',
  'twitter:image',
  'twitter:image:alt',
];

/** Google truncates well before this; past it a title is certainly too long. */
const TITLE_MAX = 70;

function walkHtml(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walkHtml(full));
    else if (name.endsWith('.html')) out.push(full);
  }
  return out.sort();
}

const attr = (html, kind, key) => {
  // Both attribute orders occur in the wild; Astro emits key-then-content.
  const re = new RegExp(
    `<meta[^>]+${kind}=["']${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`,
    'gi',
  );
  const tags = html.match(re) ?? [];
  return tags.map((t) => /content=["']([^"']*)["']/i.exec(t)?.[1] ?? '');
};

/**
 * Raster dimensions straight out of the file header.
 *
 * Deliberately not a dependency: two formats, both with the size in a fixed
 * place near the front, is not worth an image library in a build that has
 * spent real effort staying dependency-light.
 */
function rasterSize(file) {
  const b = readFileSync(file);
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) {
    return { kind: 'png', width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  }
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length - 9) {
      if (b[i] !== 0xff) {
        i += 1;
        continue;
      }
      const marker = b[i + 1];
      // SOF0..SOF15, excluding the non-frame markers DHT/JPG/DAC.
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { kind: 'jpeg', height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
      }
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  return null;
}

/** The URL path a page at this file should call its own. */
function expectedPath(distDir, file) {
  const rel = relative(distDir, file).split('\\').join('/');
  if (rel === 'index.html') return '/';
  if (rel === '404.html') return '/404';
  return `/${rel.replace(/\/index\.html$/, '').replace(/\.html$/, '')}`;
}

function checkClient(slug) {
  const distDir = join(distRoot, slug);
  if (!existsSync(distDir)) {
    console.error(`✗ ${slug}: no dist/${slug}. Run a build first.`);
    return false;
  }
  const files = walkHtml(distDir);
  if (files.length === 0) {
    console.error(`✗ ${slug}: no HTML in dist/${slug}.`);
    return false;
  }

  const problems = [];
  const notes = [];
  const say = (file, msg) => problems.push(`${relative(distDir, file).split('\\').join('/')}: ${msg}`);

  // `noindex` is read back off the built HTML, exactly as check-markers.mjs
  // does — the mode that matters is the one in the output.
  const noindex = files.every((f) =>
    /<meta[^>]+name=["']robots["'][^>]+noindex/i.test(readFileSync(f, 'utf8')),
  );

  let origin = null;

  for (const file of files) {
    const html = readFileSync(file, 'utf8');

    const titles = html.match(/<title>([\s\S]*?)<\/title>/gi) ?? [];
    if (titles.length !== 1) say(file, `${titles.length} <title> tags, expected exactly 1`);
    else {
      const text = titles[0].replace(/<\/?title>/gi, '').trim();
      if (text === '') say(file, 'empty <title>');
      else if (text.length > TITLE_MAX) say(file, `<title> is ${text.length} chars (max ${TITLE_MAX})`);
    }

    const canonicals = html.match(/<link[^>]+rel=["']canonical["'][^>]*>/gi) ?? [];
    if (canonicals.length !== 1) {
      say(file, `${canonicals.length} canonical links, expected exactly 1`);
    } else {
      const href = /href=["']([^"']*)["']/i.exec(canonicals[0])?.[1] ?? '';
      let url;
      try {
        url = new URL(href);
      } catch {
        say(file, `canonical is not an absolute URL: ${href || '(empty)'}`);
      }
      if (url) {
        if (origin === null) origin = url.origin;
        else if (url.origin !== origin) {
          say(file, `canonical origin ${url.origin} disagrees with ${origin}`);
        }
        const want = expectedPath(distDir, file);
        if (url.pathname !== want) {
          say(file, `canonical path is ${url.pathname}, expected ${want}`);
        }
      }
    }

    for (const key of REQUIRED_PROPERTY) {
      const found = attr(html, 'property', key);
      if (found.length === 0) say(file, `missing <meta property="${key}">`);
      else if (found.length > 1) say(file, `${found.length} <meta property="${key}"> tags`);
      else if (found[0].trim() === '') say(file, `empty ${key}`);
    }
    for (const key of REQUIRED_NAME) {
      const found = attr(html, 'name', key);
      if (found.length === 0) say(file, `missing <meta name="${key}">`);
      else if (found.length > 1) say(file, `${found.length} <meta name="${key}"> tags`);
      else if (found[0].trim() === '') say(file, `empty ${key}`);
    }

    // og:url and the canonical must be the same URL. Two different answers to
    // "what is this page's address" is the ambiguity canonicals exist to remove.
    const ogUrl = attr(html, 'property', 'og:url')[0];
    const canonicalHref = /href=["']([^"']*)["']/i.exec(canonicals[0] ?? '')?.[1];
    if (ogUrl && canonicalHref && ogUrl !== canonicalHref) {
      say(file, `og:url (${ogUrl}) disagrees with canonical (${canonicalHref})`);
    }

    /* --- the social card ------------------------------------------------ */
    const ogImage = attr(html, 'property', 'og:image')[0];
    if (ogImage) {
      let imgPath = null;
      try {
        imgPath = new URL(ogImage).pathname;
      } catch {
        say(file, `og:image is not an absolute URL: ${ogImage}`);
      }
      if (imgPath) {
        const onDisk = join(distDir, imgPath.replace(/^\//, ''));
        if (!existsSync(onDisk)) {
          say(file, `og:image ${imgPath} is not in dist/${slug} — the card will 404`);
        } else if (/\.svg$/i.test(imgPath)) {
          // Every major unfurler declines SVG. Fatal for a live site; for a
          // private mockup it is cosmetic, so it is reported without failing.
          const msg =
            `og:image ${imgPath} is an SVG — Facebook, X, LinkedIn, iMessage, ` +
            `WhatsApp and Slack all refuse to render SVG cards, so this link unfurls blank`;
          if (noindex) notes.push(`${relative(distDir, file).split('\\').join('/')}: ${msg}`);
          else say(file, msg);
        } else {
          const size = rasterSize(onDisk);
          if (!size) say(file, `og:image ${imgPath} is not a PNG or JPEG`);
          else {
            if (size.width < 1200 || size.height < 630) {
              say(file, `og:image is ${size.width}×${size.height}, below the 1200×630 minimum`);
            }
            const w = Number(attr(html, 'property', 'og:image:width')[0]);
            const h = Number(attr(html, 'property', 'og:image:height')[0]);
            // The declared size is a constant in Seo.astro. This is the check
            // that stops it drifting away from the file it describes.
            if (w !== size.width || h !== size.height) {
              say(
                file,
                `declares og:image ${w}×${h} but the file is ${size.width}×${size.height}`,
              );
            }
          }
        }

        // A generated brand card that exists and is not used is almost always
        // an oversight rather than a decision — it is exactly how the four
        // placeholder-SVG clients came about.
        const card = `/og/${slug}.png`;
        if (imgPath !== card && existsSync(join(distDir, 'og', `${slug}.png`))) {
          say(file, `og:image is ${imgPath} but this client has a generated brand card at ${card}`);
        }
      }
    }

    const twImage = attr(html, 'name', 'twitter:image')[0];
    if (twImage && ogImage && twImage !== ogImage) {
      say(file, `twitter:image (${twImage}) disagrees with og:image (${ogImage})`);
    }

    /* --- the card's origin, on a preview build --------------------------- */
    /*
     * Everything above this point checks the *artifact*: the file exists in
     * `dist/`, it is a real PNG, it is the size it declares. All of that was
     * green on all eight clients while 0 of 8 deployed demos unfurled an
     * image, because the artifact was never the problem — the pairing of
     * artifact with host was. `new URL(ogImage).pathname` discards the origin
     * by design, which is exactly right for a delivered site (served from its
     * own `siteUrl`, so origin and deploy origin are the same string) and
     * structurally blind on a preview, where they are not. See issue #25.
     *
     * So on a `noindex` build — the mockup lock, read back off the built HTML
     * a few lines up rather than out of the config — the origin is checked
     * too, against the origin the deploy will actually serve this slug from.
     *
     * FAIL-CLOSED, per the ruling of 2026-08-12. A tag that is missing, or
     * absolute in some shape this cannot resolve, is a failure and not a
     * skip: the whole defect was a check that looked at a preview and saw
     * nothing to say.
     */
    if (noindex) {
      const want = previewOriginFor(slug);
      for (const [label, value] of [
        ['og:image', ogImage],
        ['twitter:image', twImage],
      ]) {
        if (!value) {
          say(
            file,
            `${label} is missing on a noindex build, so its origin cannot be checked ` +
              `against ${want} — a preview card is only reachable if it names the ` +
              `origin serving the page`,
          );
          continue;
        }
        let got = null;
        try {
          got = new URL(value).origin;
        } catch {
          /* Reported immediately below; `got` stays null. */
        }
        if (got === null) {
          say(file, `${label} is not an absolute URL, so its origin cannot be resolved: ${value}`);
        } else if (got !== want) {
          say(
            file,
            `${label} is rooted at ${got}, but this preview is served from ${want} — ` +
              `the card is correct and advertised at an address no crawler can fetch ` +
              `it from, so every link shared for this demo unfurls blank (issue #25)`,
          );
        }
      }
    }
  }

  for (const note of notes) console.log(`  · ${slug}/${note}`);

  if (problems.length === 0) {
    console.log(
      `✓ ${slug}: ${files.length} page(s), metadata complete ` +
        `(${noindex ? 'noindex' : 'LIVE'}, canonical origin ${origin ?? 'unknown'}` +
        `${noindex ? `, card origin ${previewOriginFor(slug)}` : ''})` +
        `${notes.length > 0 ? ` — ${notes.length} note(s) above` : ''}.`,
    );
    return true;
  }

  console.error(`\n✗ ${slug}: ${problems.length} metadata problem(s).\n`);
  for (const p of problems.slice(0, 40)) console.error(`    ${p}`);
  if (problems.length > 40) console.error(`    … and ${problems.length - 40} more`);
  console.error('');
  return false;
}

const requested = process.argv[2];
let slugs;
try {
  if (requested === '--all') {
    slugs = readdirSync(distRoot).filter((d) => statSync(join(distRoot, d)).isDirectory());
  } else {
    slugs = [requested || process.env.SITE_CLIENT || 'kh-machine-works'];
  }
} catch {
  console.error('No dist/ directory. Run a build first.');
  process.exit(1);
}

if (slugs.length === 0) {
  console.error('No built clients found in dist/. Run a build first.');
  process.exit(1);
}

const results = slugs.map(checkClient);
process.exit(results.every(Boolean) ? 0 : 1);
