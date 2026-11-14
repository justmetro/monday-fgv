import { ArrowDownWideNarrow, ArrowUpNarrowWide, Loader2, Search, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { ESCALA } from '@generated/lib/config';

export const ALL = '__all';

export type ReviewFilterState = {
  search: string;
  categoria: string;
  grupo: string;
  nivel: string;
  aplicabilidade: string;
  sort: 'desc' | 'asc';
};

export const emptyFilters: ReviewFilterState = { search: '', categoria: ALL, grupo: ALL, nivel: ALL, aplicabilidade: ALL, sort: 'desc' };

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="min-w-0">
      <span className="mono-label mb-1 block text-[hsl(var(--text-dim))]">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label} className="h-10 w-full min-w-0 rounded-md border-[hsl(var(--input))] bg-[hsl(var(--surface-deep))] text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos</SelectItem>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function ReviewFilters({
  value,
  onChange,
  categorias,
  grupos,
  aplicabilidades,
  refetching,
}: {
  value: ReviewFilterState;
  onChange: (v: ReviewFilterState) => void;
  categorias: string[];
  grupos: string[];
  aplicabilidades: string[];
  refetching: boolean;
}) {
  const set = (patch: Partial<ReviewFilterState>) => onChange({ ...value, ...patch });
  const active =
    value.search || value.categoria !== ALL || value.grupo !== ALL || value.nivel !== ALL || value.aplicabilidade !== ALL;

  return (
    <div className="glass p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))_auto] lg:items-end">
        <label className="relative block min-w-0">
          <span className="mono-label mb-1 block text-[hsl(var(--text-dim))]">Buscar</span>
          <Search className="pointer-events-none absolute bottom-3 left-3 size-4 text-muted-foreground" aria-hidden />
          <input
            value={value.search}
            onChange={(e) => set({ search: e.target.value })}
            placeholder="ID ou texto do risco"
            className="h-10 w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--surface-deep))] pl-9 pr-8 text-base placeholder:text-[hsl(var(--text-dim))] focus-visible:border-[hsl(var(--cobalt))] focus-visible:outline-none md:text-sm"
          />
          {refetching && <Loader2 className="absolute bottom-3 right-3 size-4 animate-spin text-[hsl(var(--sky))]" aria-label="Atualizando" />}
        </label>
        <FilterSelect label="Categoria" value={value.categoria} options={categorias} onChange={(v) => set({ categoria: v })} />
        <FilterSelect label="Grupo de origem" value={value.grupo} options={grupos} onChange={(v) => set({ grupo: v })} />
        <FilterSelect label="Nível" value={value.nivel} options={[...ESCALA]} onChange={(v) => set({ nivel: v })} />
        <FilterSelect label="Aplicabilidade" value={value.aplicabilidade} options={aplicabilidades} onChange={(v) => set({ aplicabilidade: v })} />
        <div className="flex gap-2">
          <button
            type="button"
            className="ghost-pill h-10 flex-1 lg:flex-none"
            onClick={() => set({ sort: value.sort === 'desc' ? 'asc' : 'desc' })}
            aria-label={value.sort === 'desc' ? 'Ordenado por grau, do maior para o menor' : 'Ordenado por grau, do menor para o maior'}
          >
            {value.sort === 'desc' ? <ArrowDownWideNarrow className="size-4" aria-hidden /> : <ArrowUpNarrowWide className="size-4" aria-hidden />}
            Grau
          </button>
          {active && (
            <button type="button" className="ghost-pill h-10" onClick={() => onChange({ ...emptyFilters, sort: value.sort })} aria-label="Limpar filtros">
              <X className="size-4" aria-hidden />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
