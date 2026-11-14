import { useCallback, useState } from 'react';
import { fetchOrphans } from '@generated/lib/orphans';

/** Após uma rodada, conta os órfãos do 09.4 só para avisar (nunca apaga). */
export function useOrphanCheck() {
  const [orphanCount, setOrphanCount] = useState(null);
  const check = useCallback(async () => {
    try {
      const list = await fetchOrphans();
      setOrphanCount(list.length);
    } catch (err) {
      console.error('Erro ao contar órfãos do 09.4:', err);
      setOrphanCount(null);
    }
  }, []);
  const dismiss = useCallback(() => setOrphanCount(null), []);
  return { orphanCount, check, dismiss };
}
