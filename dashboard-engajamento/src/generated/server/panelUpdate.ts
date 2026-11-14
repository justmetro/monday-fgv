import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { db } from '@vibe/db/server';
import {
  boardIdsConfigCollection,
  panelUploadRunsCollection,
  panelUploadSettingsCollection,
  type PanelUploadFailure,
  type PanelUploadRunDoc,
} from '@generated/models';
import {
  ITEMS_PER_CALL_DEFAULT,
  ITEMS_PER_CALL_MAX,
  ITEMS_PER_CALL_MIN,
  PARALLEL_CALLS_DEFAULT,
  PARALLEL_CALLS_MAX,
  PARALLEL_CALLS_MIN,
  clampInt,
} from '@generated/lib/panelUploadLimits';
import { findWeekdayColumns, normText, weekdayOfIso } from '@generated/lib/weekdays';
import { assertTokenOwner, resolveSession, type UserSessionInfo } from './session.server';
import { dbWriteBestEffort, dbWriteWithRetry } from './vibeDbRetry.server';
import {
  isWritableType,
  mondayCallOnce,
  mondayItemGroups,
  mondayListGroupItems,
  mondayReadGroupItems,
  mondayUpsertItemsBatch,
  toColumnValue,
  type BatchCallResult,
  type BatchItemOutcome,
} from './mondayWrite.server';

const BOARD_IDS_DOC_ID = 'main_board_ids';
// Uma gravação "em andamento" sem atividade há mais que isso é considerada abandonada
const RUN_LOCK_STALE_MS = 3 * 60 * 1000;

const clientClaimSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    email: z.string().optional(),
    name: z.string().optional(),
    isAdmin: z.boolean().optional(),
  })
  .optional();

const tokenSchema = z.string().trim().min(1, 'Informe o token da API do monday.').max(2000);
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

async function requireManager(claim: z.infer<typeof clientClaimSchema>): Promise<UserSessionInfo> {
  const session = await resolveSession(claim);
  if (!session.canManage) throw new Error('Apenas o dono, Administradores e membros do PMO podem atualizar o painel.');
  return session;
}

async function engagementBoardId(): Promise<string> {
  const doc = await db.collection(boardIdsConfigCollection).doc(BOARD_IDS_DOC_ID).get();
  const id = doc?.data?.engagementBoardId?.trim() ?? '';
  if (!id) throw new Error('O ID do quadro de Análise de Engajamento não está configurado. Salve-o na aba Importar.');
  return id;
}

interface BoardMeta {
  boards: { id: string; name: string; columns: { id: string; title: string; type: string }[]; groups: { id: string; title: string }[] }[];
}

async function readBoard(token: string, boardId: string) {
  const res = await mondayCallOnce<BoardMeta>(
    token,
    `query ($ids: [ID!]) { boards(ids: $ids) { id name columns { id title type } groups { id title } } }`,
    { ids: [boardId] }
  );
  if (!res.ok) throw new Error(res.message);
  const board = res.data.boards?.[0];
  if (!board) throw new Error('Quadro de Análise de Engajamento não encontrado ou sem permissão para o token informado.');
  return board;
}

const processed = (r: PanelUploadRunDoc) => (r.created ?? 0) + (r.updated ?? 0) > 0 || r.status === 'em_andamento';

/** Envios anteriores com a mesma data da análise (para alertar repetição no mesmo grupo). */
async function sameDateRuns(analysisDate: string) {
  const docs = await db.collection(panelUploadRunsCollection).where('analysisDate', '==', analysisDate).limit(100).get();
  return docs.filter((d) => processed(d.data)).map((d) => d.data.groupName);
}

/** Lê colunas, o grupo digitado (se existir) e o histórico daquela data para montar a prévia. */
export const getPanelBoardContext = createServerFn({ method: 'POST' })
  .validator(z.object({ token: tokenSchema, groupName: z.string().trim().min(1).max(255), analysisDate: isoDateSchema, clientClaim: clientClaimSchema }))
  .handler(async ({ data }) => {
    await requireManager(data.clientClaim);
    if (!weekdayOfIso(data.analysisDate)) throw new Error('Data da análise inválida. Nada foi gravado.');
    const boardId = await engagementBoardId();
    const board = await readBoard(data.token, boardId);

    const weekdayCols = findWeekdayColumns(board.columns);
    if (!weekdayCols.found) {
      throw new Error(`Faltam colunas de check no quadro: ${weekdayCols.missing.join(', ')}. Crie-as no quadro; nada foi gravado.`);
    }
    const group = board.groups.find((g) => normText(g.title) === normText(data.groupName)) ?? null;

    // Lemos TODOS os itens e todas as colunas relevantes do grupo para garantir correspondência exata por e-mail e nome
    let groupItems: Awaited<ReturnType<typeof mondayReadGroupItems>> | null = null;
    if (group) {
      const relevant = board.columns
        .filter((c) => c.type === 'email' || c.type === 'date' || c.type === 'checkbox' || c.type === 'text' || normText(c.title).includes('email') || normText(c.title).includes('ativo'))
        .map((c) => c.id);
      groupItems = await mondayReadGroupItems(data.token, boardId, group.id, relevant);
      if (!groupItems.ok) throw new Error(`Não foi possível ler o grupo "${group.title}": ${groupItems.message}`);
    }

    const sameDate = await sameDateRuns(data.analysisDate);
    const sameGroupSameDate = sameDate.some((g) => normText(g) === normText(data.groupName));
    const otherGroupsSameDate = Array.from(new Set(sameDate.filter((g) => normText(g) !== normText(data.groupName))));

    return {
      boardName: board.name,
      columns: board.columns.map((c) => ({ ...c, writable: isWritableType(c.type) })),
      group: group ? { id: group.id, title: group.title } : null,
      groupItems: groupItems?.ok ? groupItems.items : [],
      sameGroupSameDate,
      otherGroupsSameDate,
    };
  });

async function assertNoRunInProgress(exceptId?: string) {
  const running = await db.collection(panelUploadRunsCollection).where('status', '==', 'em_andamento').limit(20).get();
  const now = Date.now();
  const active = running.find((r) => r.id !== exceptId && now - new Date(r.data.lastActivityAt).getTime() < RUN_LOCK_STALE_MS);
  if (active) throw new Error(`Já existe uma gravação em andamento (grupo "${active.data.groupName}"). Aguarde ela terminar.`);
}

/** Usa o grupo existente ou cria o grupo novo, e abre o registro do histórico. */
export const startPanelUpload = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      token: tokenSchema,
      groupName: z.string().trim().min(1).max(255),
      analysisDate: isoDateSchema,
      fileName: z.string().max(300),
      rowsRead: z.number().int().min(0),
      discardedByStatus: z.number().int().min(0),
      toCreate: z.number().int().min(0),
      toUpdate: z.number().int().min(0),
      unchanged: z.number().int().min(0),
      checksToMark: z.number().int().min(0),
      checkColumnId: z.string().min(1).max(100),
      updateColumnIds: z.array(z.string().min(1).max(100)).min(1).max(10),
      confirmOverwriteDate: z.boolean().optional(),
      confirmOtherGroup: z.boolean(),
      ignoredColumns: z.array(z.string().max(300)).max(500),
      clientClaim: clientClaimSchema,
    })
  )
  .handler(async ({ data }) => {
    const session = await requireManager(data.clientClaim);
    await assertTokenOwner(session, data.token);
    const weekday = weekdayOfIso(data.analysisDate);
    if (!weekday) return { ok: false as const, message: 'Data da análise inválida. Nada foi gravado.' };
    await assertNoRunInProgress();

    const sameDate = await sameDateRuns(data.analysisDate);
    if (sameDate.some((g) => normText(g) === normText(data.groupName)) && !data.confirmOverwriteDate) {
      return { ok: false as const, message: `O dia ${data.analysisDate} já foi enviado para o grupo "${data.groupName}". Confirme a reescrita na prévia para continuar.` };
    }
    if (sameDate.length > 0 && !sameDate.some((g) => normText(g) === normText(data.groupName)) && !data.confirmOtherGroup) {
      return { ok: false as const, message: 'Esta data já foi enviada para outro grupo. Confirme na prévia para continuar.' };
    }

    const boardId = await engagementBoardId();
    const board = await readBoard(data.token, boardId);
    const weekdayCols = findWeekdayColumns(board.columns);
    if (!weekdayCols.found) return { ok: false as const, message: `Faltam colunas de check no quadro: ${weekdayCols.missing.join(', ')}.` };
    if (weekdayCols.found[weekday]?.id !== data.checkColumnId) {
      return { ok: false as const, message: 'A coluna de check não corresponde ao dia da data da análise. Gere a prévia de novo.' };
    }

    const existing = board.groups.find((g) => normText(g.title) === normText(data.groupName));
    let groupId = existing?.id ?? '';
    if (!existing) {
      const created = await mondayCallOnce<{ create_group: { id: string } }>(
        data.token,
        `mutation ($boardId: ID!, $groupName: String!) { create_group(board_id: $boardId, group_name: $groupName) { id } }`,
        { boardId, groupName: data.groupName }
      );
      if (!created.ok) return { ok: false as const, message: `Não foi possível criar o grupo "${data.groupName}": ${created.message}` };
      groupId = created.data.create_group?.id ?? '';
      if (!groupId) return { ok: false as const, message: `O monday não devolveu o ID do grupo criado.` };
    }

    const now = new Date().toISOString();
    const doc = await dbWriteWithRetry('startPanelUpload', () =>
      db.collection(panelUploadRunsCollection).add({
        groupName: data.groupName,
        groupId,
        boardId,
        analysisDate: data.analysisDate,
        fileName: data.fileName,
        startedAt: now,
        lastActivityAt: now,
        status: 'em_andamento',
        toCreate: data.toCreate,
        toUpdate: data.toUpdate,
        created: 0,
        updated: 0,
        checksMarked: 0,
        failed: 0,
        pending: data.toCreate + data.toUpdate,
        rowsRead: data.rowsRead,
        discardedByStatus: data.discardedByStatus,
        unchanged: data.unchanged,
        uploadedByEmail: session.email,
        uploadedByName: session.name,
        uploadedById: session.id,
        ignoredColumns: data.ignoredColumns,
        failures: [],
      })
    );

    return { ok: true as const, runId: doc.id, groupId, boardId };
  });

/** Envia um lote de itens para o grupo da gravação aberta (alias para executePanelBatch e createPanelItemsBatch). */
export const createPanelItemsBatch = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      token: tokenSchema,
      runId: z.string().min(1),
      items: z.array(
        z.object({
          key: z.string().min(1),
          op: z.enum(['create', 'update']),
          itemId: z.string().optional(),
          name: z.string().min(1),
          values: z.record(z.string(), z.object({ type: z.string(), raw: z.string() })),
        })
      ),
      clientClaim: clientClaimSchema,
    })
  )
  .handler(async ({ data }): Promise<BatchCallResult> => {
    await requireManager(data.clientClaim);
    const runDoc = await db.collection(panelUploadRunsCollection).doc(data.runId).get();
    if (!runDoc || runDoc.data.status !== 'em_andamento') {
      return { delivered: false, kind: 'outro', message: 'A gravação não está em andamento.' };
    }

    const { boardId, groupId } = runDoc.data;

    // Defesa: se algum item tem 'update', confere se ele realmente pertence a este grupo
    const updateIds = data.items.filter((i) => i.op === 'update' && i.itemId).map((i) => i.itemId as string);
    if (updateIds.length > 0) {
      const gCheck = await mondayItemGroups(data.token, updateIds);
      if (!gCheck.ok) return { delivered: false, kind: gCheck.kind, message: gCheck.message };
      const outOfGroup = updateIds.find((id) => gCheck.groups.get(id) !== groupId);
      if (outOfGroup) {
        return {
          delivered: false,
          kind: 'outro',
          message: 'Um dos itens a atualizar não pertence a este grupo. A gravação foi interrompida para proteger outras semanas.',
        };
      }
    }

    const batchInputs = data.items.map((it) => {
      const cv: Record<string, unknown> = {};
      Object.entries(it.values).forEach(([colId, v]) => {
        const val = toColumnValue(v.type, v.raw);
        if (val !== null) cv[colId] = val;
      });
      return { key: it.key, op: it.op, itemId: it.itemId, name: it.name, columnValues: cv };
    });

    const res = await mondayUpsertItemsBatch(data.token, boardId, groupId, batchInputs);
    await dbWriteBestEffort('executePanelBatch', () =>
      db.collection(panelUploadRunsCollection).doc(data.runId).update({ lastActivityAt: new Date().toISOString() })
    );
    return res;
  });

export const executePanelBatch = createPanelItemsBatch;

/** Lista nome e e-mail dos itens que já estão no grupo (para conferência antes do reenvio). */
export const listPanelGroupItems = createServerFn({ method: 'POST' })
  .validator(z.object({ token: tokenSchema, runId: z.string().min(1), emailColumnId: z.string().nullable(), clientClaim: clientClaimSchema }))
  .handler(async ({ data }) => {
    await requireManager(data.clientClaim);
    const runDoc = await db.collection(panelUploadRunsCollection).doc(data.runId).get();
    if (!runDoc) throw new Error('Gravação não encontrada.');
    const { boardId, groupId } = runDoc.data;
    return mondayListGroupItems(data.token, boardId, groupId, data.emailColumnId);
  });

/** Encerra a gravação com os totais finais. */
export const finishPanelUpload = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      runId: z.string().min(1),
      status: z.enum(['concluido', 'concluido_com_falhas', 'parado', 'cancelado', 'erro']),
      stopReason: z.string().max(500).optional(),
      created: z.number().int().min(0),
      updated: z.number().int().min(0),
      checksMarked: z.number().int().min(0),
      failed: z.number().int().min(0),
      pending: z.number().int().min(0),
      failures: z.array(
        z.object({
          row: z.number().int().min(0),
          name: z.string(),
          reason: z.string(),
        })
      ).max(2000),
      metrics: z.any().optional(),
      clientClaim: clientClaimSchema,
    })
  )
  .handler(async ({ data }) => {
    await requireManager(data.clientClaim);
    await dbWriteBestEffort('finishPanelUpload', () =>
      db.collection(panelUploadRunsCollection).doc(data.runId).update({
        status: data.status,
        stopReason: data.stopReason,
        created: data.created,
        updated: data.updated,
        checksMarked: data.checksMarked,
        failed: data.failed,
        pending: data.pending,
        failures: data.failures.slice(0, 500) as PanelUploadFailure[],
        metrics: data.metrics,
        lastActivityAt: new Date().toISOString(),
      })
    );
    return { ok: true as const };
  });

/** Retoma uma gravação parada ou cancelada. */
export const resumePanelUpload = createServerFn({ method: 'POST' })
  .validator(z.object({ runId: z.string().min(1), clientClaim: clientClaimSchema }))
  .handler(async ({ data }) => {
    await requireManager(data.clientClaim);
    await assertNoRunInProgress(data.runId);
    await dbWriteBestEffort('resumePanelUpload', () =>
      db.collection(panelUploadRunsCollection).doc(data.runId).update({
        status: 'em_andamento',
        stopReason: undefined,
        lastActivityAt: new Date().toISOString(),
      })
    );
    return { ok: true as const };
  });

/** Lê as últimas 100 gravações para a tabela de histórico. */
export const getPanelUploadHistory = createServerFn({ method: 'POST' })
  .validator(z.object({ clientClaim: clientClaimSchema }).optional())
  .handler(async ({ data }) => {
    await requireManager(data?.clientClaim);
    const docs = await db.collection(panelUploadRunsCollection).orderBy('startedAt', 'desc').limit(100).get();
    return docs.map((d) => ({ id: d.id, ...d.data }));
  });

/** Lê os ajustes de lote/paralelismo salvos pelo usuário (ou padrões). */
export const getPanelUploadSettings = createServerFn({ method: 'POST' })
  .validator(z.object({ clientClaim: clientClaimSchema }).optional())
  .handler(async ({ data }) => {
    const session = await resolveSession(data?.clientClaim);
    if (!session.canManage) return null;
    const doc = await db.collection(panelUploadSettingsCollection).doc(session.email).get();
    return {
      itemsPerCall: clampInt(doc?.data?.itemsPerCall ?? ITEMS_PER_CALL_DEFAULT, ITEMS_PER_CALL_MIN, ITEMS_PER_CALL_MAX, ITEMS_PER_CALL_DEFAULT),
      parallelCalls: clampInt(doc?.data?.parallelCalls ?? PARALLEL_CALLS_DEFAULT, PARALLEL_CALLS_MIN, PARALLEL_CALLS_MAX, PARALLEL_CALLS_DEFAULT),
    };
  });

/** Salva os ajustes de lote/paralelismo para o usuário logado. */
export const savePanelUploadSettings = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      itemsPerCall: z.number().int().min(ITEMS_PER_CALL_MIN).max(ITEMS_PER_CALL_MAX),
      parallelCalls: z.number().int().min(PARALLEL_CALLS_MIN).max(PARALLEL_CALLS_MAX),
      clientClaim: clientClaimSchema,
    })
  )
  .handler(async ({ data }) => {
    const session = await requireManager(data.clientClaim);
    await dbWriteBestEffort('savePanelUploadSettings', () =>
      db.collection(panelUploadSettingsCollection).doc(session.email).set({
        itemsPerCall: data.itemsPerCall,
        parallelCalls: data.parallelCalls,
        updatedAt: new Date().toISOString(),
      })
    );
    return { ok: true as const };
  });
