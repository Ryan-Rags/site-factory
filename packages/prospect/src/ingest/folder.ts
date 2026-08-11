import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { isSupportedImage } from "../palette.js";
import type { ProspectPhoto } from "../types.js";

/**
 * The operator's drop-box: `prospects/<id>/assets/`.
 *
 * Classification is by filename and nothing else — no content inspection, no
 * guessing. A file named `logo.*` is the logo; `photo-*.*` (or anything else
 * that decodes as an image) is a photo. That rule is written down in the
 * README for the folder itself, so the behaviour is predictable from outside.
 */

export interface FolderAssets {
  logo?: string;
  photos: ProspectPhoto[];
  /** Files present that are not images, so the run can say they were ignored. */
  ignored: string[];
}

export function readFolder(assetsDir: string): FolderAssets {
  if (!existsSync(assetsDir)) return { photos: [], ignored: [] };

  const photos: ProspectPhoto[] = [];
  const ignored: string[] = [];
  let logo: string | undefined;

  for (const name of readdirSync(assetsDir).sort()) {
    const full = join(assetsDir, name);
    if (!statSync(full).isFile()) continue;
    if (!isSupportedImage(full)) {
      ignored.push(name);
      continue;
    }
    if (/^logo\b/i.test(name)) {
      // First logo wins, deterministically: the listing is sorted.
      logo ??= full;
      continue;
    }
    photos.push({ ref: name, kind: "folder", file: full });
  }

  return logo === undefined ? { photos, ignored } : { logo, photos, ignored };
}
