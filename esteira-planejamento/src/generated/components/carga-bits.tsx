import { cn } from '@lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@components/ui/tooltip';
import { fmtDate } from '@generated/lib/format';
import { etapasDe, type Farol } from '@generated/lib/farol';
import type { Projeto } from '@generated/lib/format';
import { FarolChip } from '@generated/components/ui-bits';

/** End-of-assignment chip: red ≤ 30 d (or ended), yellow ≤ 60 d, gray without date. */
export function FimChip({ fim, dias }: { fim: string | null; dias: number | null }) {
  if (dias === null) return <FarolChip farol="semData" text="Sem data" />;
  const quando = dias < 0 ? `encerrou há ${Math.abs(dias)} d` : dias === 0 ? 'termina hoje' : `em ${dias} d`;
  if (dias <= 30) return <FarolChip farol="atrasado" text={`${fmtDate(fim)} · ${quando}`} />;
  if (dias <= 60) return <FarolChip farol="vence" text={`${fmtDate(fim)} · ${quando}`} />;
  return (
    <span className="tnum whitespace-nowrap text-xs text-muted-foreground">
      {fmtDate(fim)} <span className="text-[hsl(var(--fg-subtle))]">· {quando}</span>
    </span>
  );
}

/** Saturated dot color + short meaning per farol state (same rules as etapasDe). */
const DOT: Record<Farol, { cls: string; nome: string }> = {
  atrasado: { cls: 'bg-[hsl(var(--farol-red))]', nome: 'Atrasado' },
  vence: { cls: 'bg-[hsl(var(--farol-yellow))]', nome: 'Vence em até 7 dias' },
  noPrazo: { cls: 'bg-[hsl(var(--farol-green))]', nome: 'Concluído no prazo' },
  aberto: { cls: 'bg-[hsl(var(--farol-blue))]', nome: 'Em aberto' },
  inativo: { cls: 'bg-[hsl(var(--farol-gray))]', nome: 'Não se aplica' },
  semData: { cls: 'bg-[hsl(var(--farol-gray))]', nome: 'Sem data de prazo' },
};

const SIGLA: Record<'plan' | 'sgi' | 'dim', string> = { plan: 'P', sgi: 'SGI', dim: 'D' };

const dotBase = 'size-3 shrink-0 rounded-full ring-2 ring-[hsl(var(--background)/0.6)]';

/** Three farol dots (Planejamento · Registro SGI · Dimensionamento), each with a label and tooltip. */
export function MiniFarois({ p, className }: { p: Projeto; className?: string }) {
  const etapas = etapasDe(p);
  const resumo = etapas.map((e) => `${e.label}: ${DOT[e.farol].nome} (${e.detalhe})`).join('; ');
  return (
    <span className={cn('inline-flex shrink-0 items-start gap-2', className)}>
      {etapas.map((e) => (
        <Tooltip key={e.key}>
          <TooltipTrigger asChild>
            <span className="flex flex-col items-center gap-0.5" aria-hidden>
              <span className={cn(dotBase, DOT[e.farol].cls)} />
              <span className="text-[9px] font-medium leading-none text-muted-foreground">{SIGLA[e.key]}</span>
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            <span className="font-medium">{e.label}:</span> {DOT[e.farol].nome} · {e.detalhe}
          </TooltipContent>
        </Tooltip>
      ))}
      <span className="sr-only">{resumo}</span>
    </span>
  );
}

/** Horizontal load bar without inline styles (native progress element, token colors). */
export function CargaBar({ value, max, label }: { value: number; max: number; label: string }) {
  return (
    <progress
      value={value}
      max={Math.max(max, 1)}
      aria-label={label}
      className={cn(
        'h-1.5 w-full min-w-16 appearance-none overflow-hidden rounded-full bg-[hsl(var(--surface-3))]',
        '[&::-webkit-progress-bar]:bg-[hsl(var(--surface-3))] [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-[linear-gradient(90deg,hsl(212_74%_58%),hsl(199_55%_52%))]',
        '[&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-[linear-gradient(90deg,hsl(212_74%_58%),hsl(199_55%_52%))]',
      )}
    />
  );
}
