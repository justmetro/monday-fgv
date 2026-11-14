// Upload da semana: grava primeiro na Base e depois espelha no quadro, conferindo por leitura de volta.
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { db } from '@vibe/db/server';
import {
  baseWeekStatusCollection,
  mirrorQueueCollection,
  panelUploadRunsCollection,
  type PanelUploadFailure,
  type StoredEngagementRow,
} from '@generated/models';
import { baseRowKey, cleanDays, isoOf } from '@generated/lib/baseRows';
import { extractEmail, isCheckedValue, normText, personMatchKey, weekdayOfIso, WEEKDAYS } from '@generated/lib/weekdays';
import { isActivatedStatus } from '@generated/lib/userStatus';
import { legacyChecks } from '@generated/lib/legacyBase';
import { OUTSIDE_PERIOD_MESSAGE, periodError } from '@generated/lib/weekPeriod';
import {
  boardColumnRoles,
  engagementBoardId,
  ensureWeekRange,
  getWeekRange,
  loadBaseRows,
  markWeekPending,
  readBoardMeta,
  requireManager,
  saveBaseRows,
  upsertInto,
  weekDocId,
  type BoardColumn,
} from './base.server';
import { logWeekAction } from './weekPeriod.server';
import {
  isWritableType,
  mondayCallOnce,
  mondayItemGroups,
  mondayReadGroupItems,
  mondayUpsertItemsBatch,
  toColumnValue,
  type BatchCallResult,
} from './mondayWrite.server';
import { dbWriteBestEffort, dbWriteWithRetry } from './vibeDbRetry.server';
import { assertTokenOwner } from './session.server';

const claimSchema = z
  .object({ id: z.union([z.string(), z.number()]).optional(), email: z.string().optional(), name: z.string().optional(), isAdmin: z.boolean().optional() })
  .optional();
const tokenSchema = z.string().trim().min(1, 'Informe o token da API do monday.').max(2000);
const groupSchema = z.string().trim().min(1).max(255);
const RUN_LOCK_STALE_MS = 3 * 60 * 1000;

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
  group: z.string().max(500).optional(),
  checkedDays: z.array(z.string().max(5)).max(7).optional(),
  boardValues: z.record(z.string().max(300), z.string().max(5000)).optional(),
  createdAt: z.string().max(100).nullable().optional(),
});

const isoSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Base antiga, passo 1: grava a semana na Base com o intervalo e os checks da regra antiga (sem remover checks). */
export const applyLegacyWeekToBase = createServerFn({ method: 'POST' })
  .validator(z.object({ token: z.string().max(2000).optional(), groupName: groupSchema, analysisDate: isoSchema, weekStart: isoSchema, weekEnd: isoSchema, rows: z.array(rowSchema).max(20000), rewrite: z.boolean().optional(), clientClaim: claimSchema }))
  .handler(async ({ data }) => {
    const session = await requireManager(data.clientClaim);
    await assertTokenOwner(session, data.token);
    const g = data.groupName.trim();
    const want = { weekStart: data.weekStart, weekEnd: data.weekEnd };
    const bad = periodError(want.weekStart, want.weekEnd);
    if (bad) throw new Error(`${bad} Nada foi gravado.`);
    // Reescrita: o período digitado já foi aplicado ao grupo; envio novo guarda o período como definido
    const range = await ensureWeekRange(g, data.analysisDate, session, want, { allowChange: Boolean(data.rewrite) });
    const incoming: StoredEngagementRow[] = data.rows.map((r) => ({
      ...r, group: g, refDate: data.analysisDate, userStatus: 'Ativado',
      weekStart: range.weekStart, weekEnd: range.weekEnd,
      checkedDays: legacyChecks(r.lastAccess, data.analysisDate, range),
      boardValues: { ...(r.boardValues ?? {}), 'Status do usuário': 'Ativado' },
    }));
    const { rows } = await loadBaseRows();
    const before = rows.filter((r) => normText(r.group) === normText(g)).reduce((n, r) => n + (r.checkedDays?.length ?? 0), 0);
    const merged = upsertInto(rows, incoming, 'analysis');
    await saveBaseRows(merged.rows, session);
    const after = merged.rows.filter((r) => normText(r.group) === normText(g)).reduce((n, r) => n + (r.checkedDays?.length ?? 0), 0);
    // Reescrita: o estado de validação da semana continua o que estava
    if (after !== before && !data.rewrite) await markWeekPending(g, session);
    return { ...merged.result, weekStart: range.weekStart, weekEnd: range.weekEnd };
  });

const queueId = (group: string) => `q_${normText(group).replace(/[^a-z0-9]+/g, '_').slice(0, 80) || 'grupo'}`;

async function sameDateRuns(analysisDate: string) {
  if (!analysisDate) return [];
  const docs = await db.collection(panelUploadRunsCollection).where('analysisDate', '==', analysisDate).limit(100).get();
  return docs
    .filter((d) => (d.data.created ?? 0) + (d.data.updated ?? 0) + (d.data.baseCreated ?? 0) + (d.data.baseUpdated ?? 0) > 0)
    .map((d) => d.data.groupName);
}

/** Linhas da semana na Base, histórico da data e (se houver token) as colunas do quadro, para a prévia. */
export const getWeekPreviewContext = createServerFn({ method: 'POST' })
  .validator(z.object({ token: z.string().max(2000).optional(), groupName: groupSchema, analysisDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), clientClaim: claimSchema }))
  .handler(async ({ data }) => {
    await requireManager(data.clientClaim);
    const { rows } = await loadBaseRows();
    const g = normText(data.groupName);
    const baseRows = rows.filter((r) => normText(r.group) === g);
    const sameDate = await sameDateRuns(data.analysisDate);
    const stored = await getWeekRange(data.groupName.trim());
    const weekRange = stored ? { weekStart: stored.weekStart, weekEnd: stored.weekEnd } : null;
    // Semana de referência da Base antiga: a de maior período entre as com período definido
    const statusDocs = (await db.collection(baseWeekStatusCollection).limit(500).get()).map((d) => d.data);
    const statusOf = new Map(statusDocs.map((s) => [normText(s.group), s]));
    const periods = new Map<string, { group: string; weekStart: string; weekEnd: string }>();
    rows.forEach((r) => {
      const k = normText(r.group);
      if (!k || periods.has(k)) return;
      const st = statusOf.get(k);
      if (st?.periodPending) return;
      const ws = st?.weekStart ?? r.weekStart ?? '';
      const we = st?.weekEnd ?? r.weekEnd ?? '';
      if (!ws) return;
      periods.set(k, { group: r.group ?? '', weekStart: ws, weekEnd: we });
    });
    const top = Array.from(periods.values()).sort((a, b) => b.weekStart.localeCompare(a.weekStart) || b.weekEnd.localeCompare(a.weekEnd))[0];
    const reference = top
      ? {
          ...top,
          emails: Array.from(new Set(
            rows.filter((r) => normText(r.group) === normText(top.group)).map((r) => (r.email ?? '').toLowerCase().replace(/\s+/g, '')).filter(Boolean)
          )),
        }
      : null;
    let board: { name: string; columns: (BoardColumn & { writable: boolean })[]; groupExists: boolean; groupItems: number | null } | null = null;
    let boardError: string | null = null;
    if (data.token?.trim()) {
      try {
        const boardId = await engagementBoardId();
        const meta = await readBoardMeta(data.token.trim(), boardId);
        const found = meta.groups.find((x) => normText(x.title) === g);
        let groupItems: number | null = null;
        if (found) {
          const read = await mondayReadGroupItems(data.token.trim(), boardId, found.id, []);
          groupItems = read.ok ? read.items.length : null;
        }
        board = {
          name: meta.name,
          columns: meta.columns.map((c) => ({ ...c, writable: isWritableType(c.type) })),
          groupExists: Boolean(found),
          groupItems,
        };
      } catch (e) {
        boardError = (e as Error).message;
      }
    }
    return {
      baseRows,
      sameGroupSameDate: sameDate.some((x) => normText(x) === g),
      otherGroupsSameDate: Array.from(new Set(sameDate.filter((x) => normText(x) !== g))),
      weekRange,
      weekStatus: stored?.doc.status ?? null,
      reference,
      board,
      boardError,
    };
  });

/**
 * Base antiga, reescrita de uma semana que já existe: apaga o grupo da semana no quadro (grupo e itens) e as linhas
 * da semana na Base, e recalcula o período pela Data da análise. Só essa semana. O estado de validação continua.
 * Chamada só depois da prévia e das travas; a regravação é feita em seguida pelos passos normais da Base antiga.
 */
export const resetLegacyWeekForRewrite = createServerFn({ method: 'POST' })
  .validator(z.object({ token: z.string().min(1).max(2000), groupName: groupSchema, analysisDate: isoSchema, weekStart: isoSchema, weekEnd: isoSchema, clientClaim: claimSchema }))
  .handler(async ({ data }) => {
    const session = await requireManager(data.clientClaim);
    await assertTokenOwner(session, data.token);
    const g = data.groupName.trim();
    const want = { weekStart: data.weekStart, weekEnd: data.weekEnd };
    const bad = periodError(want.weekStart, want.weekEnd);
    if (bad) throw new Error(`${bad} Nada foi apagado.`);
    const boardId = await engagementBoardId();
    const meta = await readBoardMeta(data.token, boardId);
    const roles = boardColumnRoles(meta.columns);
    if (roles.missingDays.length > 0) throw new Error(`Faltam colunas de check no quadro: ${roles.missingDays.join(', ')}. Nada foi apagado.`);
    const found = meta.groups.find((x) => normText(x.title) === normText(g));
    let boardDeleted = false;
    if (found) {
      const del = await mondayCallOnce<{ delete_group: { id: string } }>(
        data.token,
        `mutation ($boardId: ID!, $groupId: String!) { delete_group(board_id: $boardId, group_id: $groupId) { id } }`,
        { boardId, groupId: found.id }
      );
      if (!del.ok) throw new Error(`O monday não apagou o grupo "${g}" (${del.message}). Nada foi apagado na Base.`);
      boardDeleted = true;
    }
    const { rows } = await loadBaseRows();
    const gk = normText(g);
    const kept = rows.filter((r) => normText(r.group) !== gk);
    const removed = rows.length - kept.length;
    const checksBefore = rows.filter((r) => normText(r.group) === gk).reduce((n, r) => n + (r.checkedDays?.length ?? 0), 0);
    try {
      if (removed > 0) await saveBaseRows(kept, session);
      const ref = db.collection(baseWeekStatusCollection).doc(weekDocId(g));
      const prev = (await ref.get())?.data;
      if (prev) {
        const next = { ...prev, weekStart: want.weekStart, weekEnd: want.weekEnd, rangeFromDate: data.analysisDate, lastReprocessedAt: new Date().toISOString() };
        delete next.counters;
        delete next.periodPending;
        await dbWriteWithRetry('semana_reescrita', () => ref.set(next));
      }
      const queues = await db.collection(mirrorQueueCollection).limit(1000).get();
      for (const q of queues) {
        if (normText(q.data.group) === gk) await dbWriteBestEffort('fila_reescrita', () => db.collection(mirrorQueueCollection).doc(q.id).delete());
      }
    } catch (e) {
      throw new Error(`${boardDeleted ? 'O grupo foi apagado no quadro, mas ' : ''}a Base não foi limpa: ${(e as Error).message}. Nada foi regravado.`);
    }
    await logWeekAction(session, 'reescreveu_semana', g, `Antes: ${removed} pessoas e ${checksBefore} checks na Base${found ? '; grupo apagado no quadro' : ''}. Data da análise ${data.analysisDate}.`);
    return { removedRows: removed, checksBefore, boardDeleted, weekStart: want.weekStart, weekEnd: want.weekEnd };
  });

/** Passo 1: grava a semana na Base (uma linha por pessoa + semana, sem remover checks). */
export const applyWeekToBase = createServerFn({ method: 'POST' })
  .validator(z.object({ token: z.string().max(2000).optional(), groupName: groupSchema, analysisDate: isoSchema, weekStart: isoSchema, weekEnd: isoSchema, allowPeriodChange: z.boolean().optional(), rows: z.array(rowSchema).max(20000), deactivations: z.array(z.object({ name: z.string().max(500), email: z.string().max(500) })).max(20000).optional(), clientClaim: claimSchema }))
  .handler(async ({ data }) => {
    const session = await requireManager(data.clientClaim);
    await assertTokenOwner(session, data.token);
    const g = data.groupName.trim();
    // Período digitado (domingo a sábado) = semana do grupo; o nome do grupo é só rótulo
    const want = { weekStart: data.weekStart, weekEnd: data.weekEnd };
    const bad = periodError(want.weekStart, want.weekEnd);
    if (bad) throw new Error(`${bad} Nada foi gravado.`);
    if (data.analysisDate < want.weekStart || data.analysisDate > want.weekEnd) throw new Error(`${OUTSIDE_PERIOD_MESSAGE}. Nada foi gravado.`);
    const range = await ensureWeekRange(g, data.analysisDate, session, want, { allowChange: data.allowPeriodChange });
    // Regra do envio normal, conferida também no servidor: só o check do dia da Data da análise,
    // e só para quem tem "Ativo pela última vez" igual a ela
    const dayKey = weekdayOfIso(data.analysisDate);
    const incoming: StoredEngagementRow[] = data.rows.map((r) => ({
      ...r, group: g, weekStart: range.weekStart, weekEnd: range.weekEnd,
      checkedDays: dayKey && isoOf(r.lastAccess) === data.analysisDate ? [dayKey] : [],
    }));
    const { rows } = await loadBaseRows();
    const checksOf = (list: StoredEngagementRow[]) =>
      list.filter((r) => normText(r.group) === normText(g)).reduce((n, r) => n + (r.checkedDays?.length ?? 0), 0);
    const before = checksOf(rows);
    const gk = normText(g);
    const emailKey = (e: string | null | undefined) => (e ?? '').toLowerCase().replace(/\s+/g, '');
    // Quem já tinha linha na semana e NÃO estava ativo: o CSV com "Ativado" reativa
    const wasOff = new Set(rows.filter((r) => normText(r.group) === gk && !isActivatedStatus(r.userStatus)).map(baseRowKey));
    const merged = upsertInto(rows, incoming, 'analysis');
    const incomingKeys = new Set(incoming.map(baseRowKey));
    // Desativados no CSV: só quem já tem linha NESTA semana; só o status muda (checks e demais campos ficam)
    const targets = new Set<string>();
    let ignoredDeactivated = 0;
    const deactList = data.deactivations ?? [];
    const withDeact = merged.rows.map((r) => r);
    deactList.forEach((d) => {
      const ek = emailKey(d.email);
      const idx = withDeact.findIndex((r) => normText(r.group) === gk && (ek ? emailKey(r.email) === ek : baseRowKey(r) === baseRowKey({ name: d.name, email: '', group: g })));
      const found = idx >= 0 ? withDeact[idx] : undefined;
      if (!found) { ignoredDeactivated++; return; }
      const fk = baseRowKey(found);
      if (incomingKeys.has(fk) || !isActivatedStatus(found.userStatus)) return;
      const statusKey = Object.keys(found.boardValues ?? {}).find((k) => normText(k) === 'status do usuario') ?? 'Status do usuário';
      withDeact[idx] = { ...found, userStatus: 'Desativado', boardValues: { ...(found.boardValues ?? {}), [statusKey]: 'Desativado' } };
      targets.add(fk);
    });
    // Mesma Date para toda a semana (a análise mais recente do grupo), para os painéis não partirem a semana
    const latest = withDeact.filter((r) => normText(r.group) === gk && isActivatedStatus(r.userStatus)).map((r) => r.refDate ?? '').sort().pop() || null;
    const dated = withDeact.map((r) =>
      normText(r.group) === gk
        ? { ...r, ...(latest && isActivatedStatus(r.userStatus) ? { refDate: latest } : {}), weekStart: range.weekStart, weekEnd: range.weekEnd }
        : r
    );
    // Checks já existentes nunca são removidos (a junção só acrescenta)
    await saveBaseRows(dated, session);
    if (checksOf(dated) !== before || targets.size > 0) await markWeekPending(g, session);
    // Leitura de volta da Base: confirma desativadas e reativadas
    const back = (await loadBaseRows()).rows.filter((r) => normText(r.group) === gk);
    const backStatus = new Map(back.map((r) => [baseRowKey(r), isActivatedStatus(r.userStatus)]));
    const reactivatedKeys = Array.from(wasOff).filter((k) => incomingKeys.has(k));
    return {
      ...merged.result,
      deactivatedExpected: targets.size,
      deactivated: Array.from(targets).filter((k) => backStatus.get(k) === false).length,
      reactivatedExpected: reactivatedKeys.length,
      reactivated: reactivatedKeys.filter((k) => backStatus.get(k) === true).length,
      ignoredDeactivated,
    };
  });

/** Abre o registro da gravação no histórico (uma por vez). */
export const startMirrorRun = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      groupName: groupSchema,
      analysisDate: z.string().max(10),
      weekStart: isoSchema.optional(),
      weekEnd: isoSchema.optional(),
      fileName: z.string().max(300),
      rowsRead: z.number().int().min(0),
      discardedByStatus: z.number().int().min(0),
      discardedByLabel: z.record(z.string().max(200), z.number().int().min(0)).optional(),
      baseCreated: z.number().int().min(0),
      baseUpdated: z.number().int().min(0),
      baseUnchanged: z.number().int().min(0),
      deactivated: z.number().int().min(0).optional(),
      reactivated: z.number().int().min(0).optional(),
      ignoredDeactivated: z.number().int().min(0).optional(),
      kind: z.enum(['normal', 'base_antiga']).optional(),
      legacyByStatus: z.record(z.string().max(200), z.number().int().min(0)).optional(),
      rewrite: z.object({
        before: z.object({ people: z.number().int().min(0), checks: z.number().int().min(0), boardItems: z.number().int().min(0).nullable(), analysisDate: z.string().max(10).optional() }),
        after: z.object({ people: z.number().int().min(0), checks: z.number().int().min(0) }),
      }).optional(),
      clientClaim: claimSchema,
    })
  )
  .handler(async ({ data }) => {
    const session = await requireManager(data.clientClaim);
    const running = await db.collection(panelUploadRunsCollection).where('status', '==', 'em_andamento').limit(20).get();
    const active = running.find((r) => Date.now() - new Date(r.data.lastActivityAt).getTime() < RUN_LOCK_STALE_MS);
    if (active) throw new Error(`Já existe uma gravação em andamento (grupo "${active.data.groupName}"). Aguarde ela terminar.`);
    const now = new Date().toISOString();
    const doc = await dbWriteWithRetry('startMirrorRun', () =>
      db.collection(panelUploadRunsCollection).add({
        groupName: data.groupName, groupId: '', boardId: '', analysisDate: data.analysisDate,
        weekday: data.analysisDate ? weekdayOfIso(data.analysisDate) ?? undefined : undefined,
        ...(data.weekStart && data.weekEnd ? { weekStart: data.weekStart, weekEnd: data.weekEnd } : {}),
        fileName: data.fileName, startedAt: now, lastActivityAt: now, status: 'em_andamento',
        toCreate: 0, toUpdate: 0, created: 0, updated: 0, checksMarked: 0, failed: 0, pending: 0,
        rowsRead: data.rowsRead, discardedByStatus: data.discardedByStatus, discardedByLabel: data.discardedByLabel ?? {}, unchanged: data.baseUnchanged,
        baseCreated: data.baseCreated, baseUpdated: data.baseUpdated, baseUnchanged: data.baseUnchanged,
        ...(data.deactivated !== undefined ? { deactivated: data.deactivated } : {}),
        ...(data.reactivated !== undefined ? { reactivated: data.reactivated } : {}),
        ...(data.ignoredDeactivated !== undefined ? { ignoredDeactivated: data.ignoredDeactivated } : {}),
        uploadedByEmail: session.email, uploadedByName: session.name, uploadedById: session.id,
        ignoredColumns: [], failures: [],
        // O token nunca é guardado no histórico
        kind: data.kind ?? 'normal',
        ...(data.legacyByStatus ? { legacyByStatus: data.legacyByStatus } : {}),
        ...(data.rewrite ? { rewrite: data.rewrite } : {}),
      })
    );
    return { runId: doc.id };
  });

type Values = Record<string, { type: string; raw: string }>;

const teamSet = (raw: string | null | undefined) =>
  (raw ?? '').split(/[,;]/).map((t) => normText(t)).filter(Boolean).sort().join('|');
/** Mesmas equipes no quadro e na Base (ordem e espaços não importam). */
function sameTeams(boardText: string | null | undefined, baseTeam: string): boolean {
  return teamSet(boardText) === teamSet(baseTeam);
}
export interface MirrorOp {
  key: string;
  name: string;
  itemId?: string;
  create?: Values; // item ainda não existe no grupo
  update?: Values; // campos a avançar em item existente (último acesso, Date)
  team?: Values; // equipe a gravar — sempre em chamada própria, separada dos checks
  checks: string[]; // colunas de check que faltam marcar
}

/**
 * Lê o grupo no quadro e compara com a Base: o que falta criar, os checks que faltam e os já confirmados.
 * Chamada antes, entre as fases e no fim (leitura de volta). Cria o grupo se pedido.
 */
export const prepareMirror = createServerFn({ method: 'POST' })
  .validator(z.object({ token: tokenSchema, groupName: groupSchema, createGroup: z.boolean(), runId: z.string().optional(), clientClaim: claimSchema }))
  .handler(async ({ data }) => {
    await requireManager(data.clientClaim);
    const boardId = await engagementBoardId();
    const board = await readBoardMeta(data.token, boardId);
    const roles = boardColumnRoles(board.columns);
    if (roles.missingDays.length > 0) {
      throw new Error(`Faltam colunas de check no quadro: ${roles.missingDays.join(', ')}. A Base foi mantida; nada foi enviado ao quadro.`);
    }
    const g = normText(data.groupName);
    let group = board.groups.find((x) => normText(x.title) === g) ?? null;
    let groupCreated = false;
    if (!group && data.createGroup) {
      const created = await mondayCallOnce<{ create_group: { id: string } }>(
        data.token,
        `mutation ($boardId: ID!, $groupName: String!) { create_group(board_id: $boardId, group_name: $groupName) { id } }`,
        { boardId, groupName: data.groupName.trim() }
      );
      if (!created.ok) throw new Error(`Erro retornado pelo monday ao criar o grupo "${data.groupName}": ${created.message}`);
      group = { id: created.data.create_group.id, title: data.groupName.trim() };
      groupCreated = true;
    }

    const { rows } = await loadBaseRows();
    const baseRows = rows.filter((r) => normText(r.group) === g && isActivatedStatus(r.userStatus));

    const emailCols = board.columns.filter((c) => c.type === 'email' || normText(c.title).includes('email'));
    const dayCols = WEEKDAYS.map((w) => ({ key: w.key, col: roles.days[w.key] ?? null }));
    const teamCol = roles.team && isWritableType(roles.team.type) ? roles.team : null;
    const statusCol = roles.status && isWritableType(roles.status.type) ? roles.status : null;
    const readIds = [...emailCols, roles.lastAccess, roles.date, teamCol, statusCol, ...dayCols.map((d) => d.col)].filter(Boolean).map((c) => (c as BoardColumn).id);

    const items = group ? await mondayReadGroupItems(data.token, boardId, group.id, readIds) : { ok: true as const, items: [] };
    if (!items.ok) throw new Error(`Erro retornado pelo monday ao ler o grupo: ${items.message}`);

    const byEmail = new Map<string, (typeof items.items)[number]>();
    const byName = new Map<string, (typeof items.items)[number]>();
    const seen = new Map<string, number>();
    items.items.forEach((it) => {
      let email = '';
      for (const c of emailCols) { email = extractEmail(it.values[c.id]?.text); if (email) break; }
      if (!email && it.name.includes('@')) email = extractEmail(it.name);
      if (email && !byEmail.has(email)) byEmail.set(email, it);
      const n = normText(it.name);
      if (n && !byName.has(n)) byName.set(n, it);
      const k = personMatchKey(it.name, email);
      seen.set(k, (seen.get(k) ?? 0) + 1);
    });
    const boardDuplicates = Array.from(seen.values()).reduce((s, n) => s + Math.max(0, n - 1), 0);
    // Quem está duplicado: nomes + e-mail dos itens com a mesma chave pessoa (não apaga nada)
    const dupKeys = new Set(Array.from(seen.entries()).filter(([, n]) => n > 1).map(([k]) => k));
    const boardDuplicateNames: string[] = [];
    items.items.forEach((it) => {
      let email = '';
      for (const c of emailCols) { email = extractEmail(it.values[c.id]?.text); if (email) break; }
      if (!email && it.name.includes('@')) email = extractEmail(it.name);
      if (dupKeys.has(personMatchKey(it.name, email)) && boardDuplicateNames.length < 50) boardDuplicateNames.push(`${it.name}${email ? ` <${email}>` : ' (sem e-mail)'} · item ${it.id}`);
    });

    const writableByTitle = new Map<string, BoardColumn>();
    board.columns.forEach((c) => {
      if (isWritableType(c.type) && c.type !== 'date' && !writableByTitle.has(normText(c.title))) writableByTitle.set(normText(c.title), c);
    });
    const laTitle = normText('Ativo pela última vez');

    const ops: MirrorOp[] = [];
    let checksExpected = 0;
    let checksConfirmed = 0;
    let checksWithoutColumn = 0;
    let teamExpected = 0;
    let teamConfirmed = 0;
    const matchedItemIds = new Set<string>();

    baseRows.forEach((r) => {
      const email = extractEmail(r.email);
      const found = (email && byEmail.get(email)) || byName.get(normText(r.name));
      const expected = (r.checkedDays ?? []).flatMap((d) => {
        const col = dayCols.find((x) => x.key === d)?.col;
        if (!col) { checksWithoutColumn++; return []; }
        return [col.id];
      });
      checksExpected += expected.length;
      const key = baseRowKey(r);

      if (!found) {
        if (teamCol && r.team?.trim()) teamExpected++;
        const values: Values = {};
        Object.entries(r.boardValues ?? {}).forEach(([title, raw]) => {
          const col = writableByTitle.get(normText(title));
          if (col && col.id !== teamCol?.id && normText(title) !== laTitle && raw.trim()) values[col.id] = { type: col.type, raw };
        });
        if (roles.email && isWritableType(roles.email.type) && email) values[roles.email.id] = { type: roles.email.type, raw: email };
        if (roles.lastAccess && isWritableType(roles.lastAccess.type) && r.lastAccess) values[roles.lastAccess.id] = { type: roles.lastAccess.type, raw: r.lastAccess };
        if (roles.date && r.refDate) values[roles.date.id] = { type: 'date', raw: r.refDate };
        // "Criado em" (data de entrada na Monday) só quando a coluna existe e aceita gravação
        if (roles.createdAt && isWritableType(roles.createdAt.type) && r.createdAt) values[roles.createdAt.id] = { type: roles.createdAt.type, raw: r.createdAt };
        ops.push({ key, name: r.name || email, create: values, checks: expected });
        return;
      }

      matchedItemIds.add(found.id);
      const missing = expected.filter((id) => !isCheckedValue(found.values[id]?.value, found.values[id]?.text));
      checksConfirmed += expected.length - missing.length;
      const update: Values = {};
      if (roles.lastAccess && isWritableType(roles.lastAccess.type) && r.lastAccess) {
        // Compara só o dia: coluna de data no quadro não guarda hora, e comparar a hora deixava o item sempre "pendente"
        const cur = isoOf(found.values[roles.lastAccess.id]?.text) ?? '';
        const next = isoOf(r.lastAccess) ?? '';
        if (next && next > cur) update[roles.lastAccess.id] = { type: roles.lastAccess.type, raw: r.lastAccess };
      }
      if (roles.date && r.refDate) {
        const cur = isoOf(found.values[roles.date.id]?.text);
        if (!cur || r.refDate > cur) update[roles.date.id] = { type: 'date', raw: r.refDate };
      }
      // Equipe: conferida pelo texto lido do quadro (mesmas equipes, em qualquer ordem)
      let team: Values | undefined;
      if (teamCol && r.team?.trim()) {
        teamExpected++;
        if (sameTeams(found.values[teamCol.id]?.text, r.team)) teamConfirmed++;
        else team = { [teamCol.id]: { type: teamCol.type, raw: r.team.trim() } };
      }
      if (missing.length > 0 || Object.keys(update).length > 0 || team) {
        ops.push({ key, name: r.name, itemId: found.id, update: Object.keys(update).length ? update : undefined, team, checks: missing });
      }
    });

    // Pessoas desativadas nesta semana: o item do quadro recebe o status "Desativado" (nada é criado nem apagado)
    if (statusCol) {
      rows.filter((r) => normText(r.group) === g && !isActivatedStatus(r.userStatus)).forEach((r) => {
        const email = extractEmail(r.email);
        const found = (email && byEmail.get(email)) || byName.get(normText(r.name));
        if (!found) return;
        matchedItemIds.add(found.id);
        if (normText(found.values[statusCol.id]?.text) === 'desativado') return;
        ops.push({ key: baseRowKey(r), name: r.name, itemId: found.id, update: { [statusCol.id]: { type: statusCol.type, raw: 'Desativado' } }, checks: [] });
      });
    }

    if (data.runId) {
      await dbWriteBestEffort('prepareMirror', () =>
        db.collection(panelUploadRunsCollection).doc(data.runId as string).update({ boardId, groupId: group?.id ?? '', lastActivityAt: new Date().toISOString() })
      );
    }

    return {
      boardId,
      boardName: board.name,
      groupId: group?.id ?? '',
      groupCreated,
      ops,
      totals: {
        basePeople: baseRows.length,
        boardItems: items.items.length,
        onlyInBoard: items.items.filter((it) => !matchedItemIds.has(it.id)).length,
        boardDuplicates,
        itemsMissing: ops.filter((o) => o.create).length,
        checksExpected,
        checksConfirmed,
        checksWithoutColumn,
        teamColumn: teamCol ? `${teamCol.title} (id ${teamCol.id}, ${teamCol.type})` : null,
        fieldsPending: ops.filter((o) => o.update).length,
        boardDuplicateNames,
        teamExpected,
        teamConfirmed,
      },
    };
  });

/** Envia um lote (só criações OU só checks/campos) para o grupo informado. Devolve o erro bruto por item. */
export const mirrorWriteBatch = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      token: tokenSchema,
      boardId: z.string().min(1),
      groupId: z.string().min(1),
      runId: z.string().optional(),
      items: z.array(z.object({
        key: z.string().min(1).max(700),
        op: z.enum(['create', 'update']),
        itemId: z.string().optional(),
        name: z.string().min(1).max(500),
        values: z.record(z.string(), z.object({ type: z.string(), raw: z.string() })),
      })).min(1).max(100),
      clientClaim: claimSchema,
    })
  )
  .handler(async ({ data }): Promise<BatchCallResult> => {
    await requireManager(data.clientClaim);
    if (data.boardId !== (await engagementBoardId())) {
      return { delivered: false, kind: 'outro', message: 'Quadro diferente do configurado. Nada foi enviado.' };
    }
    const updateIds = data.items.filter((i) => i.op === 'update' && i.itemId).map((i) => i.itemId as string);
    if (updateIds.length > 0) {
      const gc = await mondayItemGroups(data.token, updateIds);
      if (!gc.ok) return { delivered: false, kind: gc.kind, message: gc.message };
      if (updateIds.some((id) => gc.groups.get(id) !== data.groupId)) {
        return { delivered: false, kind: 'outro', message: 'Um dos itens não pertence a este grupo. Envio interrompido para proteger outras semanas.' };
      }
    }
    const inputs = data.items.map((it) => {
      const cv: Record<string, unknown> = {};
      Object.entries(it.values).forEach(([colId, v]) => {
        const val = toColumnValue(v.type, v.raw);
        if (val !== null) cv[colId] = val;
      });
      return { key: it.key, op: it.op, itemId: it.itemId, name: it.name, columnValues: cv };
    });
    const res = await mondayUpsertItemsBatch(data.token, data.boardId, data.groupId, inputs);
    if (!res.delivered) console.error(`[espelho] lote rejeitado (${res.kind}): ${res.message}`);
    else res.outcomes.filter((o) => o.error).slice(0, 3).forEach((o) => console.error(`[espelho] item rejeitado (${o.kind}): ${o.error}`));
    if (data.runId) {
      await dbWriteBestEffort('mirrorWriteBatch', () =>
        db.collection(panelUploadRunsCollection).doc(data.runId as string).update({ lastActivityAt: new Date().toISOString() })
      );
    }
    return res;
  });

/** Fecha a gravação com os totais confirmados e atualiza a fila de pendências da semana. */
export const finishMirrorRun = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      runId: z.string().min(1),
      groupName: groupSchema,
      status: z.enum(['concluido', 'concluido_com_falhas', 'parado', 'cancelado', 'erro']),
      stopReason: z.string().max(1000).optional(),
      toCreate: z.number().int().min(0),
      toUpdate: z.number().int().min(0),
      created: z.number().int().min(0),
      updated: z.number().int().min(0),
      checksMarked: z.number().int().min(0),
      checksExpected: z.number().int().min(0),
      checksWithoutColumn: z.number().int().min(0),
      fieldsTodo: z.number().int().min(0).optional(),
      fieldsDone: z.number().int().min(0).optional(),
      teamExpected: z.number().int().min(0).optional(),
      teamConfirmed: z.number().int().min(0).optional(),
      failuresByStage: z.record(z.string().max(20), z.number().int().min(0)).optional(),
      duplicateNames: z.array(z.string().max(700)).max(50).optional(),
      failed: z.number().int().min(0),
      pending: z.number().int().min(0),
      pendingNames: z.array(z.string().max(500)).max(200),
      checksPending: z.number().int().min(0),
      failures: z.array(z.object({ row: z.number().int().min(0), name: z.string().max(500), reason: z.string().max(1000), stage: z.enum(['criar', 'campos', 'checks', 'equipes']).optional() })).max(4000),
      metrics: z.any().optional(),
      clientClaim: claimSchema,
    })
  )
  .handler(async ({ data }) => {
    await requireManager(data.clientClaim);
    await dbWriteBestEffort('finishMirrorRun', () =>
      db.collection(panelUploadRunsCollection).doc(data.runId).update({
        status: data.status, stopReason: data.stopReason, toCreate: data.toCreate, toUpdate: data.toUpdate,
        created: data.created, updated: data.updated, checksMarked: data.checksMarked, checksExpected: data.checksExpected,
        checksWithoutColumn: data.checksWithoutColumn, failed: data.failed, pending: data.pending,
        fieldsTodo: data.fieldsTodo, fieldsDone: data.fieldsDone, teamExpected: data.teamExpected, teamConfirmed: data.teamConfirmed,
        failuresByStage: data.failuresByStage, duplicateNames: data.duplicateNames,
        failures: data.failures.slice(0, 500) as PanelUploadFailure[], metrics: data.metrics,
        finishedAt: new Date().toISOString(), lastActivityAt: new Date().toISOString(),
      })
    );
    const qref = db.collection(mirrorQueueCollection).doc(queueId(data.groupName));
    if (data.pending === 0 && data.checksPending === 0) {
      await qref.delete().catch(() => null);
    } else {
      await dbWriteBestEffort('mirrorQueue', () =>
        qref.set({
          group: data.groupName.trim(), pendingCount: data.pending, pendingNames: data.pendingNames.slice(0, 200),
          checksPending: data.checksPending, lastError: data.stopReason ?? data.failures[0]?.reason ?? '', updatedAt: new Date().toISOString(),
        })
      );
    }
    return { ok: true as const };
  });

/** Semanas com itens ou checks que ficaram na Base sem confirmação no quadro. */
export const getMirrorQueues = createServerFn({ method: 'POST' })
  .validator(z.object({ clientClaim: claimSchema }))
  .handler(async ({ data }) => {
    await requireManager(data.clientClaim);
    const docs = await db.collection(mirrorQueueCollection).limit(200).get();
    return docs.map((d) => ({ id: d.id, ...d.data })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  });
