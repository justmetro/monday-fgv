import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getBase } from '@generated/server/projetos';
import type { Projeto } from '@generated/lib/format';
import { type FiltrosState, indexar, filtrar, opcoesDe, cancelado } from '@generated/lib/filtros';

export { FILTROS_INICIAIS, type FiltrosState, type Opcoes } from '@generated/lib/filtros';

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/**
 * Loads Esteira + Histórico once (server caches 60 s) and filters everything in memory:
 * changing a filter never triggers a request. `atualizar` forces a fresh read from the board.
 */
export function useProjetos(filtros: FiltrosState, meId: string | null) {
  const [base, setBase] = useState<Projeto[]>([]);
  const [atualizadoEm, setAtualizadoEm] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const carregou = useRef(false);
  /** Only the latest request may apply its result (periodic / focus / manual reloads can overlap). */
  const seq = useRef(0);

  const carregar = useCallback(async (force: boolean, silencioso = false) => {
    const minha = ++seq.current;
    if (carregou.current) { if (!silencioso) setRefetching(true); }
    else setLoading(true);
    if (!silencioso) setError(null);
    try {
      const res = await getBase({ data: { force } });
      if (minha !== seq.current) return;
      setBase(res?.items ?? []);
      setAtualizadoEm(res?.atualizadoEm ?? null);
      setError(null);
      carregou.current = true;
    } catch (e) {
      console.error('Erro ao carregar projetos', e);
      // A failed background refresh keeps the data on screen; only visible loads show the error.
      if (minha === seq.current && (!silencioso || !carregou.current)) setError('Não foi possível carregar os projetos do quadro. Tente novamente.');
    } finally {
      if (minha === seq.current) {
        setLoading(false);
        setRefetching(false);
      }
    }
  }, []);

  useEffect(() => {
    void carregar(false);
  }, [carregar]);

  // Automatic refresh: every 60 s while the tab is visible, and when the window/tab regains focus.
  useEffect(() => {
    const visivel = () => document.visibilityState === 'visible';
    const id = window.setInterval(() => { if (visivel()) void carregar(true, true); }, 60_000);
    let ultimo = 0;
    const aoVoltar = () => {
      if (!visivel() || Date.now() - ultimo < 5_000) return;
      ultimo = Date.now();
      void carregar(true, true);
    };
    window.addEventListener('focus', aoVoltar);
    document.addEventListener('visibilitychange', aoVoltar);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', aoVoltar);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, [carregar]);

  const termo = useDebounced(filtros.search, 150);
  // Single source for every tab, selector and export: cancelled projects never leave this hook.
  const validos = useMemo(() => base.filter((p) => !cancelado(p)), [base]);
  const indice = useMemo(() => indexar(validos), [validos]);
  const opcoes = useMemo(() => opcoesDe(validos), [validos]);
  const { items, meusCount } = useMemo(() => filtrar(indice, filtros, termo, meId), [indice, filtros, termo, meId]);
  /** Carga por gerente: same filters (Esteira only) + old projects still in execution (canceladoAloc). */
  const indiceBruto = useMemo(() => indexar(base), [base]);
  const itemsCarga = useMemo(() => filtrar(indiceBruto, filtros, termo, meId, { antigosEmExecucao: true }).items, [indiceBruto, filtros, termo, meId]);
  /** Same filters but always with "Finalizado (Plan + SGI)" — period goals and "Planejados em …". */
  const comFinalizados = useMemo(
    () => (filtros.includeFinalizados ? items : filtrar(indice, { ...filtros, includeFinalizados: true }, termo, meId).items),
    [indice, filtros, termo, meId, items],
  );

  /** Replace one item in the in-memory base — optimistic edits, rollback and post-save re-read. */
  const replaceItem = useCallback(
    (item: Projeto) => setBase((prev) => prev.map((i) => (i.id === item.id ? item : i))),
    [],
  );

  return {
    items, comFinalizados, itemsCarga, base: validos, baseBruta: base, meusCount, opcoes, loading, refetching, error, atualizadoEm, replaceItem,
    atualizar: () => void carregar(true),
    /** Background reload after a change (no spinner, keeps the data on error). */
    atualizarSilencioso: () => void carregar(true, true),
  };
}
