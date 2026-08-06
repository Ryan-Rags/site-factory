/**
 * Shared path resolution for the mockup bridge.
 *
 * Mirrors `packages/discover/src/paths.ts` — walk up to the pnpm workspace
 * root rather than assuming a fixed depth, so these scripts work the same
 * whether invoked from the repo root, a package directory, or a git worktree.
 */
import { existsSync } from 'node:fs';
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

/** The template package this bridge builds. Read-only from here. */
export const templateDir = join(repoRoot, 'packages', 'template');
export const clientsDir = join(templateDir, 'clients');
export const distRoot = join(templateDir, 'dist');

/** Audit output — the "before" screenshots. Read-only, gitignored. */
export const auditOutDir = join(repoRoot, 'audit', 'out');

/** The only directory this bridge writes to. Gitignored. */
export const outreachDir = join(repoRoot, 'outreach');

export const distDirFor = (slug) => join(distRoot, slug);
export const auditDirFor = (slug) => join(auditOutDir, slug);
export const outreachDirFor = (slug) => join(outreachDir, slug);
