import { useCallback, useEffect, useMemo, useState } from 'react';
import { getOpsDataset, getOpsPart } from '@generated/server/importer';
import { buildOpsModel, type OpsDataset } from '@generated/lib/ops';
import { readCache, writeCache } from '@generated/lib/data-cache';
import { dataVersion } from './dataVersion';

const KEY = 'ops';

/** Até 4 tentativas com espera crescente (falhas momentâneas do servidor/banco). */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; ; i++) {
    try { return await fn(); } catch (e) {
      if (i >= 3) throw e;
      console.warn('[ops] nova tentativa após falha momentânea', e instanceof Error ? e.message.slice(0, 120) : e);
      await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
    }
  }
}

type Part = 'schedule' | 'subitems' | 'products' | 'risks';

/** Lê um grupo página a página (respostas pequenas evitam erro de gateway). */
async function loadPart<T>(part: Part): Promise<T[]> {
  const out: T[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 1000; i++) {
    const c = cursor;
    const r = await withRetry(() => getOpsPart({ data: { part, cursor: c } }));
    out.push(...((r?.rows ?? []) as T[]));
    if (!r?.cursor) break;
    cursor = r.cursor;
  }
  return out;
}

async function loadOps(): Promise<OpsDataset> {
  // Cada grupo em uma requisição própria (respostas pequenas), em paralelo.
  const [base, sch, subitems, prd, rsk] = await Promise.all([
    withRetry(() => getOpsDataset({ data: {} })),
    loadPart<OpsDataset['schedule'][number]>('schedule'),
    loadPart<OpsDataset['subitems'][number]>('subitems'),
    loadPart<OpsDataset['products'][number]>('products'),
    loadPart<OpsDataset['risks'][number]>('risks'),
  ]);
  return {
    projects: base?.projects ?? [],
    schedule: sch,
    subitems,
    products: prd,
    risks: rsk,
    loadedAt: base?.loadedAt ?? new Date().toISOString(),
  };
}

/** Base dos grupos operacionais — carregada só nas telas que a usam. */
export function useOpsDataset(enabled = true) {
  const [data, setData] = useState<OpsDataset | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [refetching, setRefetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (initial: boolean) => {
    setError(null);
    try {
      if (initial) {
        // Cache local na hora; só baixa de novo se algum projeto foi atualizado desde o último download.
        const cached = await readCache<OpsDataset>(KEY);
        if (cached) { setData(cached.data); setLoading(false); }
        else setLoading(true);
        const v = await dataVersion();
        if (cached && v && cached.version === v) return;
        setRefetching(!!cached);
        const fresh = await loadOps();
        setData(fresh); void writeCache(KEY, v ?? 'sem-versao', fresh);
      } else {
        setRefetching(true);
        const [v, fresh] = await Promise.all([dataVersion(true), loadOps()]);
        setData(fresh); void writeCache(KEY, v ?? 'sem-versao', fresh);
      }
    } catch (e) {
      console.error(e);
      setError('Não foi possível carregar os dados de cronograma, produtos e riscos. Tente novamente.');
    } finally {
      setLoading(false);
      setRefetching(false);
    }
  }, []);

  useEffect(() => { if (enabled && !data) void load(true); }, [enabled, data, load]);
  const model = useMemo(() => (data ? buildOpsModel(data) : null), [data]);
  return { model, loading, refetching, error, reload: () => load(false) };
}
