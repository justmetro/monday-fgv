import { useCallback, useEffect, useMemo, useState } from 'react';
import { getDataset } from '@generated/server/importer';
import { buildModel, type Dataset } from '@generated/lib/metrics';
import { readCache, writeCache } from '@generated/lib/data-cache';
import { dataVersion } from './dataVersion';

const KEY = 'dataset';

/** Indicadores e medições: mostra o cache local na hora e só baixa de novo quando algum projeto foi atualizado. */
export function useDataset() {
  const [data, setData] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force: boolean) => {
    setError(null);
    let hasCache = false;
    try {
      if (!force) {
        const cached = await readCache<Dataset>(KEY);
        if (cached) { hasCache = true; setData(cached.data); setLoading(false); }
        const v = await dataVersion();
        if (cached && v && cached.version === v) return;
        setRefetching(hasCache);
        const res = await getDataset({ data: {} });
        if (res) { setData(res); void writeCache(KEY, v ?? 'sem-versao', res); }
      } else {
        setRefetching(true);
        const [v, res] = await Promise.all([dataVersion(true), getDataset({ data: {} })]);
        if (res) { setData(res); void writeCache(KEY, v ?? 'sem-versao', res); }
      }
    } catch (e) {
      console.error(e);
      setError('Não foi possível carregar os dados salvos. Tente novamente.');
    } finally {
      setLoading(false);
      setRefetching(false);
    }
  }, []);

  useEffect(() => { void load(false); }, [load]);
  const model = useMemo(() => (data ? buildModel(data) : null), [data]);
  return { data, model, loading, refetching, error, reload: () => load(true) };
}
