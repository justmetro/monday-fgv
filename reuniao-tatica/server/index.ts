// Servidor estático: o app roda todo no navegador (lê os quadros com o token do usuário e monta o PPT).
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const PUBLIC = path.join(__dirname, 'public');
const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation' };

http.createServer(async (req, res) => {
  const p = new URL(req.url ?? '/', 'http://x').pathname;
  if (p === '/health') { res.writeHead(200); return res.end('ok'); }
  const rel = p === '/' ? 'index.html' : path.normalize(decodeURIComponent(p)).replace(/^([/\\])+/, '');
  const file = path.join(PUBLIC, rel);
  try {
    if (!file.startsWith(PUBLIC)) throw new Error('fora');
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': /\.(html|pptx)$/.test(rel) ? 'no-store' : 'public, max-age=31536000, immutable' });
    res.end(data);
  } catch {
    const html = await readFile(path.join(PUBLIC, 'index.html')).catch(() => Buffer.from('não encontrado'));
    res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
    res.end(html);
  }
}).listen(Number(process.env.PORT) || 8080, () => console.log('servidor no ar'));
