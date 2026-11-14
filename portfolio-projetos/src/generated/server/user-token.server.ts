import { db } from '@vibe/db/server';
import { getCurrentUser } from '@api/current-user.server';
import { userTokens } from '@generated/models';
import { getUserToken } from '@shims/server/secrets';

const MONDAY_API = 'https://api.monday.com/v2';

export async function findTokenDoc(userId: string) {
  const docs = await db.collection(userTokens).where('userId', '==', userId).limit(1).get();
  const d = docs[0];
  if (!d) return null;
  // O token fica no SecureStorage; o banco guarda só nome e data.
  const token = await getUserToken(userId);
  return token ? { ...d, data: { ...d.data, token } } : null;
}

/** Token pessoal do usuário da requisição atual, se cadastrado. */
export async function currentUserToken(): Promise<string | null> {
  const u = await getCurrentUser();
  if (!u) return null;
  return (await findTokenDoc(u.id))?.data.token ?? null;
}

/** Consulta direta à API da Monday com o token informado. Erros no mesmo formato do cliente da plataforma. */
export async function requestWithToken(token: string, query: string, variables?: Record<string, unknown>): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(MONDAY_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: token, 'API-Version': '2025-04' },
      body: JSON.stringify({ query, variables: variables ?? {} }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (e) {
    throw new Error(`request failed: ${e instanceof Error ? e.message : 'erro de rede'}`);
  }
  const body = (await res.json().catch(() => null)) as { data?: unknown; errors?: { message?: string; extensions?: Record<string, unknown> }[]; error_message?: string; error_code?: string } | null;
  if (!res.ok || body?.errors?.length || body?.error_message) {
    const first = body?.errors?.[0];
    const err = new Error(first?.message ?? body?.error_message ?? `HTTP ${res.status}`) as Error & { response?: unknown };
    err.response = {
      errors: [{ message: first?.message ?? body?.error_message ?? `HTTP ${res.status}`, extensions: { ...(first?.extensions ?? {}), code: (first?.extensions?.code as string | undefined) ?? body?.error_code, status_code: res.ok ? undefined : res.status, service: 'monday-token' } }],
    };
    throw err;
  }
  return body?.data;
}
