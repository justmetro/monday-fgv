import { useEffect, useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@components/ui/popover';
import { Spinner } from '@components/ui/spinner';
import { searchUsers } from '@generated/server/projetos';

type Pessoa = { id: string; name: string };

export function PeoplePicker({ id, value, onChange }: { id: string; value: Pessoa[]; onChange: (v: Pessoa[]) => void }) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<Pessoa[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const t = setTimeout(() => {
      setLoading(true);
      setErro(false);
      searchUsers({ data: { term } })
        .then((res) => { if (active) setResults(res?.users ?? []); })
        .catch((e) => { console.error(e); if (active) setErro(true); })
        .finally(() => { if (active) setLoading(false); });
    }, 300);
    return () => { active = false; clearTimeout(t); };
  }, [term, open]);

  const toggle = (p: Pessoa) => {
    onChange(value.some((v) => v.id === p.id) ? value.filter((v) => v.id !== p.id) : [...value, p]);
  };

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      {value.map((p) => (
        <span key={p.id} className="inline-flex h-7 items-center gap-1 rounded-full bg-[hsl(var(--info-soft))] pl-2.5 pr-1 text-xs font-medium text-[hsl(var(--info-ink))]">
          {p.name || `Usuário ${p.id}`}
          <button type="button" onClick={() => toggle(p)} aria-label={`Remover ${p.name}`} className="inline-flex size-5 items-center justify-center rounded-full hover:bg-card/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <X className="size-3" />
          </button>
        </span>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button id={id} type="button" className="inline-flex h-8 items-center gap-1 rounded-full border border-dashed border-input px-3 text-xs text-muted-foreground hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Plus className="size-3.5" aria-hidden /> {value.length ? 'Adicionar' : 'Escolher responsável'}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput value={term} onValueChange={setTerm} placeholder="Buscar pessoa pelo nome" />
            <CommandList>
              {loading && <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground"><Spinner className="size-4" /> Buscando…</div>}
              {!loading && erro && <div className="px-3 py-3 text-sm text-[hsl(var(--danger-ink))]">Não foi possível buscar pessoas.</div>}
              {!loading && !erro && <CommandEmpty>{term.length < 2 ? 'Digite ao menos 2 letras.' : 'Ninguém encontrado.'}</CommandEmpty>}
              {!loading && results.length > 0 && (
                <CommandGroup>
                  {results.map((u) => {
                    const sel = value.some((v) => v.id === u.id);
                    return (
                      <CommandItem key={u.id} value={u.id} onSelect={() => toggle(u)}>
                        <Check className={sel ? 'size-4 text-primary' : 'size-4 opacity-0'} aria-hidden />
                        {u.name}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
