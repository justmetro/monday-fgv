import { cn } from '@lib/utils';
import { fmtDelta } from '@generated/calc';

/** result tints (light) — partial measurements use the same gray as "sem medição" */
export const BG = {
  hit: 'bg-[hsl(var(--ok)/var(--cell-a))] text-[hsl(var(--ok-ink))]',
  miss: 'bg-[hsl(var(--below)/var(--cell-a))] text-[hsl(var(--below-ink))]',
  nometa: 'bg-[hsl(var(--na)/var(--cell-a))] text-foreground',
  nocase: 'bg-[hsl(var(--na)/0.12)] text-[hsl(var(--na-ink))]',
  parcial: 'bg-[hsl(var(--na)/0.12)] text-[hsl(var(--na-ink))]',
  na: 'bg-[hsl(var(--na)/0.08)] text-[hsl(var(--na-ink))]',
};

export function Legend() {
  const Dot = ({ c, t }) => <span className="inline-flex items-center gap-1.5"><span aria-hidden className={cn('h-3 w-3 rounded-full', c)} />{t}</span>;
  return (
    <div className="flex gap-4 text-xs text-[hsl(var(--goal))]">
      <Dot c="bg-[hsl(var(--ok))]" t="Atingiu a meta" />
      <Dot c="border-[3px] border-[hsl(var(--below))] bg-transparent" t="Abaixo da meta" />
      <Dot c="bg-[hsl(var(--na))]" t="Sem medição ou parcial" />
    </div>
  );
}

export const Parcial = ({ className }) => <span className={cn('ml-1 inline-block rounded bg-[hsl(var(--na)/0.25)] px-1 text-[9px] font-bold uppercase leading-[14px] text-[hsl(var(--na-ink))]', className)}>parcial</span>;

export function Trend({ t, className }) {
  if (!t) return null;
  return <span className={cn('whitespace-nowrap font-semibold tabular-nums', t.delta === 0 ? 'text-[hsl(var(--goal))]' : t.better ? 'text-[hsl(var(--ok-ink))]' : 'text-[hsl(var(--below-ink))]', className)}>{fmtDelta(t)}</span>;
}

export const StreakBadge = ({ n }) => (n >= 3 ? (
  <span className="ml-1 inline-block whitespace-nowrap rounded bg-[hsl(var(--below))] px-1 text-[9px] font-bold leading-[14px] text-[hsl(var(--on-solid))]">3+ meses abaixo da meta</span>
) : null);

export function Segmented({ value, onChange, options, label }) {
  return (
    <div className="flex gap-1 rounded-xl bg-muted p-1" aria-label={label}>
      {options.map(([id, text, badge]) => (
        <button key={id} type="button" aria-pressed={value === id} onClick={() => onChange(id)}
          className={cn('inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold', value === id ? 'bg-card shadow-sm' : 'text-[hsl(var(--goal))] hover:text-foreground')}>
          {text}{badge ? <span className="rounded-full bg-[hsl(var(--below))] px-1.5 text-[11px] text-[hsl(var(--on-solid))]">{badge}</span> : null}
        </button>
      ))}
    </div>
  );
}

/** "Slide 1/2" pager shown on screen when a view spans several slides */
export function Pager({ n, total, onChange }) {
  if (total <= 1) return <span />;
  const b = 'h-9 rounded-lg border border-border bg-card px-3 text-sm font-semibold hover:bg-muted disabled:opacity-40';
  return (
    <div className="flex items-center gap-2 text-sm">
      <button className={b} disabled={n === 0} onClick={() => onChange(n - 1)} aria-label="Slide anterior">‹</button>
      <span className="font-semibold tabular-nums">Slide {n + 1}/{total}</span>
      <button className={b} disabled={n >= total - 1} onClick={() => onChange(n + 1)} aria-label="Próximo slide">›</button>
    </div>
  );
}
