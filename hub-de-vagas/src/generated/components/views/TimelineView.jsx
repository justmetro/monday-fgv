import { useMemo } from 'react';
import { toDate, MONTHS } from '@generated/lib/data';
import { Pill, GlowDot } from '@generated/components/Pill';
import { cn } from '@lib/utils';

export default function TimelineView({ items, dateField, statusKey, subtitle, onOpen }) {
  const { months, undated } = useMemo(() => {
    const map = new Map();
    const none = [];
    items.forEach((it) => {
      const d = toDate(it[dateField.key]);
      if (!d) { none.push(it); return; }
      const k = d.getUTCFullYear() * 12 + d.getUTCMonth();
      if (!map.has(k)) map.set(k, []);
      map.get(k).push({ it, d });
    });
    const list = [...map.entries()].sort((a, b) => a[0] - b[0]).map(([k, rows]) => ({
      k, label: `${MONTHS[k % 12]} ${Math.floor(k / 12)}`, rows: rows.sort((a, b) => a.d - b.d),
    }));
    return { months: list, undated: none };
  }, [items, dateField]);

  const now = new Date();
  const nowKey = now.getFullYear() * 12 + now.getMonth();

  return (
    <div className="relative">
      <div className="absolute bottom-0 left-[7px] top-2 w-px bg-gradient-to-b from-primary/60 via-border to-transparent" />
      <div className="space-y-6">
        {months.map((m) => (
          <section key={m.k} className="relative pl-7">
            <GlowDot className={cn('absolute left-[4px] top-1.5 h-2 w-2', m.k < nowKey && 'bg-muted-foreground shadow-none')} />
            <h3 className="flex items-baseline gap-2 text-sm font-medium">
              {m.label}
              {m.k === nowKey && <span className="text-xs text-primary">mês atual</span>}
              <span className="text-xs font-normal text-muted-foreground">{m.rows.length}</span>
            </h3>
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
              {m.rows.map(({ it, d }) => (
                <button key={it.id} onClick={() => onOpen(it)} className="flex min-w-0 items-center gap-3 rounded-md border border-border bg-card px-3 py-2 text-left lift hover:shadow-[var(--glow-stack)]">
                  <span className="w-9 shrink-0 text-center">
                    <span className="block text-base font-medium leading-none tabular-nums">{String(d.getUTCDate()).padStart(2, '0')}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{it.name}</span>
                    {subtitle && <span className="block truncate text-xs text-muted-foreground">{subtitle(it)}</span>}
                  </span>
                  {statusKey && <Pill fieldKey={statusKey} label={it[statusKey]} className="hidden max-w-[130px] sm:inline-flex" />}
                </button>
              ))}
            </div>
          </section>
        ))}
        {undated.length > 0 && (
          <section className="relative pl-7">
            <span className="absolute left-[4px] top-1.5 h-2 w-2 rounded-full border border-muted-foreground" />
            <h3 className="text-sm font-medium text-muted-foreground">Sem {dateField.label.toLowerCase()} <span className="text-xs">{undated.length}</span></h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {undated.map((it) => (
                <button key={it.id} onClick={() => onOpen(it)} className="max-w-[260px] truncate rounded-full border border-border px-3 py-1 text-xs hover:border-primary/50">{it.name}</button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
