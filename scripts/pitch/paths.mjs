/**
 * Shared path and client resolution for the pitch assets.
 *
 * Mirrors `scripts/mockup/paths.mjs` — walk up to the pnpm workspace root
 * rather than assuming a fixed depth, so these scripts behave identically
 * whether invoked from the repo root, a package directory, or a git worktree.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function findRepoRoot(start = dirname(fileURLToPath(import.meta.url))) {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(`Could not find the repo root: no pnpm-workspace.yaml above ${start}`);
    }
    dir = parent;
  }
}

export const repoRoot = findRepoRoot();

export const templateDir = join(repoRoot, 'packages', 'template');
export const clientsDir = join(templateDir, 'clients');
export const distRoot = join(templateDir, 'dist');
export const auditOutDir = join(repoRoot, 'audit', 'out');

/** Client-facing artifacts. Gitignored. */
export const outreachDir = join(repoRoot, 'outreach');

export const distDirFor = (slug) => join(distRoot, slug);
export const auditDirFor = (slug) => join(auditOutDir, slug);
/** Everything this pair of scripts writes for one prospect. */
export const pitchDirFor = (slug) => join(outreachDir, slug, 'pitch');

/** The Pages project alias `scripts/deploy/deploy-mockups.mjs` deploys to. */
export const defaultDemoUrl = (slug) => `https://${slug}-preview.pages.dev`;

/**
 * A hostname we use to mean "this prospect has no current website".
 *
 * Three of the five configs carry `siteUrl: 'https://example.invalid'` because
 * the shop genuinely has no site. That is the most valuable case to pitch and
 * the one most easily mistaken for a broken script, so it is named here rather
 * than left as a magic string in two files.
 */
export const NO_SITE_HOST = 'example.invalid';

/**
 * The prospect's current website, read out of their committed config.
 *
 * A regex over the TypeScript source rather than an import: plain Node cannot
 * load the TS registry, and this is the same technique
 * `packages/template/scripts/build-all.mjs` and `scripts/mockup/clients.mjs`
 * already use for the client list. It is narrow on purpose — it matches the
 * one `siteUrl:` key inside the `seo` block and nothing else. A config that
 * ever stops matching produces `null`, which is reported as "unknown" rather
 * than silently substituted.
 */
/**
 * The prospect's business name, for the card's heading. Same read-the-source
 * technique and the same caveat as `currentSiteUrlFor`: no match means the
 * caller falls back to the slug rather than to an invented name.
 */
export function businessNameFor(slug) {
  const file = join(clientsDir, `${slug}.config.ts`);
  if (!existsSync(file)) return null;
  const match = /\bbusiness:\s*\{[\s\S]*?\bname:\s*'([^']+)'/.exec(readFileSync(file, 'utf8'));
  return match ? match[1] : null;
}

export function currentSiteUrlFor(slug) {
  const file = join(clientsDir, `${slug}.config.ts`);
  if (!existsSync(file)) return null;
  const match = /\bsiteUrl:\s*'([^']+)'/.exec(readFileSync(file, 'utf8'));
  if (!match) return null;
  const url = match[1];
  try {
    if (new URL(url).hostname.endsWith(NO_SITE_HOST)) return null;
  } catch {
    return null;
  }
  return url;
}
