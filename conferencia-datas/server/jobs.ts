// Jobs em segundo plano chamados pelo agendador do monday code (/mndy-cronjob/<job>).
import { mongo } from './mongo';
import { lembretePendentes, rotinaDiaria } from '../src/generated/server/conferencia';

export const JOBS: Record<string, (arg?: string) => Promise<unknown>> = {
  lembrete: () => lembretePendentes(),
  diario: (arg) => rotinaDiaria(arg),
  // Apaga do banco o histórico e os alertas de um item (arg = id do item). Uso manual pela rota /cron.
  limpar: async (arg) => {
    if (!arg || !/^\d+$/.test(arg)) return { erro: 'informe o id do item' };
    const db = await mongo();
    const log = await db.collection('log_conferencia').deleteMany({ itemId: { $in: [arg, Number(arg)] } });
    const alertas = await db.collection<{ _id: string }>('alertas_coplan').deleteMany({ _id: { $regex: `^${arg}:` } });
    return { log: log.deletedCount, alertas: alertas.deletedCount };
  },
};

export interface JobState { _id: string; kind: string; status: 'rodando' | 'concluido' | 'erro'; startedAt: string; finishedAt?: string; arg?: string; result?: unknown; error?: string }
let running: Promise<void> | null = null;

export async function startJob(kind: string, arg?: string): Promise<JobState> {
  const fn = JOBS[kind];
  if (!fn) throw new Error(`Job desconhecido: ${kind}`);
  const col = (await mongo()).collection<JobState>('app_jobs');
  const cur = await col.findOne({ _id: 'current' });
  if (running || (cur?.status === 'rodando' && Date.now() - Date.parse(cur.startedAt) < 20 * 60_000)) {
    if (cur) return cur;
  }
  const state: JobState = { _id: 'current', kind, status: 'rodando', startedAt: new Date().toISOString(), ...(arg ? { arg } : {}) };
  await col.replaceOne({ _id: 'current' }, state, { upsert: true });
  running = (async () => {
    try {
      const result = await fn(arg);
      await col.updateOne({ _id: 'current' }, { $set: { status: 'concluido', finishedAt: new Date().toISOString(), result } });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      await col.updateOne({ _id: 'current' }, { $set: { status: 'erro', finishedAt: new Date().toISOString(), error } }).catch(() => null);
      console.error(`[job ${kind}]`, error);
    } finally {
      running = null;
    }
  })();
  return state;
}
