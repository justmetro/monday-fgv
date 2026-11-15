import { useCallback, useEffect, useRef, useState } from 'react';
import { getOpcoesEdicao } from '@generated/server/opcoes-edicao';
import { getGerentesRelacao } from '@generated/server/mapa';

export type OpcoesEdicaoRes = Awaited<ReturnType<typeof getOpcoesEdicao>>;
export type GerenteOpcao = Awaited<ReturnType<typeof getGerentesRelacao>>['gerentes'][number];

/** Live labels/options for the edit form (server caches ~10 min; `atualizar` bypasses it). */
export function useOpcoesEdicao(enabled: boolean) {
  const [res, setRes] = useState<OpcoesEdicaoRes | null>(null);
  const [loading, setLoading] = useState(false);
  const [gerentes, setGerentes] = useState<GerenteOpcao[] | null>(null);
  const [gerentesLoading, setGerentesLoading] = useState(false);
  const pedido = useRef(false);

  const carregarGerentes = useCallback(async (force: boolean) => {
    setGerentesLoading(true);
    try {
      const r = await getGerentesRelacao({ data: { force } });
      setGerentes(r?.gerentes ?? []);
    } catch (e) {
      console.error('Erro ao carregar gerentes do Mapa', e);
      setGerentes(null);
    } finally {
      setGerentesLoading(false);
    }
  }, []);

  const carregar = useCallback(async (force: boolean) => {
    setLoading(true);
    void carregarGerentes(force);
    try {
      const r = await getOpcoesEdicao({ data: { force } });
      setRes(r ?? null);
    } catch (e) {
      console.error('Erro ao carregar opções de edição', e);
      setRes(null);
    } finally {
      setLoading(false);
    }
  }, [carregarGerentes]);

  useEffect(() => {
    if (!enabled || pedido.current) return;
    pedido.current = true;
    void carregar(false);
  }, [enabled, carregar]);

  return { res, loading, atualizar: () => carregar(true), gerentes, gerentesLoading };
}
