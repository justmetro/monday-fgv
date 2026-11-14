import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { getState, subscribe, loadProjects, patchItems } from '@generated/lib/projectsStore';

const PAGE = 100;
const BIG = 200;

function useDebounced(value, ms) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export const normalizeText = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/** Estado compartilhado da base de projetos (carregada uma vez). */
export function useProjectsStore() {
  const s = useSyncExternalStore(subscribe, getState);
  useEffect(() => {
    if (s.status === 'idle') loadProjects().catch(() => {});
  }, [s.status]);
  return s;
}

/**
 * Lista de projetos filtrada na tela: busca por nome (sem acento, debounce 150 ms) e chip de status.
 * Contagens dos chips vêm da base inteira em memória. Sem requisições ao filtrar.
 */
export function useProjects({ statusColumn = 'calculadora' } = {}) {
  const store = useProjectsStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(null);
  const [limit, setLimit] = useState(PAGE);
  const term = normalizeText(useDebounced(search, 150));

  const indexed = useMemo(() => store.items.map((it) => ({ it, key: normalizeText(it.name) })), [store.items]);

  const counts = useMemo(() => {
    const by = new Map();
    store.items.forEach((it) => {
      const v = it[statusColumn] || null;
      by.set(v, (by.get(v) || 0) + 1);
    });
    const rows = [...by.entries()]
      .map(([value, count]) => ({ label: value || 'Sem status', value, count }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
    return { rows, total: store.items.length, loading: store.status === 'loading' };
  }, [store.items, store.status, statusColumn]);

  const filtered = useMemo(() => indexed
    .filter(({ it, key }) => (!term || key.includes(term)) && (!statusFilter || it[statusColumn] === statusFilter))
    .map(({ it }) => it), [indexed, term, statusFilter, statusColumn]);

  useEffect(() => { setLimit(PAGE); }, [term, statusFilter]);

  const chunked = filtered.length > BIG;
  const items = chunked ? filtered.slice(0, limit) : filtered;
  const showMore = useCallback(() => setLimit((l) => l + PAGE), []);

  return {
    items,
    filteredCount: filtered.length,
    allItems: store.items,
    hasMore: chunked && limit < filtered.length,
    showMore,
    loading: store.status === 'loading' && store.items.length === 0,
    refetching: false,
    error: store.error,
    search, setSearch, statusFilter, setStatusFilter, counts,
    patchRows: patchItems,
  };
}

/** Ids com determinado status, a partir da base recarregada na hora (garante status atual). */
export async function idsWithStatus(column, value) {
  const items = await loadProjects({ force: true });
  return items.filter((it) => it[column] === value).map((it) => it.id);
}
