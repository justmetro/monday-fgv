import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { db } from '@vibe/db/server';
import { getCurrentUser } from '@api/current-user.server';
import { userTokens } from '@generated/models';
import { findTokenDoc, requestWithToken } from './user-token.server';
import { setUserToken, deleteUserToken } from '@shims/server/secrets';
import { describeError } from './access-errors.server';

async function me() {
  const u = await getCurrentUser();
  if (!u) throw new Error('Sessão não identificada. Abra o aplicativo dentro da Monday.');
  return u;
}

/** Status apenas — o token nunca é devolvido. */
export const getTokenStatus = createServerFn({ method: 'GET' })
  .validator(z.object({}).optional())
  .handler(async () => {
    const u = await me();
    const d = await findTokenDoc(u.id);
    return d ? { configured: true as const, mondayName: d.data.mondayName, savedAt: d.data.savedAt } : { configured: false as const, mondayName: null, savedAt: null };
  });

export const saveToken = createServerFn({ method: 'POST' })
  .validator(z.object({ token: z.string().trim().min(20).max(2000) }))
  .handler(async ({ data }) => {
    const u = await me();
    let who: { id: string; name: string } | null = null;
    try {
      const r = (await requestWithToken(data.token, 'query{ me{ id name } }')) as { me?: { id: string | number; name: string } } | null;
      who = r?.me ? { id: String(r.me.id), name: r.me.name } : null;
    } catch (e) {
      const d = describeError(e);
      throw new Error(`Token recusado pela Monday (${d.platformMessage ?? 'erro desconhecido'}).`);
    }
    if (!who) throw new Error('A Monday não retornou o usuário deste token.');
    // Impede usar o token de outra pessoa (ex.: de um administrador): precisa ser do próprio usuário.
    // A sessão pode trazer o id em outro formato (ex.: prefixado); compara só a parte numérica.
    const num = (s: string) => s.match(/\d+/g)?.join('') ?? s;
    const sameName = !!u.name && u.name.trim().toLowerCase() === who.name.trim().toLowerCase();
    // Sessão de visitante (app aberto sem identificação da Monday): não há id para comparar; o token
    // já foi validado pela própria Monday e fica vinculado só a esta sessão.
    if (u.kind !== 'guest' && num(who.id) !== num(String(u.id)) && !sameName) {
      console.error('[token] usuário divergente', { sessao: String(u.id), sessaoTipo: u.kind, token: who.id });
      throw new Error('Este token pertence a outro usuário da Monday. Use o token do seu próprio perfil.');
    }
    await setUserToken(u.id, data.token);
    const doc = { userId: u.id, token: '', mondayName: who.name, savedAt: new Date().toISOString() };
    const ex = await findTokenDoc(u.id);
    if (ex) await db.collection(userTokens).doc(ex.id).set(doc);
    else await db.collection(userTokens).add(doc);
    return { mondayName: who.name, savedAt: doc.savedAt };
  });

export const removeToken = createServerFn({ method: 'POST' })
  .validator(z.object({}).optional())
  .handler(async () => {
    const u = await me();
    const ex = await findTokenDoc(u.id);
    if (ex) await db.collection(userTokens).doc(ex.id).delete();
    await deleteUserToken(u.id);
    return { ok: true };
  });
