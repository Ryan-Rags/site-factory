/**
 * Copy the "before" screenshots the audit already captured.
 *
 * A missing "before" is an expected outcome, not a failure. A lead with no
 * website was never audited, so `audit/out/<slug>/` has nothing to copy — and
 * a no-site lead is precisely the lead a mockup is most worth sending. The
 * run says so plainly and continues after-only.
 */
import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { auditDirFor } from './paths.mjs';

const PAIRS = [
  ['desktop.png', 'before-desktop.png'],
  ['mobile.png', 'before-mobile.png'],
];

/** Returns the filenames copied — empty when this client was never audited. */
export function copyBefore(slug, outDir) {
  const src = auditDirFor(slug);
  const written = [];
  for (const [from, to] of PAIRS) {
    const path = join(src, from);
    if (!existsSync(path)) continue;
    copyFileSync(path, join(outDir, to));
    written.push(to);
  }
  return written;
}
