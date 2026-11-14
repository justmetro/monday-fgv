import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchOrphans, deleteBatch, existingIds } from '@generated/lib/orphans';
import { errorMessage } from '@generated/lib/monday';


const IDLE_DEL = { running: false, total: 0, done: 0, deleted: 0, skipped: 0, failures: [], finished: false };

/** Lista os órfãos do 09.4 e apaga um a um, reconfirmando cada item antes da exclusão. */
export function useOrphans() {
  const [list, setList] = useState({ items: [], loading: true, refetching: false, error: null });
  const [del, setDel] = useState(IDLE_DEL);
  const busy = useRef(false);

  const load = useCallback(async () => {
    setList((s) => ({ ...s, loading: s.items.length === 0, refetching: s.items.length > 0, error: null }));
    try {
      const items = await fetchOrphans();
      setList({ items, loading: false, refetching: false, error: null });
    } catch (err) {
      console.error('Erro ao listar órfãos:', err);
      setList((s) => ({ ...s, loading: false, refetching: false, error: `Não foi possível ler o 09.4: ${errorMessage(err)}` }));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!del.running) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [del.running]);

  const deleteAll = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    const shownIds = new Set(list.items.map((x) => x.id));
    setDel({ ...IDLE_DEL, running: true });
    try {
      // (1) Reconsulta única logo após a confirmação
      const fresh = await fetchOrphans();
      const skipped = [...shownIds].filter((id) => !fresh.some((f) => f.id === id)).length;
      setList((s) => ({ ...s, items: fresh }));
      setDel((d) => ({ ...d, total: fresh.length, skipped }));

      const markDone = (ok, failed, msg) => {
        const okIds = new Set(ok.map((x) => x.id));
        setList((s) => ({ ...s, items: s.items.filter((x) => !okIds.has(x.id)) }));
        setDel((d) => ({
          ...d,
          done: d.done + ok.length + failed.length,
          deleted: d.deleted + ok.length,
          failures: [...d.failures, ...failed.map((x) => ({ ...x, msg }))],
        }));
      };

      // Tenta tudo numa única requisição; se for rejeitada, divide em metades (invisível ao usuário)
      const deleteRec = async (group) => {
        if (!group.length) return;
        const ids = group.map((x) => x.id);
        try {
          await deleteBatch(ids, group.length > 1 ? 1 : 5);
          markDone(group, [], null);
          return;
        } catch (err) {
          if (group.length > 1) {
            const mid = Math.ceil(group.length / 2);
            await deleteRec(group.slice(0, mid));
            await deleteRec(group.slice(mid));
            return;
          }
          console.error(`Falha ao apagar ${ids[0]}:`, err);
          // O item pode ter sido apagado numa tentativa anterior: só é falha se ainda existir
          let still = new Set(ids);
          try { still = await existingIds(ids); } catch { /* mantém como falha */ }
          if (still.has(ids[0])) markDone([], group, errorMessage(err));
          else markDone(group, [], null);
        }
      };
      await deleteRec(fresh);
    } catch (err) {
      console.error('Falha ao reconsultar órfãos:', err);
      setList((s) => ({ ...s, error: `Não foi possível reconsultar os órfãos: ${errorMessage(err)}` }));
    } finally {
      setDel((d) => ({ ...d, running: false, finished: true }));
      busy.current = false;
    }
  }, [list.items]);

  const clearResult = useCallback(() => { if (!busy.current) setDel(IDLE_DEL); }, []);

  return { list, del, load, deleteAll, clearResult };
}
