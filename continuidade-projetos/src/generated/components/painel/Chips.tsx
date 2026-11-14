import type { ReactNode } from 'react';
import { cn } from '@lib/utils';
import type { PrazoTom } from '@generated/lib/painel';

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'ghost';

const TONE: Record<Tone, string> = {
  success: 'bg-[hsl(var(--success-soft))] text-[hsl(var(--success-ink))]',
  warning: 'bg-[hsl(var(--warning-soft))] text-[hsl(var(--warning-ink))]',
  danger: 'bg-[hsl(var(--danger-soft))] text-[hsl(var(--danger-ink))]',
  info: 'bg-[hsl(var(--info-soft))] text-[hsl(var(--info-ink))]',
  neutral: 'bg-[hsl(var(--neutral-soft))] text-[hsl(var(--neutral-ink))]',
  ghost: 'border border-dashed border-input text-muted-foreground',
};
const DOT: Record<Tone, string> = {
  success: 'bg-[hsl(var(--success))]',
  warning: 'bg-[hsl(var(--warning))]',
  danger: 'bg-destructive',
  info: 'bg-primary',
  neutral: 'bg-muted-foreground',
  ghost: 'bg-input',
};

export function Chip({ tone, children, dot = false, className, title }: { tone: Tone; children: ReactNode; dot?: boolean; className?: string; title?: string }) {
  return (
    <span
      title={title}
      className={cn('inline-flex h-[22px] max-w-full items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-medium', TONE[tone], className)}
    >
      {dot && <span className={cn('size-1.5 shrink-0 rounded-full', DOT[tone])} aria-hidden />}
      <span className="truncate">{children}</span>
    </span>
  );
}

export function statusTone(s: string | null): Tone {
  switch (s) {
    case 'Em execução': return 'info';
    case 'Em encerramento': return 'warning';
    case 'Pagamento pendente': return 'danger';
    case 'Finalizado': return 'success';
    case null: return 'ghost';
    default: return 'neutral';
  }
}
export function decisaoTone(s: string | null): Tone {
  switch (s) {
    case 'Manter equipe': return 'success';
    case 'Reduzir equipe': return 'warning';
    case 'Desmobilizar': return 'danger';
    case 'Em análise': return 'neutral';
    default: return 'ghost';
  }
}
export function perspectivaTone(s: string | null): Tone {
  switch (s) {
    case 'Alta': case 'Renovado': return 'success';
    case 'Média': case 'Em negociação': case 'Aditivo': return 'info';
    case 'Baixa': return 'warning';
    case 'Sem perspectiva': return 'danger';
    default: return 'ghost';
  }
}

/** Marca discreta para valores ainda não salvos. */
const TEMP_CLASSE: Record<string, string> = {
  '15 a 30 dias': 'bg-[hsl(var(--temp-15-bg))] text-[hsl(var(--temp-15-ink))]',
  '30 a 45 dias': 'bg-[hsl(var(--temp-30-bg))] text-[hsl(var(--temp-30-ink))]',
  '45 a 60 dias': 'bg-[hsl(var(--temp-45-bg))] text-[hsl(var(--temp-45-ink))]',
  'Mais de 60 dias': 'bg-[hsl(var(--temp-60-bg))] text-[hsl(var(--temp-60-ink))]',
};
/** Selo da Temperatura da perspectiva, colorido por faixa (Sem informação = cinza neutro). */
export function TemperaturaBadge({ valor, className }: { valor: string; className?: string }) {
  return (
    <span className={cn('inline-flex h-[22px] max-w-full items-center whitespace-nowrap rounded-full px-2.5 text-xs font-medium', TEMP_CLASSE[valor] ?? 'bg-[hsl(var(--neutral-soft))] text-[hsl(var(--neutral-ink))]', className)}>
      {valor}
    </span>
  );
}

export function RascunhoTag({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex h-[18px] items-center rounded-full bg-[hsl(var(--warning-soft))] px-1.5 text-[10px] font-medium uppercase tracking-wide text-[hsl(var(--warning-ink))]', className)}>
      rascunho
    </span>
  );
}
export function prazoChipTone(t: PrazoTom): Tone {
  return t === 'vencido' ? 'danger' : t === 'proximo' ? 'warning' : t === 'ok' ? 'neutral' : 'ghost';
}
export function prazoLabel(t: PrazoTom, dias: number | null): string {
  if (t === 'sem' || dias === null) return 'Sem data';
  if (t === 'vencido') return `Vencido há ${Math.abs(dias)}d`;
  if (dias === 0) return 'Hoje';
  return `${dias}d`;
}
