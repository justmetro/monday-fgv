import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { mongo } from '../../../server/mongo';
import { COMM_BOARD_ID, COMM_COLLECTION, lastCompleteWeek, type CommWeekRow } from '../../../server/communication';
import { startJob, jobState, type JobState } from '../../../server/jobs';
import { resolveSession } from './session.server';

const claim = z
  .object({ id: z.union([z.string(), z.number()]).optional(), email: z.string().optional(), name: z.string().optional(), isAdmin: z.boolean().optional() })
  .optional();

async function requireManager(c: z.infer<typeof claim>) {
  const s = await resolveSession(c);
  if (!s.canManage) throw new Error('Apenas o dono, Administradores e membros do PMO podem recalcular a comunicação.');
  return s;
}

export interface CommunicationView {
  rows: Omit<CommWeekRow, '_id'>[];
  weeks: { weekStart: string; weekEnd: string; week: string; weekNumber: number }[]; // mais recente primeiro
  lastRun: { at: string; week: string } | null;
  nextWeekStart: string; // semana que a próxima consolidação calcula
  boardId: string;
}

/** Linhas das últimas semanas consolidadas. Qualquer pessoa logada lê (são totais por projeto). */
export const getCommunication = createServerFn({ method: 'POST' })
  .validator(z.object({ clientClaim: claim, weeks: z.number().int().min(1).max(52).optional() }))
  .handler(async ({ data }): Promise<CommunicationView> => {
    await resolveSession(data.clientClaim);
    const db = await mongo();
    const col = db.collection<CommWeekRow>(COMM_COLLECTION);
    const starts = (await col.distinct('weekStart')).sort().reverse().slice(0, data.weeks ?? 12) as string[];
    const rows = await col.find({ weekStart: { $in: starts } }, { projection: { _id: 0 } }).toArray();
    const weeks = starts.map((s) => {
      const r = rows.find((x) => x.weekStart === s)!;
      return { weekStart: s, weekEnd: r.weekEnd, week: r.week, weekNumber: r.weekNumber };
    });
    const last = await db.collection<{ at: string; week: string }>('comm_runs').find({}).sort({ at: -1 }).limit(1).toArray();
    return { rows, weeks, lastRun: last[0] ? { at: last[0].at, week: last[0].week } : null, nextWeekStart: lastCompleteWeek(), boardId: COMM_BOARD_ID };
  });

export const runCommunicationWeek = createServerFn({ method: 'POST' })
  .validator(z.object({ clientClaim: claim, weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }))
  .handler(async ({ data }): Promise<JobState> => {
    await requireManager(data.clientClaim);
    return startJob('weekly', data.weekStart);
  });

export const getCommunicationJob = createServerFn({ method: 'POST' })
  .validator(z.object({ clientClaim: claim }))
  .handler(async ({ data }): Promise<JobState | null> => {
    await requireManager(data.clientClaim);
    return jobState();
  });
