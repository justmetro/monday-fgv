import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@components/ui/popover';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@components/ui/command';
import { cn } from '@lib/utils';

export type SearchOption = { value: string; label: string; hint?: string };

/** Lista suspensa com pesquisa por texto (ignora acentos e maiúsculas). */
export function SearchSelect({ value, options, onChange, placeholder = 'Selecione…', emptyLabel, disabled, ariaLabel, className }: {
  value: string; options: SearchOption[]; onChange: (v: string) => void; placeholder?: string;
  /** Quando informado, adiciona a opção vazia (ex.: "— Não mapear —"). */
  emptyLabel?: string; disabled?: boolean; ariaLabel?: string; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const cur = options.find((o) => o.value === value);
  const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const pick = (v: string) => { onChange(v); setOpen(false); };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" disabled={disabled} aria-label={ariaLabel}
          className={cn('flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-card px-2 text-left text-sm disabled:opacity-50', !cur && 'text-muted-foreground', className)}>
          <span className="truncate">{cur ? cur.label : value === '' && emptyLabel ? emptyLabel : placeholder}</span>
          <ChevronDown className="size-4 shrink-0 opacity-60" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(28rem,calc(100vw-2rem))] p-0">
        <Command filter={(v, search) => (norm(v).includes(norm(search)) ? 1 : 0)}>
          <CommandInput placeholder="Pesquisar…" />
          <CommandList className="max-h-72">
            <CommandEmpty>Nenhum resultado.</CommandEmpty>
            {emptyLabel && (
              <CommandItem value={emptyLabel} onSelect={() => pick('')}>
                <Check className={cn('size-4', value === '' ? 'opacity-100' : 'opacity-0')} aria-hidden />
                <span className="italic text-muted-foreground">{emptyLabel}</span>
              </CommandItem>
            )}
            {options.map((o) => (
              <CommandItem key={o.value} value={`${o.label} ${o.hint ?? ''} ${o.value}`} onSelect={() => pick(o.value)}>
                <Check className={cn('size-4 shrink-0', value === o.value ? 'opacity-100' : 'opacity-0')} aria-hidden />
                <span className="min-w-0 flex-1 break-words">{o.label}</span>
                {o.hint && <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{o.hint}</span>}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
