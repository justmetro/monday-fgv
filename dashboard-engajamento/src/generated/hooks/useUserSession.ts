import { useCallback, useEffect, useState } from 'react';
import { getUserSession, type UserSessionInfo } from '@generated/server/storage';
import { errorText } from '@generated/lib/errorText';
import { useMondayContext, mondayClient } from '@/context/MondayContextProvider';

// Tempo máximo esperando o monday informar o usuário antes de seguir sem ele
const CONTEXT_WAIT_MS = 8000;
const ME_TIMEOUT_MS = 8000;
const ME_ATTEMPTS = 2;

/** Uma linha do diagnóstico por fonte (sem e-mail completo, tokens ou ids). */
export interface SessionSourceDiag { source: string; responded: boolean; emailDomain: string | null; ms: number; error?: string }

const domainOf = (e: string | null | undefined) => {
  const v = (e ?? '').replace(/\s+/g, '').toLowerCase();
  const at = v.indexOf('@');
  return at > 0 && v.length > at + 1 ? `...${v.slice(at)}` : null;
};
const validEmail = (e: unknown) => {
  const v = String(e ?? '').replace(/\s+/g, '').toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? v : '';
};

/** Primeiros 200 caracteres das mensagens de erro do GraphQL. */
function gqlText(errors: { message?: string }[] | undefined): string {
  return (errors ?? []).map((x) => x?.message).filter(Boolean).join(' | ').slice(0, 200);
}

/** Consulta "me" pelo SDK do monday no navegador, com até 2 tentativas de 8s. */
async function readMeInBrowser(): Promise<{ me: { id?: string; name?: string; email?: string; isAdmin?: boolean } | null; diag: SessionSourceDiag }> {
  const t0 = Date.now();
  let lastError = '';
  for (let attempt = 1; attempt <= ME_ATTEMPTS; attempt++) {
    try {
      const monday = mondayClient;
      // 1ª chamada mínima
      const res = (await Promise.race([
        monday.api('query { me { id name email } }'),
        new Promise((resolve) => setTimeout(() => resolve('timeout'), ME_TIMEOUT_MS)),
      ])) as 'timeout' | { data?: { me?: { id?: string | number; name?: string; email?: string } }; errors?: { message?: string }[] } | null;
      if (res === 'timeout') { lastError = `sem resposta em ${ME_TIMEOUT_MS / 1000}s`; continue; }
      const me = res?.data?.me;
      if (!me) { lastError = gqlText(res?.errors) || 'resposta sem usuário'; continue; }
      const email = validEmail(me.email);
      // 2ª chamada separada: falha = "não admin"
      let isAdmin = false;
      try {
        const a = (await Promise.race([
          monday.api('query { me { is_admin } }'),
          new Promise((resolve) => setTimeout(() => resolve(null), ME_TIMEOUT_MS)),
        ])) as { data?: { me?: { is_admin?: boolean } } } | null;
        isAdmin = a?.data?.me?.is_admin === true;
      } catch { isAdmin = false; }
      const out = { id: me.id ? String(me.id) : undefined, name: me.name, email: email || undefined, isAdmin };
      if (!email && attempt < ME_ATTEMPTS) { lastError = 'resposta sem e-mail'; continue; }
      return { me: out, diag: { source: 'monday (consulta "me" no navegador)', responded: true, emailDomain: domainOf(email), ms: Date.now() - t0, ...(email ? {} : { error: 'resposta sem e-mail' }) } };
    } catch (e) {
      const err = e as { message?: string; errors?: { message?: string }[]; data?: { errors?: { message?: string }[] } };
      lastError = gqlText(err?.errors ?? err?.data?.errors) || err?.message || 'falha na consulta';
    }
    lastError = lastError.slice(0, 200);
  }
  return { me: null, diag: { source: 'monday (consulta "me" no navegador)', responded: false, emailDomain: null, ms: Date.now() - t0, error: lastError || 'falha' } };
}

export function useUserSession() {
  const [session, setSession] = useState<UserSessionInfo | null>(null);
  const [sources, setSources] = useState<SessionSourceDiag[]>([]);
  const [loading, setLoading] = useState(true);
  const { context, isLoading: contextLoading } = useMondayContext();
  const [waitExpired, setWaitExpired] = useState(false);
  const [openedAt] = useState(() => Date.now());

  // Na abertura sem "Editar App" o contexto do monday pode demorar
  useEffect(() => {
    if (!contextLoading) return;
    const t = setTimeout(() => setWaitExpired(true), CONTEXT_WAIT_MS);
    return () => clearTimeout(t);
  }, [contextLoading]);

  const ready = Boolean(context?.user) || !contextLoading || waitExpired;

  const load = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    const diags: SessionSourceDiag[] = [];
    try {
      const claim: { id?: string | number; email?: string; name?: string; isAdmin?: boolean; emailSource?: string } = {};

      // 1) contexto do monday
      const u = (context?.user ?? null) as Record<string, unknown> | null;
      const ctxEmail = validEmail(u?.email);
      if (u) {
        if (u.id) claim.id = String(u.id);
        if (ctxEmail) { claim.email = ctxEmail; claim.emailSource = 'contexto'; }
        if (u.name) claim.name = String(u.name);
        if (u.isAdmin !== undefined) claim.isAdmin = Boolean(u.isAdmin);
        if (u.is_admin !== undefined) claim.isAdmin = Boolean(u.is_admin);
      }
      diags.push({ source: 'monday (contexto)', responded: Boolean(u), emailDomain: domainOf(ctxEmail), ms: Date.now() - openedAt, ...(u ? (ctxEmail ? {} : { error: 'contexto sem e-mail' }) : { error: waitExpired ? 'sem resposta' : 'contexto vazio' }) });

      // 2) consulta "me" do monday no navegador
      if (!claim.email) {
        const { me, diag } = await readMeInBrowser();
        diags.push(diag);
        if (me?.email) {
          claim.email = me.email;
          claim.emailSource = 'me';
          if (!claim.id && me.id) claim.id = me.id;
          if (!claim.name && me.name) claim.name = me.name;
          if (claim.isAdmin === undefined && me.isAdmin !== undefined) claim.isAdmin = me.isAdmin;
        }
      }

      // 3) servidor: monday no servidor e usuário do Vibe
      // Falha temporária do gateway (502/503/504): tenta de novo antes de desistir
      let res: Awaited<ReturnType<typeof getUserSession>> | null = null;
      let lastErr: unknown = null;
      for (let attempt = 0; attempt < 3 && !res; attempt++) {
        try {
          res = await getUserSession({ data: claim });
        } catch (err) {
          lastErr = err;
          const transient = errorText(err).startsWith('O servidor ficou indisponível');
          if (!transient || attempt === 2) break;
          await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        }
      }
      if (!res) throw lastErr ?? new Error('Falha ao carregar a sessão.');
      setSession(res);
    } catch (e) {
      console.error('Erro ao carregar sessão do usuário:', errorText(e));
      diags.push({ source: 'servidor do app', responded: false, emailDomain: null, ms: 0, error: errorText(e, 'falha').slice(0, 120) });
      setSession({ id: '', name: 'Usuário', email: '', isOwner: false, isAdmin: false, isPmo: false, canManage: false });
    } finally {
      setSources(diags);
      setLoading(false);
    }
  }, [context, ready, waitExpired, openedAt]);

  useEffect(() => {
    void load();
  }, [load]);

  const editMode = Boolean((context as Record<string, unknown> | null)?.editMode);
  return { session, loading: loading || !ready, refreshSession: load, editMode, sources };
}
