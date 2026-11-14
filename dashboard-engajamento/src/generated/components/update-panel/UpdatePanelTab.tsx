import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  FileUp,
  KeyRound,
  Loader2,
  UploadCloud,
  Database,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import { getPanelUploadHistory, getPanelUploadSettings } from '@generated/server/panelUpdate';
import { getWeekPreviewContext } from '@generated/server/mirror';
import {
  ITEMS_PER_CALL_DEFAULT,
  ITEMS_PER_CALL_MAX,
  ITEMS_PER_CALL_MIN,
  PARALLEL_CALLS_DEFAULT,
  PARALLEL_CALLS_MAX,
  PARALLEL_CALLS_MIN,
  clampInt,
} from '@generated/lib/panelUploadLimits';
import { buildPanelPlan, readCsvMatrix, type PanelCsvPlan } from '@generated/lib/panelCsv';
import { useUserSession } from '@generated/hooks/useUserSession';
import { formatBR, parseDateFlexible } from '@generated/lib/dates';
import { usePanelUploadRunner } from '@generated/hooks/usePanelUploadRunner';
import type { EngagementSnapshotView } from '@generated/server/storage';
import { PanelUploadPreview } from './PanelUploadPreview';
import { PanelUploadResult } from './PanelUploadResult';
import { PanelUploadHistory } from './PanelUploadHistory';
import { MirrorQueuePanel } from './MirrorQueuePanel';
import { LegacyBaseSection } from './LegacyBaseSection';
import { ApiImportPanel } from '../ApiImportPanel';
import { ImportUploadPanel } from '../ImportUploadPanel';
import { TeamMappingPanel } from '../TeamMappingPanel';
import { ReimportNotice } from '../ReimportNotice';
import { PmoEmailsPanel } from '../PmoEmailsPanel';
import { WeekPeriodFields } from './WeekPeriodFields';
import { brDate, OUTSIDE_PERIOD_MESSAGE, periodError } from '@generated/lib/weekPeriod';

type HistoryRow = Awaited<ReturnType<typeof getPanelUploadHistory>>[number];
interface PreviewState {
  plan: PanelCsvPlan;
  boardName: string | null;
  boardError: string | null;
  groupExists: boolean;
  sameGroupSameDate: boolean;
  otherGroupsSameDate: string[];
  periodChangeFrom: string | null; // período guardado diferente do digitado (pede confirmação)
}

const inputCls =
  'w-full h-11 px-3 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60';

interface Props {
  snapshot?: EngagementSnapshotView | null;
  onSnapshotUpdated?: () => void;
}

export function UpdatePanelTab({ snapshot, onSnapshotUpdated }: Props) {
  const { session } = useUserSession();
  const clientClaim = useMemo(
    () => (session?.email ? { email: session.email, id: session.id, name: session.name, isAdmin: session.isAdmin } : undefined),
    [session]
  );

  const [activeSubSection, setActiveSubSection] = useState<'upload' | 'sync_boards' | 'de_para' | 'pmo'>('upload');

  // Token para a aba
  const [token, setToken] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [groupName, setGroupName] = useState('');
  const [analysisDate, setAnalysisDate] = useState('');
  const [weekStart, setWeekStart] = useState('');
  const [weekEnd, setWeekEnd] = useState('');
  const [confirmPeriodChange, setConfirmPeriodChange] = useState(false);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [confirmOtherGroup, setConfirmOtherGroup] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Ajustes da gravação
  const [itemsPerCallText, setItemsPerCallText] = useState(String(ITEMS_PER_CALL_DEFAULT));
  const [parallelText, setParallelText] = useState(String(PARALLEL_CALLS_DEFAULT));

  useEffect(() => {
    if (!session?.canManage) return;
    getPanelUploadSettings({ data: { clientClaim } })
      .then((s) => {
        if (!s) return;
        setItemsPerCallText(String(s.itemsPerCall));
        setParallelText(String(s.parallelCalls));
      })
      .catch(() => console.error('Não foi possível ler os ajustes salvos.'));
  }, [session, clientClaim]);

  const readSettings = (): { ok: true; itemsPerCall: number; parallelCalls: number } | { ok: false; message: string } => {
    const ipc = Number(itemsPerCallText);
    const par = Number(parallelText);
    if (!Number.isInteger(ipc) || ipc < ITEMS_PER_CALL_MIN || ipc > ITEMS_PER_CALL_MAX) {
      return { ok: false, message: `"Itens por chamada" deve ser um número inteiro de ${ITEMS_PER_CALL_MIN} a ${ITEMS_PER_CALL_MAX}.` };
    }
    if (!Number.isInteger(par) || par < PARALLEL_CALLS_MIN || par > PARALLEL_CALLS_MAX) {
      return { ok: false, message: `"Chamadas em paralelo" deve ser um número inteiro de ${PARALLEL_CALLS_MIN} a ${PARALLEL_CALLS_MAX}.` };
    }
    return { ok: true, itemsPerCall: ipc, parallelCalls: par };
  };

  const shownSettings = {
    itemsPerCall: clampInt(Number(itemsPerCallText), ITEMS_PER_CALL_MIN, ITEMS_PER_CALL_MAX, ITEMS_PER_CALL_DEFAULT),
    parallelCalls: clampInt(Number(parallelText), PARALLEL_CALLS_MIN, PARALLEL_CALLS_MAX, PARALLEL_CALLS_DEFAULT),
  };

  const loadHistory = useCallback(async () => {
    if (!session?.canManage) return;
    setHistoryLoading(true);
    try {
      const rows = await getPanelUploadHistory({ data: { clientClaim } });
      setHistory(rows ?? []);
    } catch {
      console.error('Erro ao carregar o histórico de atualizações.');
    } finally {
      setHistoryLoading(false);
    }
  }, [session, clientClaim]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const [queueKey, setQueueKey] = useState(0);
  const runner = usePanelUploadRunner(clientClaim, () => {
    setQueueKey((k) => k + 1);
    setToken('');
    void loadHistory();
    onSnapshotUpdated?.();
  });

  const locked = runner.running || previewing;
  const clearPreview = () => {
    setPreview(null);
    setMessage(null);
    setConfirmOtherGroup(false);
  };

  const makePreview = async () => {
    setMessage(null);
    if (!token.trim()) return setMessage('Informe o token da API do monday para continuar.');
    if (!file) return setMessage('Escolha o arquivo CSV.');
    if (!groupName.trim()) return setMessage('Informe o nome do grupo.');
    if (!analysisDate) return setMessage('Informe a data da análise.');
    const pErr = periodError(weekStart, weekEnd);
    if (pErr) return setMessage(pErr);
    if (analysisDate < weekStart || analysisDate > weekEnd) return setMessage(`${OUTSIDE_PERIOD_MESSAGE}. Nada foi gravado.`);
    setPreviewing(true);
    setConfirmOtherGroup(false);
    try {
      const [ctx, matrix] = await Promise.all([
        getWeekPreviewContext({ data: { token: token.trim(), groupName: groupName.trim(), analysisDate, clientClaim } }),
        readCsvMatrix(file),
      ]);
      const built = buildPanelPlan(matrix, analysisDate, { weekStart, weekEnd }, groupName.trim(), ctx.baseRows, ctx.board?.columns ?? null);
      if (!built.ok) {
        setPreview(null);
        setMessage(built.message);
        return;
      }
      // Grupo já guardado com outro período: bloqueia se validado; senão pede confirmação na prévia
      const wr = ctx.weekRange;
      const differs = Boolean(wr && (wr.weekStart !== weekStart || wr.weekEnd !== weekEnd));
      if (wr && differs && ctx.weekStatus === 'validada') {
        setPreview(null);
        setMessage(`O grupo "${groupName.trim()}" está validado com o período ${brDate(wr.weekStart)} a ${brDate(wr.weekEnd)}. Reabra a semana antes de mudar o período. Nada foi gravado.`);
        return;
      }
      setConfirmPeriodChange(false);
      setPreview({
        plan: built.plan,
        boardName: ctx.board?.name ?? null,
        boardError: ctx.boardError,
        groupExists: Boolean(ctx.board?.groupExists),
        sameGroupSameDate: ctx.sameGroupSameDate,
        otherGroupsSameDate: ctx.otherGroupsSameDate,
        periodChangeFrom: wr && differs ? `${brDate(wr.weekStart)} a ${brDate(wr.weekEnd)}` : null,
      });
    } catch (e) {
      setPreview(null);
      setMessage((e as Error).message || 'Não foi possível gerar a prévia.');
    } finally {
      setPreviewing(false);
    }
  };

  // otherGroupConfirmed vem direto do clique (caixa da prévia ou modal de reenvio), sem depender de estado já renderizado
  const confirm = async (otherGroupConfirmed: boolean) => {
    if (!preview || !file || runner.running) return;
    if (preview.otherGroupsSameDate.length > 0 && !otherGroupConfirmed && !confirmOtherGroup) {
      return setMessage(
        `A data ${formatBR(parseDateFlexible(analysisDate))} já foi enviada para outro grupo (${preview.otherGroupsSameDate.join(', ')}). Marque a confirmação na prévia para enviá-la também para “${groupName.trim()}”.`
      );
    }
    if (preview.periodChangeFrom && !confirmPeriodChange) return setMessage('Confirme a mudança de período do grupo na prévia antes de gravar.');
    const s = readSettings();
    if (!s.ok) return setMessage(s.message);
    setMessage(null);
    const blocked = await runner.start({
      token: token.trim(),
      groupName: groupName.trim(),
      analysisDate,
      weekStart,
      weekEnd,
      allowPeriodChange: Boolean(preview.periodChangeFrom),
      fileName: file.name,
      plan: preview.plan,
      settings: { itemsPerCall: s.itemsPerCall, parallelCalls: s.parallelCalls },
    });
    if (blocked) setMessage(blocked);
    else setPreview(null);
  };

  const resume = async () => {
    if (!token.trim()) return setMessage('Informe o token da API do monday para reenviar as pendências.');
    const s = readSettings();
    if (!s.ok) return setMessage(s.message);
    if (!runner.run) return;
    setMessage(null);
    const blocked = await runner.resend(token.trim(), runner.run.groupName, { itemsPerCall: s.itemsPerCall, parallelCalls: s.parallelCalls });
    if (blocked) setMessage(blocked);
  };

  /** Reenvia ao quadro a fila de uma semana (botão da fila), mesmo sem gravação aberta nesta tela. */
  const resendGroup = async (group: string) => {
    if (!token.trim()) return setMessage('Informe o token da API do monday (campo acima) para reenviar as pendências.');
    const s = readSettings();
    if (!s.ok) return setMessage(s.message);
    setMessage(null);
    setPreview(null);
    const blocked = await runner.resend(token.trim(), group, { itemsPerCall: s.itemsPerCall, parallelCalls: s.parallelCalls });
    if (blocked) setMessage(blocked);
  };

  const startNew = () => {
    runner.reset();
    setFile(null);
    setGroupName('');
    setAnalysisDate('');
    setWeekStart('');
    setWeekEnd('');
    clearPreview();
  };

  if (!session?.canManage) return null;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Navegação entre sub-recursos fundidos da aba */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-muted/60 border border-border">
        <button
          type="button"
          onClick={() => setActiveSubSection('upload')}
          className={`h-9 px-4 rounded-xl text-xs font-medium transition-colors inline-flex items-center gap-1.5 ${
            activeSubSection === 'upload' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <UploadCloud className="w-4 h-4" />
          Atualizar Análise (CSV Semana)
        </button>
        <button
          type="button"
          onClick={() => setActiveSubSection('sync_boards')}
          className={`h-9 px-4 rounded-xl text-xs font-medium transition-colors inline-flex items-center gap-1.5 ${
            activeSubSection === 'sync_boards' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Database className="w-4 h-4" />
          Sincronização Completa de Quadros
        </button>
        <button
          type="button"
          onClick={() => setActiveSubSection('de_para')}
          className={`h-9 px-4 rounded-xl text-xs font-medium transition-colors inline-flex items-center gap-1.5 ${
            activeSubSection === 'de_para' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Layers className="w-4 h-4" />
          Tabela De-Para (Equipes → Projetos)
        </button>
        <button
          type="button"
          onClick={() => setActiveSubSection('pmo')}
          className={`h-9 px-4 rounded-xl text-xs font-medium transition-colors inline-flex items-center gap-1.5 ${
            activeSubSection === 'pmo' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Gestão de Acesso (PMOs)
        </button>
      </div>

      {activeSubSection === 'upload' && (
        <div className="space-y-6">
          <section className="rounded-3xl bg-gradient-to-br from-[hsl(var(--brand-sky))] to-[hsl(var(--brand-sky-2))] border border-border p-5 sm:p-7 space-y-5">
            <div className="flex items-start gap-3">
              <span className="w-11 h-11 rounded-2xl bg-card text-[hsl(var(--brand-navy))] grid place-items-center shrink-0 soft-stack-card">
                <UploadCloud className="w-5 h-5" />
              </span>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[hsl(var(--brand-navy)/0.7)]">
                  Atualizar painel
                </p>
                <h2 className="text-2xl font-semibold tracking-tight text-[hsl(var(--brand-navy))]">
                  Registrar o dia da análise na semana
                </h2>
                <p className="text-xs text-[hsl(var(--brand-navy)/0.75)] mt-1 max-w-2xl">
                  Cada grupo é uma semana de domingo a sábado, com um único item por pessoa. A Data da análise pode ser qualquer dia; o check marcado é o desse dia, para quem tem o último acesso igual a ela.
                </p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="up-token" className="text-[11px] font-medium text-[hsl(var(--brand-navy))] flex items-center gap-1">
                  <KeyRound className="w-3 h-3" /> Token da API do monday
                </label>
                <input
                  id="up-token"
                  type="password"
                  autoComplete="off"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  disabled={runner.running}
                  className={inputCls}
                  placeholder="Cole o token pessoal"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="up-file" className="text-[11px] font-medium text-[hsl(var(--brand-navy))] flex items-center gap-1">
                  <FileUp className="w-3 h-3" /> Arquivo CSV
                </label>
                <input
                  id="up-file"
                  type="file"
                  accept=".csv,text/csv"
                  disabled={locked}
                  onChange={(e) => {
                    setFile(e.target.files?.[0] ?? null);
                    clearPreview();
                  }}
                  className={`${inputCls} py-2 file:mr-2 file:rounded-full file:border-0 file:bg-muted file:px-3 file:text-xs`}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="up-group" className="text-[11px] font-medium text-[hsl(var(--brand-navy))]">
                  Nome do grupo
                </label>
                <input
                  id="up-group"
                  value={groupName}
                  onChange={(e) => {
                    setGroupName(e.target.value);
                    clearPreview();
                  }}
                  disabled={locked}
                  maxLength={255}
                  className={inputCls}
                  placeholder="Ex.: Semana 2"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="up-date" className="text-[11px] font-medium text-[hsl(var(--brand-navy))]">
                  Data da análise
                </label>
                <input
                  id="up-date"
                  type="date"
                  value={analysisDate}
                  onChange={(e) => {
                    setAnalysisDate(e.target.value);
                    clearPreview();
                  }}
                  disabled={locked}
                  className={inputCls}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:max-w-md gap-3">
              <WeekPeriodFields
                idPrefix="up" weekStart={weekStart} weekEnd={weekEnd} disabled={locked}
                onChange={(p) => { setWeekStart(p.weekStart); setWeekEnd(p.weekEnd); clearPreview(); }}
              />
            </div>

            <div className="grid grid-cols-2 sm:max-w-md gap-3">
              <div className="space-y-1.5">
                <label htmlFor="up-ipc" className="text-[11px] font-medium text-[hsl(var(--brand-navy))]">
                  Itens por chamada ({ITEMS_PER_CALL_MIN}–{ITEMS_PER_CALL_MAX})
                </label>
                <input
                  id="up-ipc"
                  type="number"
                  inputMode="numeric"
                  min={ITEMS_PER_CALL_MIN}
                  max={ITEMS_PER_CALL_MAX}
                  step={1}
                  value={itemsPerCallText}
                  onChange={(e) => setItemsPerCallText(e.target.value)}
                  disabled={runner.running}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="up-par" className="text-[11px] font-medium text-[hsl(var(--brand-navy))]">
                  Chamadas em paralelo ({PARALLEL_CALLS_MIN}–{PARALLEL_CALLS_MAX})
                </label>
                <input
                  id="up-par"
                  type="number"
                  inputMode="numeric"
                  min={PARALLEL_CALLS_MIN}
                  max={PARALLEL_CALLS_MAX}
                  step={1}
                  value={parallelText}
                  onChange={(e) => setParallelText(e.target.value)}
                  disabled={runner.running}
                  className={inputCls}
                />
              </div>
            </div>

            {message && (
              <p className="text-xs text-destructive bg-card border border-destructive/30 rounded-xl p-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" /> {message}
              </p>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void makePreview()}
                disabled={locked}
                className="h-11 px-5 rounded-full bg-[hsl(var(--brand-navy))] text-card text-xs font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
              >
                {previewing && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Gerar prévia
              </button>
            </div>
          </section>

          {preview && !runner.run && (
            <PanelUploadPreview
              plan={preview.plan}
              groupName={groupName.trim()}
              analysisDate={analysisDate}
              boardName={preview.boardName}
              boardError={preview.boardError}
              groupExists={preview.groupExists}
              sameGroupSameDate={preview.sameGroupSameDate}
              otherGroupsSameDate={preview.otherGroupsSameDate}
              weekStart={weekStart}
              weekEnd={weekEnd}
              periodChangeFrom={preview.periodChangeFrom}
              confirmPeriodChange={confirmPeriodChange}
              onConfirmPeriodChange={setConfirmPeriodChange}
              confirmOtherGroup={confirmOtherGroup}
              onConfirmOtherGroup={setConfirmOtherGroup}
              busy={runner.running}
              onConfirm={(otherOk) => void confirm(otherOk)}
              onDiscard={clearPreview}
            />
          )}

          {runner.run && (
            <PanelUploadResult
              run={runner.run}
              progress={runner.progress}
              settings={shownSettings}
              running={runner.running}
              onCancel={runner.cancel}
              onResume={() => void resume()}
              onNew={startNew}
            />
          )}

          {/* Base antiga: dono, admin e PMO (esta aba já é restrita a eles; o servidor confere de novo) */}
          {session.canManage && !runner.run ? (
            <LegacyBaseSection
              token={token}
              clientClaim={clientClaim}
              running={runner.running}
              readSettings={readSettings}
              onStart={(args) => runner.startLegacy({ ...args, token: token.trim() })}
            />
          ) : null}

          <MirrorQueuePanel clientClaim={clientClaim} running={runner.running} refreshKey={queueKey} onResend={(g) => void resendGroup(g)} />

          <PanelUploadHistory rows={history} loading={historyLoading} />
        </div>
      )}

      {activeSubSection === 'sync_boards' && (
        <div className="space-y-6">
          <ReimportNotice needed={Boolean(snapshot?.projectsInfo?.needsReimport)} />
          <ApiImportPanel onImported={() => onSnapshotUpdated?.()} onReportChange={() => onSnapshotUpdated?.()} />
          <ImportUploadPanel lastReport={snapshot?.importReport ?? null} onImported={() => onSnapshotUpdated?.()} />
        </div>
      )}

      {activeSubSection === 'de_para' && snapshot && (
        <TeamMappingPanel snapshot={snapshot} unmatched={[]} onChanged={() => onSnapshotUpdated?.()} />
      )}

      {activeSubSection === 'pmo' && <PmoEmailsPanel />}
    </div>
  );
}
