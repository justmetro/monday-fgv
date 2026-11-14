// Servidor só de arquivos estáticos: o app lê o monday direto do navegador (token do usuário).
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const PUBLIC = path.join(__dirname, 'public');
const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf' };

http.createServer(async (req, res) => {
  const p = new URL(req.url ?? '/', 'http://x').pathname;
  if (p === '/health') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end('{"ok":true}'); }
  const rel = p === '/' ? 'index.html' : path.normalize(p).replace(/^([/\\])+/, '');
  const file = path.join(PUBLIC, rel);
  try {
    if (!file.startsWith(PUBLIC)) throw new Error('fora');
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': rel === 'index.html' ? 'no-store' : 'public, max-age=31536000, immutable' });
    res.end(data);
  } catch {
    const html = await readFile(path.join(PUBLIC, 'index.html'));
    res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
    res.end(html);
  }
}).listen(Number(process.env.PORT) || 8080, () => console.log('servidor no ar'));
