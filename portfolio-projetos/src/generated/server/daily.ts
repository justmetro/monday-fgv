import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { db } from '@vibe/db/server';
import { getCurrentUser } from '@api/current-user.server';
import { dailyRuns, projects } from '@generated/models';
import type { DailyRunDoc, ProjectDoc } from '@generated/models';
import { loadAll } from './sync.server';

export type DailyResult = { boardId: string; name: string; ok: boolean; summary: string; at: string; exportOk?: boolean; exportSummary?: string };
/** Execução parada há mais que isso (aba fechada no meio) pode ser retomada por outra sessão. */
const STALE_MS = 15 * 60 * 1000;

/** Data e dia da semana no fuso de Brasília. */
function brToday() {
  const now = new Date();
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short' }).format(now);
  return { date, businessDay: !['Sat', 'Sun'].includes(wd) };
}
const parse = (s: string | undefined): DailyResult[] => { try { return s ? (JSON.parse(s) as DailyResult[]) : []; } catch { return []; } };
async function who() {
  const u = await getCurrentUser().catch(() => null);
  return { id: u?.id ?? 'app', name: u?.name ?? 'Aplicativo' };
}

/**
 * Reserva a execução do dia (dia útil, a partir de 00:00). Devolve os projetos que faltam atualizar
 * ou run:false quando já foi feita / está em andamento em outra sessão.
 */
export const claimDailyRun = createServerFn({ method: 'POST' })
  .validator(z.object({}).optional())
  .handler(async () => {
    const { date, businessDay } = brToday();
    if (!businessDay) return { run: false as const, reason: 'Fim de semana' };
    const existing = (await db.collection(dailyRuns).where('date', '==', date).limit(1).get())[0];
    const now = new Date().toISOString();
    if (existing) {
      const d = existing.data as DailyRunDoc;
      if (d.status === 'done') return { run: false as const, reason: 'Já executada hoje' };
      if (Date.now() - new Date(d.updatedAt).getTime() < STALE_MS) return { run: false as const, reason: 'Em andamento em outra sessão' };
    }
    const u = await who();
    const list = await loadAll<ProjectDoc>(projects);
    const done = new Set(parse(existing?.data.results).map((r) => r.boardId));
    const todo = list.filter((p) => !done.has(p.data.boardId)).map((p) => ({ boardId: p.data.boardId, name: p.data.name, config: p.data.config, noIndicators: !!p.data.noIndicators }));
    let id = existing?.id;
    if (existing) await db.collection(dailyRuns).doc(existing.id).update({ updatedAt: now, by: u.id, byName: u.name });
    else id = (await db.collection(dailyRuns).add({ date, status: 'running', startedAt: now, updatedAt: now, finishedAt: null, by: u.id, byName: u.name, total: list.length, results: '[]' })).id;
    return { run: true as const, id: id as string, date, projects: todo };
  });

export const reportDailyProject = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string(), boardId: z.string(), name: z.string(), ok: z.boolean(), summary: z.string().max(4000), exportOk: z.boolean().optional(), exportSummary: z.string().max(2000).optional() }))
  .handler(async ({ data }) => {
    const doc = await db.collection(dailyRuns).doc(data.id).get();
    if (!doc) throw new Error('Execução diária não encontrada.');
    const at = new Date().toISOString();
    const results = [...parse(doc.data.results).filter((r) => r.boardId !== data.boardId), { boardId: data.boardId, name: data.name, ok: data.ok, summary: data.summary, at, ...(data.exportSummary != null ? { exportOk: data.exportOk ?? false, exportSummary: data.exportSummary } : {}) }];
    await db.collection(dailyRuns).doc(data.id).update({ results: JSON.stringify(results), updatedAt: at });
    return { ok: true };
  });

export const finishDailyRun = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const at = new Date().toISOString();
    await db.collection(dailyRuns).doc(data.id).update({ status: 'done', finishedAt: at, updatedAt: at });
    return { ok: true };
  });

/** Últimas execuções da rotina diária (mais recentes primeiro). */
export const listDailyRuns = createServerFn({ method: 'GET' })
  .validator(z.object({}).optional())
  .handler(async () => {
    const docs = await db.collection(dailyRuns).orderBy('date', 'desc').limit(20).get();
    return docs.map((d) => { const x = d.data as DailyRunDoc; return { id: d.id, date: x.date, status: x.status, startedAt: x.startedAt, updatedAt: x.updatedAt, finishedAt: x.finishedAt ?? null, byName: x.byName ?? null, total: x.total, results: parse(x.results) }; });
  });
