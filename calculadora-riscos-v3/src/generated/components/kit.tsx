import type { ReactNode } from 'react';
import { cn } from '@lib/utils';
import { ESCALA, grauOf, LIMITE_CRITICO } from '@generated/lib/config';

export type Tone = 'neutral' | 'active' | 'featured' | 'ok' | 'warn' | 'danger' | 'dim';

const toneClass: Record<Tone, string> = {
  neutral: 'bg-[hsl(var(--muted))] text-foreground/85 border-[hsl(var(--border))]',
  active: 'bg-[hsl(var(--surface-deep))] text-[hsl(var(--sky))] border-[hsl(var(--cobalt)/0.6)]',
  featured: 'bg-[hsl(var(--surface-deep))] text-[hsl(var(--sky))] border-transparent',
  ok: 'bg-[hsl(var(--success)/0.1)] text-[hsl(var(--success))] border-[hsl(var(--success)/0.3)]',
  warn: 'bg-[hsl(var(--warning)/0.1)] text-[hsl(var(--warning))] border-[hsl(var(--warning)/0.3)]',
  danger: 'bg-[hsl(var(--destructive)/0.12)] text-[hsl(var(--destructive))] border-[hsl(var(--destructive)/0.35)]',
  dim: 'bg-transparent text-muted-foreground border-[hsl(var(--border))]',
};

export function Pill({ tone = 'neutral', children, className, title }: { tone?: Tone; children: ReactNode; className?: string; title?: string }) {
  return (
    <span
      title={title}
      className={cn(
        'mono-label inline-flex h-[22px] max-w-full shrink-0 items-center gap-1 truncate rounded-full border px-2.5',
        toneClass[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('mono-label text-[hsl(var(--text-dim))]', className)}>{children}</p>;
}

export function calcTone(status: string | null | undefined): Tone {
  switch (status) {
    case 'Executada':
      return 'ok';
    case 'Executada c/ avisos':
      return 'warn';
    case 'Erro':
      return 'danger';
    case 'Executar':
      return 'active';
    default:
      return 'dim';
  }
}

export function envioTone(status: string | null | undefined): Tone {
  switch (status) {
    case 'Enviado':
      return 'ok';
    case 'Erro':
      return 'danger';
    case 'Enviar':
      return 'active';
    default:
      return 'dim';
  }
}

export function aplicTone(status: string | null | undefined): Tone {
  switch (status) {
    case 'Aplicável':
      return 'active';
    case 'Não aplicável':
      return 'dim';
    case 'Em avaliação':
      return 'warn';
    default:
      return 'neutral';
  }
}

export function tratTone(status: string | null | undefined): Tone {
  switch (status) {
    case 'Encerrado':
      return 'ok';
    case 'Em monitoramento':
      return 'active';
    case 'Em tratamento':
      return 'warn';
    default:
      return 'dim';
  }
}

/** Grau + Nível exatamente como calculados pelo quadro, com régua de 5 posições. */
export function GrauBlock({ grau, nivel, compact = false }: { grau: string | null | undefined; nivel: string | null | undefined; compact?: boolean }) {
  const g = grauOf(grau);
  const critico = g !== null && g >= LIMITE_CRITICO;
  const idx = nivel ? ESCALA.findIndex((e) => e.toLowerCase() === nivel.trim().toLowerCase()) : -1;
  return (
    <div className={cn('flex shrink-0 flex-col items-start', compact ? 'w-14' : 'w-16')} title={`Grau ${g ?? '—'} · Nível ${nivel || '—'} (calculado pelo quadro 09.4)`}>
      <span
        className={cn(
          'mono font-medium leading-none tabular-nums',
          compact ? 'text-xl' : 'text-2xl',
          critico ? 'text-[hsl(var(--destructive))]' : g === null ? 'text-muted-foreground' : 'text-foreground',
        )}
      >
        {g ?? '—'}
      </span>
      <div className="mt-1.5 flex gap-0.5" aria-hidden>
        {ESCALA.map((e, i) => (
          <span
            key={e}
            className={cn(
              'h-1 w-2 rounded-full',
              i <= idx ? (critico ? 'bg-[hsl(var(--destructive))]' : 'bg-[hsl(var(--cobalt))]') : 'bg-[hsl(var(--border))]',
            )}
          />
        ))}
      </div>
      <span className="mono-label mt-1 truncate text-[9.5px] text-muted-foreground">{nivel || 'sem nível'}</span>
    </div>
  );
}

export function EmptyNote({ title, children, icon }: { title: string; children: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[hsl(var(--border))] px-6 py-12 text-center">
      {icon && <div className="text-[hsl(var(--sky))]">{icon}</div>}
      <p className="text-base font-medium text-foreground">{title}</p>
      <div className="max-w-md text-sm text-muted-foreground">{children}</div>
    </div>
  );
}
