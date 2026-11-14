import { cn } from '@lib/utils';
import { fmtPct, fmtDiff, isHit } from '@generated/lib';

const clamp = (v) => Math.max(0, Math.min(100, v));

/** neutral → gray bar and gray text (partial measurement: never green / orange) */
export default function GoalBar({ apurado, meta, lower, compact, neutral }) {
  if (apurado == null) return null;
  const ok = neutral ? null : isHit(apurado, meta, lower);
  return (
    <div className={compact ? 'mt-2' : 'mt-6'}>
      <div className={cn('relative', compact ? 'pt-4' : 'pt-6')}>
        {meta != null && (
          <div className={cn('absolute top-0 -translate-x-1/2 font-semibold text-[hsl(var(--goal))] whitespace-nowrap', compact ? 'text-[9px]' : 'text-xs')}
            style={{ left: `${clamp(meta)}%` }}>Meta {fmtPct(meta)}</div>
        )}
        <div className={cn('relative rounded-full bg-[hsl(var(--na)/0.25)]', compact ? 'h-2' : 'h-3')}>
          <div className={cn('h-full rounded-full', ok == null ? 'bg-[hsl(var(--na))]' : ok ? 'bg-[hsl(var(--ok))]' : 'bg-[hsl(var(--below))]')} style={{ width: `${clamp(apurado)}%` }} />
          {meta != null && <div className="absolute -top-1.5 -bottom-1.5 w-0.5 rounded bg-[hsl(var(--goal))]" style={{ left: `calc(${clamp(meta)}% - 1px)` }} />}
        </div>
        {!compact && <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground"><span>0%</span><span>100%</span></div>}
      </div>
      {meta != null && (
        <p className={cn('font-semibold', compact ? 'mt-1.5 text-[11px]' : 'mt-3 text-sm', ok == null ? 'text-[hsl(var(--na-ink))]' : ok ? 'text-[hsl(var(--ok-ink))]' : 'text-[hsl(var(--below-ink))]')}>
          {neutral ? 'Parcial · resultado provisório' : fmtDiff(apurado, meta, lower)}
        </p>
      )}
    </div>
  );
}
