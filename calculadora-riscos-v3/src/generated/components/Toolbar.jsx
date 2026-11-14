import { Search, Play, PlayCircle, Loader2, X } from 'lucide-react';
import { cn } from '@lib/utils';

const pill = 'inline-flex min-h-9 items-center justify-center gap-2 rounded-[5px] px-3.5 text-[13px] font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-45';

/** Barra de ações (executar) e busca/filtros da lista de projetos. */
export function Toolbar({
  search, onSearch, counts, statusFilter, onStatusFilter,
  selectedCount, executarCount, running, loadingExecutar, onRunSelected, onRunExecutar, onClearSelection,
  primaryLabel = 'Rodar para os selecionados', secondaryLabel = 'Rodar todos em “Executar”',
  filterLabel = 'Filtrar por status da calculadora',
}) {
  return (
    <div className="space-y-3 rounded-[6px] border border-border bg-[hsl(var(--canvas-chrome))] p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <label className="relative block min-w-0 lg:w-80">
          <span className="sr-only">Buscar projeto pelo nome</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Buscar projeto pelo nome"
            className="h-9 w-full rounded-[5px] border border-border bg-background pl-9 pr-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none md:text-[13.5px]"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {selectedCount > 0 && !running && (
            <button type="button" onClick={onClearSelection}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-[5px] px-2.5 text-[13px] text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
              <X className="size-3.5" aria-hidden /> Limpar seleção
            </button>
          )}
          <button type="button" className={cn(pill, 'border border-border text-foreground hover:bg-[hsl(var(--ink-soft))]')}
            disabled={running || loadingExecutar || executarCount === 0} onClick={onRunExecutar}>
            {loadingExecutar ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <PlayCircle className="size-4" aria-hidden />}
            {secondaryLabel}
            <span className="tabular-nums text-muted-foreground">{executarCount}</span>
          </button>
          <button type="button" className={cn(pill, 'bg-primary text-primary-foreground hover:bg-primary/90')}
            disabled={running || selectedCount === 0} onClick={onRunSelected}>
            {running ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Play className="size-4" aria-hidden />}
            {primaryLabel}
            <span className="tabular-nums opacity-70">{selectedCount}</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
        <div className="flex min-w-0 flex-wrap gap-1.5" role="group" aria-label={filterLabel}>
          <Chip active={!statusFilter} onClick={() => onStatusFilter(null)} label="Todos" count={counts.total} />
          {counts.rows.filter((r) => r.value).map((r) => (
            <Chip key={r.value} active={statusFilter === r.value} onClick={() => onStatusFilter(r.value)} label={r.label} count={r.count} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Chip({ active, onClick, label, count }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-[5px] border px-2.5 text-[13px] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-ring',
        active ? 'border-primary/40 bg-[hsl(var(--primary)/0.15)] text-primary' : 'border-border text-muted-foreground hover:bg-[hsl(var(--ink-soft))] hover:text-foreground'
      )}>
      {label}
      <span className="tabular-nums opacity-70">{count}</span>
    </button>
  );
}
