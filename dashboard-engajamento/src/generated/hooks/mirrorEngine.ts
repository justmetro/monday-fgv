// Espelha uma semana da Base no quadro (roda na página; o token nunca é guardado).
// Etapas separadas: 1) criar itens que faltam, 2) último acesso/Date + checks, 3) equipes (chamada própria).
// Antes de cada rodada o grupo é relido; TODOS os totais vêm da leitura de volta do quadro.
// Só repete na hora: limite de taxa, complexidade e tempo esgotado. Erro de validação da consulta para tudo.
import { mirrorWriteBatch, prepareMirror, type MirrorOp } from '@generated/server/mirror';
import type { BatchCallResult } from '@generated/server/mondayWrite.server';
import type { MirrorStage, PanelUploadFailure, PanelUploadMetrics } from '@generated/models';
import {
  MIRROR_ITEMS_PER_CALL_MAX,
  MIRROR_ROUNDS,
  RETRY_WAITS_MS,
  RUN_TIME_LIMIT_MS,
  suggestedWaitMs,
} from '@generated/lib/panelUploadLimits';

type Claim = { email?: string; id?: string; name?: string; isAdmin?: boolean } | undefined;
type Prepared = Awaited<ReturnType<typeof prepareMirror>>;
interface SendItem { key: string; op: 'create' | 'update'; itemId?: string; name: string; values: Record<string, { type: string; raw: string }> }

const RETRY_NOW = ['complexidade', 'limite_requisicoes', 'timeout'];
const SHRINK = ['complexidade'];
const FATAL = ['consulta', 'autorizacao'];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const STAGE_DEFAULT: Record<MirrorStage, string> = {
  criar: 'Item não encontrado no quadro após as tentativas.',
  campos: 'Último acesso ou Date não confirmados no quadro.',
  checks: 'Check não confirmado no quadro.',
  equipes: 'Equipe não confirmada no quadro.',
};

export interface StageCount { todo: number; done: number; pending: number }

export interface MirrorSnapshot {
  phase: 'lendo' | 'criando' | 'marcando' | 'equipes' | 'conferindo' | 'fim';
  toCreate: number;
  toUpdate: number;
  created: number;
  updated: number;
  checksExpected: number;
  checksConfirmed: number;
  checksWithoutColumn: number;
  teamExpected: number;
  teamConfirmed: number;
  boardDuplicates: number;
  duplicateNames: string[];
  onlyInBoard: number;
  groupCreated: boolean;
  pending: MirrorOp[];
  failures: PanelUploadFailure[];
  failuresByStage: Record<MirrorStage, number>;
  metrics: PanelUploadMetrics;
  stop: { status: 'parado' | 'cancelado'; reason: string } | null;
}

export interface MirrorInput {
  token: string;
  groupName: string;
  runId?: string;
  clientClaim: Claim;
  itemsPerCall: number;
  parallelCalls: number;
  isCancelled: () => boolean;
  onUpdate: (s: MirrorSnapshot) => void;
}

/** Etapas que ainda faltam para uma pessoa, segundo a leitura do quadro. */
function stagesOf(o: MirrorOp): MirrorStage[] {
  if (o.create) return ['criar'];
  const s: MirrorStage[] = [];
  if (o.update) s.push('campos');
  if (o.checks.length > 0) s.push('checks');
  if (o.team) s.push('equipes');
  return s;
}

export async function runMirror(input: MirrorInput): Promise<MirrorSnapshot> {
  const started = Date.now();
  let size = Math.max(1, Math.min(input.itemsPerCall, MIRROR_ITEMS_PER_CALL_MAX));
  const sizeHistory = [size];
  const errorsByKind: Record<string, number> = {};
  const rawErrors: string[] = [];
  const lastError = new Map<string, string>(); // `${etapa}|${chave}` → erro bruto
  const blocked = new Set<string>(); // `${etapa}|${chave}` com erro não recuperável: não reenviar nesta execução
  let calls = 0, verifications = 0, retries = 0;
  let stop: MirrorSnapshot['stop'] = null;
  let fatal: string | null = null;

  const timeUp = () => Date.now() - started >= RUN_TIME_LIMIT_MS;
  const halted = () => input.isCancelled() || timeUp() || Boolean(fatal);
  const noteError = (stage: MirrorStage, kind: string, message: string, keys: string[]) => {
    errorsByKind[kind] = (errorsByKind[kind] ?? 0) + 1;
    if (message && !rawErrors.includes(message) && rawErrors.length < 20) rawErrors.push(message);
    keys.forEach((k) => {
      lastError.set(`${stage}|${k}`, message);
      if (!RETRY_NOW.includes(kind)) blocked.add(`${stage}|${k}`);
    });
    if (FATAL.includes(kind) && !fatal) fatal = message;
  };
  const metrics = (): PanelUploadMetrics => ({
    elapsedMs: Date.now() - started, itemsPerSecond: 0, itemsPerCallStart: sizeHistory[0] ?? size, itemsPerCallFinal: size,
    itemsPerCallHistory: sizeHistory.slice(-50), parallelCalls: input.parallelCalls, calls, verifications, retries, errorsByKind, rawErrors,
  });

  const prepare = async (createGroup: boolean): Promise<Prepared> => {
    verifications++;
    return prepareMirror({ data: { token: input.token, groupName: input.groupName, createGroup, runId: input.runId, clientClaim: input.clientClaim } });
  };

  let p = await prepare(true);
  const first = p.totals;
  let phase: MirrorSnapshot['phase'] = 'criando';

  const snap = (cur: Prepared, final = false): MirrorSnapshot => {
    const m = metrics();
    const t = cur.totals;
    const created = Math.max(0, first.itemsMissing - t.itemsMissing);
    const updated = Math.max(0, first.fieldsPending - t.fieldsPending);
    m.itemsPerSecond = m.elapsedMs > 0 ? Math.round(((created + updated) / (m.elapsedMs / 1000)) * 100) / 100 : 0;
    const failuresByStage: Record<MirrorStage, number> = { criar: 0, campos: 0, checks: 0, equipes: 0 };
    const failures: PanelUploadFailure[] = [];
    if (final) {
      cur.ops.forEach((o) => stagesOf(o).forEach((stage) => {
        failuresByStage[stage]++;
        failures.push({ row: 0, name: o.name, stage, reason: lastError.get(`${stage}|${o.key}`) ?? STAGE_DEFAULT[stage] });
      }));
    }
    return {
      phase: final ? 'fim' : phase,
      toCreate: first.itemsMissing, created, toUpdate: first.fieldsPending, updated,
      checksExpected: t.checksExpected, checksConfirmed: t.checksConfirmed, checksWithoutColumn: t.checksWithoutColumn,
      teamExpected: t.teamExpected, teamConfirmed: t.teamConfirmed,
      boardDuplicates: t.boardDuplicates, duplicateNames: t.boardDuplicateNames, onlyInBoard: t.onlyInBoard, groupCreated: p.groupCreated,
      pending: cur.ops, failures, failuresByStage, metrics: m, stop,
    };
  };
  input.onUpdate(snap(p));

  /** Envia em lotes pequenos e paralelos; repete na hora só limite de taxa, complexidade e tempo esgotado. */
  const sendAll = async (stage: MirrorStage, all: SendItem[], boardId: string, groupId: string) => {
    const queue = all.filter((i) => !blocked.has(`${stage}|${i.key}`));
    const attempts = new Map<string, number>();
    const worker = async () => {
      while (queue.length > 0 && !halted()) {
        const chunk = queue.splice(0, size);
        calls++;
        let res: BatchCallResult;
        try {
          res = await mirrorWriteBatch({ data: { token: input.token, boardId, groupId, runId: input.runId, items: chunk, clientClaim: input.clientClaim } });
        } catch (e) {
          res = { delivered: false, kind: 'rede', message: (e as Error)?.message || 'Falha de comunicação com o servidor.' };
        }
        let wait = 0;
        const again: SendItem[] = [];
        let shrink = false;
        if (res.delivered) {
          res.outcomes.forEach((o) => {
            if (!o.error) return;
            const kind = o.kind ?? 'outro';
            noteError(stage, kind, o.error, [o.key]);
            if (SHRINK.includes(kind)) { shrink = true; wait = Math.max(wait, suggestedWaitMs(o.error) ?? 0); }
            const it = chunk.find((c) => c.key === o.key);
            if (it && RETRY_NOW.includes(kind)) again.push(it);
          });
        } else {
          noteError(stage, res.kind, res.message, chunk.map((c) => c.key));
          if (FATAL.includes(res.kind)) return;
          if (SHRINK.includes(res.kind)) shrink = true;
          if (RETRY_NOW.includes(res.kind)) {
            wait = suggestedWaitMs(res.message) ?? 0;
            // Criação com tempo esgotado pode ter sido gravada: fica para a próxima rodada (o grupo é relido antes)
            chunk.forEach((c) => { if (!(c.op === 'create' && res.kind === 'timeout')) again.push(c); });
          }
        }
        if (shrink && size > 1) { size = Math.max(1, Math.floor(size / 2)); sizeHistory.push(size); }
        const retryable = again.filter((c) => {
          const n = (attempts.get(c.key) ?? 0) + 1;
          attempts.set(c.key, n);
          return n <= RETRY_WAITS_MS.length;
        });
        if (retryable.length > 0) {
          retries++;
          const step = RETRY_WAITS_MS[Math.min((attempts.get(retryable[0]?.key ?? '') ?? 1) - 1, RETRY_WAITS_MS.length - 1)] ?? 2000;
          await sleep(Math.max(wait, step));
          queue.push(...retryable);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.max(1, input.parallelCalls) }, () => worker()));
  };

  // Etapa 1: criar o que falta (somente campos; checks e equipe vão em chamadas separadas)
  for (let round = 0; round < MIRROR_ROUNDS && !halted(); round++) {
    if (round > 0) p = await prepare(false);
    const creates = p.ops.filter((o) => o.create);
    if (creates.length === 0 || !p.groupId) break;
    await sendAll('criar', creates.map((o) => ({ key: o.key, op: 'create' as const, name: o.name, values: o.create ?? {} })), p.boardId, p.groupId);
    input.onUpdate(snap(p));
  }

  // Etapa 2: checks e avanço de último acesso/Date nos itens existentes
  phase = 'marcando';
  for (let round = 0; round < MIRROR_ROUNDS && !halted(); round++) {
    p = await prepare(false);
    input.onUpdate(snap(p));
    const ups = p.ops.filter((o) => o.itemId && (o.checks.length > 0 || o.update) && !blocked.has(`checks|${o.key}`));
    if (ups.length === 0) break;
    await sendAll(
      'checks',
      ups.map((o) => {
        const values: SendItem['values'] = { ...(o.update ?? {}) };
        o.checks.forEach((colId) => { values[colId] = { type: 'checkbox', raw: 'true' }; });
        return { key: o.key, op: 'update' as const, itemId: o.itemId, name: o.name, values };
      }),
      p.boardId,
      p.groupId
    );
    // Falha de campos/checks na mesma chamada: registra também na etapa de campos
    ups.forEach((o) => { const e = lastError.get(`checks|${o.key}`); if (e && o.update) lastError.set(`campos|${o.key}`, e); });
  }

  // Etapa 3: equipe, em chamadas próprias (uma coluna por item, localizada pelo ID da coluna)
  phase = 'equipes';
  for (let round = 0; round < MIRROR_ROUNDS && !halted(); round++) {
    p = await prepare(false);
    input.onUpdate(snap(p));
    const teams = p.ops.filter((o) => o.itemId && o.team && !blocked.has(`equipes|${o.key}`));
    if (teams.length === 0) break;
    await sendAll(
      'equipes',
      teams.map((o) => ({ key: o.key, op: 'update' as const, itemId: o.itemId, name: o.name, values: { ...(o.team ?? {}) } })),
      p.boardId,
      p.groupId
    );
  }

  // Leitura de volta: só o que está no quadro conta como gravado
  phase = 'conferindo';
  try { p = await prepare(false); } catch (e) { noteError('checks', 'rede', (e as Error).message, []); }

  if (fatal) stop = { status: 'parado', reason: `Erro não recuperável retornado pelo monday (a chamada não foi repetida): ${fatal}` };
  else if (input.isCancelled()) stop = { status: 'cancelado', reason: 'Gravação cancelada por você. O que faltou ficou na fila da semana.' };
  else if (timeUp() && p.ops.length > 0) stop = { status: 'parado', reason: 'Tempo limite atingido. O que faltou ficou na fila da semana.' };

  const final = snap(p, true);
  input.onUpdate(final);
  return final;
}
