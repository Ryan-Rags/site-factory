/**
 * A minimal static file server over one built client's `dist/<slug>/`.
 *
 * Why serve at all rather than screenshotting `file://` URLs: the template
 * emits root-absolute asset paths (`/images/...`) and sets `trailingSlash:
 * 'ignore'`, neither of which resolves correctly off the filesystem. A page
 * shot over `file://` would be missing exactly the images the mockup exists
 * to show.
 *
 * Port 0 — the OS picks a free ephemeral port. Nothing here is long-lived or
 * externally reachable: the listener binds to 127.0.0.1 only, serves the
 * screenshots, and closes.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

/**
 * Map a URL path to a file inside `root`, honouring Astro's `trailingSlash:
 * 'ignore'`: `/about`, `/about/` and `/about/index.html` are the same page.
 * Returns null for anything that escapes `root` — the server only ever hands
 * out bytes from the directory it was pointed at.
 */
function resolveFile(root, urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  const rel = normalize(decoded).replace(/^([/\\])+/, '');
  const base = join(root, rel);
  if (base !== root && !base.startsWith(root + sep)) return null;

  const candidates = [base, join(base, 'index.html'), `${base}.html`];
  for (const c of candidates) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
}

/** Start the server; resolves to `{ origin, close }`. */
export function serveDir(root) {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const file = resolveFile(root, req.url || '/');
      if (!file) {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('not found');
        return;
      }
      res.writeHead(200, {
        'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
        'cache-control': 'no-store',
      });
      createReadStream(file).pipe(res);
    });

    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        origin: `http://127.0.0.1:${port}`,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}
