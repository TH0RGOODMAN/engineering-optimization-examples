import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PUBLIC_FILES } from './files.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const allowed = new Set(PUBLIC_FILES);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.txt': 'text/plain; charset=utf-8' };

export function createServer() {
  return http.createServer(async (req, res) => {
    const headers = { 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' };
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405, { ...headers, Allow: 'GET, HEAD' }); res.end(); return;
    }
    let relative;
    try {
      relative = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\//, '') || 'index.html';
    } catch { res.writeHead(400, headers); res.end(); return; }
    if (!allowed.has(relative)) { res.writeHead(404, headers); res.end(); return; }
    try {
      const body = await readFile(path.join(root, relative));
      res.writeHead(200, { ...headers, 'Content-Type': mime[path.extname(relative)] || 'text/plain; charset=utf-8', 'Content-Length': body.length });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch { res.writeHead(404, headers); res.end(); }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 8785);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535.');
  const server = createServer();
  server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? `Port ${port} is busy. Set PORT to another value.` : error.message); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`Engineering Optimization Examples: http://127.0.0.1:${port}\nLocal computer only. Press Ctrl+C to stop.`));
}
