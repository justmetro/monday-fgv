import { addMonths, differenceInCalendarDays, format, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@lib/utils';
import { fmtDate, parseIso, todayIso } from '@generated/lib/painel';

export type TimelineMark = { kind: 'termino' | 'manter' | 'renovacao'; date: string | null; label: string };
export type TimelineItem = {
  id: string; label: string; sub?: string;
  start: string | null; end: string | null; barClass: string; marks: TimelineMark[];
};

const MARK: Record<TimelineMark['kind'], string> = {
  termino: 'rotate-45 bg-foreground',
  manter: 'rounded-full bg-[hsl(var(--success))]',
  renovacao: 'rounded-full bg-destructive',
};

export function Timeline({ items, onOpen, monthsBefore = 2, months = 12 }: {
  items: TimelineItem[]; onOpen: (id: string) => void; monthsBefore?: number; months?: number;
}) {
  const start = startOfMonth(addMonths(new Date(), -monthsBefore));
  const end = addMonths(start, months);
  const total = Math.max(1, differenceInCalendarDays(end, start));
  const pct = (iso: string | null) => {
    const d = parseIso(iso);
    return d ? (differenceInCalendarDays(d, start) / total) * 100 : null;
  };
  const clamp = (n: number) => Math.min(100, Math.max(0, n));
  const meses = Array.from({ length: months }, (_, i) => addMonths(start, i));
  const hoje = pct(todayIso());

  return (
    <div className="soft-stack overflow-x-auto rounded-xl bg-card">
      <div className="min-w-[900px]">
        <div className="grid grid-cols-[240px_minmax(0,1fr)] border-b border-border bg-[hsl(var(--chrome))] text-xs text-muted-foreground">
          <div className="sticky left-0 z-10 bg-[hsl(var(--chrome))] px-4 py-2 font-medium">Projeto</div>
          <div className="grid" style={{ gridTemplateColumns: `repeat(${months}, minmax(0, 1fr))` }}>
            {meses.map((m) => (
              <div key={m.toISOString()} className="border-l border-border px-2 py-2 capitalize">
                {format(m, 'MMM/yy', { locale: ptBR })}
              </div>
            ))}
          </div>
        </div>

        {items.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">Nenhum projeto para exibir com os filtros atuais.</p>
        )}

        {items.map((it) => {
          const a = pct(it.start ?? it.end);
          const z = pct(it.end ?? it.start);
          const lo = a !== null && z !== null ? Math.min(a, z) : null;
          const hi = a !== null && z !== null ? Math.max(a, z) : null;
          const visivel = lo !== null && hi !== null && hi >= 0 && lo <= 100;
          return (
            <div key={it.id} className="group grid grid-cols-[240px_minmax(0,1fr)] border-b border-border last:border-b-0 hover:bg-[hsl(var(--chrome))]">
              <button
                type="button"
                onClick={() => onOpen(it.id)}
                className="sticky left-0 z-10 min-w-0 bg-card px-4 py-2.5 text-left group-hover:bg-[hsl(var(--chrome))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <span className="block truncate text-sm font-medium text-foreground hover:text-primary" title={it.label}>{it.label}</span>
                {it.sub && <span className="block truncate text-xs text-muted-foreground">{it.sub}</span>}
              </button>
              <div className="relative h-12">
                {meses.map((m, i) => (
                  <span key={m.toISOString()} className="absolute inset-y-0 w-px bg-border/60" style={{ left: `${(i / months) * 100}%` }} aria-hidden />
                ))}
                {hoje !== null && hoje >= 0 && hoje <= 100 && (
                  <span className="absolute inset-y-0 w-0.5 bg-primary" style={{ left: `${hoje}%` }} aria-hidden />
                )}
                {visivel && lo !== null && hi !== null && (
                  <div
                    className={cn('absolute top-1/2 h-3 -translate-y-1/2 rounded-full', it.barClass)}
                    style={{ left: `${clamp(lo)}%`, width: `${Math.max(0.8, clamp(hi) - clamp(lo))}%` }}
                    title={`${fmtDate(it.start)} – ${fmtDate(it.end)}`}
                  />
                )}
                {it.marks.map((mk) => {
                  const p = pct(mk.date);
                  if (p === null || p < 0 || p > 100) return null;
                  return (
                    <span
                      key={mk.kind}
                      title={`${mk.label}: ${fmtDate(mk.date)}`}
                      className={cn('absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 ring-2 ring-card', MARK[mk.kind])}
                      style={{ left: `${p}%` }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
