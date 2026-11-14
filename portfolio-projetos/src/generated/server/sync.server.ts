import { AccessError } from './access-errors.server';
import { db } from '@vibe/db/server';
import type { VibeDoc } from '@vibe/db/server';
import { indicators, measurements, products, projects, risks, scheduleItems, scheduleSubitems, syncLogs } from '@generated/models';
import type { IndicatorDoc, MeasurementDoc, ProjectDoc, ScheduleItemDoc, ScheduleSubitemDoc } from '@generated/models';
import { GROUP_LABEL, groupIdOf, type GroupKey, type ProjectConfig } from '@generated/lib/fields';
import type { SubMode } from '@generated/lib/stages';
import { fetchBoardStructure, fetchGroupItems } from './monday.server';
import { colIds, toIndicator, toMeasurement } from './extract.server';
import { idsOf, toProduct, toRisk, toScheduleItem, toSubitem } from './extract-ops.server';
import { flagProduct, flagRisk, flagSchedule } from './flags-ops.server';

export type OpsColl = typeof scheduleItems | typeof scheduleSubitems | typeof products | typeof risks;
type Coll = typeof indicators | typeof measurements | typeof projects | OpsColl;
export type GroupSync = Partial<Record<GroupKey | 'sub', { status: 'ok' | 'error' | 'off'; message: string; at: string }>>;

export async function loadWhere<T>(coll: Coll, field: string, value: string): Promise<VibeDoc<T>[]> {
  const out: VibeDoc<T>[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 200; i++) {
    let q = db.collection(coll as never).where(field, '==', value).limit(1000);
    if (cursor) q = q.startAfter(cursor);
    const page = await q.getPage();
    out.push(...(page.docs as unknown as VibeDoc<T>[]));
    cursor = page.cursor;
    if (!cursor) break;
  }
  return out;
}

export async function loadAll<T>(coll: Coll): Promise<VibeDoc<T>[]> {
  const out: VibeDoc<T>[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 500; i++) {
    let q = db.collection(coll as never).limit(1000);
    if (cursor) q = q.startAfter(cursor);
    const page = await q.getPage();
    out.push(...(page.docs as unknown as VibeDoc<T>[]));
    cursor = page.cursor;
    if (!cursor) break;
  }
  return out;
}

export async function inChunks<T>(list: T[], fn: (x: T) => Promise<unknown>, size = 8) {
  for (let i = 0; i < list.length; i += size) await Promise.all(list.slice(i, i + size).map(fn));
}

export async function findProject(boardId: string): Promise<VibeDoc<ProjectDoc> | null> {
  const r = await loadWhere<ProjectDoc>(projects, 'boardId', boardId);
  return r[0] ?? null;
}

export function parseGroupSync(raw: string | undefined): GroupSync {
  try { return raw ? (JSON.parse(raw) as GroupSync) : {}; } catch { return {}; }
}

/**
 * Leitura completa (sem gravar). Lança erro se qualquer parte falhar.
 * Só lê os grupos configurados (e, se `only` vier, apenas esses). Resultado undefined = grupo não lido;
 * [] = grupo desconfigurado (registros anteriores serão inativados).
 */
/** maxParents: só na prévia — lê os subelementos apenas das primeiras atividades (amostra). */
export async function readSource(boardId: string, cfg: ProjectConfig, only?: GroupKey[], subMode?: SubMode, maxParents?: number) {
  const t0 = Date.now();
  const board = await fetchBoardStructure(boardId);
  const gids = new Set(board.groups.map((g) => g.id));
  const want = (g: GroupKey) => !!groupIdOf(cfg, g) && (!only || only.includes(g));
  const clear = (g: GroupKey) => !groupIdOf(cfg, g) && !only;
  const keys: GroupKey[] = ['ind', 'med', 'sched', 'prod', 'risk'];
  for (const g of keys) if (want(g) && !gids.has(groupIdOf(cfg, g))) throw new Error(`O grupo de ${GROUP_LABEL[g].toLowerCase()} configurado não existe mais no quadro. Refaça o mapeamento.`);
  const cols = new Set(board.columns.map((c) => c.id));
  const colsOf: Record<GroupKey, string[]> = {
    ind: colIds(cfg, 'indicator'), med: colIds(cfg, 'measurement'),
    sched: idsOf(cfg.scheduleCols), prod: idsOf(cfg.productCols), risk: idsOf(cfg.riskCols),
  };
  const missing = keys.filter(want).flatMap((g) => colsOf[g].filter((c) => !cols.has(c)).map((c) => `${GROUP_LABEL[g]} · ${c}`));
  const subOnly = subMode === 'only';
  const withSub = want('sched') && !!cfg.importSubitems && subMode !== 'skip';
  if (withSub) {
    if (!board.subitemBoardId) throw new Error('Este quadro não tem subelementos configurados. Desmarque "Importar subelementos" no mapeamento.');
    const sc = new Set(board.subitemColumns.map((c) => c.id));
    missing.push(...idsOf(cfg.subitemCols).filter((c) => !sc.has(c)).map((c) => `Subelementos · ${c}`));
  }
  if (missing.length) throw new Error(`Colunas mapeadas não encontradas no quadro: ${missing.join(', ')}. Refaça o mapeamento.`);

  // Só subelementos: as atividades são lidas apenas pelo ID (para vincular o pai), sem colunas.
  const colsFor = (g: GroupKey) => (g === 'sched' && subOnly ? [] : colsOf[g]);
  const get = (g: GroupKey, sub?: string[]) => (want(g) ? fetchGroupItems(boardId, groupIdOf(cfg, g), colsFor(g), sub, g === 'sched' && subOnly ? maxParents : undefined) : Promise.resolve(null));
  const [ind, med, sch, prd, rsk] = await Promise.all([get('ind'), get('med'), get('sched', withSub ? idsOf(cfg.subitemCols) : undefined), get('prod'), get('risk')]);
  console.info('[sync] leitura', { boardId, only, subMode, ms: Date.now() - t0 });
  const now = new Date().toISOString();
  const pick = <T,>(g: GroupKey, raw: typeof ind, fn: (i: NonNullable<typeof ind>[number]) => T): T[] | undefined => (raw ? raw.map(fn) : clear(g) ? [] : undefined);
  return {
    board,
    inds: pick('ind', ind, (i) => toIndicator(i, boardId, cfg, now)),
    meds: pick('med', med, (i) => toMeasurement(i, boardId, cfg, now)),
    sched: subOnly ? undefined : pick('sched', sch, (i) => toScheduleItem(i, boardId, cfg, now)),
    subs: sch
      ? (withSub ? sch.flatMap((p) => (p.subitems ?? []).map((s) => toSubitem(s, p.id, boardId, cfg, now))) : subMode === 'skip' ? undefined : [])
      : clear('sched') ? [] : undefined,
    prods: pick('prod', prd, (i) => toProduct(i, boardId, cfg, now)),
    risks: pick('risk', rsk, (i) => toRisk(i, boardId, cfg, now)),
  };
}

/** Cadastra/atualiza projeto "sem indicador elaborado": só lê o nome/URL do quadro. */
export async function refreshNoIndicator(boardId: string, userId: string) {
  const proj = await findProject(boardId);
  const startedAt = new Date().toISOString();
  try {
    const board = await fetchBoardStructure(boardId);
    // Registros importados antes deixam de contar (preservados como inativos).
    const [oldInd, oldMed] = await Promise.all([
      loadWhere<IndicatorDoc>(indicators, 'projectBoardId', boardId),
      loadWhere<MeasurementDoc>(measurements, 'projectBoardId', boardId),
    ]);
    await inChunks(oldInd.filter((d) => d.data.active), (d) => db.collection(indicators).doc(d.id).update({ active: false }));
    await inChunks(oldMed.filter((d) => d.data.active), (d) => db.collection(measurements).doc(d.id).update({ active: false }));
    const summary = 'Projeto sem indicador elaborado.';
    const data: ProjectDoc = {
      ...(proj?.data ?? {}), // preserva vínculo e metadados do Histórico
      boardId, name: board.name, workspaceId: board.workspaceId, workspaceName: board.workspaceName,
      boardUrl: board.url, config: proj?.data.config ?? '',
      indicatorCount: 0, measurementCount: 0,
      lastSuccessAt: new Date().toISOString(), lastAttemptAt: startedAt, syncStatus: 'ok', syncMessage: summary,
      createdBy: proj?.data.createdBy ?? userId, enabled: proj?.data.enabled ?? true, noIndicators: true,
    };
    if (proj) await db.collection(projects).doc(proj.id).set(data);
    else await db.collection(projects).add(data);
    await db.collection(syncLogs).add({ projectBoardId: boardId, at: data.lastSuccessAt ?? startedAt, ok: true, summary });
    return { ok: true as const, summary };
  } catch (e) {
    console.error('no-indicator register failed', boardId, e);
    const summary = `Falha: ${e instanceof Error ? e.message : 'erro desconhecido'} Os dados anteriores foram preservados.`;
    if (proj) await db.collection(projects).doc(proj.id).update({ syncStatus: 'error', syncMessage: summary, lastAttemptAt: startedAt });
    return { ok: false as const, summary };
  }
}

/** Repete gravações que falham por instabilidade momentânea de rede (até 3 tentativas). */
export async function retry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try { return await fn(); } catch (e) {
      if (i >= tries) throw e;
      await new Promise((r) => setTimeout(r, 300 * i));
    }
  }
}

type Stats = { novos: number; atualizados: number; inalterados: number; inativados: number };
/** Assinatura estável do registro (chaves ordenadas, sem datas de sincronização) para detectar mudanças. */
export const strip = (o: object) => {
  const r = o as Record<string, unknown>;
  return JSON.stringify(Object.keys(r).filter((k) => k !== 'syncedAt' && k !== 'flagsAt').sort().map((k) => [k, r[k] ?? null]));
};

/** Upsert por chave (itemId ou parentItemId:itemId); grava só o que mudou; inativa o que sumiu. */
async function upsert<T extends { itemId: string; active: boolean }>(coll: Coll, boardId: string, news: T[], keyOf: (x: T) => string): Promise<Stats> {
  const olds = await loadWhere<T>(coll, 'projectBoardId', boardId);
  const byKey = new Map(olds.map((d) => [keyOf(d.data), d]));
  const seen = new Set<string>();
  const st: Stats = { novos: 0, atualizados: 0, inalterados: 0, inativados: 0 };
  await inChunks(news, async (n) => {
    const key = keyOf(n);
    seen.add(key);
    const ex = byKey.get(key);
    if (!ex) { st.novos++; await retry(() => db.collection(coll as never).add(n as never)); return; }
    if (strip(ex.data) === strip(n)) { st.inalterados++; return; }
    st.atualizados++;
    await retry(() => db.collection(coll as never).doc(ex.id).set(n as never));
  }, 12);
  const gone = olds.filter((d) => d.data.active && !seen.has(keyOf(d.data)));
  st.inativados = gone.length;
  await inChunks(gone, (d) => retry(() => db.collection(coll as never).doc(d.id).update({ active: false } as never)), 12);
  return st;
}

const byItem = (x: { itemId: string }) => x.itemId;
const bySub = (x: { itemId: string; parentItemId: string }) => `${x.parentItemId}:${x.itemId}`;
const stTxt = (n: number, s: Stats) => `${n} lidos · ${s.novos} novos · ${s.atualizados} atualizados · ${s.inativados} inativados`;

export async function syncProject(boardId: string, cfgOverride: ProjectConfig | null, userId: string, only?: GroupKey[], subMode?: SubMode) {
  let proj = await findProject(boardId);
  if (!cfgOverride && proj?.data.noIndicators) return refreshNoIndicator(boardId, userId);
  const cfg = cfgOverride ?? (proj?.data.config ? (JSON.parse(proj.data.config) as ProjectConfig) : null);
  if (!cfg) throw new Error('Projeto sem configuração de importação.');
  const startedAt = new Date().toISOString();
  const prevSync = parseGroupSync(proj?.data.groupSync);
  if (proj) await db.collection(projects).doc(proj.id).update({ syncStatus: 'running', lastAttemptAt: startedAt });

  try {
    const src = await readSource(boardId, cfg, only, subMode);
    const tw = Date.now();
    const flagsAt = new Date().toISOString();
    const today = flagsAt.slice(0, 10);
    const meds = src.meds?.map((m) => {
      const concl = !!m.statusMedicao && cfg.status.concluded.includes(m.statusMedicao);
      const excl = !!m.statusMedicao && cfg.status.excluded.includes(m.statusMedicao);
      return {
        ...m,
        flagSemPrazo: !m.prazo,
        flagPrazoVencido: !!m.prazo && m.prazo.slice(0, 10) < today && !concl && !excl,
        flagSemBaseDados: concl && m.baseDadosUrls.length === 0 && !m.baseDadosText,
        flagsAt,
      };
    });
    const sched = src.sched?.map((x) => flagSchedule<ScheduleItemDoc>(x, cfg, today, flagsAt));
    const subs = src.subs?.map((x) => flagSchedule<ScheduleSubitemDoc>(x, cfg, today, flagsAt));
    const prods = src.prods?.map((x) => flagProduct(x, cfg, today, flagsAt));
    const rsks = src.risks?.map((x) => flagRisk(x, cfg, today, flagsAt));

    const gs: GroupSync = { ...prevSync };
    const parts: string[] = [];
    const at = new Date().toISOString();
    const run = async <T extends { itemId: string; active: boolean }>(g: GroupKey | 'sub', label: string, coll: Coll, list: T[] | undefined, key: (x: T) => string) => {
      if (!list) return;
      const s = await upsert(coll, boardId, list, key);
      const msg = stTxt(list.length, s);
      parts.push(`${label}: ${msg}`);
      gs[g] = { status: 'ok', message: msg, at };
    };
    await run('ind', 'Indicadores', indicators, src.inds, byItem);
    await run('med', 'Medições', measurements, meds, byItem);
    await run('sched', 'Cronograma', scheduleItems, sched, byItem);
    await run('sub', 'Subatividades', scheduleSubitems, subs, bySub);
    await run('prod', 'Produtos', products, prods, byItem);
    await run('risk', 'Riscos', risks, rsks, byItem);
    console.info('[sync] gravação', { boardId, only, subMode, ms: Date.now() - tw });
    for (const g of ['ind', 'med', 'sched', 'prod', 'risk'] as GroupKey[]) if (!groupIdOf(cfg, g)) gs[g] = { status: 'off', message: 'Grupo não configurado', at };
    if (!cfg.scheduleGroupId || !cfg.importSubitems) gs.sub = { status: 'off', message: 'Subelementos não importados', at };

    const finishedAt = new Date().toISOString();
    const summary = parts.length ? parts.join(' · ') : 'Nenhum grupo configurado para leitura.';
    const old = proj?.data;
    const data: ProjectDoc = {
      ...(old ?? {}), // preserva vínculo e metadados do Histórico
      boardId, name: src.board.name, workspaceId: src.board.workspaceId, workspaceName: src.board.workspaceName,
      boardUrl: src.board.url, config: JSON.stringify(cfg),
      indicatorCount: src.inds?.length ?? old?.indicatorCount ?? 0, measurementCount: meds?.length ?? old?.measurementCount ?? 0,
      scheduleCount: sched?.length ?? old?.scheduleCount, subitemCount: subs?.length ?? old?.subitemCount,
      productCount: prods?.length ?? old?.productCount, riskCount: rsks?.length ?? old?.riskCount,
      groupSync: JSON.stringify(gs),
      lastSuccessAt: finishedAt, lastAttemptAt: startedAt, syncStatus: 'ok', syncMessage: summary,
      createdBy: old?.createdBy ?? userId,
      enabled: old?.enabled ?? true,
      noIndicators: false,
    };
    if (proj) await db.collection(projects).doc(proj.id).set(data);
    else proj = await db.collection(projects).add(data);
    await db.collection(syncLogs).add({ projectBoardId: boardId, at: finishedAt, ok: true, summary });
    return { ok: true as const, summary };
  } catch (e) {
    const base = e instanceof Error ? e.message : 'Falha desconhecida na atualização.';
    const ae = e instanceof AccessError ? e : null;
    const msg = ae && (ae.code || ae.status) ? `${base} (código: ${ae.code ?? '—'}${ae.status ? `, HTTP ${ae.status}` : ''})` : base;
    console.error('sync failed', boardId, e);
    const summary = `Falha na atualização: ${msg} Os dados anteriores foram preservados.`;
    const at = new Date().toISOString();
    const gs: GroupSync = { ...prevSync };
    if (subMode === 'only') gs.sub = { status: 'error', message: msg, at };
    else for (const g of ['ind', 'med', 'sched', 'prod', 'risk'] as GroupKey[]) if (groupIdOf(cfg, g) && (!only || only.includes(g))) gs[g] = { status: 'error', message: msg, at };
    if (proj) await db.collection(projects).doc(proj.id).update({ syncStatus: 'error', syncMessage: summary, lastAttemptAt: startedAt, groupSync: JSON.stringify(gs) });
    await db.collection(syncLogs).add({ projectBoardId: boardId, at, ok: false, summary });
    return { ok: false as const, summary };
  }
}
