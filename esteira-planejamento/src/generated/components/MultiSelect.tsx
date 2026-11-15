import { Check, ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@components/ui/command';
import { cn } from '@lib/utils';
import { normNome } from '@generated/lib/nomes';

interface Props {
  label: string;
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  loading?: boolean;
  /** Display text for an option value (e.g. person name for an id). Defaults to the value. */
  getLabel?: (v: string) => string;
  /** Smaller trigger (filter bar). */
  compacto?: boolean;
}

export function MultiSelect({ label, options, value, onChange, loading, getLabel, compacto }: Props) {
  const lbl = (v: string) => (getLabel ? getLabel(v) : v);
  const active = value.length > 0;
  const toggle = (opt: string) =>
    onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-11 min-w-0 items-center gap-1.5 rounded-[var(--radius-md)] border transition-colors duration-150',
            compacto ? 'px-2 text-xs md:h-7' : 'px-2.5 text-[13px] md:h-8',
            'hover:bg-[hsl(var(--surface-3))] focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20',
            active
              ? 'border-[hsl(var(--primary)/0.55)] bg-[hsl(var(--accent-soft))] text-foreground'
              : 'border-input bg-[hsl(var(--surface-2))] text-muted-foreground',
          )}
        >
          <span className="truncate">{label}</span>
          {active && (
            <span className="tnum rounded-[var(--radius-sm)] bg-primary px-1 text-[11px] font-semibold text-primary-foreground">
              {value.length}
            </span>
          )}
          <ChevronDown className="size-3.5 shrink-0 opacity-70" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 rounded-[var(--radius-lg)] border-border p-0 shadow-none">
        {/* Substring search, case- and accent-insensitive ("joao" finds "João"). */}
        <Command filter={(v, busca) => (normNome(v).includes(normNome(busca)) ? 1 : 0)}>
          <CommandInput placeholder={`Buscar ${label.toLowerCase()}…`} className="text-[13px]" />
          <CommandList className="max-h-64">
            <CommandEmpty>{loading ? 'Carregando opções…' : 'Nenhuma opção encontrada.'}</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => {
                const on = value.includes(opt);
                return (
                  <CommandItem key={opt} value={getLabel ? `${lbl(opt)} ${opt}` : opt} onSelect={() => toggle(opt)} className="gap-2 text-[13px]">
                    <span
                      className={cn(
                        'flex size-3.5 shrink-0 items-center justify-center rounded-[3px] border',
                        on ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                      )}
                    >
                      {on && <Check className="size-3" />}
                    </span>
                    <span className="truncate">{lbl(opt)}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
          {active && (
            <div className="border-t border-border p-1">
              <button
                type="button"
                onClick={() => onChange([])}
                className="w-full rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                Limpar seleção
              </button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
