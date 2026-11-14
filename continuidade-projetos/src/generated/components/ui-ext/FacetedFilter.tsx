import { Check, PlusCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@components/ui/popover';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from '@components/ui/command';
import { cn } from '@lib/utils';

export type FacetOption = { value: string; label: string; count?: number };

export function FacetedFilter({ title, options, selected, onChange }: {
  title: string; options: FacetOption[]; selected: string[]; onChange: (v: string[]) => void;
}) {
  const sel = new Set(selected);
  const toggle = (v: string) => {
    const n = new Set(sel);
    if (n.has(v)) n.delete(v); else n.add(v);
    onChange([...n]);
  };
  const chosen = options.filter((o) => sel.has(o.value));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-9 max-w-full items-center gap-1.5 rounded-md border border-dashed border-input bg-card px-3 text-sm text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            sel.size > 0 && 'border-solid border-primary/60',
          )}
        >
          <PlusCircle className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="shrink-0">{title}</span>
          {sel.size > 0 && (
            <>
              <span className="mx-1 h-4 w-px shrink-0 bg-border" aria-hidden />
              {sel.size <= 2 ? (
                chosen.map((o) => (
                  <span key={o.value} className="max-w-[120px] truncate rounded-sm bg-[hsl(var(--info-soft))] px-1.5 text-xs leading-5 text-[hsl(var(--info-ink))]">
                    {o.label}
                  </span>
                ))
              ) : (
                <span className="rounded-sm bg-[hsl(var(--info-soft))] px-1.5 text-xs leading-5 text-[hsl(var(--info-ink))]">
                  {sel.size} selecionados
                </span>
              )}
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder={`Buscar ${title.toLowerCase()}`} />
          <CommandList className="max-h-72">
            <CommandEmpty>Nada encontrado.</CommandEmpty>
            <CommandGroup>
              {options.map((o) => {
                const on = sel.has(o.value);
                return (
                  <CommandItem key={o.value} value={`${o.label} ${o.value}`} onSelect={() => toggle(o.value)}>
                    <span
                      className={cn(
                        'mr-2 flex size-4 shrink-0 items-center justify-center rounded-sm border border-primary',
                        on ? 'bg-primary text-primary-foreground' : 'opacity-50',
                      )}
                      aria-hidden
                    >
                      {on && <Check className="size-3" />}
                    </span>
                    <span className="flex-1 truncate">{o.label}</span>
                    {o.count !== undefined && <span className="tnum ml-2 text-xs text-muted-foreground">{o.count}</span>}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem value="__selecionar_todos" onSelect={() => onChange(options.map((o) => o.value))} className="justify-center">
                Selecionar todos
              </CommandItem>
              {sel.size > 0 && (
                <CommandItem value="__limpar" onSelect={() => onChange([])} className="justify-center">
                  Limpar
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
