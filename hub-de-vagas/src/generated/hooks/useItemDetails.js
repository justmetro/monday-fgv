import { useEffect, useState } from 'react';
import { board } from '@generated/lib/data';

export const VAGA_DETAIL_COLS = ['requisitosEliminatrios', 'principaisAtividadesVaga', 'competnciasEssenciais', 'competnciasDesejveis', 'observaesVaga', 'dataDeAberturaDaVaga', 'modalidadeDeAtuaoVaga', 'motivoDaAbertura', 'origemDoPreenchimento', 'cidadeRegional', 'gerenteDeProjetosDestino', 'salrioPrevistoR'];
export const PERFIL_DETAIL_COLS = ['competnciasEHabilidades', 'principaisInteresses', 'pontosFortes', 'pontosDeMelhoria', 'principaisAtividadesEntregas', 'observaesPerfil', 'cidadeDeResidncia', 'ufsDeInteresse', 'currculoLattes', 'tempoDeDgpeMeses'];

// Loads the long-form columns of a single item only when its page is opened.
export function useItemDetails(id, cols) {
  const [state, setState] = useState({ item: null, loading: true, error: null });
  useEffect(() => {
    if (!id) return undefined;
    let alive = true;
    setState({ item: null, loading: true, error: null });
    board.item(id).withColumns(cols).execute()
      .then((item) => { if (alive) setState({ item: item ?? {}, loading: false, error: null }); })
      .catch((e) => {
        console.error('Erro ao carregar detalhes do item', e);
        if (alive) setState({ item: {}, loading: false, error: 'Não foi possível carregar os detalhes.' });
      });
    return () => { alive = false; };
  }, [id, cols]);
  return state;
}
