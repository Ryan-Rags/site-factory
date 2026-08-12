/**
 * Turn a comparison result into the things that actually go in front of a
 * prospect: one sentence, and one card.
 *
 * Nothing in here invents a number. Every path that cannot produce a score
 * says so in words a person can read out loud — "unavailable", "no current
 * website" — because the alternative, a plausible-looking 0 or a dash, is a
 * claim about somebody's business that we did not measure.
 */

/** The categories `packages/audit` reports, in the order the card shows them. */
export const CATEGORIES = [
  ['performance', 'Performance'],
  ['accessibility', 'Accessibility'],
  ['best-practices', 'Best practices'],
  ['seo', 'SEO'],
];

/**
 * The one-liner.
 *
 *   Your site: 38/100. New site: 96/100.
 *
 * Performance alone, because that is the number the sentence is about and the
 * one a shop owner recognises. The other three are on the card.
 */
export function headline(result) {
  const theirs = result.live;
  const ours = result.demo;

  const newSide =
    ours.scores && typeof ours.scores.performance === 'number'
      ? `New site: ${ours.scores.performance}/100.`
      : `New site: score unavailable (${ours.error || 'the run did not complete'}).`;

  if (theirs.status === 'no-site') {
    return `You have no website today. ${newSide}`;
  }
  /*
   * A parked or dead domain is a *stronger* pitch than no domain at all, and
   * the line says so rather than flattening it to "no website": the owner is
   * paying for, or has lost, an address that is currently working against
   * them. Deliberately not scored — see `websiteStatusFor` in paths.mjs.
   */
  if (theirs.status === 'parked') {
    return `Your domain shows a for-sale page, not your business. ${newSide}`;
  }
  if (theirs.status === 'dead') {
    return `Your domain does not load at all. ${newSide}`;
  }
  if (theirs.status === 'unreachable') {
    return `Your site: would not load (${theirs.error}). ${newSide}`;
  }
  if (!theirs.scores || typeof theirs.scores.performance !== 'number') {
    return `Your site: score unavailable (${theirs.error || 'the run did not complete'}). ${newSide}`;
  }
  return `Your site: ${theirs.scores.performance}/100. ${newSide}`;
}

const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

const NOT_A_SITE = {
  'no-site': 'no site',
  parked: 'parked domain',
  dead: 'dead domain',
};

function scoreCell(side, key) {
  const label = NOT_A_SITE[side.status];
  if (label !== undefined) return `<td class="none">${label}</td>`;
  const value = side.scores ? side.scores[key] : undefined;
  if (typeof value !== 'number') return '<td class="none">unavailable</td>';
  const band = value >= 90 ? 'good' : value >= 50 ? 'mid' : 'poor';
  return `<td class="score ${band}">${value}</td>`;
}

/**
 * A single self-contained HTML file, sized for a phone held up in a shop.
 * No external CSS, no fonts, no images beyond the two screenshots which are
 * referenced as siblings in the same directory.
 */
export function pitchCard(result) {
  const rows = CATEGORIES.map(
    ([key, label]) =>
      `<tr><th scope="row">${label}</th>${scoreCell(result.live, key)}${scoreCell(result.demo, key)}</tr>`,
  ).join('\n        ');

  const LIVE_LABEL = {
    'no-site': 'No current website',
    parked: 'Domain parked on a for-sale page',
    dead: 'Domain does not load',
  };
  const liveLabel =
    LIVE_LABEL[result.live.status] ?? escapeHtml(result.live.url ?? '—');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(result.name)} — site comparison</title>
    <style>
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      body {
        margin: 0; padding: 24px;
        font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
        color: #0f172a; background: #f8fafc;
      }
      h1 { font-size: 1.5rem; margin: 0 0 4px; }
      .sub { color: #475569; margin: 0 0 20px; font-size: 0.95rem; }
      .headline {
        font-size: 1.35rem; font-weight: 700; line-height: 1.35;
        background: #fff; border: 2px solid #0f172a; border-radius: 12px;
        padding: 16px 18px; margin-bottom: 20px;
      }
      table { width: 100%; border-collapse: collapse; background: #fff;
              border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; }
      th, td { padding: 12px 14px; text-align: left; border-bottom: 1px solid #e2e8f0; }
      thead th { background: #0f172a; color: #fff; font-size: 0.85rem;
                 text-transform: uppercase; letter-spacing: 0.06em; }
      tbody th { font-weight: 600; }
      td.score { font-variant-numeric: tabular-nums; font-weight: 700; font-size: 1.1rem; }
      td.good { color: #047857; }
      td.mid  { color: #b45309; }
      td.poor { color: #b91c1c; }
      td.none { color: #64748b; font-style: italic; }
      .shots { display: grid; gap: 16px; margin-top: 20px; }
      @media (min-width: 720px) { .shots { grid-template-columns: 1fr 1fr; } }
      figure { margin: 0; background: #fff; border: 1px solid #e2e8f0;
               border-radius: 12px; padding: 12px; }
      figcaption { font-size: 0.85rem; color: #475569; margin-bottom: 8px; }
      img { width: 100%; height: auto; border-radius: 6px; border: 1px solid #e2e8f0; }
      .missing { padding: 40px 12px; text-align: center; color: #64748b;
                 font-style: italic; border: 2px dashed #cbd5e1; border-radius: 6px; }
      footer { margin-top: 20px; font-size: 0.8rem; color: #64748b; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(result.name)}</h1>
    <p class="sub">Google Lighthouse, mobile, measured ${escapeHtml(result.measuredAt)}</p>

    <p class="headline">${escapeHtml(result.headline)}</p>

    <table>
      <thead>
        <tr><th scope="col">Measure</th><th scope="col">${liveLabel}</th><th scope="col">New site</th></tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <div class="shots">
      <figure>
        <figcaption>Current site — mobile</figcaption>
        ${
          result.live.screenshot
            ? `<img src="${escapeHtml(result.live.screenshot)}" alt="The current site on a phone" />`
            : `<div class="missing">${LIVE_LABEL[result.live.status] ?? 'Screenshot unavailable'}</div>`
        }
      </figure>
      <figure>
        <figcaption>New site — mobile</figcaption>
        ${
          result.demo.screenshot
            ? `<img src="${escapeHtml(result.demo.screenshot)}" alt="The new site on a phone" />`
            : `<div class="missing">Screenshot unavailable</div>`
        }
      </figure>
    </div>

    <footer>
      Scores are Google Lighthouse, mobile emulation, run from one machine on one
      connection. They move a few points run to run; anything reported as
      &ldquo;unavailable&rdquo; was not measured and is not guessed at.
      ${
        result.demo.noindex
          ? `<br /><br /><strong>About the new site's SEO score:</strong> this preview is
             deliberately hidden from search engines while it is unapproved, which
             Lighthouse counts as an SEO failure. That switch is turned off when the
             site goes live, and the score goes with it.`
          : ''
      }
    </footer>
  </body>
</html>
`;
}
