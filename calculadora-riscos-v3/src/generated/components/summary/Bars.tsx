import { cn } from '@lib/utils';

export type Count = { label: string; total: number };

/** Barras horizontais compactas (sem gráfico genérico): rótulo, trilho e número. */
export function Bars({ rows, highlight, emptyText }: { rows: Count[]; highlight?: (label: string) => boolean; emptyText: string }) {
  const max = Math.max(1, ...rows.map((r) => r.total));
  if (rows.every((r) => r.total === 0)) {
    return <p className="py-4 text-sm text-muted-foreground">{emptyText}</p>;
  }
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_2.5rem] items-center gap-3 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_2.5rem]">
          <span className="truncate text-xs text-muted-foreground" title={r.label}>
            {r.label}
          </span>
          <span className="h-2 overflow-hidden rounded-full bg-[hsl(var(--border)/0.7)]">
            <span
              className={cn('block h-full rounded-full', highlight?.(r.label) ? 'bg-[hsl(var(--destructive))]' : 'bg-[hsl(var(--cobalt))]')}
              style={{ width: `${(r.total / max) * 100}%` }}
            />
          </span>
          <span className="mono text-right text-sm tabular-nums text-foreground">{r.total}</span>
        </li>
      ))}
    </ul>
  );
}
