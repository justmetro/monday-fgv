// Substitui createServerFn no navegador: cada função vira uma chamada POST para /_fn/<id>,
// autenticada com o sessionToken do monday.
import mondaySdk from 'monday-sdk-js';

const monday = mondaySdk();
let cached: { t: string; at: number } | null = null;

export async function sessionToken(): Promise<string> {
  if (cached && Date.now() - cached.at < 5 * 60_000) return cached.t;
  const res = await monday.get('sessionToken');
  cached = { t: String((res as { data: unknown }).data ?? ''), at: Date.now() };
  return cached.t;
}

export async function callServerFn(id: string, data: unknown): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(`./_fn/${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: await sessionToken() },
      body: JSON.stringify({ data: data ?? null }),
    });
  } catch {
    throw new Error('O servidor ficou indisponível por um instante. Tente novamente.');
  }
  if (res.status === 401) cached = null;
  let body: { ok?: boolean; result?: unknown; error?: string } | null = null;
  try {
    body = await res.json();
  } catch {
    if (res.status >= 502) throw new Error('O servidor ficou indisponível por um instante. Tente novamente.');
    throw new Error(`Falha de comunicação com o servidor (HTTP ${res.status}).`);
  }
  if (!body?.ok) throw new Error(body?.error || 'Erro no servidor.');
  return body.result;
}

export function serverFnStub(id: string) {
  const fn = (opts?: { data?: unknown }) => callServerFn(id, opts?.data);
  (fn as unknown as { __id: string }).__id = id;
  return fn;
}

// Só para tipagem; no navegador os módulos de servidor são trocados por stubs no build.
export function createServerFn(_opts?: unknown) {
  const b = {
    validator: (_v: unknown) => b,
    inputValidator: (_v: unknown) => b,
    middleware: (_m: unknown) => b,
    handler: (_h: unknown) => serverFnStub('unknown'),
  };
  return b;
}
