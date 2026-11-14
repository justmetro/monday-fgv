// Leitura e gravação da Base interna e leitura completa do quadro (somente servidor).
import { db } from '@vibe/db/server';
import { parseDateFlexible, toISODate, weekWindowOf } from '@generated/lib/dates';
import {
  baseWeekStatusCollection,
  type BaseWeekStatusDoc,
  boardIdsConfigCollection,
  engagementChunksCollection,
  projectsDocCollection,
  snapshotMetaCollection,
  type ImportReport,
  type SnapshotMetaDoc,
  type StoredEngagementRow,
} from '@generated/models';
import { filterActiveProjects } from '@generated/lib/activeProjects';
import { baseRowKey, isoOf, mergeRow, rowFingerprint } from '@generated/lib/baseRows';

function valuesFingerprint(v: Record<string, string> | undefined): string {
  return JSON.stringify(Object.entries(v ?? {}).sort(([a], [b]) => a.localeCompare(b)));
}

export function sameRow(a: StoredEngagementRow, b: StoredEngagementRow): boolean {
  return rowFingerprint(a) === rowFingerprint(b) && valuesFingerprint(a.boardValues) === valuesFingerprint(b.boardValues);
}
import { emptyDayCounts, findWeekdayColumns, isCheckedValue, isWeekdayKey, normText, sortDays, weekdayOfIso, WEEKDAYS, type WeekdayKey } from '@generated/lib/weekdays';
import { periodError } from '@generated/lib/weekPeriod';
import { resolveSession, type UserSessionInfo } from './session.server';
import { dbReadWithRetry, dbWriteWithRetry } from './vibeDbRetry.server';
import { isWritableType, mondayCallOnce, mondayReadGroupItems } from './mondayWrite.server';

export const META_DOC_ID = 'main_meta';
export const PROJECTS_DOC_ID = 'main_projects';
const BOARD_IDS_DOC_ID = 'main_board_ids';
const CHUNK_SIZE = 150; // linhas por documento (com os valores do quadro, fica bem abaixo do limite)

export type ClientClaim = { id?: string | number; email?: string; name?: string; isAdmin?: boolean } | undefined;

/**
 * Acesso à aba Base: dono do app ou e-mail na lista de PMOs.
 * Usa a mesma verificação das demais abas (resolveSession lê a lista de PMOs a cada chamada).
 */
export async function requireBaseAccess(claim: ClientClaim): Promise<UserSessionInfo> {
  const session = await resolveSession(claim);
  if (!(session.isOwner || session.isPmo)) {
    throw new Error('Apenas o dono do app e os membros da lista de PMOs têm acesso à Base.');
  }
  return session;
}

/** Acesso da aba Atualizar Painel (mesma regra de gestão de hoje). */
export async function requireManager(claim: ClientClaim): Promise<UserSessionInfo> {
  const session = await resolveSession(claim);
  if (!session.canManage) throw new Error('Apenas o dono, Administradores e membros do PMO podem atualizar o painel.');
  return session;
}

export async function loadBaseRows(): Promise<{ rows: StoredEngagementRow[]; meta: SnapshotMetaDoc | null }> {
  const metaDoc = await dbReadWithRetry('base_meta', () => db.collection(snapshotMetaCollection).doc(META_DOC_ID).get());
  const meta = metaDoc?.data ?? null;
  const count = meta?.chunkCount ?? 0;
  const docs = await Promise.all(
    Array.from({ length: count }, (_, i) =>
      dbReadWithRetry(`base_chunk_${i}`, () => db.collection(engagementChunksCollection).doc(`chunk_${i}`).get())
    )
  );
  if (docs.some((d) => !d?.data)) throw new Error('A Base salva está incompleta no momento da leitura. Tente de novo.');
  const rows: StoredEngagementRow[] = [];
  docs.forEach((d) => rows.push(...(d?.data?.rows ?? [])));
  return { rows, meta };
}

/** Regrava a Base inteira (chunks + metadados), mantendo projetos. */
export async function saveBaseRows(rows: StoredEngagementRow[], session: UserSessionInfo, report?: ImportReport): Promise<void> {
  const chunks: StoredEngagementRow[][] = [];
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) chunks.push(rows.slice(i, i + CHUNK_SIZE));
  for (let idx = 0; idx < chunks.length; idx++) {
    await dbWriteWithRetry(`base_chunk_${idx}`, () =>
      db.collection(engagementChunksCollection).doc(`chunk_${idx}`).set({ index: idx, rows: chunks[idx] ?? [] })
    );
  }
  for (let guard = 0; guard < 20; guard++) {
    const stale = await db.collection(engagementChunksCollection).where('index', '>=', chunks.length).limit(500).get();
    if (stale.length === 0) break;
    await Promise.all(stale.map((d) => db.collection(engagementChunksCollection).doc(d.id).delete()));
  }
  const [prevMeta, projects] = await Promise.all([
    db.collection(snapshotMetaCollection).doc(META_DOC_ID).get(),
    db.collection(projectsDocCollection).doc(PROJECTS_DOC_ID).get(),
  ]);
  const meta: SnapshotMetaDoc = {
    updatedAt: new Date().toISOString(),
    updatedBy: { id: session.id, name: session.name, email: session.email },
    rowsCount: rows.length,
    projectsCount: projects?.data ? filterActiveProjects(projects.data.projects).length : prevMeta?.data?.projectsCount ?? 0,
    chunkCount: chunks.length,
    importReport: report ?? prevMeta?.data?.importReport,
  };
  await dbWriteWithRetry('base_meta', () => db.collection(snapshotMetaCollection).doc(META_DOC_ID).set(meta));
}

export interface UpsertResult {
  created: number;
  updated: number;
  unchanged: number;
}

/** Junta linhas na Base por pessoa + semana (nunca duplica). */
export function upsertInto(
  base: StoredEngagementRow[],
  incoming: StoredEngagementRow[],
  mode: 'analysis' | 'rewrite' | 'board'
): { rows: StoredEngagementRow[]; result: UpsertResult } {
  const map = new Map<string, StoredEngagementRow>();
  base.forEach((r) => {
    const k = baseRowKey(r);
    const prev = map.get(k);
    map.set(k, prev ? mergeRow(prev, r, 'analysis') : r); // duplicadas antigas viram uma só
  });
  const result: UpsertResult = { created: 0, updated: 0, unchanged: 0 };
  incoming.forEach((r) => {
    const k = baseRowKey(r);
    const prev = map.get(k);
    const next = mergeRow(prev, r, mode);
    if (!prev) result.created++;
    else if (sameRow(prev, next)) { result.unchanged++; return; }
    else result.updated++;
    map.set(k, next);
  });
  return { rows: Array.from(map.values()), result };
}

// ---------- Intervalo da semana guardado por grupo ----------

export const weekDocId = (group: string) => `w_${normText(group).replace(/[^a-z0-9]+/g, '_').slice(0, 80) || 'grupo'}`;

export interface WeekRange { weekStart: string; weekEnd: string }

/** Domingo a sábado da semana que contém a data (AAAA-MM-DD). */
export function rangeOfDate(iso: string): WeekRange | null {
  const d = parseDateFlexible(iso);
  if (!d) return null;
  const w = weekWindowOf(d);
  return { weekStart: toISODate(w.start), weekEnd: toISODate(w.end) };
}

export async function getWeekRange(group: string): Promise<(WeekRange & { doc: BaseWeekStatusDoc }) | null> {
  const doc = await dbReadWithRetry('week_range', () => db.collection(baseWeekStatusCollection).doc(weekDocId(group)).get());
  const d = doc?.data;
  return d?.weekStart && d.weekEnd ? { weekStart: d.weekStart, weekEnd: d.weekEnd, doc: d } : null;
}

const br = (iso: string) => iso.split('-').reverse().join('/');

/**
 * Garante o período guardado do grupo, que vem sempre do que foi digitado (domingo a sábado).
 * Grupo novo: guarda o período (já definido, não pendente). Grupo existente com outro período:
 * só muda com `allowChange` (confirmação do usuário) e nunca em semana validada.
 */
export async function ensureWeekRange(group: string, analysisDate: string, session: UserSessionInfo, want: WeekRange, opts?: { allowChange?: boolean }): Promise<WeekRange> {
  const bad = periodError(want.weekStart, want.weekEnd);
  if (bad) throw new Error(`${bad} Nada foi gravado.`);
  const stored = await getWeekRange(group);
  if (stored && stored.weekStart === want.weekStart && stored.weekEnd === want.weekEnd) return stored;
  if (stored) {
    if (stored.doc.status === 'validada') {
      throw new Error(`O grupo "${group}" está validado com o período ${br(stored.weekStart)} a ${br(stored.weekEnd)}. Reabra a semana antes de mudar o período. Nada foi gravado.`);
    }
    if (!opts?.allowChange) {
      throw new Error(`O grupo "${group}" já existe com o período ${br(stored.weekStart)} a ${br(stored.weekEnd)}, e você digitou ${br(want.weekStart)} a ${br(want.weekEnd)}. Confirme a mudança de período na prévia. Nada foi gravado.`);
    }
  }
  const prev = (await db.collection(baseWeekStatusCollection).doc(weekDocId(group)).get())?.data;
  const next: BaseWeekStatusDoc = {
    ...(prev ?? {}),
    group: prev?.group ?? group,
    status: prev?.status ?? 'pendente',
    updatedAt: prev?.updatedAt ?? new Date().toISOString(),
    updatedByEmail: prev?.updatedByEmail ?? session.email,
    updatedByName: prev?.updatedByName ?? session.name,
    weekStart: want.weekStart,
    weekEnd: want.weekEnd,
    rangeFromDate: analysisDate,
  };
  delete next.periodPending;
  await dbWriteWithRetry('week_range_set', () => db.collection(baseWeekStatusCollection).doc(weekDocId(group)).set(next));
  return want;
}

/** Volta a semana para pendente (checks reprocessados ou alterados). */
export async function markWeekPending(group: string, session: UserSessionInfo, reprocessed = false): Promise<void> {
  const ref = db.collection(baseWeekStatusCollection).doc(weekDocId(group));
  const prev = (await ref.get())?.data;
  const now = new Date().toISOString();
  await dbWriteWithRetry('week_pending', () =>
    ref.set({
      ...(prev ?? {}),
      group: prev?.group ?? group,
      status: 'pendente',
      updatedAt: now,
      updatedByEmail: session.email,
      updatedByName: session.name,
      ...(reprocessed ? { lastReprocessedAt: now } : {}),
    })
  );
}

/**
 * Recalcula os checks das linhas do grupo a partir do "Ativo pela última vez" dentro do intervalo guardado,
 * no dia da semana correspondente. Só acrescenta (nunca remove check) e grava início/fim da semana na linha.
 */
export function recomputeGroupChecks(rows: StoredEngagementRow[], group: string, range: WeekRange) {
  const g = normText(group);
  let added = 0;
  let outside = 0;
  let noAccess = 0;
  const next = rows.map((r) => {
    if (normText(r.group) !== g) return r;
    const la = isoOf(r.lastAccess);
    const days = new Set<string>(r.checkedDays ?? []);
    if (!la) noAccess++;
    else if (la < range.weekStart || la > range.weekEnd) outside++;
    else {
      const wd = weekdayOfIso(la);
      if (wd && !days.has(wd)) { days.add(wd); added++; }
    }
    return { ...r, weekStart: range.weekStart, weekEnd: range.weekEnd, checkedDays: sortDays(Array.from(days)) };
  });
  const byDay = emptyDayCounts();
  next.forEach((r) => {
    if (normText(r.group) !== g) return;
    (r.checkedDays ?? []).forEach((d) => { if (isWeekdayKey(d)) byDay[d]++; });
  });
  return { rows: next, added, outside, noAccess, byDay, people: next.filter((r) => normText(r.group) === g).length };
}

export async function engagementBoardId(): Promise<string> {
  const doc = await db.collection(boardIdsConfigCollection).doc(BOARD_IDS_DOC_ID).get();
  const id = doc?.data?.engagementBoardId?.trim() ?? '';
  if (!id) throw new Error('O ID do quadro de Análise de Engajamento não está configurado (Atualizar Painel → Sincronização Completa de Quadros).');
  return id;
}

export interface BoardColumn { id: string; title: string; type: string }
export interface BoardMeta { id: string; name: string; columns: BoardColumn[]; groups: { id: string; title: string }[] }

export async function readBoardMeta(token: string, boardId: string): Promise<BoardMeta> {
  const res = await mondayCallOnce<{ boards: BoardMeta[] }>(
    token,
    `query ($ids: [ID!]) { boards(ids: $ids) { id name columns { id title type } groups { id title } } }`,
    { ids: [boardId] }
  );
  if (!res.ok) throw new Error(`Erro retornado pelo monday: ${res.message}`);
  const board = res.data.boards?.[0];
  if (!board) throw new Error('Quadro de Análise de Engajamento não encontrado ou sem permissão para o token informado.');
  return board;
}

/** Colunas do quadro que formam a linha da Base. */
export function boardColumnRoles(columns: BoardColumn[]) {
  const byTitle = (t: string) => columns.find((c) => normText(c.title) === normText(t));
  const weekdayCols = findWeekdayColumns(columns);
  return {
    email: columns.find((c) => c.type === 'email') ?? byTitle('E-mail') ?? byTitle('Email') ?? null,
    team: byTitle('Equipes') ?? byTitle('Equipe') ?? byTitle('Times') ?? byTitle('Teams') ?? null,
    department: byTitle('Departamento') ?? null,
    lastAccess: byTitle('Ativo pela última vez') ?? null,
    date: columns.find((c) => normText(c.title) === 'date' && c.type === 'date') ?? null,
    weekStart: byTitle('Início da semana') ?? null,
    status: byTitle('Status do usuário') ?? null,
    createdAt: byTitle('Criado em') ?? null,
    days: (weekdayCols.found ?? {}) as Partial<Record<WeekdayKey, BoardColumn>>,
    missingDays: weekdayCols.missing,
  };
}

/** Lê o quadro inteiro (todos os grupos) no formato da Base. Lança com o erro bruto do monday. */
export async function readBoardAsBaseRows(token: string): Promise<{
  board: BoardMeta;
  rows: StoredEngagementRow[];
  duplicates: number;
}> {
  const boardId = await engagementBoardId();
  const board = await readBoardMeta(token, boardId);
  const roles = boardColumnRoles(board.columns);
  const dayCols = WEEKDAYS.map((w) => ({ key: w.key, col: roles.days[w.key] })).filter((d) => d.col);
  const valueCols = board.columns.filter((c) => isWritableType(c.type) && c.type !== 'date');
  const ids = Array.from(new Set([
    ...valueCols.map((c) => c.id),
    ...[roles.email, roles.lastAccess, roles.date, roles.weekStart, roles.status, roles.team, roles.department, roles.createdAt].filter(Boolean).map((c) => (c as BoardColumn).id),
    ...dayCols.map((d) => (d.col as BoardColumn).id),
  ]));

  const map = new Map<string, StoredEngagementRow>();
  let duplicates = 0;
  for (const g of board.groups) {
    const res = await mondayReadGroupItems(token, boardId, g.id, ids);
    if (!res.ok) throw new Error(`Erro retornado pelo monday ao ler o grupo "${g.title}": ${res.message}`);
    res.items.forEach((it) => {
      const t = (c: BoardColumn | null) => (c ? (it.values[c.id]?.text ?? '').trim() : '');
      const checks: WeekdayKey[] = dayCols
        .filter((d) => isCheckedValue(it.values[(d.col as BoardColumn).id]?.value, it.values[(d.col as BoardColumn).id]?.text))
        .map((d) => d.key);
      const boardValues: Record<string, string> = {};
      valueCols.forEach((c) => { const v = (it.values[c.id]?.text ?? '').trim(); if (v) boardValues[c.title] = v; });
      const row: StoredEngagementRow = {
        name: it.name.trim(),
        email: t(roles.email),
        team: t(roles.team),
        department: t(roles.department),
        lastAccess: t(roles.lastAccess) || null,
        refDate: isoOf(t(roles.date)),
        weekStart: isoOf(t(roles.weekStart)) ?? (t(roles.weekStart) || null),
        userStatus: t(roles.status),
        group: g.title.trim(),
        checkedDays: sortDays(checks),
        boardValues,
        createdAt: isoOf(t(roles.createdAt)),
      };
      const k = baseRowKey(row);
      const prev = map.get(k);
      if (prev) duplicates++;
      map.set(k, prev ? mergeRow(prev, row, 'analysis') : row);
    });
  }
  return { board, rows: Array.from(map.values()), duplicates };
}
