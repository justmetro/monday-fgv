import { cn } from '@lib/utils';
import { fmtDate, parseIso, todayIso } from '@generated/lib/painel';

type Bar = { label: string; from: string | null; to: string | null; tone: 'ink' | 'primary' | 'muted' };
type Mark = { label: string; date: string | null; tone: 'primary' | 'warning' | 'danger' | 'success' | 'muted' };

const BAR: Record<Bar['tone'], string> = {
  ink: 'bg-[hsl(var(--neutral-ink))]/70',
  primary: 'bg-primary/80',
  muted: 'bg-[hsl(var(--chart-5))]/50',
};
const MARK: Record<Mark['tone'], string> = {
  primary: 'bg-primary',
  warning: 'bg-[hsl(var(--warning))]',
  danger: 'bg-destructive',
  success: 'bg-[hsl(var(--success))]',
  muted: 'bg-muted-foreground',
};

/** Faixa de prazos: barras de contrato/execução + marcos (hoje, término, manter até). */
export function PrazoStrip({ bars, marks }: { bars: Bar[]; marks: Mark[] }) {
  const hoje = todayIso();
  const all = [
    ...bars.flatMap((b) => [b.from, b.to]),
    ...marks.map((m) => m.date),
    hoje,
  ].map((d) => parseIso(d)?.getTime()).filter((n): n is number => typeof n === 'number');
  if (all.length < 2) {
    return <p className="rounded-md bg-[hsl(var(--chrome))] px-4 py-3 text-sm text-muted-foreground">Preencha as datas de contrato ou execução para visualizar a linha de prazos.</p>;
  }
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = Math.max(1, max - min);
  const pos = (d: string | null) => {
    const t = parseIso(d)?.getTime();
    return t === undefined ? null : ((t - min) / span) * 100;
  };
  const visibleMarks = [{ label: 'Hoje', date: hoje, tone: 'primary' as const }, ...marks].filter((m) => m.date);

  return (
    <figure className="rounded-lg bg-[hsl(var(--chrome))] px-4 pb-3 pt-4" aria-label="Linha de prazos do projeto">
      <div className="relative">
        <div className="flex flex-col gap-2.5">
          {bars.map((b) => {
            const a = pos(b.from ?? b.to);
            const z = pos(b.to ?? b.from);
            return (
              <div key={b.label} className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-3">
                <span className="truncate text-xs text-muted-foreground" title={b.label}>{b.label}</span>
                <div className="relative h-2.5 rounded-full bg-card">
                  {a !== null && z !== null && (
                    <div
                      className={cn('absolute inset-y-0 rounded-full', BAR[b.tone])}
                      style={{ left: `${Math.min(a, z)}%`, width: `${Math.max(1.2, Math.abs(z - a))}%` }}
                      title={`${fmtDate(b.from)} – ${fmtDate(b.to)}`}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="pointer-events-none absolute inset-y-[-6px] left-[100px] right-0">
          {visibleMarks.map((m) => {
            const p = pos(m.date);
            if (p === null) return null;
            return <span key={m.label} className={cn('absolute inset-y-0 w-px', MARK[m.tone])} style={{ left: `${p}%` }} aria-hidden />;
          })}
        </div>
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 pl-0 sm:pl-[100px]">
        {visibleMarks.map((m) => (
          <span key={m.label} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={cn('size-2 rounded-full', MARK[m.tone])} aria-hidden />
            {m.label} <span className="tnum text-foreground">{fmtDate(m.date)}</span>
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
