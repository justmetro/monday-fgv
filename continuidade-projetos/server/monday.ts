import { tokenOAuth } from './oauth';
const API = 'https://api.monday.com/v2';

export function serviceToken(): string {
  return (process.env.MONDAY_API_TOKEN ?? '').trim();
}

export async function gql<T = any>(query: string, variables: Record<string, unknown> = {}, tokenFixo?: string): Promise<T> {
  const token = tokenFixo ?? (await tokenOAuth()) ?? serviceToken();
  if (!token) throw new Error('Token de serviço do monday não configurado no servidor.');
  let wait = 1500;
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: token, 'API-Version': '2026-10' },
      body: JSON.stringify({ query, variables }),
    });
    const json = (await res.json().catch(() => null)) as { data?: T; errors?: { message?: string; extensions?: { code?: string; retry_in_seconds?: number } }[]; error_message?: string } | null;
    const err = json?.errors?.[0];
    const msg = err?.message || json?.error_message || (!res.ok ? `HTTP ${res.status}` : '');
    const retryable = res.status === 429 || res.status >= 500 || /complexity|rate|limit|timeout|temporar/i.test(`${msg} ${err?.extensions?.code ?? ''}`);
    if (!msg && json?.data) return json.data;
    if (retryable && attempt < 6) {
      const s = err?.extensions?.retry_in_seconds;
      await new Promise((r) => setTimeout(r, s ? s * 1000 + 500 : wait));
      wait = Math.min(wait * 2, 30000);
      continue;
    }
    throw new Error(`API do monday: ${msg || 'resposta vazia'}`.slice(0, 400));
  }
}
