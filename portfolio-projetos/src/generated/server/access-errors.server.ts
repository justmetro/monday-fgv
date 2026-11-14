/** Classificação de falhas de acesso à Monday. Nunca inclui tokens/cabeçalhos — só código, status e mensagem da plataforma. */
export type AccessKind = 'session' | 'denied' | 'restricted' | 'not_returned' | 'temporary' | 'unknown';

export const GENERIC_ACCESS_MSG =
  'Não foi possível acessar este quadro pela conexão atual do aplicativo. Isso pode ocorrer por permissões do usuário ou por restrições da conexão. Consulte o diagnóstico.';

const MESSAGES: Record<AccessKind, string> = {
  session: 'Sessão não identificada ou expirada. Recarregue o aplicativo dentro da Monday e tente novamente.',
  denied: 'Acesso negado explicitamente pela API da Monday para este usuário.',
  restricted: 'A conexão do aplicativo recusou a consulta (restrição do aplicativo ou da conexão, não necessariamente do usuário).',
  not_returned: GENERIC_ACCESS_MSG,
  temporary: 'Falha temporária ou limite de uso da API da Monday. Aguarde alguns instantes e tente novamente.',
  unknown: GENERIC_ACCESS_MSG,
};

export class AccessError extends Error {
  constructor(public kind: AccessKind, public code: string | null, public status: number | null, public platformMessage: string | null) {
    super(MESSAGES[kind]);
  }
}

const clip = (s: unknown) => (typeof s === 'string' ? s.replace(/(bearer\s+)\S+/gi, '$1***').slice(0, 300) : null);

export type ErrInfo = { kind: AccessKind; code: string | null; status: number | null; platformMessage: string | null; message: string };

export function describeError(e: unknown): ErrInfo {
  if (e instanceof AccessError) return { kind: e.kind, code: e.code, status: e.status, platformMessage: e.platformMessage, message: e.message };
  const anyE = e as { message?: string; response?: { errors?: { message?: string; extensions?: { code?: string; status_code?: number; service?: string } }[]; error_code?: string; status_code?: number }; status?: number };
  const first = anyE?.response?.errors?.[0];
  const code = first?.extensions?.code ?? anyE?.response?.error_code ?? null;
  const status = first?.extensions?.status_code ?? anyE?.response?.status_code ?? anyE?.status ?? null;
  const service = first?.extensions?.service ?? null;
  const raw = `${first?.message ?? ''} ${anyE?.message ?? ''}`;
  const pm = clip(first?.message ?? anyE?.message ?? null);
  const t = raw.toLowerCase();
  let kind: AccessKind = 'unknown';
  if (t.includes('missing vibe-auth session') || status === 401 || code === 'UNAUTHENTICATED') kind = 'session';
  else if (status === 429 || (status != null && status >= 500) || /rate limit|complexity|timeout|timed out|econn|fetch failed|request failed/.test(t)) kind = 'temporary';
  else if (service === 'vibe-auth' && status === 403) kind = 'restricted';
  else if (/scope|not allowed for this app|app is not|resource not allowed|not connected/.test(t)) kind = 'restricted';
  else if (status === 403 || /unauthorized|not authorized|permission|forbidden|access denied/.test(t)) kind = 'denied';
  return { kind, code, status, platformMessage: pm, message: MESSAGES[kind] };
}

export function toAccessError(e: unknown): AccessError {
  if (e instanceof AccessError) return e;
  const d = describeError(e);
  return new AccessError(d.kind, d.code, d.status, d.platformMessage);
}
