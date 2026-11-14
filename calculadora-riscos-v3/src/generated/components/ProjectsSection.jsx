/** Contêiner da lista de projetos, com contagem e "Mostrar mais" (só na tela, sem nova requisição). */
export function ProjectsSection({ title, shownCount, totalCount, selectedCount, hasMore, onShowMore, children }) {
  return (
    <section aria-label={title} className="overflow-hidden rounded-[6px] border border-border bg-card">
      <div className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="text-[18px] font-medium text-[hsl(var(--paper))]">{title}</h2>
        <span className="text-xs tabular-nums text-muted-foreground">
          {shownCount < totalCount ? `${shownCount} de ${totalCount}` : totalCount} projetos
          {selectedCount > 0 ? ` · ${selectedCount} selecionados` : ''}
        </span>
      </div>
      {children}
      {hasMore && (
        <div className="flex justify-center border-t border-border p-3">
          <button
            type="button"
            onClick={onShowMore}
            className="inline-flex min-h-9 items-center gap-2 rounded-[5px] border border-border px-4 text-[13.5px] text-[hsl(var(--paper))] transition-colors duration-150 hover:bg-[hsl(var(--ink-soft))] focus-visible:outline-2 focus-visible:outline-[hsl(var(--paper))]"
          >
            Mostrar mais
          </button>
        </div>
      )}
    </section>
  );
}

/** Seleção por conjunto de ids (persistente entre filtros). */
export function toggleIn(set, id) {
  const next = new Set(set);
  if (next.has(id)) next.delete(id); else next.add(id);
  return next;
}

export function toggleMany(set, ids, on) {
  const next = new Set(set);
  ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
  return next;
}
