import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

import { templateDir } from "./paths.js";

/**
 * Put a generated demo's social card where `astro build` will pick it up, and
 * take it away again afterwards.
 *
 * ## Why it cannot be copied in after the build, like the photos
 *
 * `copyAssets()` writes the prospect's own images into `dist/` once Astro has
 * finished, because Astro empties `dist/` first. That trick does not work for
 * the card: `pnpm -C packages/template build` is `astro build` followed by the
 * gates, and `check-metadata.mjs` — one of them — resolves `og:image` against
 * `dist/<slug>/` and fails the build when the file is not there. A card copied
 * in afterwards would arrive one gate too late.
 *
 * So it is staged into `public/og/<slug>.png` before the build, which is also
 * exactly where a hand-authored client's card lives. That is deliberate:
 * `check-metadata.mjs` already treats `/og/<slug>.png` as "this client's
 * generated brand card" and complains when a client has one and does not use
 * it. Putting a demo's card anywhere else would mean a second convention for
 * the same thing.
 *
 * ## Why it is removed again
 *
 * The same two reasons `content.ts` removes its markdown, and they are firm:
 * `packages/template` belongs to another stream and is not ours to leave files
 * in, and the card is derived from a third party's business — name and town
 * drawn in our palette — which CLAUDE.md forbids committing. `prospects/` is
 * gitignored; `packages/template/public/` is not.
 *
 * It also matters for correctness, not just tidiness: `public/` is copied into
 * *every* build, so a card left behind would ship inside the next client's
 * `dist/` and inside all 49 other demos.
 */

export interface BrandCardHandle {
  /** Where the build will find it, or `null` when nothing was staged. */
  publicPath: string | null;
  /** Removes exactly what this call wrote, and nothing else. */
  cleanup: () => void;
}

/** Nothing staged, nothing to undo. */
const NOTHING: BrandCardHandle = { publicPath: null, cleanup: () => {} };

/**
 * @param slug   the demo being built; names the file, as it does for a client.
 * @param source the rendered card, from `renderOgCard`.
 * @returns the public path to put in `brand.ogImage`, or `null`.
 *
 * **Never overwrites.** `public/og/` holds nine committed client cards. A slug
 * that collides with one leaves the client's card exactly where it is and
 * stages nothing, so the demo falls back to its previous card rather than a
 * client's artwork being replaced on disk by a prospect's. That case should be
 * impossible — a generated demo has no `clients/<slug>.config.ts` — but "should
 * be impossible" is how the wrong artifact reached a prospect in
 * `docs/known-issues.md` #13, and the cost of checking is one `existsSync`.
 */
export function stageBrandCard(slug: string, source: string): BrandCardHandle {
  if (!existsSync(source)) return NOTHING;

  const ogDir = join(templateDir, "public", "og");
  const target = join(ogDir, `${slug}.png`);
  if (existsSync(target)) return NOTHING;

  mkdirSync(ogDir, { recursive: true });
  copyFileSync(source, target);

  let removed = false;
  return {
    publicPath: `/og/${slug}.png`,
    cleanup: () => {
      // Idempotent: `runProspect` calls this in a `finally`, and a second call
      // after a thrown build must not delete a file a later run has staged.
      if (removed) return;
      removed = true;
      rmSync(target, { force: true });
    },
  };
}
