import { useEffect, useState, type ReactNode } from 'react';
import { ChevronRight, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@components/ui/tooltip';
import { cn } from '@lib/utils';
import { dotDe } from '@generated/lib/status';
import type { Farol } from '@generated/lib/farol';
import { DASH } from '@generated/lib/format';

export function StatusPill({ label, className }: { label: string | null | undefined; className?: string }) {
  if (!label) return <span className="text-muted-foreground">{DASH}</span>;

  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-[var(--radius-sm)] border border-border bg-[hsl(var(--surface-2))] px-1.5 py-0.5 text-xs text-foreground',
        className,
      )}
      title={label}
    >
      <span className={cn('size-1.5 shrink-0 rounded-full', dotDe(label))} aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  );
}

export const FAROL_META: Record<Farol, { label: string; cls: string; dot: string }> = {
  noPrazo: {
    label: 'No prazo',
    cls: 'bg-[hsl(var(--success-soft))] text-[hsl(var(--success))] border-[hsl(var(--success)/0.35)]',
    dot: 'bg-[hsl(var(--success))]',
  },
  atrasado: {
    label: 'Atrasado',
    cls: 'bg-[hsl(var(--danger-soft))] text-[hsl(var(--danger))] border-[hsl(var(--danger)/0.4)]',
    dot: 'bg-[hsl(var(--danger))]',
  },
  vence: {
    label: 'Vence ≤ 7 d',
    cls: 'bg-[hsl(var(--warning-soft))] text-[hsl(var(--warning))] border-[hsl(var(--warning)/0.4)]',
    dot: 'bg-[hsl(var(--warning))]',
  },
  aberto: {
    label: 'Em aberto',
    cls: 'bg-[hsl(var(--info-soft))] text-[hsl(var(--info))] border-[hsl(var(--info)/0.3)]',
    dot: 'bg-[hsl(var(--info))]',
  },
  inativo: {
    label: 'Não se aplica',
    cls: 'bg-[hsl(var(--neutral-soft))] text-muted-foreground border-border',
    dot: 'bg-[hsl(var(--fg-subtle))]',
  },
  semData: {
    label: 'Sem data',
    cls: 'bg-[hsl(var(--neutral-soft))] text-muted-foreground border-border',
    dot: 'bg-[hsl(var(--neutral-status))]',
  },
};

export function FarolChip({ farol, text, className }: { farol: Farol; text?: string; className?: string }) {
  const m = FAROL_META[farol];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-[var(--radius-sm)] border px-1.5 py-0.5 text-xs font-medium',
        m.cls,
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', m.dot)} aria-hidden />
      {text ?? m.label}
    </span>
  );
}

/** Open/closed state remembered per block in this browser (localStorage, failures ignored). */
export function useAberto(chave: string | undefined) {
  const k = chave ? `painel:${chave}` : null;
  const [aberto, setAberto] = useState(true);
  useEffect(() => {
    if (!k) return;
    try { const v = window.localStorage.getItem(k); if (v !== null) setAberto(v === '1'); } catch { /* storage unavailable */ }
  }, [k]);
  const alternar = () => setAberto((a) => {
    const n = !a;
    if (k) { try { window.localStorage.setItem(k, n ? '1' : '0'); } catch { /* storage unavailable */ } }
    return n;
  });
  return { aberto, alternar };
}

export function Panel({
  title,
  aside,
  children,
  className,
  recolhivel,
}: {
  title?: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Storage key: shows a chevron left of the title that collapses/expands the block. */
  recolhivel?: string;
}) {
  const { aberto, alternar } = useAberto(recolhivel);
  const visivel = !recolhivel || aberto;
  return (
    <section className={cn('fx-grain min-w-0 rounded-[var(--radius-lg)] border border-border bg-card', className)}>
      {title && (
        <header className={cn('flex flex-wrap items-center justify-between gap-2 px-4 py-2.5', visivel && 'border-b border-border')}>
          <h2 className="min-w-0 text-sm font-semibold text-foreground">
            {recolhivel ? (
              <button type="button" onClick={alternar} aria-expanded={aberto}
                className="-ml-1.5 inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-sm)] px-1.5 text-left hover:bg-[hsl(var(--surface-2))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-7">
                <ChevronRight className={cn('size-4 shrink-0 text-muted-foreground transition-transform duration-150', aberto && 'rotate-90')} aria-hidden />
                <span>{title}</span>
              </button>
            ) : title}
          </h2>
          {aside}
        </header>
      )}
      {visivel && children}
    </section>
  );
}

export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-6 py-14 text-center">
      <p className="text-base font-medium text-foreground">{title}</p>
      <p className="max-w-md text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}

export function Money({ value, className }: { value: number | null | undefined; className?: string }) {
  const neg = (value ?? 0) < 0;
  return (
    <span className={cn('tnum', neg && 'font-medium text-[hsl(var(--danger))]', className)}>
      {value === null || value === undefined
        ? DASH
        : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
    </span>
  );
}

/** "i" icon with the calculation rule of an indicator (hover / focus / tap). */
export function InfoDica({ texto, className }: { texto: string; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-label={`Como é calculado: ${texto}`} onClick={(e) => e.stopPropagation()}
          className={cn('relative z-[2] inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[hsl(var(--fg-subtle))] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', className)}>
          <Info className="size-3.5" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-72 text-xs leading-snug">{texto}</TooltipContent>
    </Tooltip>
  );
}
