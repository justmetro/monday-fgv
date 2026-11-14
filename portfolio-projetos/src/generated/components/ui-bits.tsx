import type { ReactNode } from 'react';
import { Link2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@components/ui/tooltip';
import { cn } from '@lib/utils';
import { typeKind, valState, fmtField } from '@generated/lib/format';

export function TypeBadge({ tipo }: { tipo: string | null }) {
  const kind = typeKind(tipo);
  return (
    <span
      title={tipo ?? 'Sem tipo'}
      className={cn(
        'inline-flex shrink-0 items-center rounded-sm px-1.5 py-0.5 font-mono text-[11px] font-medium',
        kind === 'KR' && 'bg-[hsl(var(--kr-soft))] text-[hsl(var(--kr))]',
        kind === 'KPI' && 'bg-[hsl(var(--kpi-soft))] text-[hsl(var(--kpi))]',
        kind === 'OUTRO' && 'bg-muted text-muted-foreground',
      )}
    >
      {kind === 'OUTRO' ? (tipo ? tipo.slice(0, 12) : 'Sem tipo') : kind}
    </span>
  );
}

/** Exibe um valor distinguindo vazio, indisponível, não mapeado e não aplicável. */
export function Val({ rec, field, v, mono }: { rec: { unavailable: string[]; unmapped: string[] }; field: string; v: string | null; mono?: boolean }) {
  const st = valState(rec, field, v);
  const text = fmtField(rec, field, v);
  if (st === 'unavailable' || st === 'unmapped')
    return <span className="text-xs italic text-[hsl(var(--warn))]">{text}</span>;
  if (st === 'empty') return <span className="text-muted-foreground">—</span>;
  return <span className={cn(mono && 'font-mono tabular-nums')}>{text}</span>;
}

export function Truncate({ text, className }: { text: string | null; className?: string }) {
  if (!text) return <span className="text-muted-foreground">—</span>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn('block truncate', className)}>{text}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm whitespace-pre-wrap">{text}</TooltipContent>
    </Tooltip>
  );
}

export function StatusPill({ label, tone }: { label: string | null; tone?: 'ok' | 'bad' | 'warn' | 'neutral' }) {
  if (!label) return <span className="text-muted-foreground">—</span>;
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center truncate rounded-sm px-1.5 py-0.5 text-xs',
        tone === 'ok' && 'bg-[hsl(var(--ok-soft))] text-[hsl(var(--ok))]',
        tone === 'bad' && 'bg-[hsl(var(--bad-soft))] text-destructive',
        tone === 'warn' && 'bg-[hsl(var(--warn-soft))] text-[hsl(var(--warn))]',
        (!tone || tone === 'neutral') && 'bg-muted text-foreground',
      )}
    >
      {label}
    </span>
  );
}

export function BaseDados({ urls, labels, text }: { urls: string[]; labels: string[]; text: string | null }) {
  if (urls.length === 0) return <Truncate text={text} />;
  return (
    <span className="flex flex-col gap-0.5">
      {urls.map((u, i) => (
        <a key={u} href={u} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 truncate text-primary underline-offset-2 hover:underline">
          <Link2 className="size-3 shrink-0" aria-hidden />
          <span className="truncate">{labels[i] || u}</span>
        </a>
      ))}
    </span>
  );
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-muted-foreground">{children}</h2>
      {aside}
    </div>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('min-w-0 rounded-lg border border-border bg-card p-4', className)}>{children}</section>;
}
