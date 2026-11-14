import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@lib/utils';

type Tone = 'default' | 'primary' | 'warning' | 'danger';
const TONE: Record<Tone, string> = {
  default: 'text-foreground',
  primary: 'text-primary',
  warning: 'text-[hsl(var(--warning-ink))]',
  danger: 'text-[hsl(var(--danger-ink))]',
};

export function KpiCard({ label, value, hint, icon: Icon, tone = 'default', spark, loading, onClick }: {
  label: string; value: ReactNode; hint?: ReactNode; icon?: LucideIcon; tone?: Tone;
  spark?: number[]; loading?: boolean; onClick?: () => void;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs text-muted-foreground">{label}</span>
        {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
      </div>
      {loading ? (
        <div className="h-7 w-24 animate-pulse rounded bg-muted" />
      ) : (
        <span className={cn('tnum truncate text-2xl font-normal tracking-[-0.025em]', TONE[tone])}>{value}</span>
      )}
      <div className="flex min-h-5 items-end justify-between gap-2">
        {hint && !loading ? <span className="truncate text-xs text-muted-foreground">{hint}</span> : <span />}
        {spark && spark.length > 1 && !loading && <Sparkline data={spark} />}
      </div>
    </>
  );
  const cls = 'soft-stack flex min-w-0 flex-col gap-2 rounded-xl bg-card p-4 text-left';
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={cn(cls, 'transition-colors hover:bg-[hsl(var(--chrome))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring')}
    >
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function Sparkline({ data, w = 72, h = 24 }: { data: number[]; w?: number; h?: number }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data
    .map((v, i) => `${((i / (data.length - 1)) * w).toFixed(1)},${(h - 1 - ((v - min) / span) * (h - 2)).toFixed(1)}`)
    .join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0 text-primary" aria-hidden>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
