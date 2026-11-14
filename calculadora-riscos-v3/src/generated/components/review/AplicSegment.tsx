import { APLICABILIDADE_OPCOES, type Aplicabilidade } from '@generated/lib/config';
import { cn } from '@lib/utils';

const short: Record<Aplicabilidade, string> = {
  'Em avaliação': 'Em avaliação',
  Aplicável: 'Aplicável',
  'Não aplicável': 'Não aplicável',
};

const activeCls: Record<Aplicabilidade, string> = {
  'Em avaliação': 'border-[hsl(var(--warning)/0.6)] bg-[hsl(var(--warning)/0.12)] text-[hsl(var(--warning))]',
  Aplicável: 'border-[hsl(var(--cobalt))] bg-[hsl(var(--surface-deep))] text-[hsl(var(--sky))] shadow-[var(--shadow-active-glow)]',
  'Não aplicável': 'border-[hsl(var(--input))] bg-[hsl(var(--muted))] text-foreground',
};

/** Marcação rápida de aplicabilidade: um clique grava no item do 09.4. */
export function AplicSegment({
  value,
  disabled,
  onChange,
  label,
}: {
  value: string | null;
  disabled: boolean;
  onChange: (v: Aplicabilidade) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={`Aplicabilidade de ${label}`} className="grid grid-cols-3 gap-1 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--surface-deep)/0.7)] p-1">
      {APLICABILIDADE_OPCOES.map((opt) => {
        const on = value === opt;
        return (
          <button
            key={opt}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              if (!on) onChange(opt);
            }}
            className={cn(
              'mono-label min-h-9 whitespace-nowrap rounded-full border px-2.5 text-[10px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-8',
              on ? activeCls[opt] : 'border-transparent text-muted-foreground hover:bg-[hsl(var(--accent)/0.6)] hover:text-foreground',
            )}
          >
            {short[opt]}
          </button>
        );
      })}
    </div>
  );
}
