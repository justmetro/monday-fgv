// Jobs longos em segundo plano (o gateway do monday code corta requisições após ~60s).
// Registre os jobs do app em JOBS; a tela inicia com startJob e consulta jobState a cada 5s.
import { mongo } from './mongo';
import { consolidateWeek } from './communication';

export const JOBS: Record<string, (arg?: string) => Promise<unknown>> = {
  weekly: (arg) => consolidateWeek(arg),
  // Agendamento antigo de acessos diários: o % da equipe agora vem da Base do engajamento
  'daily-activity': async () => ({ skipped: true }),
};

export interface JobState { _id: string; kind: string; status: 'rodando' | 'concluido' | 'erro'; startedAt: string; finishedAt?: string; arg?: string; result?: unknown; error?: string }
let running: Promise<void> | null = null;

export async function jobState(): Promise<JobState | null> {
  return (await mongo()).collection<JobState>('app_jobs').findOne({ _id: 'current' });
}

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
