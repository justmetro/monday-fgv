import { useState } from 'react';
import { toast } from 'sonner';
import { reverterLog } from '@generated/server/log';
import { CAMPOS, type LogEntry } from '@generated/lib/logCampos';
import type { Decisao, Produto, Projeto } from '@generated/lib/painel';
import type { PainelData } from '@generated/hooks/usePainelData';
import { reverterEdicaoApp } from '@generated/components/painel/drawer/useEdicaoProduto';

export type ConflitoReversao = { entry: LogEntry; campos: string[] };

/** Reverte um registro do histórico: regrava os valores anteriores no monday e registra a reversão. */
export function useReverter(data: PainelData) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [conflito, setConflito] = useState<ConflitoReversao | null>(null);

  const reverter = async (e: LogEntry, forcar = false) => {
    setBusyId(e.id);
    setConflito(null);
    if (e.origem === 'app') {
      try {
        await reverterEdicaoApp(data, e);
        toast.success('Edição do app revertida (o monday não foi alterado).');
      } catch (err) {
        console.error('reverterEdicaoApp', err);
        toast.error('Não foi possível reverter. Tente novamente.');
      } finally {
        setBusyId(null);
      }
      return;
    }
    try {
      const res = await reverterLog({
        data: { logId: e.id, itemId: e.itemId, projectId: e.projectId, projectName: e.projectName, changes: e.changes, forcar },
      });
      if (res?.status === 'conflito') {
        setConflito({ entry: e, campos: res.campos });
        return;
      }
      // Atualiza o estado local com os valores restaurados.
      const patchA: Record<string, unknown> = {};
      const patchC: Record<string, unknown> = {};
      const patchP = new Map<string, Record<string, unknown>>();
      for (const c of e.changes) {
        const def = CAMPOS[c.campo];
        if (def.board === 'P') {
          if (c.produtoId) patchP.set(c.produtoId, { ...(patchP.get(c.produtoId) ?? {}), [def.local]: c.de });
          continue;
        }
        (def.board === 'A' ? patchA : patchC)[def.local] = c.de;
      }
      if (patchP.size) {
        const lista = data.produtos[e.projectId] ?? [];
        data.patchProdutos(e.projectId, lista.filter((x) => patchP.has(x.id)).map((x) => ({ ...x, ...(patchP.get(x.id) as Partial<Produto>) })));
      }
      if (Object.keys(patchA).length) data.patchProjeto(e.projectId, patchA as Partial<Projeto>);
      const dec = data.getDecisao(e.projectId);
      if (dec && Object.keys(patchC).length) data.upsertDecisao({ ...dec, ...(patchC as Partial<Decisao>), updatedAt: new Date().toISOString() });
      if (res?.log) data.addLog(res.log);
      toast.success('Alteração revertida no monday.');
    } catch (err) {
      console.error('reverterLog', err);
      toast.error('Não foi possível reverter. Tente novamente.');
    } finally {
      setBusyId(null);
    }
  };

  return {
    reverter,
    busyId,
    conflito,
    forcar: () => { if (conflito) void reverter(conflito.entry, true); },
    cancelarConflito: () => setConflito(null),
  };
}
