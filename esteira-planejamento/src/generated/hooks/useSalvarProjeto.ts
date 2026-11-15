import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { updateProjeto, relerProjeto, type Changes } from '@generated/server/projetos';
import type { Projeto } from '@generated/lib/format';
import { aplicarLocal, camposAlterados } from '@generated/lib/edicao';

/**
 * Snapshot → optimistic local update → save on the board → replace with the re-read item
 * (fresh formulas) → rollback on error. Toasts report the outcome.
 */
export function useSalvarProjeto(onItem: (item: Projeto) => void) {
  const [salvando, setSalvando] = useState(false);

  const salvar = useCallback(
    async (p: Projeto, changes: Changes): Promise<boolean> => {
      const anterior = p;
      onItem(aplicarLocal(p, changes));
      setSalvando(true);
      try {
        const res = await updateProjeto({ data: { id: p.id, changes } });
        if (res?.item) onItem(res.item);
        if (res?.erroRelacao) {
          const extras = [
            res.ddMantido ? 'O dropdown Gerente também foi mantido, para não ficar diferente da relação.' : '',
            res.outrosGravados ? 'Os demais campos foram salvos.' : '',
          ].filter(Boolean).join(' ');
          toast.error('Gerente (relação) não foi gravado', { description: `${res.erroRelacao} ${extras}`.trim(), duration: 9000 });
          return false;
        }
        const campos = camposAlterados(changes);
        toast.success('Projeto atualizado no quadro', {
          description: campos.length <= 3 ? campos.join(', ') : `${campos.length} campos alterados`,
        });
        return true;
      } catch (e) {
        console.error('Erro ao salvar projeto', e);
        // Part of the change may already be on the board: show the real state, not the old snapshot.
        let real: Projeto | null = null;
        try {
          real = (await relerProjeto({ data: { id: p.id } }))?.item ?? null;
        } catch (e2) {
          console.error('Falha ao reler o projeto após erro', e2);
        }
        onItem(real ?? anterior);
        toast.error('Não foi possível salvar', {
          description: real
            ? 'O painel mostra o estado atual do quadro (parte das alterações pode ter sido gravada). Confira e tente novamente.'
            : 'As alterações foram desfeitas. Verifique sua conexão e permissões no quadro e tente novamente.',
        });
        return false;
      } finally {
        setSalvando(false);
      }
    },
    [onItem],
  );

  return { salvar, salvando };
}
