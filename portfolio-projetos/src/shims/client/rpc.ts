import mondaySdk from 'monday-sdk-js';
const monday = mondaySdk();
let cache: { t: string; at: number } | null = null;
async function sessionToken(): Promise<string> {
  if (cache && Date.now() - cache.at < 60_000) return cache.t;
  const r = await monday.get('sessionToken');
  cache = { t: String(r.data), at: Date.now() };
  return cache.t;
}
export async function callServer(id: string, data: unknown) {
  const res = await fetch(`./_fn/${encodeURIComponent(id)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: await sessionToken() },
    body: JSON.stringify({ data: data ?? null }),
  });
  let body: { ok: boolean; result?: unknown; error?: string };
  try { body = await res.json(); } catch { throw new Error(`Falha de comunicação com o servidor (HTTP ${res.status}).`); }
  if (!body.ok) throw new Error(body.error || 'Erro no servidor.');
  return body.result as any;
}
