import GoalBar from '@generated/GoalBar';
import { Parcial } from '@generated/bits';
import { fmtPct, unidade } from '@generated/lib';
import { fracLine } from '@generated/tip';
import { cn } from '@lib/utils';

/** left card of the indicator slide: Resultado [V2] + Atingido/Total (or saldo in R$) of the chosen period */
export default function ResultCard({ eyebrow, r, i, onClick, extra }) {
  const semCasos = !r || r.state === 'nocase';
  const parcial = r?.state === 'parcial';
  const un = unidade(i);
  const f = fracLine(r, un);
  return (
    <section onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined} className={cn('min-w-0 rounded-2xl border border-border bg-card p-6', onClick && 'cursor-pointer hover:border-[hsl(var(--goal)/0.5)]')}>
      <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--goal))]">{eyebrow}{parcial && <Parcial />}</p>
      {parcial && <p className="mt-1 text-xs font-medium text-[hsl(var(--na-ink))]">Mês em andamento, resultado provisório</p>}
      {semCasos ? <p className="mt-6 text-lg text-[hsl(var(--na-ink))]">{r ? 'Sem casos no período' : 'Sem medição no período'}</p> : (
        <>
          <div className="mt-5 flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs text-[hsl(var(--goal))]">Resultado</p>
              <p className={cn('text-5xl font-bold tracking-tight tabular-nums', parcial && 'text-[hsl(var(--na-ink))]')}>{fmtPct(r.apurado)}</p>
              {f && <p className="mt-1 text-sm text-[hsl(var(--goal))]">{f}</p>}
              {extra}
            </div>
            <div className="text-right">
              <p className="text-xs text-[hsl(var(--goal))]">Meta</p>
              <p className="text-3xl font-semibold tabular-nums text-[hsl(var(--goal))]">{fmtPct(r.meta)}</p>
            </div>
          </div>
          <GoalBar apurado={r.apurado} meta={r.meta} lower={i.lower} neutral={parcial} />
        </>
      )}
    </section>
  );
}
