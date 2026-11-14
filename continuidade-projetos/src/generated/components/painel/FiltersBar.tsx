import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@components/ui/input';
import { FacetedFilter } from '@generated/components/ui-ext/FacetedFilter';
import { FILTROS_INICIAIS, filtrosAtivos, type Filtros, type Opcoes } from '@generated/lib/filtros';

/** Filtros do cabeçalho: Buscar, Status e Último produto previsto (inclui "Vencidos"). */
export function FiltersBar({ filtros, setFiltros, opts }: { filtros: Filtros; setFiltros: (f: Filtros) => void; opts: Opcoes }) {
  const [q, setQ] = useState(filtros.q);
  useEffect(() => {
    const t = setTimeout(() => { if (q !== filtros.q) setFiltros({ ...filtros, q }); }, 250);
    return () => clearTimeout(t);
  }, [q, filtros, setFiltros]);
  useEffect(() => { setQ(filtros.q); }, [filtros.q]);

  const set = <K extends keyof Filtros>(k: K, v: Filtros[K]) => setFiltros({ ...filtros, [k]: v });

  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-start">
      <div className="relative min-w-0 lg:w-72 lg:shrink-0">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome, sigla ou código"
          aria-label="Buscar projeto"
          className="h-9 bg-card pl-9 text-base sm:text-sm"
        />
      </div>
      <div className="flex min-w-0 flex-wrap gap-2">
        <FacetedFilter title="Status" options={opts.status} selected={filtros.status} onChange={(v) => set('status', v)} />
        <FacetedFilter title="Último produto previsto" options={opts.meses} selected={filtros.termino} onChange={(v) => set('termino', v)} />
        {filtrosAtivos(filtros) && (
          <button
            type="button"
            onClick={() => { setQ(''); setFiltros(FILTROS_INICIAIS); }}
            className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-sm text-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-3.5" aria-hidden /> Limpar filtros
          </button>
        )}
      </div>
    </div>
  );
}
