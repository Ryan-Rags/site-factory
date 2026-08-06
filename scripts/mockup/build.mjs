/**
 * Build one client's site.
 *
 * Selection is by `SITE_CLIENT`, the contract `packages/template/clients/
 * index.ts` defines — not a CLI flag, because `astro build` owns its own argv.
 * We invoke the template's own `build` script rather than `astro build`
 * directly, so the marker gate (`check-markers.mjs`) runs on every mockup
 * build exactly as it does on a normal one. A build that would ship an
 * unconfirmed value must fail here too; the bridge does not get a weaker gate
 * than the thing it is bridging.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { distDirFor, repoRoot } from './paths.mjs';

export function buildClient(slug) {
  const res = spawnSync('pnpm', ['--filter', '@site-factory/template', 'build'], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: { ...process.env, SITE_CLIENT: slug },
    shell: process.platform === 'win32',
  });

  if (res.status !== 0) {
    throw new Error(`build failed for ${slug} (exit ${res.status})`);
  }

  const dist = distDirFor(slug);
  if (!existsSync(join(dist, 'index.html'))) {
    throw new Error(
      `build for ${slug} reported success but produced no index.html in ${dist}. ` +
        `Check that clients/${slug}.config.ts is registered and that astro.config.mjs ` +
        `still writes to dist/<slug>/.`,
    );
  }
  return dist;
}
