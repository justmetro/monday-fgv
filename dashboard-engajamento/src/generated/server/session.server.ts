import { db } from '@vibe/db/server';
import { pmoConfigCollection } from '@generated/models';
import { currentCtx } from '../../../server/context';
import { gql } from '../../../server/monday';
import { dbReadWithRetry } from './vibeDbRetry.server';

export const OWNER_EMAIL = 'davi.vale@fgv.br';
export const PMO_CONFIG_DOC_ID = 'main_pmo_config';

export function normalizeEmail(e: string | null | undefined): string {
  return (e || '').replace(/\s+/g, '').toLowerCase();
}

/** De onde veio o usuário e o e-mail (para o diagnóstico temporário do dono). */
export interface SessionDiag {
  userSource: 'monday' | 'vibe' | 'nenhuma';
  emailSource: 'monday (servidor)' | 'monday (navegador)' | 'monday (consulta no navegador)' | 'nenhuma';
  appMode: string;
  serverError?: string;
  sources?: { source: string; responded: boolean; emailDomain: string | null; ms: number; error?: string }[];
}

/** Primeiros 200 caracteres das mensagens do GraphQL (sem token). */
function graphqlErrorText(e: unknown, token: string): string {
  const err = e as { message?: string; response?: { errors?: { message?: string }[] }; cause?: { response?: { errors?: { message?: string }[] } } };
  const list = err?.response?.errors ?? err?.cause?.response?.errors ?? [];
  const msgs = list.map((x) => x?.message).filter(Boolean).join(' | ');
  let text = msgs || err?.message || 'falha na consulta';
  if (token) text = text.split(token).join('[token]');
  return text.slice(0, 200);
}

function domainOf(e: string | null | undefined): string | null {
  const v = normalizeEmail(e);
  const at = v.indexOf('@');
  return at > 0 ? `...${v.slice(at)}` : null;
}

const ME_TTL_MS = 60_000;
const meCache = new Map<string, { exp: number; me: { id: string; name: string; email: string; isAdmin: boolean; kind: string } | null }>();

/** Usuário do sessionToken verificado; nome, e-mail e tipo lidos com o token de serviço. */
async function mondayMeOnServer(_mode: string): Promise<{ me: { id: string; name: string; email: string; isAdmin: boolean; kind: string } | null; error?: string }> {
  const ctx = currentCtx();
  if (!ctx?.userId) return { me: null, error: 'sem sessão do monday' };
  const hit = meCache.get(ctx.userId);
  if (hit && hit.exp > Date.now()) return { me: hit.me };
  try {
    const r = await gql<{ users?: { id: string; name: string; email: string; kind: string }[] }>('query ($ids: [ID!]) { users(ids: $ids) { id name email kind } }', { ids: [ctx.userId] });
    const u = r.users?.[0];
    const me = u ? { id: String(u.id), name: u.name ?? '', email: normalizeEmail(u.email), isAdmin: u.kind === 'admin' || ctx.isAdmin, kind: u.kind ?? '' } : null;
    if (meCache.size > 500) meCache.clear();
    meCache.set(ctx.userId, { exp: Date.now() + ME_TTL_MS, me });
    return { me };
  } catch (e) {
    return { me: null, error: (e instanceof Error ? e.message : String(e)).slice(0, 200) };
  }
}

export interface UserSessionInfo {
  diag?: SessionDiag;
  id: string;
  name: string;
  email: string;
  isOwner: boolean;
  isAdmin: boolean;
  isPmo: boolean;
  canManage: boolean; // dono, admin do monday ou e-mail na lista do PMO
}

export async function readPmoEmails(): Promise<string[]> {
  try {
    // Com novas tentativas: numa falha momentânea o PMO perderia o acesso de gestão na abertura
    const doc = await dbReadWithRetry('pmo', () => db.collection(pmoConfigCollection).doc(PMO_CONFIG_DOC_ID).get());
    const emails = (doc?.data?.pmoEmails ?? []).map(normalizeEmail).filter(Boolean);
    return Array.from(new Set([OWNER_EMAIL, ...emails]));
  } catch (e) {
    console.error('Erro ao ler configuração de PMO:', e);
    return [OWNER_EMAIL];
  }
}

/**
 * Resolve o usuário logado e suas permissões (somente servidor).
 * Reconcilia o e-mail/identificação do usuário com o dono fixo, admins e a lista de PMO.
 */
export async function resolveSession(clientClaim?: {
  id?: string | number;
  email?: string;
  name?: string;
  isAdmin?: boolean;
  emailSource?: string;
}): Promise<UserSessionInfo> {
  const appMode = '';
  // Identidade do vibe (id e nome; não traz e-mail). Também valida o "me" do servidor:
  // se o token for compartilhado (app público), o id não bate com o visitante e é descartado.
  const tVibe = Date.now();
  const current = null as { id: string; name: string; kind?: string } | null;
  const vibeMs = Date.now() - tVibe;

  // 1) monday no servidor (token da sessão). Descartado só para visitante (app público, token compartilhado).
  const tSrv = Date.now();
  const rawServer = await mondayMeOnServer(appMode);
  const srvMs = Date.now() - tSrv;
  const server =
    rawServer.me && current?.kind === 'guest'
      ? { me: null, error: 'visitante: token do servidor não identifica a pessoa' }
      : rawServer;
  // 2) e-mail lido no navegador (contexto do monday ou consulta "me" feita no navegador)
  const claimEmail = normalizeEmail(clientClaim?.email);
  // 3) identidade do vibe
  const vibe = server.me ? null : current;

  const email = server.me?.email || claimEmail;
  const emailSource: SessionDiag['emailSource'] = server.me?.email
    ? 'monday (servidor)'
    : claimEmail
      ? clientClaim?.emailSource === 'me' ? 'monday (consulta no navegador)' : 'monday (navegador)'
      : 'nenhuma';
  const id = server.me?.id || (clientClaim?.id ? String(clientClaim.id) : '') || vibe?.id || '';
  const name = server.me?.name || clientClaim?.name || vibe?.name || 'Usuário';
  const mondayAdmin = server.me ? server.me.isAdmin : clientClaim?.isAdmin === true;
  const diag: SessionDiag = {
    userSource: server.me || clientClaim?.id ? 'monday' : vibe ? 'vibe' : 'nenhuma',
    emailSource,
    appMode: appMode || '(não informado)',
    ...(server.error && !server.me ? { serverError: server.error } : {}),
    sources: [
      { source: 'monday (servidor)', responded: Boolean(server.me), emailDomain: domainOf(server.me?.email), ms: srvMs, ...(server.me ? (server.me.email ? {} : { error: 'resposta sem e-mail' }) : { error: (server.error || 'sem resposta').slice(0, 200) }) },
      { source: 'usuário do Vibe', responded: Boolean(current), emailDomain: null, ms: vibeMs, error: current ? 'não informa e-mail' : 'sem usuário' },
    ],
  };

  // Sem e-mail legível não há acesso de gestão
  if (!email) {
    return { id, name, email: '', isOwner: false, isAdmin: false, isPmo: false, canManage: false, diag };
  }

  const isOwner = email === OWNER_EMAIL;
  const pmoEmails = await readPmoEmails();
  const isPmo = pmoEmails.includes(email);
  const isAdmin = isOwner || mondayAdmin;

  return { id, name, email, isOwner, isAdmin, isPmo, canManage: isOwner || mondayAdmin || isPmo, diag };
}

/**
 * Ações de escrita/apagar com token digitado: quando o e-mail da sessão não foi confirmado pelo servidor,
 * consulta me { email } com o token e exige que seja o mesmo e-mail e que a pessoa tenha gestão.
 */
export async function assertTokenOwner(session: UserSessionInfo, token: string | null | undefined): Promise<void> {
  if (!session.canManage) throw new Error('Apenas o dono, Administradores e membros do PMO podem fazer isso.');
  if (session.diag?.emailSource === 'monday (servidor)') return;
  const t = (token ?? '').trim();
  if (!t) throw new Error('Informe o token da API do monday para confirmar sua conta.');
  let tokenEmail = '';
  try {
    const res = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: t, 'API-Version': '2024-10' },
      body: JSON.stringify({ query: 'query { me { email } }' }),
    });
    const json = (await res.json().catch(() => null)) as { data?: { me?: { email?: string } } } | null;
    tokenEmail = normalizeEmail(json?.data?.me?.email);
  } catch {
    throw new Error('Não foi possível confirmar o token no monday. Tente novamente.');
  }
  if (!tokenEmail || tokenEmail !== normalizeEmail(session.email)) throw new Error('O token não pertence à sua conta');
}
