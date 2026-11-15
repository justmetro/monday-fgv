import { useCallback } from 'react';
import { toast } from 'sonner';
import { useVibeQuery, vibeQueryClient } from '@vibe/db/client';
import { alocRegraCapacidade } from '@generated/models';
import { REGRA_CAPACIDADE_PADRAO, type RegraCapacidade } from '@generated/lib/alocacao';
import { getRegraCapacidade, salvarRegraCapacidade, resetRegraCapacidade } from '@generated/server/alocacao';
import { desfazerAcao } from '@generated/server/acoes';

const Q = ['vibedb', 'regraCapacidade'] as const;

/**
 * Adjustable capacity rule ("Regra de capacidade", Disponibilidade): shared across every manager/project
 * capacity calculation in the app (Alocação, Capacidade por Gerente). Default 30/60/90 days when unset.
 */
export function useRegraCapacidade() {
  const q = useVibeQuery(['regraCapacidade'], () => getRegraCapacidade({ data: {} }), { collections: [alocRegraCapacidade.name] });
  const regra: RegraCapacidade = q.data ?? REGRA_CAPACIDADE_PADRAO;

  const salvar = useCallback(async (nova: RegraCapacidade) => {
    try {
      const r = await salvarRegraCapacidade({ data: nova });
      const acaoId = r?.acao?.id;
      void vibeQueryClient.invalidateQueries({ queryKey: Q });
      toast.success('Regra de capacidade salva', {
        description: 'Todos os gerentes e projetos foram recalculados.',
        action: acaoId ? { label: 'Desfazer', onClick: () => void desfazerAcao({ data: { id: acaoId } }).then(() => vibeQueryClient.invalidateQueries({ queryKey: Q })) } : undefined,
      });
      return true;
    } catch (e) {
      console.error('Falha ao salvar a regra de capacidade', e);
      toast.error('Não foi possível salvar a regra de capacidade', { description: e instanceof Error ? e.message : 'Tente novamente.' });
      return false;
    }
  }, []);

  const restaurarPadrao = useCallback(async () => {
    try {
      await resetRegraCapacidade({ data: {} });
      void vibeQueryClient.invalidateQueries({ queryKey: Q });
      toast.success('Regra de capacidade voltou ao padrão (30 / 60 / 90 dias)');
      return true;
    } catch (e) {
      console.error('Falha ao restaurar a regra de capacidade', e);
      toast.error('Não foi possível restaurar a regra padrão', { description: e instanceof Error ? e.message : 'Tente novamente.' });
      return false;
    }
  }, []);

  return { regra, loading: q.isLoading, salvar, restaurarPadrao };
}
