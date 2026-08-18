/**
 * Operator-supplied files, resolved at BUILD time.
 *
 * The rule for both slots on this site is the same: the artifact decides. Ryan
 * drops `public/ryan.jpg` in, or sets `LINKEDIN_URL` in `site.ts`, and the next
 * build renders the real thing. Neither needs a code change, a flag, or a
 * second person to remember a step — and until the file is there, the build
 * still succeeds and still ships the loud placeholder.
 *
 * That "degrades gracefully" requirement is why this reads the filesystem
 * instead of taking a boolean: a boolean is a second copy of the truth, and the
 * failure it produces is the worst one available — an `<img>` pointed at a 404,
 * on the hero of the page that exists to prove competence.
 *
 * Static output only. This module runs in Node during `astro build` and is
 * never shipped to a browser; `check-no-forms.mjs` asserts no page emits any
 * script at all, which is the gate that keeps that true.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { HEADSHOT_SRC, LINKEDIN_URL } from './site';

/**
 * Absolute path of the headshot Ryan drops in, resolved from the PROCESS CWD.
 *
 * MEASURED, and not the obvious spelling: `new URL('../public/…',
 * import.meta.url)` is wrong here. Vite SSR-bundles this module before Astro
 * executes it, so at build time `import.meta.url` is the bundled chunk's
 * location rather than `src/assets.ts`, and the relative hop lands somewhere
 * that never contains `public/`. The symptom is the bad one: the file exists,
 * the page renders the placeholder anyway, and nothing says so.
 *
 * `astro build` runs with the cwd at the package root — which is the only way
 * this package is ever built, per the README — so cwd is the stable anchor.
 * `check-placeholders.mjs` computes the same fact from its own unbundled script
 * path and fails the build if the two ever disagree, which is what caught this.
 */
const headshotFile = join(process.cwd(), 'public', HEADSHOT_SRC.replace(/^\//, ''));

/**
 * Whether the hero renders a photo or the `PHOTO_HERE` placeholder.
 * `check-placeholders.mjs` recomputes this from the same file and asserts the
 * built HTML agrees, so the two cannot disagree silently.
 */
export const HAS_HEADSHOT = existsSync(headshotFile);

/** Whether the footer renders a real LinkedIn anchor or the placeholder. */
export const HAS_LINKEDIN = typeof LINKEDIN_URL === 'string' && LINKEDIN_URL.length > 0;

/**
 * Intrinsic size of the headshot box, in the 4:5 the placeholder reserves.
 * Emitted as width/height on the <img> so the photo occupies exactly the space
 * the placeholder did and swapping one for the other cannot shift the page —
 * this site measures CLS 0 and that is a number worth not losing to an image.
 */
export const HEADSHOT_W = 800;
export const HEADSHOT_H = 1000;
