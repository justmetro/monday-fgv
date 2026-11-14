import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { db } from '@vibe/db/server';
import { getCurrentUser } from '@api/current-user.server';
import { indicators, measurements, products, projects, risks, scheduleItems, scheduleSubitems, syncLogs } from '@generated/models';
import type { IndicatorDoc, MeasurementDoc, ProductDoc, ProjectDoc, RiskDoc, ScheduleItemDoc, ScheduleSubitemDoc, SyncLogDoc } from '@generated/models';
import { fetchBoardStructure, fetchBoards, fetchWorkspaces } from './monday.server';
import { autoLink, refreshMeta } from './history.server';
import { SUB_PART, syncSubitemsPart } from './sync-subs.server';
import { findProject, loadAll, loadWhere, readSource, refreshNoIndicator, retry, syncProject, type OpsColl } from './sync.server';

const strs = z.array(z.string());
const cols = z.record(z.string(), z.string());
const groupKey = z.enum(['ind', 'med', 'sched', 'prod', 'risk']);
const subModeSchema = z.enum(['skip', 'only']);
const cfgSchema = z.object({
  indicatorGroupId: z.string(),
  measurementGroupId: z.string(),
  indicatorCols: cols,
  measurementCols: cols,
  status: z.object({ concluded: strs, excluded: strs, reached: strs, notReached: strs }),
  scheduleGroupId: z.string().optional(),
  scheduleCols: cols.optional(),
  importSubitems: z.boolean().optional(),
  subitemCols: cols.optional(),
  productGroupId: z.string().optional(),
  productCols: cols.optional(),
  riskGroupId: z.string().optional(),
  riskCols: cols.optional(),
  scheduleStatus: z.object({ concluded: strs, excluded: strs, healthOk: strs, healthWarn: strs, healthBad: strs }).optional(),
  productStatus: z.object({ delivered: strs, paid: strs }).optional(),
  riskStatus: z.object({ levels: strs, probability: strs, impact: strs, staleDays: z.number().int().min(1).max(3650) }).optional(),
});

async function requireUser() {
  let u = await getCurrentUser().catch(() => null);
  if (!u) { await new Promise((r) => setTimeout(r, 400)); u = await getCurrentUser().catch(() => null); }
  // Identidade indisponível momentaneamente: segue com identificação neutra (usada só para registro).
  return u ?? { id: 'app', name: 'Aplicativo', kind: 'guest' as const };
}

export const listWorkspaces = createServerFn({ method: 'GET' })
  .validator(z.object({}).optional())
  .handler(async () => fetchWorkspaces());

export const listBoards = createServerFn({ method: 'GET' })
  .validator(z.object({ workspaceId: z.string() }))
  .handler(async ({ data }) => fetchBoards(data.workspaceId));

export const getStructure = createServerFn({ method: 'GET' })
  .validator(z.object({ boardId: z.string() }))
  .handler(async ({ data }) => {
    const s = await fetchBoardStructure(data.boardId);
    const existing = await findProject(data.boardId);
    return { ...s, savedConfig: existing?.data.config || null, noIndicators: !!existing?.data.noIndicators };
  });

export const saveNoIndicatorProject = createServerFn({ method: 'POST' })
  .validator(z.object({ boardId: z.string() }))
  .handler(async ({ data }) => {
    const u = await requireUser();
    const r = await refreshNoIndicator(data.boardId, u.id);
    return { ...r, history: await autoLink(data.boardId) };
  });

export const setProjectEnabled = createServerFn({ method: 'POST' })
  .validator(z.object({ boardId: z.string(), enabled: z.boolean() }))
  .handler(async ({ data }) => {
    await requireUser();
    const p = await findProject(data.boardId);
    if (!p) throw new Error('Projeto não encontrado.');
    await db.collection(projects).doc(p.id).update({ enabled: data.enabled });
    return { ok: true };
  });

export const previewImport = createServerFn({ method: 'POST' })
  .validator(z.object({ boardId: z.string(), config: cfgSchema, groups: z.array(groupKey).optional(), subMode: subModeSchema.optional() }))
  .handler(async ({ data }) => {
    // Prévia em etapas (o assistente chama uma vez por grupo) para não exceder o tempo limite.
    // Subelementos: a prévia lê só uma amostra (as primeiras atividades); a gravação lê tudo, em partes.
    const src = await readSource(data.boardId, data.config, data.groups, data.subMode, data.subMode === 'only' ? SUB_PART : undefined);
    const inds = src.inds ?? [];
    const meds = src.meds ?? [];
    const indIds = new Set(inds.map((i) => i.itemId));
    const unresolved = src.inds && src.meds ? meds
      .filter((m) => m.indicadorIds.length === 0 || m.indicadorIds.some((id) => !indIds.has(id)))
      .map((m) => ({ itemId: m.itemId, name: m.name, motivo: m.indicadorIds.length === 0 ? 'Sem indicador vinculado' : 'Vinculada a item fora do grupo de indicadores' })) : [];
    const distinct = (vals: (string | null)[]) => [...new Set(vals.filter((v): v is string => !!v))];
    const prodIds = new Set((src.prods ?? []).map((p) => p.itemId));
    const prodLinks = (list: { itemId: string; name: string; produtoIds: string[]; unmapped: string[] }[] | undefined, what: string) =>
      (list ?? []).filter((x) => !x.unmapped.includes('produto') && (x.produtoIds.length === 0 || (src.prods && x.produtoIds.some((id) => !prodIds.has(id)))))
        .map((x) => ({ itemId: x.itemId, name: x.name, motivo: x.produtoIds.length === 0 ? `${what} sem produto vinculado` : 'Vinculada a item fora do grupo de produtos' }));
    const unav = (list: { unavailable: string[] }[] | undefined) => distinct((list ?? []).flatMap((x) => x.unavailable));
    return {
      projectName: src.board.name,
      workspaceName: src.board.workspaceName,
      indicatorCount: inds.length,
      measurementCount: meds.length,
      hasIndicators: !!src.inds && !!src.meds,
      unresolved,
      sampleIndicators: inds.slice(0, 3),
      sampleMeasurements: meds.slice(0, 3),
      statusMedicaoValues: distinct(meds.map((m) => m.statusMedicao)),
      statusMetaValues: distinct(meds.map((m) => m.statusMeta)),
      unavailableFields: distinct([...inds, ...meds].flatMap((x) => x.unavailable)),
      sched: src.sched && data.config.scheduleGroupId ? {
        count: src.sched.length, subCount: src.subs?.length ?? 0, sample: src.sched.slice(0, 3), sampleSubs: (src.subs ?? []).slice(0, 3),
        unresolved: [...prodLinks(src.sched, 'Atividade'), ...prodLinks(src.subs, 'Subatividade')],
        unavailable: distinct([...unav(src.sched), ...unav(src.subs).map((f) => `sub.${f}`)]),
        statusValues: distinct([...src.sched, ...(src.subs ?? [])].map((x) => x.status)), healthValues: distinct(src.sched.map((x) => x.saude)),
      } : null,
      subs: src.subs && data.config.scheduleGroupId && data.config.importSubitems ? {
        count: src.subs.length, sample: src.subs.slice(0, 3), unresolved: prodLinks(src.subs, 'Subatividade'),
        unavailable: unav(src.subs).map((f) => `sub.${f}`), statusValues: distinct(src.subs.map((x) => x.status)),
      } : null,
      prods: src.prods && data.config.productGroupId ? {
        count: src.prods.length, sample: src.prods.slice(0, 3), unavailable: unav(src.prods),
        statusValues: distinct(src.prods.map((x) => x.status)), payValues: distinct(src.prods.map((x) => x.statusPagamento)),
      } : null,
      risks: src.risks && data.config.riskGroupId ? {
        count: src.risks.length, sample: src.risks.slice(0, 3), unavailable: unav(src.risks),
        levelValues: distinct(src.risks.map((x) => x.nivel)), probValues: distinct(src.risks.map((x) => x.probabilidadeStatus)), impValues: distinct(src.risks.map((x) => x.impactoStatus)),
      } : null,
    };
  });

export const saveImport = createServerFn({ method: 'POST' })
  .validator(z.object({ boardId: z.string(), config: cfgSchema, groups: z.array(groupKey).optional(), subMode: subModeSchema.optional(), link: z.boolean().optional() }))
  .handler(async ({ data }) => {
    const u = await requireUser();
    // Salvamento em etapas (um grupo por requisição) para não exceder o tempo limite do servidor.
    const r = await syncProject(data.boardId, data.config, u.id, data.groups, data.subMode);
    // Falha no Histórico não impede a importação dos indicadores.
    return { ...r, history: data.link === false ? null : await autoLink(data.boardId) };
  });



/** Subelementos do Cronograma em partes; o navegador chama de novo com `next` até vir null. */
export const saveSubitemsPart = createServerFn({ method: 'POST' })
  .validator(z.object({ boardId: z.string(), config: cfgSchema.optional(), offset: z.number().int().min(0) }))
  .handler(async ({ data }) => {
    await requireUser();
    return syncSubitemsPart(data.boardId, data.config ?? null, data.offset);
  });

export const refreshProject = createServerFn({ method: 'POST' })
  .validator(z.object({ boardId: z.string(), groups: z.array(groupKey).optional(), subMode: subModeSchema.optional(), history: z.boolean().optional() }))
  .handler(async ({ data }) => {
    const u = await requireUser();
    // Sem pré-checagem: a leitura real classifica a falha (sessão, negado, restrição, vazio, temporária).
    let r: { ok: boolean; summary: string };
    try { r = await syncProject(data.boardId, null, u.id, data.groups?.length ? data.groups : undefined, data.subMode); }
    catch (e) { r = { ok: false, summary: e instanceof Error ? e.message : 'Falha na atualização dos indicadores.' }; }
    // Cadastro do projeto (Histórico) atualizado separadamente: uma falha não impede a outra.
    let history: { ok: boolean; summary: string } | null = null;
    try {
      const p = data.history === false ? null : await findProject(data.boardId);
      if (p?.data.hLink === 'confirmed') {
        const h = await refreshMeta([data.boardId]);
        const x = h.results[0];
        history = x ? { ok: x.ok, summary: x.summary } : { ok: false, summary: h.error ?? 'Cadastro não atualizado.' };
      }
    } catch (e) {
      console.error('[histórico] atualização do cadastro falhou', e);
      history = { ok: false, summary: 'Falha ao atualizar o cadastro; dados anteriores preservados.' };
    }
    return { ok: r.ok, summary: r.summary, history };
  });

export const refreshAll = createServerFn({ method: 'POST' })
  .validator(z.object({}).optional())
  .handler(async () => {
    const u = await requireUser();
    const list = await loadAll<ProjectDoc>(projects);
    const results: { boardId: string; name: string; ok: boolean; summary: string }[] = [];
    for (const p of list) {
      const r = await syncProject(p.data.boardId, null, u.id);
      results.push({ boardId: p.data.boardId, name: p.data.name, ...r });
    }
    return results;
  });

/** Exclui o projeto e todos os seus registros salvos no aplicativo. Não altera o quadro de origem. */
export const deleteProject = createServerFn({ method: 'POST' })
  .validator(z.object({ boardId: z.string().min(1) }))
  .handler(async ({ data }) => {
    await requireUser();
    const [inds, meds, proj] = await Promise.all([
      loadWhere<IndicatorDoc>(indicators, 'projectBoardId', data.boardId),
      loadWhere<MeasurementDoc>(measurements, 'projectBoardId', data.boardId),
      findProject(data.boardId),
    ]);
    const logs = await db.collection(syncLogs).where('projectBoardId', '==', data.boardId).limit(1000).get();
    const del = async (ids: string[], coll: typeof indicators | typeof measurements | typeof syncLogs) => {
      for (let i = 0; i < ids.length; i += 10) {
        await Promise.all(ids.slice(i, i + 10).map((id) => db.collection(coll as never).doc(id).delete()));
      }
    };
    await del(inds.map((d) => d.id), indicators);
    await del(meds.map((d) => d.id), measurements);
    // Registros dos grupos operacionais (Cronograma, Subelementos, Produtos, Riscos).
    for (const coll of [scheduleItems, scheduleSubitems, products, risks] as OpsColl[]) {
      const docs = await loadWhere<{ itemId: string }>(coll, 'projectBoardId', data.boardId);
      await del(docs.map((d) => d.id), coll as never);
    }
    await del(logs.map((d) => d.id), syncLogs);
    if (proj) await db.collection(projects).doc(proj.id).delete();
    return { ok: true as const, indicadores: inds.length, medicoes: meds.length };
  });

export const listProjects = createServerFn({ method: 'GET' })
  .validator(z.object({}).optional())
  .handler(async () => {
    // Dados salvos no aplicativo são visíveis a todos os usuários do app (leitura).
    const list = await loadAll<ProjectDoc>(projects);
    return list.map((p) => ({ docId: p.id, ...p.data }));
  });

export const getSyncLogs = createServerFn({ method: 'GET' })
  .validator(z.object({ boardId: z.string() }))
  .handler(async ({ data }) => {
    const docs = await db.collection(syncLogs).where('projectBoardId', '==', data.boardId).orderBy('at', 'desc').limit(20).get();
    return docs.map((d) => d.data as SyncLogDoc);
  });

/** Base completa salva (somente registros ativos) dos projetos que o usuário pode acessar. */
/**
 * Versão dos dados salvos: muda sempre que algum projeto é atualizado, ativado/desativado ou tem
 * o cadastro alterado. Leitura leve (só a lista de projetos) — os painéis usam o cache local enquanto ela não muda.
 */
export const getDataVersion = createServerFn({ method: 'GET' })
  .validator(z.object({}).optional())
  .handler(async () => {
    const list = await loadAll<ProjectDoc>(projects);
    const sig = list
      .map((p) => [p.data.boardId, p.data.enabled !== false, p.data.lastSuccessAt, p.data.syncStatus, p.data.hStatus ?? '', p.data.config.length].join('|'))
      .sort().join(';');
    let h = 0;
    for (let i = 0; i < sig.length; i++) h = (Math.imul(31, h) + sig.charCodeAt(i)) | 0;
    return { version: `${list.length}-${(h >>> 0).toString(36)}` };
  });

export const getDataset = createServerFn({ method: 'GET' })
  .validator(z.object({}).optional())
  .handler(async () => {
    // Somente projetos ativos entram nas visões de análise.
    const list = (await loadAll<ProjectDoc>(projects)).filter((p) => p.data.enabled !== false);
    const allowed = new Set(list.map((p) => p.data.boardId));
    const [inds, meds] = await Promise.all([loadAll<IndicatorDoc>(indicators), loadAll<MeasurementDoc>(measurements)]);
    return {
      projects: list.map((p) => p.data),
      indicators: inds.map((d) => d.data).filter((d) => d.active && allowed.has(d.projectBoardId)),
      measurements: meds.map((d) => d.data).filter((d) => d.active && allowed.has(d.projectBoardId)),
      loadedAt: new Date().toISOString(),
    };
  });

/**
 * Base dos grupos operacionais (somente ativos, de projetos ativos). Carregada só nas telas que a usam,
 * para não aumentar o tempo de carga das telas de indicadores.
 */
export const getOpsDataset = createServerFn({ method: 'GET' })
  .validator(z.object({}).optional())
  .handler(async () => {
    const list = (await loadAll<ProjectDoc>(projects)).filter((p) => p.data.enabled !== false);
    return { projects: list.map((p) => p.data), loadedAt: new Date().toISOString() };
  });

/**
 * Uma coleção por requisição (somente ativos de projetos ativos): mantém cada resposta pequena,
 * abaixo do limite de tamanho do servidor. Subelementos, os mais numerosos, vêm paginados.
 */
let activeCache: { at: number; ids: Set<string> } | null = null;
export const getOpsPart = createServerFn({ method: 'GET' })
  .validator(z.object({ part: z.enum(['schedule', 'subitems', 'products', 'risks']), cursor: z.string().optional() }))
  .handler(async ({ data }) => {
    // Uma única página do banco por chamada (resposta pequena e rápida); o cliente segue o cursor.
    // Projetos ativos em cache curto: evita reler a coleção inteira a cada página (sobrecarga do banco).
    if (!activeCache || Date.now() - activeCache.at > 60_000) {
      const list = (await retry(() => loadAll<ProjectDoc>(projects))).filter((p) => p.data.enabled !== false);
      activeCache = { at: Date.now(), ids: new Set(list.map((p) => p.data.boardId)) };
    }
    const allowed = activeCache.ids;
    const coll = { schedule: scheduleItems, products, risks, subitems: scheduleSubitems }[data.part];
    const page = await retry(() => {
      let q = db.collection(coll as never).limit(400);
      if (data.cursor) q = q.startAfter(data.cursor);
      return q.getPage();
    });
    type Row = ScheduleItemDoc | ScheduleSubitemDoc | ProductDoc | RiskDoc;
    const rows = (page.docs as unknown as { data: Row }[])
      .map((d) => d.data)
      .filter((d) => d.active && allowed.has(d.projectBoardId));
    return { rows, cursor: (page.cursor as string | undefined) ?? null };
  });
