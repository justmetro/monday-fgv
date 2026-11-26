// Chamadas à API do monday. Leituras usam o token OAuth do app (ou MONDAY_API_TOKEN como reserva);
// mutations feitas a pedido de alguém são executadas pelo navegador dessa pessoa (ver relay.ts).
import { tokenOAuth } from './oauth';
import { viaNavegador, SEM_NAVEGADOR } from './relay';

const API = 'https://api.monday.com/v2';

export function serviceToken(): string {
  return (process.env.MONDAY_API_TOKEN ?? '').trim();
}

export const ehMutacao = (query: string) => /^\s*mutation\b/.test(query);

/** Resposta crua do monday ({ data, errors, error_message }) e o status HTTP (200 quando veio do navegador). */
export async function respostaMonday(query: string, variables: Record<string, unknown> = {}, opts: { tokenFixo?: string; versao?: string; signal?: AbortSignal } = {}): Promise<{ status: number; json: any }> {
  if (!opts.tokenFixo && ehMutacao(query)) {
    const r = await viaNavegador(query, variables);
    if (r !== SEM_NAVEGADOR) return { status: 200, json: r };
  }
  const token = opts.tokenFixo ?? (await tokenOAuth()) ?? serviceToken();
  if (!token) throw new Error('App sem autorização OAuth e sem token de serviço configurado.');
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token, 'API-Version': opts.versao ?? '2026-10' },
    body: JSON.stringify({ query, variables }),
    signal: opts.signal,
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

export async function gql<T = any>(query: string, variables: Record<string, unknown> = {}, tokenFixo?: string): Promise<T> {
  let wait = 1500;
  for (let attempt = 1; ; attempt++) {
    const { status, json } = await respostaMonday(query, variables, { tokenFixo });
    const err = json?.errors?.[0];
    const msg = err?.message || json?.error_message || (status >= 400 ? `HTTP ${status}` : '');
    const retryable = status === 429 || status >= 500 || /complexity|rate|limit|timeout|temporar/i.test(`${msg} ${err?.extensions?.code ?? ''}`);
    if (!msg && json?.data) return json.data as T;
    if (retryable && attempt < 6) {
      const s = err?.extensions?.retry_in_seconds;
      await new Promise((r) => setTimeout(r, s ? s * 1000 + 500 : wait));
      wait = Math.min(wait * 2, 30000);
      continue;
    }
    throw new Error(`API do monday: ${msg || 'resposta vazia'}`.slice(0, 400));
  }
}
