// Static file server for local play and the tunnel. No caching, so every reload gets the latest build.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('./public/', import.meta.url));
const port = Number(process.env.PORT || 5178);

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://local');
      let path = decodeURIComponent(url.pathname);
      if (path.endsWith('/')) path += 'index.html';
      const file = normalize(join(root, path));
      if (!file.startsWith(root.endsWith(sep) ? root : root + sep)) {
        res.writeHead(403).end('Forbidden');
        return;
      }
      const info = await stat(file).catch(() => null);
      if (!info || !info.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
        return;
      }
      const body = await readFile(file);
      res.writeHead(200, {
        'Content-Type': types[extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-store, max-age=0',
      });
      res.end(body);
    } catch (err) {
      res.writeHead(500).end(String(err));
    }
  })
  .listen(port, () => console.log(`Pulp Panic on http://localhost:${port}`));
