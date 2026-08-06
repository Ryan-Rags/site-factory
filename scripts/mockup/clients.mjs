/**
 * Discover the buildable client slugs.
 *
 * Same technique as `packages/template/scripts/build-all.mjs`: plain Node
 * cannot import the TypeScript registry, so slugs come from the config
 * filenames and are cross-checked against `clients/index.ts`. Drift between
 * the two is a hard error rather than a silently skipped client — a config
 * that exists but is unregistered will not build, and finding that out from a
 * missing screenshot hours later is worse than failing here.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { clientsDir } from './paths.mjs';

export function listClients() {
  const fromFiles = readdirSync(clientsDir)
    .filter((f) => f.endsWith('.config.ts'))
    .map((f) => f.replace(/\.config\.ts$/, ''))
    .sort();

  const registry = readFileSync(join(clientsDir, 'index.ts'), 'utf8');
  const unregistered = fromFiles.filter((slug) => !registry.includes(`'${slug}'`));
  if (unregistered.length > 0) {
    throw new Error(
      `These configs exist but are not registered in clients/index.ts: ${unregistered.join(', ')}`,
    );
  }
  return fromFiles;
}

export function assertKnownClient(slug, known = listClients()) {
  if (!known.includes(slug)) {
    throw new Error(`Unknown client "${slug}". Known clients: ${known.join(', ')}.`);
  }
  return slug;
}
