// Token OAuth do app: autorizado uma vez por um admin da conta (rota /oauth/start) e guardado no banco.
// Substitui o token pessoal (MONDAY_API_TOKEN), que fica só como reserva enquanto o app não for autorizado.
import { randomBytes } from 'node:crypto';
import type http from 'node:http';
import { mongo } from './mongo';

type Doc = { _id: string; [k: string]: unknown };
const col = async () => (await mongo()).collection<Doc>('app_oauth');

let cache: { at: number; token: string | null } | null = null;
const TTL = 5 * 60 * 1000;

export async function tokenOAuth(): Promise<string | null> {
  if (cache && Date.now() - cache.at < TTL) return cache.token;
  try {
    const d = await (await col()).findOne({ _id: 'token' });
    cache = { at: Date.now(), token: typeof d?.accessToken === 'string' ? d.accessToken : null };
  } catch (e) {
    console.error('[oauth] leitura do token', e);
    cache = { at: Date.now(), token: null };
  }
  return cache.token;
}

/** Guarda o client_id e a conta que vêm no sessionToken (necessários para iniciar o OAuth fora do monday). */
let conhecido = '';
export function lembrarCliente(clientId: unknown, accountId: unknown) {
  const c = String(clientId ?? ''), a = String(accountId ?? '');
  if (!c || conhecido === `${c}|${a}`) return;
  conhecido = `${c}|${a}`;
  col().then((x) => x.updateOne({ _id: 'cliente' }, { $set: { clientId: c, accountId: a } }, { upsert: true })).catch(() => { conhecido = ''; });
}

function pagina(res: http.ServerResponse, status: number, texto: string) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(`<!doctype html><meta charset="utf-8"><title>Autorização do app</title><body style="font-family:system-ui;padding:40px;max-width:560px">${texto}</body>`);
}

function retorno(req: http.IncomingMessage) {
  const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? '').split(',')[0].trim();
  return `https://${host}/oauth/callback`;
}

export async function oauthStart(req: http.IncomingMessage, res: http.ServerResponse) {
  const c = await (await col()).findOne({ _id: 'cliente' });
  if (!c?.clientId) return pagina(res, 409, '<p>Abra o app uma vez dentro do monday e depois volte a este link.</p>');
  const state = randomBytes(24).toString('hex');
  await (await col()).updateOne({ _id: 'state' }, { $set: { state, at: Date.now() } }, { upsert: true });
  const url = new URL('https://auth.monday.com/oauth2/authorize');
  url.searchParams.set('client_id', String(c.clientId));
  url.searchParams.set('redirect_uri', retorno(req));
  url.searchParams.set('state', state);
  res.writeHead(302, { Location: url.toString(), 'Cache-Control': 'no-store' });
  res.end();
}

export async function oauthCallback(req: http.IncomingMessage, res: http.ServerResponse, url: URL) {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const x = await col();
  const s = await x.findOne({ _id: 'state' });
  if (!code || !state || s?.state !== state || Date.now() - Number(s?.at ?? 0) > 15 * 60 * 1000) {
    return pagina(res, 400, '<p>Link de autorização inválido ou expirado. Abra /oauth/start de novo.</p>');
  }
  await x.deleteOne({ _id: 'state' });
  const c = await x.findOne({ _id: 'cliente' });
  const r = await fetch('https://auth.monday.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: c?.clientId, client_secret: process.env.CLIENT_SECRET, code, redirect_uri: retorno(req) }),
  });
  const j = (await r.json().catch(() => null)) as { access_token?: string; error?: string; error_description?: string } | null;
  if (!j?.access_token) return pagina(res, 400, `<p>O monday recusou a autorização: ${String(j?.error_description ?? j?.error ?? r.status).replace(/[<>]/g, '')}</p>`);

  // Só um admin da mesma conta pode definir o token do app.
  const me = await fetch('https://api.monday.com/v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: j.access_token, 'API-Version': '2026-10' },
    body: JSON.stringify({ query: '{ me { id name is_admin account { id } } }' }),
  }).then((y) => y.json()).catch(() => null) as { data?: { me?: { id: string; name: string; is_admin: boolean; account: { id: string } } } } | null;
  const u = me?.data?.me;
  if (!u?.is_admin || (c?.accountId && String(u.account?.id) !== String(c.accountId))) {
    return pagina(res, 403, '<p>Só um admin da conta FGV DGPE pode autorizar o app.</p>');
  }
  await x.updateOne({ _id: 'token' }, { $set: { accessToken: j.access_token, userId: String(u.id), nome: u.name, em: new Date().toISOString() } }, { upsert: true });
  cache = null;
  return pagina(res, 200, `<p>App autorizado por ${u.name.replace(/[<>]/g, '')}. Pode fechar esta aba e recarregar o app no monday.</p>`);
}

export async function oauthStatus(res: http.ServerResponse) {
  const d = await (await col()).findOne({ _id: 'token' });
  res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify({ autorizado: !!d?.accessToken, por: d?.nome ?? null, em: d?.em ?? null }));
}
