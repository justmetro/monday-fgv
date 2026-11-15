import { cn } from '@lib/utils';

const ITENS: { cls: string; rotulo: string; texto: string }[] = [
  { cls: 'bg-[hsl(var(--farol-red))]', rotulo: 'Atrasado', texto: 'Prazo vencido sem conclusão, ou concluído fora do prazo' },
  { cls: 'bg-[hsl(var(--farol-yellow))]', rotulo: 'Vence em ≤7 dias', texto: 'Ainda em aberto, prazo nos próximos 7 dias' },
  { cls: 'bg-[hsl(var(--farol-green))]', rotulo: 'Concluído no prazo', texto: 'Etapa concluída dentro do prazo' },
  { cls: 'bg-[hsl(var(--farol-blue))]', rotulo: 'Em aberto (>7 dias)', texto: 'Em aberto, prazo a mais de 7 dias' },
  { cls: 'bg-[hsl(var(--farol-gray))]', rotulo: 'Sem prazo / não se aplica', texto: 'Sem data de prazo, ou projeto finalizado, pausado, despriorizado ou sem apuração' },
];

const item = 'inline-flex items-center gap-1 whitespace-nowrap';

/** Compact one-line legend: wraps between items, never inside them. */
export function FarolLegenda({ className }: { className?: string }) {
  return (
    <p className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] leading-5 text-muted-foreground', className)}>
      <span className="sr-only">Legenda das bolinhas:</span>
      <span className={item}><b className="font-semibold text-foreground">P</b> Planejamento</span>
      <span className={item}><b className="font-semibold text-foreground">SGI</b> Registro SGI</span>
      <span className={item}><b className="font-semibold text-foreground">D</b> Dimensionamento</span>
      <span className="text-[hsl(var(--fg-subtle))]" aria-hidden>|</span>
      {ITENS.map((l) => (
        <span key={l.rotulo} className={item} title={l.texto}>
          <span className={cn('size-2 shrink-0 rounded-full', l.cls)} aria-hidden />
          {l.rotulo}
        </span>
      ))}
    </p>
  );
}
