/**
 * `public/_headers` is only worth anything if it reaches dist/ intact — Pages
 * reads it from the deployed root, and a build that dropped it fails silently
 * and invisibly. Nothing about the served page looks different.
 *
 * Deliberately NOT checked: a script-src CSP, and any hash machinery. This is a
 * static brochure with no client JavaScript; check-no-forms.mjs is what keeps
 * that true, and if it ever stops being true that gate fails before this one
 * becomes wrong.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { distDir, problem, report, requireDist } from './lib.mjs';

requireDist();

const REQUIRED = [
  [/^\s*X-Content-Type-Options:\s*nosniff\s*$/im, 'X-Content-Type-Options: nosniff'],
  [
    /^\s*Referrer-Policy:\s*strict-origin-when-cross-origin\s*$/im,
    'Referrer-Policy: strict-origin-when-cross-origin',
  ],
  [
    /^\s*Content-Security-Policy:\s*frame-ancestors\s+'none'\s*$/im,
    "Content-Security-Policy: frame-ancestors 'none'",
  ],
  [/^\s*X-Frame-Options:\s*DENY\s*$/im, 'X-Frame-Options: DENY'],
];

const path = join(distDir, '_headers');

if (!existsSync(path)) {
  problem('dist/_headers is missing — every response would ship with no security headers.');
} else {
  const text = readFileSync(path, 'utf8');

  if (!/^\s*\/\*\s*$/m.test(text)) {
    problem('_headers has no `/*` rule — the header block would apply to nothing.');
  }

  for (const [re, label] of REQUIRED) {
    if (!re.test(text)) problem(`_headers is missing or has altered: ${label}`);
  }
}

report('check-headers');
