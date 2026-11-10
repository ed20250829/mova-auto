/**
 * Entry for hoster.by / ispmanager Node.js.
 * Listens on process.env.SOCKET (unix socket) or HOST+PORT.
 * No Express — fewer deps / lighter install on shared hosting.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handler as ssrHandler } from './dist/server/entry.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

try {
  process.loadEnvFile(path.join(__dirname, '.env'));
} catch {
  // .env optional — panel env vars still work
}

const clientRoot = path.join(__dirname, 'dist/client');

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.map': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function resolveClientFile(urlPath) {
  const clean = decodeURIComponent((urlPath || '/').split('?')[0]);
  if (clean === '/' || clean.endsWith('/')) return null;
  const resolved = path.normalize(path.join(clientRoot, clean));
  if (!resolved.startsWith(clientRoot)) return null;
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) return null;
  return resolved;
}

function tryServeStatic(req, res) {
  const raw = req.url || '/';
  const clean = decodeURIComponent(raw.split('?')[0] || '/');
  const filePath = resolveClientFile(raw);

  if (filePath) {
    const ext = path.extname(filePath).toLowerCase();
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    if (clean.startsWith('/_astro/')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
    fs.createReadStream(filePath).pipe(res);
    return true;
  }

  // Missing files with an extension must not fall through to SSR —
  // on shared hosting that can hang the request for tens of seconds.
  if (clean !== '/' && /\.[a-zA-Z0-9]{1,8}$/.test(clean)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return true;
  }

  return false;
}

const server = http.createServer((req, res) => {
  if (tryServeStatic(req, res)) return;
  ssrHandler(req, res, (err) => {
    if (err) {
      console.error(err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Internal Server Error');
      }
      return;
    }
    // @astrojs/node middleware calls next() when nothing matched.
    // Without ending the response, nginx waits until upstream timeout (0 bytes).
    if (!res.headersSent) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(
        '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>404 — Мова</title></head><body><h1>Страница не найдена</h1><p><a href="/">На главную</a></p></body></html>',
      );
    }
  });
});

const socket = process.env.SOCKET;

if (socket) {
  if (fs.existsSync(socket)) fs.unlinkSync(socket);
  server.listen(socket, () => {
    try {
      fs.chmodSync(socket, 0o660);
    } catch {
      // ignore chmod failures on some hosts
    }
    console.log(`Mova listening on socket ${socket}`);
  });
} else {
  const port = Number(process.env.PORT || 4321);
  const host = process.env.HOST || process.env.INSTANCE_HOST || '127.0.0.1';
  server.listen(port, host, () => {
    console.log(`Mova listening on http://${host}:${port}`);
  });
}

server.on('error', (err) => {
  console.error('Server error:', err);
  process.exit(1);
});
