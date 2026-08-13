/**
 * §3.7 — customizer sanity, live. A small sample, not a matrix.
 *
 * `check-switching.mjs` walks every offered cell against a local build and is
 * the gate that owns that claim. What is unproven after it passes is narrower:
 * that a *shared link* carrying a cell still resolves to that cell on the
 * deployed site — through Cloudflare's cache, through the service worker, on
 * the artifact actually being served.
 *
 * Three legal cells, one per design family, plus one illegal URL. The expected
 * values are read from `src/design/presets.json` — the same file the CSS is
 * emitted from — so a cell cannot pass by agreeing with the renderer. That is
 * `check-switching.mjs`'s rule and it is the whole reason the sample is worth
 * anything.
 *
 * Only clients whose live page carries the panel are checked; the rest are
 * `n/a` with the reason, never a silent skip. `ks-welding-{forge,heritage,
 * precision}` are deliberately customizer-free per their configs.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { FINDING, assertion, finding, notApplicable, summarise } from '../fleet.mjs';
import { repoRoot } from '../../pitch/paths.mjs';

const presetFile = JSON.parse(
  readFileSync(join(repoRoot, 'packages', 'template', 'src', 'design', 'presets.json'), 'utf8'),
);

/** An illegal URL: neither the family nor the swatch has ever existed. */
const ILLEGAL_QUERY = '?theme=brutalist&accent=chartreuse';

/** Hex and `rgb()` say the same thing; compare them as the same thing. */
function norm(value) {
  const text = String(value ?? '').trim().toLowerCase();
  const hex = /^#([0-9a-f]{6})$/.exec(text);
  if (!hex) return text.replace(/\s+/g, ' ');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * The sample: one cell per family, each in that family's own default tone, with
 * the accent and lettering rotated so the three cells do not all sit at index
 * zero. Deterministic — a smoke run that sampled randomly would report a
 * different thing every time it was run.
 */
export function sampleCells() {
  return presetFile.presets.map((preset, i) => {
    const scheme = preset.defaultScheme;
    const tone = preset.schemes[scheme];
    const swatch = tone.accents[i % tone.accents.length];
    const font = preset.fonts[i % preset.fonts.length];
    return { theme: preset.id, scheme, accent: swatch.id, font: font.id, expect: swatch };
  });
}

export const hasCustomizer = (html) => /id=["']d-cust-toggle["']/.test(html);

const readState = () => {
  const doc = document.documentElement;
  const styles = getComputedStyle(doc);
  return {
    theme: doc.getAttribute('data-theme'),
    scheme: doc.getAttribute('data-scheme'),
    accent: doc.getAttribute('data-accent'),
    font: doc.getAttribute('data-font'),
    dAccent: styles.getPropertyValue('--d-accent').trim(),
    href: location.href,
  };
};

export async function run(ctx, session) {
  const { slug, pages } = ctx;
  const assertions = [];
  const findings = [];

  if (!hasCustomizer(pages.get('/').body)) {
    return notApplicable(
      'customizer',
      'Customizer',
      'the live build carries no customizer panel (features.customizer is off)',
    );
  }

  for (const cell of sampleCells()) {
    const query = `?theme=${cell.theme}&scheme=${cell.scheme}&accent=${cell.accent}&font=${cell.font}`;
    const visit = await session.visit('/', { shot: false, query });
    if (visit.status !== 200) {
      assertions.push(assertion(`${query} loads`, false, visit.error || visit.status, 200));
      continue;
    }
    const state = await session.page.evaluate(readState);
    const label = `${cell.theme}/${cell.scheme}/${cell.accent}/${cell.font}`;
    assertions.push(
      assertion(`${label} · data-theme`, state.theme === cell.theme, state.theme, cell.theme),
      assertion(`${label} · data-scheme`, state.scheme === cell.scheme, state.scheme, cell.scheme),
      assertion(`${label} · data-accent`, state.accent === cell.accent, state.accent, cell.accent),
      assertion(`${label} · data-font`, state.font === cell.font, state.font, cell.font),
      assertion(
        `${label} · --d-accent`,
        state.dAccent !== '' && norm(state.dAccent) === norm(cell.expect.accent),
        state.dAccent || '(empty)',
        cell.expect.accent,
        'expected value read from presets.json, not from the page',
      ),
    );
  }

  /* --- the illegal URL ---------------------------------------------------- */

  const illegal = await session.visit('/', { shot: false, query: ILLEGAL_QUERY });
  if (illegal.status !== 200) {
    assertions.push(assertion(`${ILLEGAL_QUERY} loads`, false, illegal.error || illegal.status, 200));
  } else {
    const state = await session.page.evaluate(readState);
    const preset = presetFile.presets.find((p) => p.id === state.theme);
    const tone = preset ? preset.schemes[state.scheme] : null;
    // The brand accent is offered per cell and is not in presets.json, so a
    // landing on it is legal too; what must never happen is the *asked-for*
    // value being stamped, which is the bug this case exists for.
    const known = tone ? tone.accents.some((a) => a.id === state.accent) : false;
    assertions.push(
      assertion(
        `${ILLEGAL_QUERY} · resolved to a real family`,
        Boolean(preset),
        state.theme,
        'a preset in presets.json',
      ),
      assertion(
        `${ILLEGAL_QUERY} · did not stamp the invented accent`,
        state.accent !== 'chartreuse',
        state.accent,
        'not "chartreuse"',
      ),
      assertion(
        `${ILLEGAL_QUERY} · landed on a painted cell`,
        state.dAccent !== '',
        state.dAccent || '(empty)',
        'a non-empty --d-accent',
        known ? 'the accent is one presets.json offers for that cell' : 'accent is off-preset (a brand swatch)',
      ),
    );
  }

  if (assertions.some((a) => !a.ok)) {
    findings.push(
      finding(
        FINDING.CUSTOMIZER,
        `${slug}: a shared customizer link does not resolve to the cell it names on the live site`,
      ),
    );
  }

  return summarise('customizer', 'Customizer', assertions, findings, {
    cells: sampleCells().map((c) => `${c.theme}/${c.scheme}/${c.accent}/${c.font}`),
  });
}
