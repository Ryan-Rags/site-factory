import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, sep } from "node:path";

/**
 * A localhost static server over one built site.
 *
 * Ported from `scripts/mockup/serve.mjs`, for the reason recorded there: the
 * template emits root-absolute asset paths and `trailingSlash: 'ignore'`, so a
 * `file://` screenshot would be missing exactly the images the demo exists to
 * show. Binds to 127.0.0.1 on an ephemeral port and closes when the shot is
 * taken.
 */

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

function resolveFile(root: string, urlPath: string): string | null {
  const path = urlPath.split("?")[0]?.split("#")[0] ?? "/";
  const decoded = decodeURIComponent(path);
  const rel = normalize(decoded).replace(/^([/\\])+/, "");
  const base = join(root, rel);
  if (base !== root && !base.startsWith(root + sep)) return null;

  for (const candidate of [base, join(base, "index.html"), `${base}.html`]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

export interface StaticServer {
  origin: string;
  close: () => Promise<void>;
}

export function serveDir(root: string): Promise<StaticServer> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const file = resolveFile(root, req.url ?? "/");
      if (!file) {
        res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        res.end("not found");
        return;
      }
      res.writeHead(200, {
        "content-type": MIME[extname(file).toLowerCase()] ?? "application/octet-stream",
        "cache-control": "no-store",
      });
      createReadStream(file).pipe(res);
    });

    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new Error("static server did not bind to a port"));
        return;
      }
      resolve({
        origin: `http://127.0.0.1:${address.port}`,
        close: () => new Promise<void>((done) => server.close(() => done())),
      });
    });
  });
}
