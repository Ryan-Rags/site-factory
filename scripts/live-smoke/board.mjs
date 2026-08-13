/**
 * §3.9 — `board.html`: every client × every route on one scrolling page.
 *
 * Images are embedded by relative `<img src>` rather than as data URIs. The
 * board is opened from disk, so relative paths resolve; a 32-shot base64 page
 * is a file nobody wants to open and nobody can diff. A red border marks any
 * cell whose route check failed, so a scan down the page finds the broken ones
 * without reading the markdown — which is the only reason a picture board earns
 * its place next to a report that already says everything.
 *
 * 390 px, the viewport `shoot.mjs` and `verify-offline.mjs` already use.
 */
const escapeHtml = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export function renderBoard(run) {
  const columns = run.clients
    .map((client) => {
      if (client.status === 'not-deployed') {
        return `<section class="client">
      <h2>${escapeHtml(client.slug)}</h2>
      <p class="origin">${escapeHtml(client.origin)}</p>
      <div class="cell bad"><p class="missing">not deployed</p>
        <figcaption>${escapeHtml(client.reason)}</figcaption></div>
    </section>`;
      }

      const routeCheck = client.checks.find((c) => c.name === 'routes');
      const failedRoutes = new Set(
        (routeCheck?.assertions ?? [])
          .filter((a) => !a.ok)
          .map((a) => a.label.split(' ')[0]),
      );

      const cells = client.shots
        .map((shot) => {
          const bad = shot.status !== 200 || failedRoutes.has(shot.route);
          return `<figure class="cell${bad ? ' bad' : ''}">
        ${shot.file ? `<img src="shots/${escapeHtml(shot.file)}" alt="${escapeHtml(client.slug)} ${escapeHtml(shot.route)}" loading="lazy">` : `<p class="missing">no screenshot — ${escapeHtml(shot.error || 'navigation failed')}</p>`}
        <figcaption>${escapeHtml(client.slug)} · ${escapeHtml(shot.route)} · ${shot.error ? escapeHtml(shot.error) : shot.status}</figcaption>
      </figure>`;
        })
        .join('\n      ');

      return `<section class="client">
      <h2>${escapeHtml(client.slug)} <span class="verdict ${client.status}">${escapeHtml(client.status)}</span></h2>
      <p class="origin"><a href="${escapeHtml(client.origin)}">${escapeHtml(client.origin)}</a></p>
      ${cells}
    </section>`;
    })
    .join('\n    ');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Live smoke board — ${escapeHtml(run.startedAt)}</title>
<style>
  :root { color-scheme: light dark; --line: #c9ced6; --bad: #c22a1e; }
  body { margin: 0; padding: 1.5rem; font: 14px/1.5 ui-sans-serif, system-ui, sans-serif; }
  h1 { font-size: 1.25rem; margin: 0 0 .25rem; }
  .lede { margin: 0 0 1.5rem; max-width: 60ch; opacity: .8; }
  .fleet { display: flex; flex-wrap: wrap; gap: 2rem; align-items: flex-start; }
  .client { flex: 0 0 auto; }
  .client h2 { font-size: 1rem; margin: 0 0 .1rem; }
  .origin { margin: 0 0 .75rem; font-size: .8rem; opacity: .7; }
  .verdict { font-size: .7rem; text-transform: uppercase; letter-spacing: .05em; padding: .1rem .4rem; border: 1px solid var(--line); border-radius: 2px; }
  .verdict.fail { color: var(--bad); border-color: var(--bad); }
  .cell { margin: 0 0 1rem; width: 390px; border: 1px solid var(--line); }
  .cell.bad { border: 3px solid var(--bad); }
  .cell img { display: block; width: 390px; height: auto; }
  .missing { margin: 0; padding: 3rem 1rem; text-align: center; color: var(--bad); }
  figcaption { padding: .35rem .5rem; font-size: .75rem; border-top: 1px solid var(--line); }
</style>
</head>
<body>
  <h1>Live smoke board — ${escapeHtml(run.startedAt)}</h1>
  <p class="lede">Every client × every route, 390&nbsp;px, full page, shot from the
  deployed site. A red border is a route whose check failed. The measured detail
  is in <code>report.md</code> beside this file.</p>
  <div class="fleet">
    ${columns}
  </div>
</body>
</html>
`;
}
