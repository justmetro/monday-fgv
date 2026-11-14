// Aba Base: somente o dono do app e quem está na lista de PMOs (verificado no servidor a cada ação).
// Exceção: validar semana (e as ações de semana em weekActions.ts) valem também para admin do monday.
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { db } from '@vibe/db/server';
import {
  baseDeletionLogCollection,
  baseWeekLogCollection,
  baseSyncStatusCollection,
  baseWeekStatusCollection,
  engagementChunksCollection,
  mirrorQueueCollection,
  projectsDocCollection,
  snapshotMetaCollection,
  type BaseWeekStatusDoc,
  type BaseSyncDifference,
  type BaseSyncStatusDoc,
  type BaseSyncWeekTotals,
  type StoredEngagementRow,
} from '@generated/models';
import { baseRowKey, cleanDays, isoOf, rowFingerprint } from '@generated/lib/baseRows';
import { normText, sortDays } from '@generated/lib/weekdays';
import {
  META_DOC_ID,
  PROJECTS_DOC_ID,
  getWeekRange,
  loadBaseRows,
  markWeekPending,
  readBoardAsBaseRows,
  recomputeGroupChecks,
  requireBaseAccess,
  requireManager,
  saveBaseRows,
  upsertInto,
  weekDocId,
  type WeekRange,
} from './base.server';
import { dbWriteWithRetry } from './vibeDbRetry.server';
import { assertTokenOwner } from './session.server';

const claimSchema = z
  .object({ id: z.union([z.string(), z.number()]).optional(), email: z.string().optional(), name: z.string().optional(), isAdmin: z.boolean().optional() })
  .optional();
const tokenSchema = z.string().trim().min(1, 'Informe o token da API do monday.').max(2000);
const SYNC_DOC_ID = 'main_sync';

const rowSchema = z.object({
  name: z.string().max(500),
  email: z.string().max(500),
  team: z.string().max(5000),
  department: z.string().max(2000),
  lastAccess: z.string().max(100).nullable(),
  refDate: z.string().max(100).nullable(),
  weekStart: z.string().max(100).nullable(),
  weekEnd: z.string().max(10).nullable().optional(),
  userStatus: z.string().max(200).optional(),
  group: z.string().min(1).max(500),
  checkedDays: z.array(z.string().max(5)).max(7).optional(),
});
const toRow = (r: z.infer<typeof rowSchema>): StoredEngagementRow => ({ ...r, checkedDays: cleanDays(r.checkedDays) });

/** Tudo o que a aba Base mostra: linhas, validação das semanas, última conferência e fila. */
export const getBaseData = createServerFn({ method: 'POST' })
  .validator(z.object({ clientClaim: claimSchema }))
  .handler(async ({ data }) => {
    await requireBaseAccess(data.clientClaim);
    const [{ rows, meta }, weeks, sync, queues, deletions, weekLog] = await Promise.all([
      loadBaseRows(),
      db.collection(baseWeekStatusCollection).limit(500).get(),
      db.collection(baseSyncStatusCollection).doc(SYNC_DOC_ID).get(),
      db.collection(mirrorQueueCollection).limit(200).get(),
      db.collection(baseDeletionLogCollection).orderBy('deletedAt', 'desc').limit(5).get().catch(() => []),
      db.collection(baseWeekLogCollection).orderBy('at', 'desc').limit(8).get().catch(() => []),
    ]);
    return {
      rows,
      updatedAt: meta?.updatedAt ?? null,
      updatedByName: meta?.updatedBy?.name ?? null,
      projectsCount: meta?.projectsCount ?? 0,
      weekStatus: weeks.map((w) => w.data),
      sync: sync?.data ?? null,
      queues: queues.map((q) => q.data),
      deletions: deletions.map((d) => d.data),
      weekLog: weekLog.map((d) => d.data),
    };
  });

/** Marca a semana como validada (manual). Para voltar a pendente, use "Reabrir semana". */
export const setWeekValidation = createServerFn({ method: 'POST' })
  .validator(z.object({ group: z.string().trim().min(1).max(500), status: z.literal('validada'), clientClaim: claimSchema }))
  .handler(async ({ data }) => {
    const session = await requireManager(data.clientClaim);
    const prev = (await db.collection(baseWeekStatusCollection).doc(weekDocId(data.group)).get())?.data;
    if (prev?.periodPending && !(prev.weekStart && prev.weekEnd)) throw new Error('Defina o período da semana antes de validar.');
    // Mantém o intervalo guardado da semana; só troca o status
    const doc: BaseWeekStatusDoc = {
      ...(prev ?? {}),
      group: prev?.group ?? data.group,
      status: data.status,
      updatedAt: new Date().toISOString(),
      updatedByEmail: session.email,
      updatedByName: session.name,
    };
    await dbWriteWithRetry('setWeekValidation', () => db.collection(baseWeekStatusCollection).doc(weekDocId(data.group)).set(doc));
    return doc;
  });

/**
 * Recalcula os checks de uma semana a partir da Base (e-mail, semana e "Ativo pela última vez"),
 * dentro do período guardado do grupo (o digitado no envio ou definido na aba Base).
 * Só acrescenta checks e volta a semana para pendente.
 */
export const reprocessWeekChecks = createServerFn({ method: 'POST' })
  .validator(z.object({ group: z.string().trim().min(1).max(500), clientClaim: claimSchema }))
  .handler(async ({ data }) => {
    const session = await requireBaseAccess(data.clientClaim);
    const range: WeekRange | null = await getWeekRange(data.group);
    if (!range) {
      throw new Error(`O grupo "${data.group}" não tem período guardado. Defina o período (domingo a sábado) da semana antes de recalcular.`);
    }
    const { rows } = await loadBaseRows();
    const res = recomputeGroupChecks(rows, data.group, range);
    if (res.people === 0) throw new Error(`O grupo "${data.group}" não tem linhas na Base.`);
    await saveBaseRows(res.rows, session);
    await markWeekPending(data.group, session, true);
    return { weekStart: range.weekStart, weekEnd: range.weekEnd, people: res.people, added: res.added, outside: res.outside, noAccess: res.noAccess, byDay: res.byDay };
  });

/** Apaga a Base interna (linhas e metadados). O quadro não é afetado. */
export const clearBaseData = createServerFn({ method: 'POST' })
  .validator(z.object({ token: z.string().max(2000).optional(), clientClaim: claimSchema }))
  .handler(async ({ data }) => {
    const session = await requireBaseAccess(data.clientClaim);
    await assertTokenOwner(session, data.token);
    const before = await loadBaseRows().catch(() => ({ rows: [] as StoredEngagementRow[] }));
    for (let guard = 0; guard < 20; guard++) {
      const docs = await db.collection(engagementChunksCollection).limit(500).get();
      if (docs.length === 0) break;
      await Promise.all(docs.map((d) => db.collection(engagementChunksCollection).doc(d.id).delete()));
    }
    await db.collection(snapshotMetaCollection).doc(META_DOC_ID).delete().catch(() => null);
    await db.collection(projectsDocCollection).doc(PROJECTS_DOC_ID).delete().catch(() => null);
    // Histórico: quem apagou e quando
    await dbWriteWithRetry('baseDeletionLog', () =>
      db.collection(baseDeletionLogCollection).add({
        deletedAt: new Date().toISOString(),
        deletedByEmail: session.email,
        deletedByName: session.name,
        rowsDeleted: before.rows.length,
      })
    ).catch((e) => console.error('Erro ao registrar exclusão da Base:', e));
    return { success: true };
  });

/** Prévia da reescrita por arquivo: quantas linhas seriam criadas, atualizadas ou ficam iguais. */
export const previewBaseRows = createServerFn({ method: 'POST' })
  .validator(z.object({ rows: z.array(rowSchema).max(30000), clientClaim: claimSchema }))
  .handler(async ({ data }) => {
    await requireBaseAccess(data.clientClaim);
    const { rows } = await loadBaseRows();
    return upsertInto(rows, data.rows.map(toRow), 'rewrite').result;
  });

/** Grava a reescrita por arquivo (e-mail + semana; existe → atualiza, não existe → cria; check nunca é removido). */
export const applyBaseRows = createServerFn({ method: 'POST' })
  .validator(z.object({ rows: z.array(rowSchema).max(30000), clientClaim: claimSchema }))
  .handler(async ({ data }) => {
    const session = await requireBaseAccess(data.clientClaim);
    const { rows } = await loadBaseRows();
    const merged = upsertInto(rows, data.rows.map(toRow), 'rewrite');
    await saveBaseRows(merged.rows, session);
    return merged.result;
  });

/** Edição direta de linhas (inclui desmarcar check, só por ação manual). Pessoa e semana não mudam. */
export const updateBaseRows = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      edits: z.array(z.object({
        key: z.string().min(1).max(800),
        lastAccess: z.string().max(100).nullable(),
        team: z.string().max(5000),
        department: z.string().max(2000),
        userStatus: z.string().max(200),
        checkedDays: z.array(z.string().max(5)).max(7),
      })).min(1).max(2000),
      token: z.string().max(2000).optional(),
      clientClaim: claimSchema,
    })
  )
  .handler(async ({ data }) => {
    const session = await requireBaseAccess(data.clientClaim);
    await assertTokenOwner(session, data.token);
    const { rows } = await loadBaseRows();
    const byKey = new Map(data.edits.map((e) => [e.key, e]));
    let updated = 0;
    const next = rows.map((r) => {
      const e = byKey.get(baseRowKey(r));
      if (!e) return r;
      updated++;
      return { ...r, lastAccess: e.lastAccess?.trim() || null, team: e.team.trim(), department: e.department.trim(), userStatus: e.userStatus.trim(), checkedDays: cleanDays(e.checkedDays) };
    });
    if (updated === 0) throw new Error('Nenhuma das linhas editadas foi encontrada na Base. Recarregue a aba e tente de novo.');
    await saveBaseRows(next, session);
    return { updated, notFound: data.edits.length - updated };
  });

function compare(boardRows: StoredEngagementRow[], baseRows: StoredEngagementRow[]) {
  const board = new Map(boardRows.map((r) => [baseRowKey(r), r]));
  const base = new Map(baseRows.map((r) => [baseRowKey(r), r]));
  const differences: BaseSyncDifference[] = [];
  const weeks = new Map<string, BaseSyncWeekTotals>();
  const week = (g: string) => {
    const k = normText(g);
    const w = weeks.get(k) ?? { group: g, boardPeople: 0, basePeople: 0, boardChecks: 0, baseChecks: 0 };
    weeks.set(k, w);
    return w;
  };
  let toCreate = 0, toUpdate = 0, unchanged = 0;
  board.forEach((b, k) => {
    const w = week(b.group ?? '');
    w.boardPeople++; w.boardChecks += b.checkedDays?.length ?? 0;
    const a = base.get(k);
    const who = { group: b.group ?? '', name: b.name, email: b.email };
    if (!a) { toCreate++; differences.push({ ...who, type: 'missing_in_base', detail: 'Está no quadro e não está na Base.' }); return; }
    if (rowFingerprint(a) === rowFingerprint(b)) { unchanged++; return; }
    toUpdate++;
    const bc = sortDays(b.checkedDays ?? []).join(', ') || 'nenhum';
    const ac = sortDays(a.checkedDays ?? []).join(', ') || 'nenhum';
    if (bc !== ac) differences.push({ ...who, type: 'checked_days_diff', detail: `Checks no quadro: ${bc} · na Base: ${ac}` });
    else if ((isoOf(b.lastAccess) ?? b.lastAccess) !== (isoOf(a.lastAccess) ?? a.lastAccess)) {
      differences.push({ ...who, type: 'last_access_diff', detail: `Último acesso no quadro: ${b.lastAccess ?? '—'} · na Base: ${a.lastAccess ?? '—'}` });
    } else differences.push({ ...who, type: 'last_access_diff', detail: 'Outros campos diferentes (equipe, departamento, status ou datas).' });
  });
  let onlyInBase = 0;
  base.forEach((a, k) => {
    const w = week(a.group ?? '');
    w.basePeople++; w.baseChecks += a.checkedDays?.length ?? 0;
    if (!board.has(k)) { onlyInBase++; differences.push({ group: a.group ?? '', name: a.name, email: a.email, type: 'missing_in_board', detail: 'Está na Base e não está no quadro.' }); }
  });
  return { differences, weeks: Array.from(weeks.values()), toCreate, toUpdate, unchanged, onlyInBase };
}

/** Lê o quadro, compara com a Base, guarda data/hora e devolve a prévia (C) e as divergências (D). */
export const compareBoardAndBase = createServerFn({ method: 'POST' })
  .validator(z.object({ token: tokenSchema, clientClaim: claimSchema }))
  .handler(async ({ data }) => {
    const session = await requireBaseAccess(data.clientClaim);
    const [{ rows: boardRows, duplicates }, { rows: baseRows }] = await Promise.all([readBoardAsBaseRows(data.token), loadBaseRows()]);
    const c = compare(boardRows, baseRows);
    const status: BaseSyncStatusDoc = {
      checkedAt: new Date().toISOString(), checkedByName: session.name, inSync: c.differences.length === 0,
      boardRows: boardRows.length, baseRows: baseRows.length, differencesCount: c.differences.length,
      differences: c.differences.slice(0, 300), weeks: c.weeks,
    };
    await dbWriteWithRetry('baseSync', () => db.collection(baseSyncStatusCollection).doc(SYNC_DOC_ID).set(status));
    return { status, preview: { toCreate: c.toCreate, toUpdate: c.toUpdate, unchanged: c.unchanged, onlyInBase: c.onlyInBase, boardDuplicates: duplicates } };
  });

/** Atualiza a Base a partir do quadro: tudo (espelho exato) ou só as diferenças (mantém linhas que só existem na Base). */
export const applyBaseFromBoard = createServerFn({ method: 'POST' })
  .validator(z.object({ token: tokenSchema, mode: z.enum(['all', 'diff']), clientClaim: claimSchema }))
  .handler(async ({ data }) => {
    const session = await requireBaseAccess(data.clientClaim);
    const [{ rows: boardRows }, { rows: baseRows }] = await Promise.all([readBoardAsBaseRows(data.token), loadBaseRows()]);
    let finalRows: StoredEngagementRow[];
    let result: { created: number; updated: number; unchanged: number; removed: number };
    if (data.mode === 'all') {
      const c = compare(boardRows, baseRows);
      finalRows = boardRows;
      result = { created: c.toCreate, updated: c.toUpdate, unchanged: c.unchanged, removed: c.onlyInBase };
    } else {
      const base = new Map(baseRows.map((r) => [baseRowKey(r), r]));
      const changed = boardRows.filter((b) => { const a = base.get(baseRowKey(b)); return !a || rowFingerprint(a) !== rowFingerprint(b); });
      const merged = upsertInto(baseRows, changed, 'board');
      finalRows = merged.rows;
      result = { ...merged.result, unchanged: boardRows.length - changed.length, removed: 0 };
    }
    await saveBaseRows(finalRows, session);
    const c2 = compare(boardRows, finalRows);
    await dbWriteWithRetry('baseSync', () =>
      db.collection(baseSyncStatusCollection).doc(SYNC_DOC_ID).set({
        checkedAt: new Date().toISOString(), checkedByName: session.name, inSync: c2.differences.length === 0,
        boardRows: boardRows.length, baseRows: finalRows.length, differencesCount: c2.differences.length,
        differences: c2.differences.slice(0, 300), weeks: c2.weeks,
      })
    );
    return result;
  });
