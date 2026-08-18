/**
 * Post-deploy: the artifact we just published must name the origin we just
 * published it to, and every asset it advertises must actually be there.
 *
 * WHY THIS IS NOT `check-metadata.mjs`. That gate asserts the card origin
 * equals `previewOriginFor(slug)` — the origin the build *expects*. On
 * `c3m-of-nj-home-renovation-affordable-handyman` the build and the gate
 * agreed with each other and both were wrong: the deploy appends a `-rr`
 * collision suffix when a project name is held in another account, and it does
 * that AFTER the build, so nothing in the artifact could know. The demo served
 * from one host and advertised another. Six absolute URLs, one dead host, a
 * link that unfurls blank and a canonical pointing at nothing —
 * `docs/known-issues.md` #13, measured live on 1 of 50.
 *
 * The only thing that can catch that class is a check that runs where the
 * resolved project name is known, which is the deploy, and takes the serving
 * origin as an INPUT rather than deriving it from the slug. Anything deriving
 * a demo URL from a slug is wrong for exactly the demo this exists to protect.
 *
 * TWO RULES, and they differ because the URLs differ (see the asset/identity
 * split in `lib/stamped-origins.mjs`):
 *
 *   1. Any stamped absolute URL on a `*.pages.dev` host must equal the serving
 *      origin. That host is our hosting; naming a different one of ours is
 *      always a defect, whether it is a card or a canonical.
 *
 *   2. Every ASSET URL must return 200. A card that 404s is the blank-unfurl
 *      defect with the origin spelled correctly.
 *
 *   3. The two CARD tags -- `og:image` and `twitter:image` -- must answer with
 *      a content type a platform will draw: PNG or JPEG. 200 is not enough.
 *      c3m answered 200 `image/svg+xml` and every gate was green while every
 *      shared link unfurled blank, because rule 2 asks whether the file is
 *      there and this asks whether it is a picture anyone will render.
 *      Issue #61, measured on 6 of 6 demos.
 *
 *      RULE 3 IS SCOPED TO THOSE TWO TAGS ON PURPOSE, and the scope is not an
 *      oversight to be tidied up later. The JSON-LD `image` and `logo` are
 *      assets under rule 2 and stay there: `logo` is `/images/logo.svg` on all
 *      nine hand-authored clients by design, nothing unfurls a graph node, and
 *      widening rule 3 would fail every client for shipping what it is meant
 *      to ship. See `CARD_LABELS` in `lib/stamped-origins.mjs`.
 *
 * And one deliberate non-rule: a stamped IDENTITY URL on a host that is NOT
 * ours — `https://example.invalid`, or a client's own domain — is left alone.
 * The ledger of 2026-08-13 rules the canonical and `og:url` are identity
 * claims that keep `seo.siteUrl` even on a mockup. A blanket "must match the
 * serving origin" would fail all eight hand-authored demos by design, which is
 * how a gate gets switched off.
 *
 * Usage:
 *   node scripts/check-stamped-origins.mjs --origin https://<host> [--slug <slug>]
 *                                          [--dist <dir>] [--offline]
 *
 *   --origin   REQUIRED. Where this build is actually served from. The deploy
 *              knows it; nothing else does.
 *   --slug     Defaults to SITE_CLIENT. Names dist/<slug>/.
 *   --dist     A built directory to read instead of dist/<slug>/.
 *   --offline  Apply rule 1 only -- rules 2 and 3 are properties of the
 *              response, so neither can be answered without fetching. For a
 *              dry run, and for proving the origin rule without spending
 *              requests.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ASSET,
  CARD_LABELS,
  DRAWABLE_CARD_TYPES,
  isPagesHost,
  stampedUrls,
} from './lib/stamped-origins.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const pkgRoot = join(here, '..');

function parseArgs(argv) {
  const args = { origin: '', slug: process.env['SITE_CLIENT'] ?? '', dist: '', offline: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--origin') args.origin = argv[++i] ?? '';
    else if (argv[i] === '--slug') args.slug = argv[++i] ?? '';
    else if (argv[i] === '--dist') args.dist = argv[++i] ?? '';
    else if (argv[i] === '--offline') args.offline = true;
    else throw new Error(`unknown argument: ${argv[i]}`);
  }
  return args;
}

/** Every built page under a directory, as absolute paths. */
function pagesIn(dir) {
  const out = [];
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.html')) out.push(full);
    }
  };
  walk(dir);
  return out.sort();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch one asset and say whether it is really there.
 *
 * GET rather than HEAD: a HEAD can be answered from an edge rule that never
 * touches the object, and a gate satisfiable without the bytes existing is not
 * measuring the asset. The body is read and discarded; this is two files per
 * site, deduplicated.
 */
async function fetchOnce(url) {
  try {
    const res = await fetch(url, { redirect: 'follow' });
    await res.arrayBuffer();
    const type = (res.headers.get('content-type') ?? '').split(';')[0].trim();
    return { status: res.status, type, error: '' };
  } catch (err) {
    const cause = err?.cause?.code ?? '';
    return { status: 0, type: '', error: cause ? `${err.message} (${cause})` : err.message };
  }
}

/**
 * The same probe, given time for a just-published deploy to start serving.
 *
 * WHY THIS IS NOT OVER-PATIENCE. This gate's first caller is the deploy, and it
 * runs the instant `wrangler pages deploy` returns. The project alias goes on
 * serving the previous deployment for a few seconds after that, so an asset at
 * a path the previous build did not have answers 404 — and the gate reported a
 * demo that is completely correct as one advertising an address that is not
 * itself. Measured on the c3m redeploy of 2026-08-18: red from the deploy,
 * green from the CLI against the same origin and the same dist forty seconds
 * later. Fifty of those in a batch is a gate nobody reads.
 *
 * `deploy.ts` already waits this way for the homepage, for this reason. The
 * asset probe was the half that did not.
 *
 * ONLY A NON-200 IS RETRIED. A wrong content type is not a race — an SVG does
 * not become a PNG by waiting — so rule 3 still fails on the first response and
 * the red demonstration stays instant.
 */
async function probe(url, attempts = 5, gapMs = 5000) {
  let res = await fetchOnce(url);
  for (let i = 1; i < attempts && res.status !== 200; i += 1) {
    await sleep(gapMs);
    res = await fetchOnce(url);
    if (res.status === 200) res.retried = i;
  }
  return res;
}

/**
 * @param origin the host this build is actually served from.
 * @param dist   the built directory that was published there.
 * @returns `{ problems, pages, assets, serving }` — problems empty is a pass.
 *
 * Exported so `scripts/deploy/deploy-mockups.mjs` can call it in-process right
 * after a deploy, with the project name it just resolved. The prospect
 * pipeline spawns the CLI below instead, because it is TypeScript in another
 * package and a spawn is the boundary it already uses for the build.
 */
export async function checkStampedOrigins({ origin, dist, offline = false, log = () => {} }) {
  const problems = [];
  let serving;
  try {
    serving = new URL(origin).origin;
  } catch {
    throw new Error(`--origin is not a URL: ${origin}`);
  }
  if (serving !== origin.replace(/\/$/, '')) {
    // A path or a query on the serving origin would make every comparison
    // below pass against something nobody serves.
    throw new Error(`--origin must be a bare origin, not ${origin}`);
  }

  const pages = pagesIn(dist);
  if (pages.length === 0) throw new Error(`no built pages under ${dist}`);

  /** url -> the tags that stamp it, so one bad card is reported once. */
  const assets = new Map();

  /**
   * Wrong origins, grouped by `<tag> at <origin>` rather than listed per page.
   *
   * Every page of a site carries the same head, so an ungrouped report is the
   * same sentence forty times and the operator scrolls past all of it. Two
   * pages broken the same way are one problem — the grouping `fleet.mjs` makes
   * for live findings, for the same reason.
   */
  const wrongOrigin = new Map();

  for (const page of pages) {
    const where = relative(dist, page).split(sep).join('/');
    const { stamped, unparseable } = stampedUrls(readFileSync(page, 'utf8'));
    for (const message of unparseable) {
      problems.push(`${where}: a JSON-LD block does not parse — ${message}`);
    }

    for (const { label, url, kind } of stamped) {
      let parsed;
      try {
        parsed = new URL(url);
      } catch {
        problems.push(`${where}: ${label} is not an absolute URL: ${url}`);
        continue;
      }

      // Rule 1 — our hosting, named wrongly.
      if (isPagesHost(parsed.origin) && parsed.origin !== serving) {
        const key = `${label} at ${parsed.origin}`;
        const seen = wrongOrigin.get(key) ?? [];
        seen.push(where);
        wrongOrigin.set(key, seen);
        continue;
      }

      if (kind === ASSET) {
        const entry = assets.get(parsed.href) ?? { stampedBy: [], card: false };
        entry.stampedBy.push(`${where} (${label})`);
        // One URL can be stamped by both a card tag and a graph node. If ANY
        // tag that names it is a card tag, the bytes have to satisfy rule 3 --
        // the graph node sharing the URL does not buy it an exemption.
        if (CARD_LABELS.has(label)) entry.card = true;
        assets.set(parsed.href, entry);
      }
    }
  }

  for (const [key, where] of wrongOrigin) {
    const [label, origin] = key.split(' at ');
    problems.push(
      `${label} is rooted at ${origin} on ${where.length} page(s) (${where.slice(0, 3).join(', ')}` +
        `${where.length > 3 ? ', …' : ''}), but this build is served from ${serving}. Both are ` +
        `Cloudflare Pages hosts of ours, so this is not an identity claim about the business — ` +
        `it is a demo advertising an address that is not itself.`,
    );
  }

  // Rule 2 — the assets are really there. Deduplicated, so a five-page site
  // costs two requests rather than ten, and spaced regardless.
  if (!offline) {
    let first = true;
    for (const [url, { stampedBy, card }] of assets) {
      if (!first) await sleep(500);
      first = false;
      const res = await probe(url);
      if (res.status !== 200) {
        problems.push(
          `${url} does not resolve — ${res.error || `HTTP ${res.status}`}, still, after 5 ` +
            `attempts over 20s. Stamped by ${stampedBy.length} tag(s), first ${stampedBy[0]}.`,
        );
        continue;
      }

      // Rule 3 — a card has to be a picture a platform will draw.
      if (card && !DRAWABLE_CARD_TYPES.has(res.type)) {
        problems.push(
          `${url} answers 200 ${res.type || '(no content-type)'}, which no platform will draw ` +
            `as a card. Facebook, X, LinkedIn, iMessage, WhatsApp and Slack all decline ` +
            `anything but a raster image, so this link unfurls blank while every other check ` +
            `passes. Stamped by ${stampedBy.length} tag(s), first ${stampedBy[0]}. ` +
            `Expected one of ${[...DRAWABLE_CARD_TYPES].join(', ')}.`,
        );
        continue;
      }

      log(
        `  · ${url}  200 ${res.type}${card ? '  (card)' : ''}` +
          (res.retried ? `  (served after ${res.retried} retr${res.retried === 1 ? 'y' : 'ies'})` : ''),
      );
    }
  }

  return { problems, pages: pages.length, assets: [...assets.keys()], serving };
}

/* --------------------------------------------------------------------- cli */

const invokedDirectly =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.origin) {
    console.error(
      'check-stamped-origins needs --origin: the host this build is actually served from.\n' +
        'The deploy knows it (it resolved the Pages project name); nothing else does.\n\n' +
        '  node scripts/check-stamped-origins.mjs --slug <slug> --origin https://<host>\n',
    );
    process.exit(1);
  }
  const dist = args.dist || join(pkgRoot, 'dist', args.slug);
  if (!existsSync(dist) || !statSync(dist).isDirectory()) {
    console.error(`No built site at ${dist}. Build first.`);
    process.exit(1);
  }

  let result;
  try {
    result = await checkStampedOrigins({
      origin: args.origin,
      dist,
      offline: args.offline,
      log: console.log,
    });
  } catch (err) {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  }

  if (result.problems.length === 0) {
    console.log(
      `✓ ${args.slug || dist}: ${result.pages} page(s), every stamped origin is ${result.serving}` +
        (args.offline
          ? ' (origins only, --offline)'
          : ` and ${result.assets.length} asset(s) answer 200`) +
        '.',
    );
    process.exit(0);
  }

  console.error(`\n✗ ${args.slug || dist}: ${result.problems.length} stamped-origin problem(s).\n`);
  for (const p of result.problems) console.error(`    ${p}`);
  console.error(
    '\nRebuild this slug with the origin it is actually served from, then redeploy:\n\n' +
      `  PREVIEW_ORIGIN=${result.serving} pnpm demo -- --prospect <slug> --skip-ingest\n`,
  );
  process.exit(1);
}
