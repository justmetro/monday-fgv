import { errorText } from '@generated/lib/errorText';
import { useCallback, useMemo, useRef, useState } from 'react';
import { savePanelUploadSettings } from '@generated/server/panelUpdate';
import { applyLegacyWeekToBase, applyWeekToBase, finishMirrorRun, resetLegacyWeekForRewrite, startMirrorRun } from '@generated/server/mirror';
import type { PanelCsvPlan } from '@generated/lib/panelCsv';
import { type LegacyPlan } from '@generated/lib/legacyBase';
import type { MirrorStage, PanelUploadFailure, PanelUploadMetrics } from '@generated/models';
import { runMirror, type MirrorSnapshot } from './mirrorEngine';

type Claim = { email?: string; id?: string; name?: string; isAdmin?: boolean } | undefined;

export interface UploadSettings {
  itemsPerCall: number;
  parallelCalls: number;
}

export interface RunState {
  runId: string;
  groupName: string;
  phase: MirrorSnapshot['phase'];
  base: { created: number; updated: number; unchanged: number; deactivated?: number; deactivatedExpected?: number; reactivated?: number; reactivatedExpected?: number; ignoredDeactivated?: number } | null; // gravado na Base (fonte de leitura)
  discardedByStatus: number;
  toCreate: number;
  toUpdate: number;
  created: number; // confirmados no quadro por leitura de volta
  updated: number;
  checksExpected: number;
  checksConfirmed: number;
  checksWithoutColumn: number;
  teamExpected: number;
  teamConfirmed: number;
  boardDuplicates: number;
  duplicateNames: string[];
  failuresByStage: Record<MirrorStage, number>;
  discardedByLabel: Record<string, number>;
  failures: PanelUploadFailure[];
  pendingCount: number;
  checksPending: number;
  metrics: PanelUploadMetrics | null;
  activeSince: number | null;
  elapsedBefore: number;
  status: 'gravando' | 'concluido' | 'concluido_com_falhas' | 'parado' | 'cancelado' | 'erro';
  stopReason?: string;
}

function fromSnapshot(base: RunState, s: MirrorSnapshot): RunState {
  return {
    ...base,
    phase: s.phase,
    toCreate: s.toCreate, toUpdate: s.toUpdate, created: s.created, updated: s.updated,
    checksExpected: s.checksExpected, checksConfirmed: s.checksConfirmed, checksWithoutColumn: s.checksWithoutColumn,
    teamExpected: s.teamExpected, teamConfirmed: s.teamConfirmed,
    boardDuplicates: s.boardDuplicates, duplicateNames: s.duplicateNames, failuresByStage: s.failuresByStage,
    failures: s.failures, pendingCount: s.pending.length,
    checksPending: s.pending.reduce((n, o) => n + o.checks.length, 0), metrics: s.metrics,
  };
}

export function usePanelUploadRunner(clientClaim: Claim, onFinished: () => void) {
  const [run, setRun] = useState<RunState | null>(null);
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);
  const cancelRef = useRef(false);

  /** Espelha a semana no quadro e fecha o registro com os totais confirmados. */
  const mirror = useCallback(
    async (base: RunState, token: string, settings: UploadSettings, fallbackPending: { count: number; checks: number; names: string[] }) => {
      setRun(base);
      let final: RunState = base;
      let pendingNames: string[] = [];
      try {
        const s = await runMirror({
          token, groupName: base.groupName, runId: base.runId, clientClaim,
          itemsPerCall: settings.itemsPerCall, parallelCalls: settings.parallelCalls,
          isCancelled: () => cancelRef.current,
          onUpdate: (snap) => setRun(fromSnapshot(base, snap)),
        });
        pendingNames = s.pending.map((o) => o.name);
        const status: RunState['status'] = s.stop?.status ?? (s.pending.length > 0 ? 'concluido_com_falhas' : 'concluido');
        final = { ...fromSnapshot(base, s), status, stopReason: s.stop?.reason, activeSince: null };
      } catch (e) {
        // Quadro indisponível: a Base continua valendo; tudo fica na fila da semana
        const raw = errorText(e, 'Falha inesperada ao falar com o quadro.');
        console.error('Espelho no quadro falhou:', raw);
        pendingNames = fallbackPending.names;
        final = {
          ...base, status: 'erro', phase: 'fim', activeSince: null,
          pendingCount: fallbackPending.count, checksPending: fallbackPending.checks,
          stopReason: `${base.base ? 'A Base foi atualizada. ' : ''}O quadro não recebeu os dados: ${raw}`,
        };
      }
      setRun(final);
      try {
        await finishMirrorRun({
          data: {
            runId: final.runId, groupName: final.groupName,
            status: final.status === 'gravando' ? 'erro' : final.status, stopReason: final.stopReason,
            toCreate: final.toCreate, toUpdate: final.toUpdate, created: final.created, updated: final.updated,
            checksMarked: final.checksConfirmed, checksExpected: final.checksExpected, checksWithoutColumn: final.checksWithoutColumn,
            fieldsTodo: final.toUpdate, fieldsDone: final.updated, teamExpected: final.teamExpected, teamConfirmed: final.teamConfirmed,
            failuresByStage: final.failuresByStage, duplicateNames: final.duplicateNames.slice(0, 50),
            failed: final.failures.length, pending: final.pendingCount, pendingNames: pendingNames.slice(0, 200),
            checksPending: final.checksPending,
            failures: final.failures.slice(0, 4000).map((f) => ({ row: f.row, name: f.name.slice(0, 500), reason: f.reason.slice(0, 1000), stage: f.stage })),
            metrics: final.metrics ?? undefined, clientClaim,
          },
        });
      } catch {
        console.error('Não foi possível registrar o histórico da gravação.');
      }
    },
    [clientClaim]
  );

  const guard = async (fn: () => Promise<void>) => {
    if (runningRef.current) return;
    runningRef.current = true;
    cancelRef.current = false;
    setRunning(true);
    try { await fn(); } finally {
      runningRef.current = false;
      setRunning(false);
      onFinished();
    }
  };

  const persistSettings = async (s: UploadSettings) => {
    try { await savePanelUploadSettings({ data: { ...s, clientClaim } }); } catch { console.error('Não foi possível salvar os ajustes.'); }
  };

  const emptyRun = (runId: string, groupName: string, discardedByStatus: number, base: RunState['base'], discardedByLabel: Record<string, number> = {}): RunState => ({
    runId, groupName, phase: 'lendo', base, discardedByStatus, discardedByLabel, duplicateNames: [], failuresByStage: { criar: 0, campos: 0, checks: 0, equipes: 0 }, toCreate: 0, toUpdate: 0, created: 0, updated: 0,
    checksExpected: 0, checksConfirmed: 0, checksWithoutColumn: 0, teamExpected: 0, teamConfirmed: 0, boardDuplicates: 0, failures: [], pendingCount: 0,
    checksPending: 0, metrics: null, activeSince: Date.now(), elapsedBefore: 0, status: 'gravando',
  });

  /** 1) grava a semana na Base; 2) espelha no quadro. Devolve mensagem de bloqueio, se houver. */
  const start = (args: { token: string; groupName: string; analysisDate: string; weekStart: string; weekEnd: string; allowPeriodChange?: boolean; fileName: string; plan: PanelCsvPlan; settings: UploadSettings }) =>
    new Promise<string | null>((resolve) => {
      void guard(async () => {
        const { plan } = args;
        // Sem as sete colunas de check no quadro não se grava nada (nem na Base)
        if (plan.missingDayColumns.length > 0) {
          resolve(`Faltam colunas de check no quadro: ${plan.missingDayColumns.join(', ')}. Nada foi gravado.`);
          return;
        }
        let baseResult: NonNullable<RunState['base']>;
        try {
          void persistSettings(args.settings);
          baseResult = await applyWeekToBase({ data: { token: args.token, groupName: args.groupName, analysisDate: args.analysisDate, weekStart: args.weekStart, weekEnd: args.weekEnd, allowPeriodChange: args.allowPeriodChange, rows: plan.rows, deactivations: plan.deactivations, clientClaim } });
        } catch (e) {
          resolve(`A Base não foi gravada: ${(e as Error).message}`);
          return;
        }
        let runId: string;
        try {
          const r = await startMirrorRun({
            data: {
              groupName: args.groupName, analysisDate: args.analysisDate, weekStart: args.weekStart, weekEnd: args.weekEnd, fileName: args.fileName,
              rowsRead: plan.rowsRead, discardedByStatus: baseResult.ignoredDeactivated ?? plan.discardedByStatus, discardedByLabel: plan.discardedByLabel,
              baseCreated: baseResult.created, baseUpdated: baseResult.updated, baseUnchanged: baseResult.unchanged,
              deactivated: baseResult.deactivated, reactivated: baseResult.reactivated, ignoredDeactivated: baseResult.ignoredDeactivated, clientClaim,
            },
          });
          runId = r.runId;
        } catch (e) {
          resolve(`A Base foi atualizada, mas o envio ao quadro não começou: ${(e as Error).message}`);
          return;
        }
        resolve(null);
        const checks = plan.rows.reduce((n, r) => n + (r.checkedDays?.length ?? 0), 0);
        await mirror(emptyRun(runId, args.groupName, plan.discardedByStatus, baseResult, plan.discardedByLabel), args.token, args.settings, {
          count: plan.rows.length, checks, names: plan.rows.map((r) => r.name),
        });
      });
    });

  /** Base antiga: 1) grava na Base com as regras antigas; 2) espelha no quadro; histórico marcado "base antiga". */
  const startLegacy = (args: { token: string; groupName: string; analysisDate: string; weekStart: string; weekEnd: string; fileName: string; plan: LegacyPlan; settings: UploadSettings; rewriteBefore?: { people: number; checks: number; boardItems: number | null } }) =>
    new Promise<string | null>((resolve) => {
      void guard(async () => {
        const { plan } = args;
        if (plan.missingDayColumns.length > 0) {
          resolve(`Faltam colunas de check no quadro: ${plan.missingDayColumns.join(', ')}. Nada foi gravado.`);
          return;
        }
        const rewrite = args.rewriteBefore
          ? { before: args.rewriteBefore, after: { people: plan.rows.length, checks: plan.rows.reduce((n, r) => n + (r.checkedDays?.length ?? 0), 0) } }
          : undefined;
        if (rewrite) {
          // Só aqui, depois da prévia e das travas, a semana antiga é apagada (quadro e Base)
          try {
            await resetLegacyWeekForRewrite({ data: { token: args.token, groupName: args.groupName, analysisDate: args.analysisDate, weekStart: args.weekStart, weekEnd: args.weekEnd, clientClaim } });
          } catch (e) {
            resolve(`A semana não foi reescrita: ${errorText(e)}`);
            return;
          }
        }
        let baseResult: NonNullable<RunState['base']>;
        try {
          void persistSettings(args.settings);
          const r = await applyLegacyWeekToBase({ data: { token: args.token, groupName: args.groupName, analysisDate: args.analysisDate, weekStart: args.weekStart, weekEnd: args.weekEnd, rows: plan.rows, rewrite: Boolean(rewrite), clientClaim } });
          baseResult = { created: r.created, updated: r.updated, unchanged: r.unchanged };
        } catch (e) {
          resolve(rewrite
            ? `A semana antiga foi apagada, mas a gravação da nova falhou: ${errorText(e)} Nada foi regravado e não tentei de novo sozinho.`
            : `A Base não foi gravada: ${errorText(e)}`);
          return;
        }
        let runId: string;
        try {
          const r = await startMirrorRun({
            data: {
              groupName: args.groupName, analysisDate: args.analysisDate, weekStart: args.weekStart, weekEnd: args.weekEnd, fileName: args.fileName,
              rowsRead: plan.rowsRead, discardedByStatus: plan.discarded, discardedByLabel: plan.discardedByLabel,
              baseCreated: baseResult.created, baseUpdated: baseResult.updated, baseUnchanged: baseResult.unchanged,
              kind: 'base_antiga', legacyByStatus: plan.byStatus, ...(rewrite ? { rewrite } : {}), clientClaim,
            },
          });
          runId = r.runId;
        } catch (e) {
          resolve(`A Base foi atualizada, mas o envio ao quadro não começou: ${(e as Error).message}`);
          return;
        }
        resolve(null);
        const checks = plan.rows.reduce((n, r) => n + (r.checkedDays?.length ?? 0), 0);
        await mirror(emptyRun(runId, args.groupName, plan.discarded, baseResult, plan.discardedByLabel), args.token, args.settings, {
          count: plan.rows.length, checks, names: plan.rows.map((r) => r.name),
        });
      });
    });

  /** Reenvia ao quadro o que está na Base para a semana (fila de pendências), sem duplicar. */
  const resend = (token: string, groupName: string, settings: UploadSettings) =>
    new Promise<string | null>((resolve) => {
      void guard(async () => {
        let runId: string;
        try {
          const r = await startMirrorRun({
            data: { groupName, analysisDate: '', fileName: 'Reenvio da fila (Base → quadro)', rowsRead: 0, discardedByStatus: 0, baseCreated: 0, baseUpdated: 0, baseUnchanged: 0, clientClaim },
          });
          runId = r.runId;
        } catch (e) {
          resolve((e as Error).message || 'Não foi possível iniciar o reenvio.');
          return;
        }
        resolve(null);
        await mirror(emptyRun(runId, groupName, 0, null), token, settings, { count: 0, checks: 0, names: [] });
      });
    });

  const cancel = () => { cancelRef.current = true; };
  const reset = () => { setRun(null); };

  const progress = useMemo(() => {
    if (!run) return { done: 0, total: 0 };
    const total = run.checksExpected + run.toCreate + run.teamExpected;
    return { done: Math.min(total, run.checksConfirmed + run.created + run.teamConfirmed), total };
  }, [run]);

  return { run, progress, running, start, startLegacy, resend, cancel, reset };
}
