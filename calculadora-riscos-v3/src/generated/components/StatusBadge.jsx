import { cn } from '@lib/utils';

// Tom por status: ok (verde), aviso (amarelo), erro (vermelho), ação pendente (azul), neutro (cinza)
const TONE = {
  Executada: 'ok',
  Enviado: 'ok',
  'Executada c/ avisos': 'warn',
  'Enviado c/ avisos': 'warn',
  Erro: 'err',
  Executar: 'info',
  Enviar: 'info',
};

const STYLES = {
  ok: { chip: 'bg-[hsl(var(--ok)/0.15)] text-[hsl(var(--ok))]', dot: 'bg-[hsl(var(--ok))]' },
  warn: { chip: 'bg-[hsl(var(--warn)/0.15)] text-[hsl(var(--warn))]', dot: 'bg-[hsl(var(--warn))]' },
  err: { chip: 'bg-[hsl(var(--err)/0.15)] text-[hsl(var(--err))]', dot: 'bg-[hsl(var(--err))]' },
  info: { chip: 'bg-[hsl(var(--primary)/0.15)] text-primary', dot: 'bg-primary' },
  neutral: { chip: 'bg-[hsl(var(--track))] text-muted-foreground', dot: 'bg-muted-foreground' },
};

/** Selo flat: bolinha colorida + texto, raio 3px, fundo com ~15% da cor. */
export function StatusBadge({ status, emptyLabel = 'Não executada', className }) {
  const s = STYLES[TONE[status] ?? 'neutral'];
  return (
    <span className={cn('inline-flex h-5 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[3px] px-1.5 text-xs leading-none', s.chip, className)}>
      <span className={cn('size-1.5 rounded-full', s.dot)} aria-hidden />
      {status || emptyLabel}
    </span>
  );
}
