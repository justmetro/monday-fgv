import { AlertTriangle } from 'lucide-react';
import { AVISOS_APLICAVEIS } from '@generated/lib/config';
import { Eyebrow } from '@generated/components/kit';
import { cn } from '@lib/utils';

function level(n: number): 'ok' | 'atencao' | 'alerta' {
  if (n >= AVISOS_APLICAVEIS.alerta) return 'alerta';
  if (n >= AVISOS_APLICAVEIS.atencao) return 'atencao';
  return 'ok';
}

const msg = {
  ok: `Abaixo de ${AVISOS_APLICAVEIS.atencao} aplicáveis`,
  atencao: `Atenção: ${AVISOS_APLICAVEIS.atencao} ou mais aplicáveis`,
  alerta: `Alerta: ${AVISOS_APLICAVEIS.alerta} ou mais aplicáveis`,
};

export function ApplicableCounter({ value, variant = 'full' }: { value: number; variant?: 'full' | 'compact' }) {
  const lv = level(value);
  const color =
    lv === 'alerta' ? 'text-[hsl(var(--destructive))]' : lv === 'atencao' ? 'text-[hsl(var(--warning))]' : 'text-[hsl(var(--sky))]';

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-2" title={`${msg[lv]} · limites em definição, sem bloqueio`}>
        {lv !== 'ok' && <AlertTriangle className={cn('size-4', color)} aria-hidden />}
        <span className="mono-label text-[hsl(var(--text-dim))]">Aplicáveis</span>
        <span className={cn('mono text-lg tabular-nums', color)}>{value}</span>
      </div>
    );
  }

  const max = Math.max(AVISOS_APLICAVEIS.alerta * 1.3, value * 1.05, 1);
  const pct = (n: number) => `${Math.min(100, (n / max) * 100)}%`;
  return (
    <div className="min-w-0">
      <Eyebrow>Contador de aplicáveis</Eyebrow>
      <div className="mt-2 flex items-end gap-3">
        <span className={cn('mono text-6xl font-medium leading-none tabular-nums tracking-[-0.03em]', color)}>{value}</span>
        <span className={cn('mono-label pb-1.5', color)}>{msg[lv]}</span>
      </div>
      <div className="relative mt-5 h-2 rounded-full bg-[hsl(var(--border))]" role="img" aria-label={`${value} riscos aplicáveis; avisos em ${AVISOS_APLICAVEIS.atencao} e ${AVISOS_APLICAVEIS.alerta}`}>
        <div
          className={cn(
            'absolute inset-y-0 left-0 rounded-full transition-[width] duration-300',
            lv === 'alerta' ? 'bg-[hsl(var(--destructive))]' : lv === 'atencao' ? 'bg-[hsl(var(--warning))]' : 'bg-[hsl(var(--cobalt))]',
          )}
          style={{ width: pct(value) }}
        />
        {[AVISOS_APLICAVEIS.atencao, AVISOS_APLICAVEIS.alerta].map((t) => (
          <div key={t} className="absolute -top-1.5 h-5 w-px bg-foreground/60" style={{ left: pct(t) }}>
            <span className="mono absolute left-1/2 top-6 -translate-x-1/2 text-[10px] text-muted-foreground">{t}</span>
          </div>
        ))}
      </div>
      <p className="mt-8 text-xs text-muted-foreground">Limites em definição pela equipe. Os avisos são apenas visuais e não bloqueiam a revisão.</p>
    </div>
  );
}
