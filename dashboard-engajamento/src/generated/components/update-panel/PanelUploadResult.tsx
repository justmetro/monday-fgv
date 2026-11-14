import { CheckCircle2, AlertTriangle, XCircle, Loader2, RotateCcw, Database } from 'lucide-react';
import type { RunState, UploadSettings } from '@generated/hooks/usePanelUploadRunner';
import { PanelUploadMetricsView } from './PanelUploadMetricsView';

interface Props {
  run: RunState;
  progress: { done: number; total: number };
  settings: UploadSettings;
  running: boolean;
  onCancel: () => void;
  onResume: () => void;
  onNew: () => void;
}

const STATUS_TEXT: Record<RunState['status'], string> = {
  gravando: 'Gravando…',
  concluido: 'Gravação concluída e confirmada no quadro',
  concluido_com_falhas: 'Gravação concluída com pendências no quadro',
  parado: 'Gravação parada',
  cancelado: 'Gravação cancelada',
  erro: 'Quadro não recebeu os dados',
};

const STAGE_LABEL: Record<string, string> = { criar: 'Criar item', campos: 'Último acesso/Date', checks: 'Checks', equipes: 'Equipes' };

const PHASE_TEXT: Record<RunState['phase'], string> = {
  lendo: 'Lendo o grupo no quadro…',
  criando: 'Criando os itens que faltam…',
  marcando: 'Marcando os checks…',
  equipes: 'Gravando as equipes…',
  conferindo: 'Conferindo no quadro (leitura de volta)…',
  fim: '',
};

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-[hsl(var(--brand-sky-2))] border border-border p-3 min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold text-[hsl(var(--brand-navy))] tabular-nums truncate">{value}</p>
    </div>
  );
}

export function PanelUploadResult({ run, progress, settings, running, onCancel, onResume, onNew }: Props) {
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const Icon = running ? Loader2 : run.status === 'concluido' ? CheckCircle2 : run.status === 'concluido_com_falhas' ? AlertTriangle : XCircle;
  const hasQueue = run.pendingCount > 0 || run.checksPending > 0;

  return (
    <section className="bg-card rounded-3xl soft-stack-card p-5 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Icon className={`w-5 h-5 shrink-0 text-[hsl(var(--brand-navy))] ${running ? 'animate-spin' : ''}`} />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Grupo “{run.groupName}”</p>
            <h3 className="text-lg font-medium text-foreground">{running ? PHASE_TEXT[run.phase] || STATUS_TEXT.gravando : STATUS_TEXT[run.status]}</h3>
            {!running && run.stopReason && <p className="text-xs text-muted-foreground break-words">{run.stopReason}</p>}
          </div>
        </div>
        {running ? (
          <button type="button" onClick={onCancel} className="h-11 px-4 rounded-full border border-destructive/40 text-destructive text-xs font-medium hover:bg-destructive/10">
            Cancelar
          </button>
        ) : (
          <div className="flex flex-wrap gap-2">
            {hasQueue && (
              <button type="button" onClick={onResume} className="h-11 px-4 rounded-full bg-[hsl(var(--brand-navy))] text-card text-xs font-medium inline-flex items-center gap-1.5 hover:opacity-90">
                <RotateCcw className="w-3.5 h-3.5" /> Reenviar pendências ao quadro
              </button>
            )}
            <button type="button" onClick={onNew} className="h-11 px-4 rounded-full border border-border text-xs text-foreground hover:bg-muted">
              Nova atualização
            </button>
          </div>
        )}
      </div>

      {run.base && (
        <p className="text-xs text-foreground bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-center gap-2">
          <Database className="w-4 h-4 shrink-0 text-primary" />
          Base atualizada primeiro: {run.base.created} linhas criadas · {run.base.updated} atualizadas · {run.base.unchanged} sem alteração. Painéis e scores já leem estes dados.
        </p>
      )}

      {!running && hasQueue && (
        <p className="text-xs text-foreground bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
          Ficaram na fila desta semana: {run.pendingCount} pessoas e {run.checksPending} checks ainda não confirmados no quadro. A Base continua valendo; reenvie quando o quadro estiver disponível (nada será duplicado).
        </p>
      )}

      <div className="space-y-1.5">
        <div className="h-3 rounded-full bg-muted overflow-hidden" role="progressbar" aria-label="Confirmado no quadro" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-gradient-to-r from-[hsl(var(--brand-navy)/0.45)] to-[hsl(var(--brand-navy))] transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-muted-foreground tabular-nums">
          Confirmado no quadro: {run.created} de {run.toCreate} itens criados · {run.checksConfirmed} de {run.checksExpected} checks · {run.teamConfirmed} de {run.teamExpected} equipes (leitura de volta)
        </p>
      </div>

      <PanelUploadMetricsView metrics={run.metrics} activeSince={running ? run.activeSince : null} elapsedBefore={run.elapsedBefore} createdTotal={run.created + run.updated} settings={settings} />

      {!running && (
        <>
          <p className="text-[11px] text-muted-foreground">Todos os números abaixo vêm da leitura de volta do quadro, etapa por etapa.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <Tile label="1 · Itens criados" value={`${run.created} / ${run.toCreate}`} />
            <Tile label="2 · Último acesso/Date" value={`${run.updated} / ${run.toUpdate}`} />
            <Tile label="3 · Checks confirmados" value={`${run.checksConfirmed} / ${run.checksExpected}`} />
            <Tile label="4 · Equipes confirmadas" value={`${run.teamConfirmed} / ${run.teamExpected}`} />
            <Tile label="Falhas · criar" value={run.failuresByStage.criar} />
            <Tile label="Falhas · último acesso/Date" value={run.failuresByStage.campos} />
            <Tile label="Falhas · checks" value={run.failuresByStage.checks} />
            <Tile label="Falhas · equipes" value={run.failuresByStage.equipes} />
            <Tile label="Pessoas com pendência" value={run.pendingCount} />
            <Tile label="Desativadas na semana (lido da Base)" value={run.base ? `${run.base.deactivated ?? 0} / ${run.base.deactivatedExpected ?? 0}` : '—'} />
            <Tile label="Reativadas (lido da Base)" value={run.base ? `${run.base.reactivated ?? 0} / ${run.base.reactivatedExpected ?? 0}` : '—'} />
            <Tile label="Ignoradas (desativadas sem linha)" value={run.base?.ignoredDeactivated ?? run.discardedByStatus} />
            <Tile label="Checks só na Base" value={run.checksWithoutColumn} />
            <Tile label="Duplicados no quadro" value={run.boardDuplicates} />
          </div>
          {Object.keys(run.discardedByLabel).length > 0 && (
            <p className="text-xs text-muted-foreground">
              Ignoradas por “Status do usuário” (sem linha na semana): {Object.entries(run.discardedByLabel).map(([k, n]) => `${k} ${n}`).join(' · ')}. Nada foi criado para elas.
            </p>
          )}
          {run.duplicateNames.length > 0 && (
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Itens duplicados no grupo do quadro (nada foi apagado)</p>
              <ul className="space-y-0.5">{run.duplicateNames.map((n) => <li key={n} className="break-words">{n}</li>)}</ul>
            </div>
          )}
          {run.checksWithoutColumn > 0 && (
            <p className="text-xs text-muted-foreground">Checks de sábado/domingo ficam só na Base até as colunas existirem no quadro; depois, use “Reenviar pendências”.</p>
          )}
          {(run.metrics?.rawErrors?.length ?? 0) > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-foreground">Erros originais retornados pelo monday</p>
              <ul className="text-[11px] text-muted-foreground space-y-1 max-h-40 overflow-y-auto font-mono bg-muted/40 rounded-xl p-3">
                {run.metrics?.rawErrors?.map((m) => <li key={m} className="break-words">{m}</li>)}
              </ul>
            </div>
          )}
          {run.failures.length > 0 && (
            <div className="border border-border rounded-2xl overflow-x-auto max-h-72">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr><th className="px-3 py-2">Pessoa</th><th className="px-3 py-2">Etapa</th><th className="px-3 py-2">Motivo exato</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {run.failures.slice(0, 600).map((f) => (
                    <tr key={`${f.name}-${f.stage}-${f.reason}`}>
                      <td className="px-3 py-2">{f.name || '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{STAGE_LABEL[f.stage ?? 'checks']}</td>
                      <td className="px-3 py-2 text-muted-foreground break-words">{f.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
