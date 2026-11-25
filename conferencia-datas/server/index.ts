import http from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { reqCtx, type ReqCtx } from './context';
import type { ServerFn } from './serverFn';
import { startJob, JOBS } from './jobs';
import { pendentes, registrarResultado } from './relay';
import { oauthStart, oauthCallback, oauthStatus, lembrarCliente } from './oauth';
import { MODULES } from './registry';

const FNS = new Map<string, ServerFn>();
for (const [mod, exp] of Object.entries(MODULES)) {
  for (const [name, v] of Object.entries(exp)) {
    if (typeof v === 'function' && (v as ServerFn).__serverFn) FNS.set(`${mod}:${name}`, v as ServerFn);
  }
}

const PUBLIC = path.join(__dirname, 'public');
const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' };

function b64url(buf: Buffer) { return buf.toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_'); }
function verifySession(token: string): ReqCtx | null {
  const secret = process.env.CLIENT_SECRET;
  if (!secret || !token) return null;
  const parts = token.replace(/^Bearer\s+/i, '').split('.');
  if (parts.length !== 3) return null;
  const sig = b64url(createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest());
  const a = Buffer.from(sig), b = Buffer.from(parts[2]);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (p.exp && p.exp * 1000 < Date.now()) return null;
    const d = p.dat ?? p;
    if (!d.user_id) return null;
    lembrarCliente(d.client_id, d.account_id);
    return { userId: String(d.user_id), accountId: String(d.account_id ?? ''), isAdmin: d.is_admin === true, isGuest: d.is_guest === true || d.user_kind === 'guest' };
  } catch { return null; }
}

function send(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}
async function readBody(req: http.IncomingMessage, max = 10 * 1024 * 1024): Promise<string> {
  const chunks: Buffer[] = []; let size = 0;
  for await (const c of req) { size += (c as Buffer).length; if (size > max) throw new Error('Envio grande demais.'); chunks.push(c as Buffer); }
  return Buffer.concat(chunks).toString('utf8');
}
function zodMessage(e: unknown): string | null {
  const issues = (e as { issues?: { path?: (string | number)[]; message?: string }[] })?.issues;
  if (!Array.isArray(issues)) return null;
  return 'Dados inválidos: ' + issues.slice(0, 3).map((i) => `${(i.path ?? []).join('.')}: ${i.message}`).join('; ');
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  const p = url.pathname;
  try {
    if (req.method === 'POST' && p.startsWith('/_fn/')) {
      const id = decodeURIComponent(p.slice(5));
      const fn = FNS.get(id);
      if (!fn) return send(res, 404, { ok: false, error: `Função não encontrada: ${id}` });
      const ctx = verifySession(String(req.headers.authorization ?? ''));
      if (!ctx) return send(res, 401, { ok: false, error: 'Sessão do monday inválida ou expirada. Recarregue a página.' });
      const body = JSON.parse((await readBody(req)) || '{}');
      const callId = String(req.headers['x-call-id'] ?? '');
      if (/^[a-f0-9]{16,64}$/.test(callId)) ctx.callId = callId;
      try {
        const result = await reqCtx.run(ctx, () => fn.run(body?.data ?? undefined));
        return send(res, 200, { ok: true, result: result ?? null });
      } catch (e) {
        const msg = zodMessage(e) ?? (e instanceof Error ? e.message : String(e));
        console.error(`[fn ${id}]`, msg);
        return send(res, 200, { ok: false, error: msg.slice(0, 1000) });
      } finally {
        ctx.encerrada = true;
      }
    }
    if (req.method === 'POST' && (p === '/_mut/pendentes' || p === '/_mut/resultado')) {
      const ctx = verifySession(String(req.headers.authorization ?? ''));
      if (!ctx) return send(res, 401, { ok: false, error: 'Sessão do monday inválida ou expirada. Recarregue a página.' });
      const b = JSON.parse((await readBody(req, 20 * 1024 * 1024)) || '{}');
      if (p === '/_mut/pendentes') {
        const callId = String(b?.callId ?? '');
        if (!/^[a-f0-9]{16,64}$/.test(callId)) return send(res, 400, { ok: false });
        return send(res, 200, { ok: true, result: await pendentes(callId, ctx.userId) });
      }
      await registrarResultado(String(b?.id ?? ''), ctx.userId, b?.resposta ?? null, b?.erro);
      return send(res, 200, { ok: true });
    }
    if (p.startsWith('/mndy-cronjob/') || p.startsWith('/cron/')) {
      const job = p.split('/').filter(Boolean)[1] ?? '';
      if (p.startsWith('/cron/') && (!process.env.CRON_KEY || req.headers['x-cron-key'] !== process.env.CRON_KEY)) return send(res, 401, { ok: false });
      if (req.method === 'POST') await readBody(req, 1e6).catch(() => '');
      const arg = new URL(req.url ?? '/', 'http://x').searchParams.get('arg') ?? undefined;
      // Com CRON_KEY e ?direto=1 roda na hora e devolve o resultado (usado para simular).
      const direto = p.startsWith('/cron/') && new URL(req.url ?? '/', 'http://x').searchParams.get('direto') === '1';
      const out = await reqCtx.run({ userId: '', accountId: '', isAdmin: false, isGuest: false, viaCron: true }, () => (direto ? JOBS[job]!(arg) : startJob(job, arg))).catch((e) => ({ error: String(e?.message ?? e) }));
      console.log(`[cron ${job}]`, JSON.stringify(out));
      return send(res, 200, { ok: true, result: out });
    }
    if (req.method === 'GET' && p === '/oauth/start') return await oauthStart(req, res);
    if (req.method === 'GET' && p === '/oauth/callback') return await oauthCallback(req, res, url);
    if (req.method === 'GET' && p === '/oauth/status') return await oauthStatus(res);
    if (p === '/health') return send(res, 200, { ok: true });
    const rel = p === '/' ? 'index.html' : path.normalize(p).replace(/^([/\\])+/, '');
    const file = path.join(PUBLIC, rel);
    if (!file.startsWith(PUBLIC)) return send(res, 404, { ok: false });
    try {
      const data = await readFile(file);
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': rel === 'index.html' ? 'no-store' : 'public, max-age=31536000, immutable' });
      return res.end(data);
    } catch {
      const html = await readFile(path.join(PUBLIC, 'index.html'));
      res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
      return res.end(html);
    }
  } catch (e) {
    console.error('[server]', e);
    if (!res.headersSent) send(res, 500, { ok: false, error: e instanceof Error ? e.message : 'Erro no servidor.' });
  }
});

server.requestTimeout = 0;
server.headersTimeout = 120_000;
server.listen(Number(process.env.PORT) || 8080, () => console.log(`servidor no ar (${FNS.size} funções)`));
