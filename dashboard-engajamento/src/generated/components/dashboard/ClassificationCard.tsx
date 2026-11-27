import { Users2, Check } from 'lucide-react';
import type { BandCounts, ScoreBand } from '@generated/lib/dashboardTheme';
import { SCORE_HIGH_THRESHOLD, SCORE_LOW_THRESHOLD } from '@generated/lib/dashboardTheme';

interface Props {
  weekly: boolean;
  counts: BandCounts;
  selected: ScoreBand | null;
  onSelect: (b: ScoreBand | null) => void;
}

interface Row {
  id: ScoreBand;
  label: string;
  hint: string;
  count: number;
  barClass: string;
}

export function ClassificationCard({ weekly, counts, selected, onSelect }: Props) {
  const rows: Row[] = weekly
    ? [
        { id: 'engaged', label: 'Engajados', hint: 'Acesso na semana (dom a sáb)', count: counts.engaged, barClass: 'bg-[hsl(var(--brand-navy))]' },
        { id: 'not_engaged', label: 'Desengajados', hint: 'Mais de 7 dias sem acesso', count: counts.notEngaged, barClass: 'bg-[hsl(var(--brand-navy)/0.45)]' },
        { id: 'inactive', label: 'Inativos', hint: 'Mais de 30 dias sem acesso', count: counts.inactive, barClass: 'bg-[hsl(var(--brand-navy)/0.2)]' },
        { id: 'away', label: 'Afastados', hint: 'Férias ou licença', count: counts.away, barClass: 'bg-muted-foreground/40' },
      ]
    : [
        { id: 'high', label: 'Alto', hint: `${SCORE_HIGH_THRESHOLD}% ou mais`, count: counts.high, barClass: 'bg-[hsl(var(--brand-navy))]' },
        { id: 'medium', label: 'Médio', hint: `${SCORE_LOW_THRESHOLD}% a ${SCORE_HIGH_THRESHOLD - 1}%`, count: counts.medium, barClass: 'bg-[hsl(var(--brand-navy)/0.6)]' },
        { id: 'low', label: 'Baixo', hint: `Abaixo de ${SCORE_LOW_THRESHOLD}%`, count: counts.low, barClass: 'bg-[hsl(var(--brand-navy)/0.3)]' },
        { id: 'away', label: 'Afastados', hint: 'Férias ou licença', count: counts.away, barClass: 'bg-muted-foreground/40' },
      ];

  const total = counts.evaluated + counts.away;

  return (
    <section className="rounded-3xl bg-card soft-stack-card p-6 min-w-0 flex flex-col">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Classificação</p>
      <h3 className="mt-1 text-lg font-medium tracking-[-0.015em] text-[hsl(var(--brand-navy))]">Faixas de score das pessoas</h3>
      <p className="text-xs text-muted-foreground">Clique em uma faixa para filtrar a tabela</p>

      {total === 0 ? (
        <div className="flex-1 grid place-items-center py-10 text-center">
          <div className="space-y-2">
            <Users2 className="w-8 h-8 mx-auto text-muted-foreground/60" strokeWidth={1.5} />
            <p className="text-xs text-muted-foreground">Sem pessoas classificadas neste período</p>
          </div>
        </div>
      ) : (
        <div className="mt-5 space-y-2">
          {rows.map((r) => {
            const pct = total > 0 ? Math.round((r.count / total) * 100) : 0;
            const active = selected === r.id;
            return (
              <button
                key={r.id}
                type="button"
                aria-pressed={active}
                aria-label={`Faixa ${r.label}: ${r.count} pessoas (${pct}%)`}
                onClick={() => onSelect(active ? null : r.id)}
                className={`w-full text-left rounded-2xl px-4 py-3 border transition-colors ${
                  active
                    ? 'border-[hsl(var(--brand-navy)/0.4)] bg-[hsl(var(--brand-sky))]'
                    : 'border-border hover:bg-[hsl(var(--brand-sky-2))]'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${r.barClass}`} />
                    <span className="text-sm font-medium text-[hsl(var(--brand-navy))]">{r.label}</span>
                    <span className="text-[11px] text-muted-foreground truncate">{r.hint}</span>
                    {active && <Check className="w-3.5 h-3.5 text-[hsl(var(--brand-navy))] shrink-0" />}
                  </div>
                  <div className="shrink-0 text-right tabular-nums">
                    <span className="text-sm font-medium text-[hsl(var(--brand-navy))]">{r.count}</span>
                    <span className="ml-2 text-[11px] text-muted-foreground">{pct}%</span>
                  </div>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full ${r.barClass}`} style={{ width: `${pct}%` }} />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
