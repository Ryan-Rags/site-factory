/**
 * Which demos this suite can smoke, and where each one is actually served.
 *
 * THE BUILDABLE UNIVERSE IS TWO LISTS. `clients/index.ts` holds the
 * hand-authored configs; `prospects/known.json` holds the slugs of the
 * generated demos, which have no config under `clients/` and never will,
 * because ingested third-party data does not go in the repo. That is the
 * bijection ruled on 2026-08-17 and already implemented in
 * `check-form-fields.mjs`: `KNOWN_PROSPECTS === clients/index.ts u
 * prospects/known.json`.
 *
 * `live-smoke` resolved slugs through `clients/index.ts` alone, so 50 deployed
 * demos were invisible to it — `pnpm smoke -- --client ztm-construction-llc`
 * answered "Unknown client". They had deploy-time 200 checks and nothing else:
 * no card, no headers, no demo-posture, no Lighthouse against the live origin.
 * Issue #56, known-issues #11.
 *
 * AND THE ORIGIN IS NOT DERIVED FROM THE SLUG WHERE A MANIFEST KNOWS BETTER.
 * `https://<slug>-preview.pages.dev` is right for 49 of the 50 and wrong for
 * the one whose Pages project name was substituted at deploy time. A first
 * attempt at the fleet sweep guessed that shape and recorded a live site as
 * dead (known-issues #13). `prospects/<slug>/demo.json` records the `liveUrl`
 * wrangler actually returned, so it is read first and the derivation is the
 * fallback.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { listClients } from '../mockup/clients.mjs';
import { defaultDemoUrl, repoRoot } from '../pitch/paths.mjs';

/** Committed, slugs only. See the `note` block inside the file. */
const knownProspectsFile = join(repoRoot, 'packages', 'template', 'prospects', 'known.json');

/** The generated demos, or `[]` when the registry is absent. */
export function listProspects() {
  if (!existsSync(knownProspectsFile)) return [];
  let doc;
  try {
    doc = JSON.parse(readFileSync(knownProspectsFile, 'utf8'));
  } catch (err) {
    throw new Error(`packages/template/prospects/known.json is not valid JSON: ${err.message}`);
  }
  const slugs = doc?.slugs;
  if (!Array.isArray(slugs)) {
    throw new Error('packages/template/prospects/known.json has no "slugs" array');
  }
  return [...slugs].sort();
}

/**
 * Every slug this suite may be pointed at, with where each came from.
 *
 * The origin is kept per slug rather than derived at the call site, so nothing
 * downstream can reintroduce the slug-shaped guess.
 */
export function listSmokeable({ fixturePrefix = 'zz-' } = {}) {
  const clients = listClients().filter((slug) => !slug.startsWith(fixturePrefix));
  const prospects = listProspects().filter((slug) => !slug.startsWith(fixturePrefix));
  const seen = new Set(clients);
  return [
    ...clients.map((slug) => ({ slug, from: 'clients/index.ts' })),
    // A slug in both lists is a defect `check-form-fields.mjs` already fails
    // on ("One slug, one config"); listing it twice here would smoke it twice.
    ...prospects.filter((slug) => !seen.has(slug)).map((slug) => ({ slug, from: 'prospects/known.json' })),
  ];
}

export function assertSmokeable(slug, known = listSmokeable()) {
  const found = known.find((entry) => entry.slug === slug);
  if (found) return found;
  throw new Error(
    `Unknown demo "${slug}". Known demos are clients/index.ts u prospects/known.json — ` +
      `${known.length} slug(s). A generated demo must be listed in ` +
      `packages/template/prospects/known.json; regenerate it with \`pnpm demo -- --emit-known\`.`,
  );
}

/**
 * Where `slug` is actually served, and how that was decided.
 *
 * `demo.json` is the manifest the demo pipeline wrote at deploy time. Its
 * `liveUrl` is what wrangler returned, so it carries a substituted project
 * name; the derived form cannot. When the manifest is absent — every
 * hand-authored client, and any prospect whose gitignored record is not in this
 * checkout — the derivation is used and the caller is told so.
 */
export function originFor(slug) {
  const manifest = join(repoRoot, 'prospects', slug, 'demo.json');
  if (existsSync(manifest)) {
    try {
      const liveUrl = JSON.parse(readFileSync(manifest, 'utf8'))?.liveUrl;
      if (typeof liveUrl === 'string' && liveUrl !== '') {
        return { origin: liveUrl.replace(/\/+$/, ''), source: `prospects/${slug}/demo.json` };
      }
    } catch {
      // A manifest that does not parse is not a reason to refuse to smoke the
      // site; it is a reason to fall back and say where the origin came from.
    }
  }
  return { origin: defaultDemoUrl(slug).replace(/\/+$/, ''), source: 'derived from the slug' };
}
