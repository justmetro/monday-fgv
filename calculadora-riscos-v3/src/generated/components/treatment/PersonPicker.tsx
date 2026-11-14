import { useEffect, useState } from 'react';
import { useDebounce } from '@uidotdev/usehooks';
import { Check, Loader2, Search, UserPlus, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@components/ui/popover';
import { searchUsers } from '@generated/data/risks';
import { cn } from '@lib/utils';

export type PersonRef = { id: string; name: string };
type User = Awaited<ReturnType<typeof searchUsers>>[number];

export function PersonPicker({ value, onChange, disabled }: { value: PersonRef[]; onChange: (v: PersonRef[]) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const debounced = useDebounce(term, 300);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError(null);
    searchUsers({ data: { term: debounced || undefined } })
      .then((res) => active && setUsers(res ?? []))
      .catch((e: unknown) => {
        console.error('Erro ao buscar pessoas', e);
        if (active) setError('Não foi possível buscar pessoas.');
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [open, debounced]);

  const toggle = (u: PersonRef) => {
    const has = value.some((p) => p.id === u.id);
    onChange(has ? value.filter((p) => p.id !== u.id) : [...value, u]);
  };

  return (
    <div>
      <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--surface-deep))] p-1.5">
        {value.map((p) => (
          <span key={p.id} className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--muted))] py-0.5 pl-2.5 pr-1 text-xs">
            {p.name || `Usuário ${p.id}`}
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(value.filter((x) => x.id !== p.id))}
              aria-label={`Remover ${p.name}`}
              className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              <X className="size-3" aria-hidden />
            </button>
          </span>
        ))}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              className="inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs text-[hsl(var(--sky))] hover:bg-[hsl(var(--accent))] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <UserPlus className="size-3.5" aria-hidden /> {value.length ? 'Adicionar' : 'Definir responsável'}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 rounded-lg border-[hsl(var(--border))] bg-popover p-2">
            <label className="relative block">
              <span className="sr-only">Buscar pessoa</span>
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input
                autoFocus
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Buscar pelo nome"
                className="h-9 w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--surface-deep))] pl-8 pr-2 text-base focus-visible:border-[hsl(var(--cobalt))] focus-visible:outline-none md:text-sm"
              />
            </label>
            <p className="mono-label px-1 pb-1 pt-2 text-[hsl(var(--text-dim))]">{debounced ? 'Resultados' : 'Inscritos no quadro 09.4'}</p>
            <ul className="max-h-60 overflow-y-auto">
              {loading && (
                <li className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" aria-hidden /> Buscando
                </li>
              )}
              {error && <li className="px-2 py-2 text-xs text-[hsl(var(--destructive))]">{error}</li>}
              {!loading && !error && users.length === 0 && <li className="px-2 py-2 text-xs text-muted-foreground">Ninguém encontrado. Digite parte do nome.</li>}
              {!loading &&
                users.map((u) => {
                  const on = value.some((p) => p.id === u.id);
                  return (
                    <li key={u.id}>
                      <button
                        type="button"
                        onClick={() => toggle({ id: u.id, name: u.name })}
                        className={cn('flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-[hsl(var(--accent))]', on && 'text-[hsl(var(--sky))]')}
                      >
                        {u.photo ? (
                          <img src={u.photo} alt="" className="size-6 max-w-full rounded-full object-cover" />
                        ) : (
                          <span className="mono flex size-6 items-center justify-center rounded-full bg-[hsl(var(--muted))] text-[10px]">{u.name.slice(0, 2).toUpperCase()}</span>
                        )}
                        <span className="min-w-0 flex-1 truncate">{u.name}</span>
                        {on && <Check className="size-4" aria-hidden />}
                      </button>
                    </li>
                  );
                })}
            </ul>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
