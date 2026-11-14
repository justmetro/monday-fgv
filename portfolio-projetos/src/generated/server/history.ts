import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { db } from '@vibe/db/server';
import { getCurrentUser } from '@api/current-user.server';
import { historyConfig, projects } from '@generated/models';
import type { ProjectDoc } from '@generated/models';
import { norm } from '@generated/lib/fields';
import { matchProjects } from '@generated/lib/history';
import { fetchBoardStructure } from './monday.server';
import { loadAll } from './sync.server';
import { CLEAR_META, getConfig, loadAllHistory, refreshMeta, setLink } from './history.server';

async function requireUser() {
  let u = await getCurrentUser().catch(() => null);
  if (!u) { await new Promise((r) => setTimeout(r, 400)); u = await getCurrentUser().catch(() => null); }
  // Identidade indisponível momentaneamente: segue com identificação neutra (usada só para registro).
  return u ?? { id: 'app', name: 'Aplicativo', kind: 'guest' as const };
}

export const getHistoryConfig = createServerFn({ method: 'GET' })
  .validator(z.object({}).optional())
  .handler(async () => (await getConfig())?.data ?? null);

/** Valida o acesso ao quadro (ID ou URL) e sugere colunas. */
export const inspectHistoryBoard = createServerFn({ method: 'POST' })
  .validator(z.object({ ref: z.string().min(1) }))
  .handler(async ({ data }) => {
    await requireUser();
    const id = data.ref.match(/boards\/(\d+)/)?.[1] ?? data.ref.match(/\d{5,}/)?.[0];
    if (!id) throw new Error('Informe um ID numérico ou a URL do quadro.');
    const s = await fetchBoardStructure(id);
    const cols = s.columns.filter((c) => c.type !== 'name' && c.type !== 'subtasks');
    const find = (pred: (t: string, type: string) => boolean) => cols.find((c) => pred(norm(c.title), c.type))?.id ?? null;
    const saved = (await getConfig())?.data;
    const same = saved?.boardId === s.id ? saved : null;
    return {
      id: s.id, name: s.name, url: s.url, workspaceName: s.workspaceName,
      columns: cols.map((c) => ({ id: c.id, title: c.title, type: c.type })),
      suggested: {
        statusCol: same?.statusCol ?? find((t) => t.includes('status do projeto')) ?? find((t, ty) => ty === 'status' && t.includes('status')),
        managerCol: same?.managerCol ?? find((t) => t.includes('gerente atual')) ?? find((t) => t.includes('gerente')),
        axesCol: same?.axesCol ?? find((t) => t.includes('eixo')),
        codeCol: same?.codeCol ?? find((t) => t.includes('codigo')),
      },
    };
  });

const opt = z.string().nullable();
export const saveHistoryConfig = createServerFn({ method: 'POST' })
  .validator(z.object({ boardId: z.string().min(1), boardName: z.string(), boardUrl: z.string(), statusCol: opt, managerCol: opt, axesCol: opt, codeCol: opt }))
  .handler(async ({ data }) => {
    const u = await requireUser();
    const cur = await getConfig();
    const doc = { ...data, savedAt: new Date().toISOString(), savedBy: u.id };
    if (cur) await db.collection(historyConfig).doc(cur.id).set(doc);
    else await db.collection(historyConfig).add(doc);
    return doc;
  });

/** Elementos do Histórico (leitura paginada completa) + proposta de correspondência por projeto. */
export const getHistoryMatches = createServerFn({ method: 'POST' })
  .validator(z.object({}).optional())
  .handler(async () => {
    await requireUser();
    const cfg = (await getConfig())?.data;
    if (!cfg) throw new Error('Configure o quadro Histórico de Projetos primeiro.');
    const [items, all] = await Promise.all([loadAllHistory(cfg), loadAll<ProjectDoc>(projects)]);
    return { items, matches: matchProjects(all.map((p) => p.data), items) };
  });

/** Grava os vínculos confirmados na prévia e marca os demais como pendentes. */
export const confirmLinks = createServerFn({ method: 'POST' })
  .validator(z.object({ links: z.array(z.object({ boardId: z.string(), itemId: z.string() })), pending: z.array(z.object({ boardId: z.string(), reason: z.string() })) }))
  .handler(async ({ data }) => {
    await requireUser();
    const cfg = (await getConfig())?.data;
    if (!cfg) throw new Error('Histórico não configurado.');
    const items = await loadAllHistory(cfg);
    const all = await loadAll<ProjectDoc>(projects);
    for (const l of data.links) {
      const it = items.find((h) => h.id === l.itemId);
      if (it) await setLink(l.boardId, it, 'code', false);
    }
    for (const p of data.pending) {
      const d = all.find((x) => x.data.boardId === p.boardId);
      if (d && d.data.hLink !== 'confirmed') await db.collection(projects).doc(d.id).update({ hLink: 'pending', hPendingReason: p.reason });
    }
    const r = data.links.length ? await refreshMeta(data.links.map((l) => l.boardId)) : { results: [], error: null };
    return { linked: data.links.length, pending: data.pending.length, metaErrors: r.results.filter((x) => !x.ok).length };
  });

export const linkManual = createServerFn({ method: 'POST' })
  .validator(z.object({ boardId: z.string(), itemId: z.string(), allowShared: z.boolean() }))
  .handler(async ({ data }) => {
    await requireUser();
    const cfg = (await getConfig())?.data;
    if (!cfg) throw new Error('Histórico não configurado.');
    const all = await loadAll<ProjectDoc>(projects);
    const others = all.filter((p) => p.data.boardId !== data.boardId && p.data.hLink === 'confirmed' && p.data.hItemId === data.itemId);
    if (others.length && !data.allowShared) return { ok: false as const, sharedWith: others.map((o) => o.data.name) };
    const items = await loadAllHistory(cfg);
    const it = items.find((h) => h.id === data.itemId);
    if (!it) throw new Error('Elemento não encontrado no Histórico.');
    await setLink(data.boardId, it, 'manual', others.length > 0);
    const r = await refreshMeta([data.boardId]);
    return { ok: true as const, meta: r.results[0] ?? null };
  });

export const unlinkProject = createServerFn({ method: 'POST' })
  .validator(z.object({ boardId: z.string() }))
  .handler(async ({ data }) => {
    await requireUser();
    const all = await loadAll<ProjectDoc>(projects);
    const p = all.find((x) => x.data.boardId === data.boardId);
    if (!p) throw new Error('Projeto não encontrado.');
    // Remove somente os metadados derivados do Histórico; indicadores e medições não são tocados.
    await db.collection(projects).doc(p.id).update({ ...CLEAR_META, hLink: 'pending', hPendingReason: 'unlinked', hLastMessage: 'Vínculo removido manualmente.' });
    return { ok: true };
  });

export const refreshHistoryMeta = createServerFn({ method: 'POST' })
  .validator(z.object({ boardIds: z.array(z.string()).optional() }))
  .handler(async ({ data }) => {
    await requireUser();
    return refreshMeta(data.boardIds);
  });
