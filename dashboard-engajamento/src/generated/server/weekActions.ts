// Ações sobre as semanas da Base: definir período, apagar, reabrir e listar semanas sem período.
// Só dono, admin do monday e PMO (conferido no servidor a cada chamada).
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { db } from '@vibe/db/server';
import { baseWeekStatusCollection, mirrorQueueCollection, type BaseWeekStatusDoc } from '@generated/models';
import { periodError } from '@generated/lib/weekPeriod';
import { normText } from '@generated/lib/weekdays';
import { loadBaseRows, recomputeGroupChecks, requireManager, saveBaseRows, weekDocId } from './base.server';
import { logWeekAction, normGroupKey } from './weekPeriod.server';
import { dbReadWithRetry, dbWriteWithRetry } from './vibeDbRetry.server';

const claimSchema = z
  .object({ id: z.union([z.string(), z.number()]).optional(), email: z.string().optional(), name: z.string().optional(), isAdmin: z.boolean().optional() })
  .optional();
const isoSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const groupSchema = z.string().trim().min(1).max(500);

async function readWeekDoc(group: string): Promise<BaseWeekStatusDoc | null> {
  const doc = await dbReadWithRetry('semana', () => db.collection(baseWeekStatusCollection).doc(weekDocId(group)).get());
  return doc?.data ?? null;
}

/** Salva o período (domingo a sábado) de uma ou mais semanas e recalcula os checks (só acrescenta, nunca desmarca). */
export const setWeekPeriods = createServerFn({ method: 'POST' })
  .validator(z.object({ items: z.array(z.object({ group: groupSchema, start: isoSchema, end: isoSchema })).min(1).max(100), clientClaim: claimSchema }))
  .handler(async ({ data }) => {
    const session = await requireManager(data.clientClaim);
    const { rows } = await loadBaseRows();
    let current = rows;
    const results: { group: string; ok: boolean; message?: string; added?: number; people?: number }[] = [];
    const toWrite: { group: string; start: string; end: string; counters: BaseWeekStatusDoc['counters']; added: number }[] = [];

    for (const item of data.items) {
      const err = periodError(item.start, item.end);
      if (err) { results.push({ group: item.group, ok: false, message: err }); continue; }
      const gk = normGroupKey(item.group);
      const doc = await readWeekDoc(item.group);
      if (!doc && !current.some((r) => normGroupKey(r.group) === gk)) { results.push({ group: item.group, ok: false, message: 'Semana não encontrada na Base.' }); continue; }
      if (doc?.status === 'validada') { results.push({ group: item.group, ok: false, message: 'Semana validada: reabra a semana para alterar o período.' }); continue; }
      const res = recomputeGroupChecks(current, item.group, { weekStart: item.start, weekEnd: item.end });
      current = res.rows;
      const checks = Object.values(res.byDay).reduce((a, b) => a + b, 0);
      toWrite.push({
        group: doc?.group ?? item.group, start: item.start, end: item.end, added: res.added,
        counters: { people: res.people, checks, outside: res.outside, noAccess: res.noAccess, byDay: { ...res.byDay } },
      });
      results.push({ group: item.group, ok: true, added: res.added, people: res.people });
    }

    if (toWrite.length > 0) {
      await saveBaseRows(current, session);
      const now = new Date().toISOString();
      for (const w of toWrite) {
        const prev = await readWeekDoc(w.group);
        const doc: BaseWeekStatusDoc = {
          ...(prev ?? {}),
          group: prev?.group ?? w.group,
          status: prev?.status ?? 'pendente',
          updatedAt: now,
          updatedByEmail: session.email,
          updatedByName: session.name,
          weekStart: w.start,
          weekEnd: w.end,
          lastReprocessedAt: now,
          counters: w.counters,
        };
        delete doc.periodPending;
        delete doc.rangeFromDate;
        await dbWriteWithRetry('semana_periodo', () => db.collection(baseWeekStatusCollection).doc(weekDocId(w.group)).set(doc));
        await logWeekAction(session, 'definiu_periodo', w.group, `${w.start} a ${w.end} · ${w.added} checks acrescentados`);
      }
    }
    return { results };
  });

/** Apaga uma semana só da Base (nunca do quadro). Exige o nome exato da semana; semana validada fica bloqueada. */
export const deleteWeek = createServerFn({ method: 'POST' })
  .validator(z.object({ group: groupSchema, confirmName: z.string().max(500), clientClaim: claimSchema }))
  .handler(async ({ data }) => {
    const session = await requireManager(data.clientClaim);
    if (data.confirmName !== data.group) throw new Error('O nome digitado não confere com o nome da semana.');
    const doc = await readWeekDoc(data.group);
    if (doc?.status === 'validada') throw new Error('Semana validada: reabra a semana antes de apagar.');
    const { rows } = await loadBaseRows();
    const gk = normGroupKey(data.group);
    const kept = rows.filter((r) => normGroupKey(r.group) !== gk);
    const removed = rows.length - kept.length;
    if (removed === 0 && !doc) throw new Error('Semana não encontrada na Base.');
    await saveBaseRows(kept, session);
    await dbWriteWithRetry('semana_apagar', () => db.collection(baseWeekStatusCollection).doc(weekDocId(data.group)).delete());
    const queues = await dbReadWithRetry('fila_apagar', () => db.collection(mirrorQueueCollection).limit(1000).get());
    for (const q of queues) {
      if (normText(q.data.group) === normText(data.group)) await dbWriteWithRetry('fila_apagar', () => db.collection(mirrorQueueCollection).doc(q.id).delete());
    }
    await logWeekAction(session, 'apagou_semana', data.group, `${removed} linhas apagadas da Base`);
    return { removed };
  });

/** Reabre uma semana validada (destrava período e exclusão) e registra quem reabriu. */
export const reopenWeek = createServerFn({ method: 'POST' })
  .validator(z.object({ group: groupSchema, clientClaim: claimSchema }))
  .handler(async ({ data }) => {
    const session = await requireManager(data.clientClaim);
    const prev = await readWeekDoc(data.group);
    if (!prev || prev.status !== 'validada') throw new Error('Esta semana não está validada.');
    const now = new Date().toISOString();
    const doc: BaseWeekStatusDoc = {
      ...prev,
      status: 'pendente',
      updatedAt: now,
      updatedByEmail: session.email,
      updatedByName: session.name,
      reopenedAt: now,
      reopenedByEmail: session.email,
      reopenedByName: session.name,
    };
    await dbWriteWithRetry('semana_reabrir', () => db.collection(baseWeekStatusCollection).doc(weekDocId(data.group)).set(doc));
    await logWeekAction(session, 'reabriu_semana', data.group);
    return doc;
  });

/** Semanas da Base sem período definido (com quantidade de pessoas), para preencher na tela da importação. */
export const getPendingPeriodWeeks = createServerFn({ method: 'POST' })
  .validator(z.object({ clientClaim: claimSchema }).optional())
  .handler(async ({ data }) => {
    await requireManager(data?.clientClaim);
    const docs = await dbReadWithRetry('semanas_sem_periodo', () => db.collection(baseWeekStatusCollection).limit(1000).get());
    const pending = docs.filter((d) => d.data.periodPending && !(d.data.weekStart && d.data.weekEnd)).map((d) => d.data.group);
    if (pending.length === 0) return { weeks: [] as { group: string; people: number }[] };
    const { rows } = await loadBaseRows();
    return { weeks: pending.map((g) => ({ group: g, people: rows.filter((r) => normGroupKey(r.group) === normGroupKey(g)).length })) };
  });
