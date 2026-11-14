// Semanas da Base: espelho do quadro na importação pela API e registro de ações (somente servidor).
import { db } from '@vibe/db/server';
import {
  baseWeekLogCollection,
  baseWeekStatusCollection,
  mirrorQueueCollection,
  type BaseWeekLogDoc,
  type ImportReport,
  type StoredEngagementRow,
  type WeeksImportReport,
} from '@generated/models';
import { baseRowKey, mergeRow } from '@generated/lib/baseRows';
import { normText } from '@generated/lib/weekdays';
import { loadBaseRows, saveBaseRows, weekDocId } from './base.server';
import type { UserSessionInfo } from './session.server';
import { dbReadWithRetry, dbWriteWithRetry } from './vibeDbRetry.server';

export const normGroupKey = (g: string | undefined | null) => normText(g);

/** Registra no histórico quem fez o quê, em qual semana e quando. */
export async function logWeekAction(
  session: Pick<UserSessionInfo, 'email' | 'name'>,
  action: BaseWeekLogDoc['action'],
  group: string,
  detail?: string
): Promise<void> {
  try {
    await dbWriteWithRetry('baseWeekLog', () =>
      db.collection(baseWeekLogCollection).add({
        at: new Date().toISOString(),
        action,
        group,
        byEmail: session.email,
        byName: session.name,
        ...(detail ? { detail } : {}),
      })
    );
  } catch (e) {
    console.error('Erro ao registrar a ação da semana:', e);
  }
}

/** Grupos (normalizados) de semanas sem período definido: ficam fora dos scores e painéis. */
export async function loadPendingPeriodKeys(): Promise<Set<string>> {
  const docs = await dbReadWithRetry('semanas_pendentes', () => db.collection(baseWeekStatusCollection).limit(1000).get());
  const out = new Set<string>();
  docs.forEach((d) => {
    if (d.data.periodPending && !(d.data.weekStart && d.data.weekEnd)) out.add(normGroupKey(d.data.group));
  });
  return out;
}

/**
 * Importação pela API: deixa as semanas e as linhas de pessoas da Base iguais ao quadro.
 * Só é chamada depois que o quadro foi lido por inteiro. Não mexe em afastamentos, PMO, de-para,
 * histórico de envios nem IDs dos quadros.
 */
export async function mirrorBoardWeeksIntoBase(
  session: UserSessionInfo,
  incoming: StoredEngagementRow[],
  boardGroupTitles: string[],
  buildReport: (weeks: WeeksImportReport, rowsSaved: number) => ImportReport
): Promise<{ weeks: WeeksImportReport; report: ImportReport }> {
  const [{ rows: existing }, weekDocs, queueDocs] = await Promise.all([
    loadBaseRows(),
    dbReadWithRetry('semanas_import', () => db.collection(baseWeekStatusCollection).limit(1000).get()),
    dbReadWithRetry('fila_import', () => db.collection(mirrorQueueCollection).limit(1000).get()),
  ]);

  // Semanas do quadro (grupos) e semanas que já existem na Base
  const boardWeeks = new Map<string, string>();
  boardGroupTitles.forEach((t) => { const k = normGroupKey(t); if (k && !boardWeeks.has(k)) boardWeeks.set(k, t.trim()); });
  incoming.forEach((r) => { const k = normGroupKey(r.group); if (k && !boardWeeks.has(k)) boardWeeks.set(k, (r.group ?? '').trim()); });
  const baseWeeks = new Map<string, string>();
  existing.forEach((r) => { const k = normGroupKey(r.group); if (k && !baseWeeks.has(k)) baseWeeks.set(k, (r.group ?? '').trim()); });
  weekDocs.forEach((d) => { const k = normGroupKey(d.data.group); if (k && !baseWeeks.has(k)) baseWeeks.set(k, d.data.group); });

  const kept: string[] = [];
  const created: string[] = [];
  const removed: string[] = [];
  boardWeeks.forEach((title, k) => (baseWeeks.has(k) ? kept : created).push(title));
  baseWeeks.forEach((title, k) => { if (!boardWeeks.has(k)) removed.push(title); });

  const docByKey = new Map(weekDocs.map((d) => [normGroupKey(d.data.group), d.data]));
  const prevByRow = new Map(existing.map((r) => [baseRowKey(r), r]));

  const merged = new Map<string, StoredEngagementRow>();
  incoming.forEach((r) => {
    const gk = normGroupKey(r.group);
    if (!gk) return;
    const doc = docByKey.get(gk);
    const hasRange = Boolean(doc?.weekStart && doc.weekEnd);
    const noPeriod = !baseWeeks.has(gk) || (Boolean(doc?.periodPending) && !hasRange);
    const prev = prevByRow.get(baseRowKey(r));
    const next: StoredEngagementRow = {
      ...r,
      group: boardWeeks.get(gk) ?? r.group,
      // Semana mantida: período guardado; semana nova (ou ainda sem período): sem período
      weekStart: noPeriod ? null : hasRange ? (doc?.weekStart ?? null) : r.weekStart,
      weekEnd: noPeriod ? null : hasRange ? (doc?.weekEnd ?? null) : prev?.weekEnd ?? null,
      createdAt: r.createdAt || prev?.createdAt || null,
      ...(prev?.boardValues ? { boardValues: prev.boardValues } : {}),
    };
    const key = baseRowKey(next);
    const dup = merged.get(key);
    merged.set(key, dup ? mergeRow(dup, next, 'analysis') : next);
  });
  const finalRows = Array.from(merged.values());

  const peopleBy = new Map<string, number>();
  finalRows.forEach((r) => { const k = normGroupKey(r.group); peopleBy.set(k, (peopleBy.get(k) ?? 0) + 1); });
  const pendingPeriod = Array.from(boardWeeks.entries())
    .filter(([k]) => !baseWeeks.has(k) || (docByKey.get(k)?.periodPending && !(docByKey.get(k)?.weekStart && docByKey.get(k)?.weekEnd)))
    .map(([, t]) => t);
  const weeks: WeeksImportReport = {
    kept, created, removed,
    people: Array.from(boardWeeks.entries()).map(([k, t]) => ({ group: t, people: peopleBy.get(k) ?? 0 })),
    pendingPeriod,
  };

  // Gravação: só chega aqui com o quadro lido por inteiro
  await saveBaseRows(finalRows, session, buildReport(weeks, finalRows.length));

  const now = new Date().toISOString();
  for (const title of created) {
    await dbWriteWithRetry('semana_nova', () =>
      db.collection(baseWeekStatusCollection).doc(weekDocId(title)).set({
        group: title, status: 'pendente', periodPending: true,
        updatedAt: now, updatedByEmail: session.email, updatedByName: session.name,
      })
    );
  }
  const removedKeys = new Set(removed.map(normGroupKey));
  for (const d of weekDocs) {
    if (removedKeys.has(normGroupKey(d.data.group))) await dbWriteWithRetry('semana_removida', () => db.collection(baseWeekStatusCollection).doc(d.id).delete());
  }
  for (const q of queueDocs) {
    if (removedKeys.has(normGroupKey(q.data.group))) await dbWriteWithRetry('fila_removida', () => db.collection(mirrorQueueCollection).doc(q.id).delete());
  }
  for (const title of removed) await logWeekAction(session, 'removida_na_importacao', title, 'Semana não existe mais no quadro');

  return { weeks, report: buildReport(weeks, finalRows.length) };
}
