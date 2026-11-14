import { useEffect } from 'react';
import { ensureMeta } from '@generated/lib/projectsStore';
import { useProjectsStore } from '@generated/hooks/useProjects';

import { linkBoardId } from '@generated/lib/projectsStore';

export { linkBoardId };

/** Link do quadro de destino (sempre o quadro, nunca a aba que veio no link informado). */
export function boardHref(link) {
  const bid = linkBoardId(link);
  if (!bid) return null;
  try {
    const u = new URL(link?.url);
    if (u.host.endsWith('monday.com')) return `${u.protocol}//${u.host}/boards/${bid}`;
  } catch { /* sem URL válida */ }
  return `https://monday.com/boards/${bid}`;
}

/**
 * Nome do quadro de destino e riscos no 09.4 de TODOS os projetos, carregados uma vez e guardados
 * na base compartilhada (voltar para a aba não refaz a busca).
 */
export function useSendMeta() {
  const store = useProjectsStore();
  useEffect(() => { if (store.status === 'ready') ensureMeta(); }, [store.status]);
  const pending = store.metaLoaded ? store.metaPending : new Set(store.items.map((it) => it.id));
  return { meta: store.meta, pending };
}
