import { CalendarRange, AlertTriangle } from 'lucide-react';
import type { PeriodOption } from '@generated/lib/periods';

interface Props {
  period: PeriodOption | null;
  weeksCount: number;
}

/** Intervalo de datas do período escolhido e quantas semanas analisadas ele tem; aviso amarelo quando não há nenhuma. */
export function PeriodInfoLine({ period, weeksCount }: Props) {
  if (!period) return null;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-2xl border border-border bg-card px-4 py-2.5 text-xs">
        <span className="flex items-center gap-2 text-foreground min-w-0">
          <CalendarRange className="w-4 h-4 text-[hsl(var(--brand-navy))] shrink-0" strokeWidth={1.75} />
          <span className="truncate">
            Período avaliado: <strong className="font-medium">{period.longLabel}</strong> · {period.rangeText}
          </span>
        </span>
        <span className="text-muted-foreground tabular-nums">
          {weeksCount} {weeksCount === 1 ? 'semana analisada' : 'semanas analisadas'}
        </span>
      </div>
      {weeksCount === 0 && (
        <div role="status" className="flex items-center gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-foreground">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Período sem semana analisada</span>
        </div>
      )}
    </div>
  );
}
