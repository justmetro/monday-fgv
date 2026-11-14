import { History } from 'lucide-react';
import type { getPanelUploadHistory } from '@generated/server/panelUpdate';
import { formatBR, parseDateFlexible } from '@generated/lib/dates';
import { weekdayOfIso, weekdayTitle } from '@generated/lib/weekdays';
import { errorsSummary, formatElapsed } from './PanelUploadMetricsView';

type HistoryRow = Awaited<ReturnType<typeof getPanelUploadHistory>>[number];

const LABEL: Record<string, string> = {
  em_andamento: 'Em andamento',
  concluido: 'Concluída',
  concluido_com_falhas: 'Com falhas',
  parado: 'Parada',
  cancelado: 'Cancelada',
  erro: 'Erro',
};

export function PanelUploadHistory({ rows, loading }: { rows: HistoryRow[]; loading: boolean }) {
  return (
    <section className="bg-card rounded-3xl soft-stack-card p-5 sm:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <History className="w-4 h-4 text-[hsl(var(--brand-navy))]" />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Histórico</p>
          <h3 className="text-base font-medium text-foreground">Atualizações enviadas</h3>
        </div>
      </div>
      {loading && rows.length === 0 ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-10 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">Nenhuma atualização enviada ainda.</p>
      ) : (
        <div className="border border-border rounded-2xl overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                {['Quando', 'Quem enviou', 'Grupo', 'Data da análise', 'Dia', 'Lidas', 'Descartadas', 'Criados', 'Atualizados', 'Checks', 'Falhas', 'Pendentes', 'Situação', 'Métricas'].map((h) => (
                  <th key={h} className="px-3 py-2 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums">{new Date(r.startedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td className="px-3 py-2"><div className="text-foreground">{r.uploadedByName}</div><div className="text-muted-foreground">{r.uploadedByEmail}</div></td>
                  <td className="px-3 py-2 text-foreground">
                    {r.groupName}
                    {r.weekStart && r.weekEnd ? <span className="block text-[10px] text-muted-foreground tabular-nums">{r.weekStart.split('-').reverse().join('/')} a {r.weekEnd.split('-').reverse().join('/')}</span> : null}
                    {r.kind === 'base_antiga' ? <span className="ml-1.5 px-1.5 py-0.5 rounded bg-muted text-[10px] font-semibold text-muted-foreground whitespace-nowrap">base antiga</span> : null}
                    {r.rewrite ? <span className="ml-1.5 px-1.5 py-0.5 rounded bg-destructive/10 text-[10px] font-semibold text-destructive whitespace-nowrap" title={`Antes: ${r.rewrite.before.people} pessoas, ${r.rewrite.before.checks} checks, ${r.rewrite.before.boardItems ?? '?'} itens no quadro. Depois: ${r.rewrite.after.people} pessoas, ${r.rewrite.after.checks} checks.`}>reescrita</span> : null}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{formatBR(parseDateFlexible(r.analysisDate))}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{weekdayTitle(r.weekday ?? weekdayOfIso(r.analysisDate))}</td>
                  <td className="px-3 py-2 tabular-nums">{r.rowsRead}</td>
                  <td className="px-3 py-2 tabular-nums">{r.discardedByStatus}</td>
                  <td className="px-3 py-2 tabular-nums font-medium text-foreground">{r.created}</td>
                  <td className="px-3 py-2 tabular-nums">{r.updated ?? '—'}</td>
                  <td className="px-3 py-2 tabular-nums">{r.checksMarked ?? '—'}</td>
                  <td className="px-3 py-2 tabular-nums">{r.failed}</td>
                  <td className="px-3 py-2 tabular-nums">{r.pending}</td>
                  <td className="px-3 py-2 whitespace-nowrap" title={r.stopReason ?? undefined}>{LABEL[r.status] ?? r.status}</td>
                  <td className="px-3 py-2 min-w-[220px] text-muted-foreground">
                    {r.metrics ? (
                      <div className="space-y-0.5">
                        <div className="text-foreground tabular-nums">
                          {formatElapsed(r.metrics.elapsedMs)} · {r.metrics.itemsPerSecond.toLocaleString('pt-BR')} itens/s
                        </div>
                        <div className="tabular-nums">
                          {r.metrics.itemsPerCallHistory.join(' → ')} por chamada · {r.metrics.parallelCalls} em paralelo
                        </div>
                        <div className="tabular-nums">
                          {r.metrics.calls} chamadas · {r.metrics.retries} repetidas · {r.metrics.verifications} conferências
                        </div>
                        <div>Erros: {errorsSummary(r.metrics.errorsByKind)}</div>
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
