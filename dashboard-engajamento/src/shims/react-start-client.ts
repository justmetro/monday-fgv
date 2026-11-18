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

const API_VERSION = '2026-10';
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Executa no navegador (login de quem usa o app) uma mutation pedida pelo servidor; devolve a resposta crua. */
async function executarMutacao(query: string, variables: unknown): Promise<unknown> {
  let wait = 1500;
  for (let attempt = 1; ; attempt++) {
    let r: any;
    try {
      r = await monday.api(query, { variables: (variables ?? {}) as Record<string, unknown>, apiVersion: API_VERSION });
    } catch (e: any) {
      r = e?.data ?? e;
      if (!r?.errors && !r?.error_message) r = { errors: [{ message: String(e?.message ?? e ?? 'Falha ao gravar no monday.') }] };
    }
    const err = r?.errors?.[0];
    const msg = `${err?.message ?? r?.error_message ?? ''} ${err?.extensions?.code ?? ''}`;
    if (err && attempt < 5 && /complexity|rate|limit|timeout|temporar/i.test(msg)) {
      const s = err?.extensions?.retry_in_seconds;
      await espera(s ? s * 1000 + 300 : wait);
      wait = Math.min(wait * 2, 20000);
      continue;
    }
    return r;
  }
}

async function postar(caminho: string, corpo: unknown): Promise<any> {
  const res = await fetch(caminho, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: await sessionToken() },
    body: JSON.stringify(corpo),
  });
  return res.json().catch(() => null);
}

/** Enquanto a função roda no servidor, busca e executa as gravações que ela pedir. */
function bombaDeGravacoes(callId: string) {
  let ativo = true;
  const ciclo = async () => {
    await espera(300);
    while (ativo) {
      try {
        const r = await postar('./_mut/pendentes', { callId });
        for (const m of (r?.result ?? []) as { id: string; query: string; variables: unknown }[]) {
          const resposta = await executarMutacao(m.query, m.variables).catch((e: unknown) => ({ errors: [{ message: String((e as Error)?.message ?? e) }] }));
          await postar('./_mut/resultado', { id: m.id, resposta });
        }
      } catch {
        await espera(1000);
      }
    }
  };
  void ciclo();
  return () => { ativo = false; };
}

function novoCallId(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

export async function callServerFn(id: string, data: unknown): Promise<unknown> {
  const callId = novoCallId();
  const parar = bombaDeGravacoes(callId);
  let res: Response;
  try {
    res = await fetch(`./_fn/${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: await sessionToken(), 'x-call-id': callId },
      body: JSON.stringify({ data: data ?? null }),
    });
  } catch {
    parar();
    throw new Error('O servidor ficou indisponível por um instante. Tente novamente.');
  }
  parar();
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
