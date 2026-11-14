import { useState } from 'react';
import { toast } from 'sonner';
import { salvarEdicaoProduto } from '@generated/server/edicoes';
import { salvarAjusteEquipe } from '@generated/server/ajustes';
import { CAMPO_PRODUTO, CAMPOS, valorIgual, type LogEntry, type Mudanca } from '@generated/lib/logCampos';
import type { CampoProduto, EdicaoProduto, Produto, ProdutoOverride, ProdutoView } from '@generated/lib/painel';
import type { PainelData } from '@generated/hooks/usePainelData';

const KS: CampoProduto[] = ['prazo', 'atraso', 'status', 'valor'];
export type ValoresProduto = Pick<Produto, CampoProduto>;

async function gravar(data: PainelData, args: {
  produtoId: string; projectId: string; projectName: string; override: ProdutoOverride;
  changes: Mudanca[]; acao: 'alteracao' | 'reversao'; ref?: string | null;
}) {
  const res = await salvarEdicaoProduto({ data: { ...args, ref: args.ref ?? null } });
  data.setEdicao(args.produtoId, (res?.edicao as EdicaoProduto | null) ?? null);
  if (res?.log) data.addLog(res.log);
}

/** Edições de produto guardadas só no app (nenhum quadro do monday é alterado). */
export function useEdicaoProduto(data: PainelData, projectId: string, projectName: string) {
  const [busyId, setBusyId] = useState<string | null>(null);

  const salvar = async (x: ProdutoView, novo: ValoresProduto): Promise<boolean> => {
    const override: ProdutoOverride = {};
    const changes: Mudanca[] = [];
    for (const k of KS) {
      if (!valorIgual(novo[k], x.orig[k])) Object.assign(override, { [k]: novo[k] });
      if (!valorIgual(novo[k], x[k])) changes.push({ campo: CAMPO_PRODUTO[k], de: x[k], para: novo[k], produtoId: x.id, produtoNome: x.nome });
    }
    if (!changes.length) return true;
    setBusyId(x.id);
    try {
      await gravar(data, { produtoId: x.id, projectId, projectName, override, changes, acao: 'alteracao' });
      toast.success('Edição guardada no app (o monday não foi alterado).');
      return true;
    } catch (e) {
      console.error('salvarEdicaoProduto', e);
      toast.error('Não foi possível guardar a edição. Tente novamente.');
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const desfazer = async (x: ProdutoView) => {
    const changes: Mudanca[] = x.editados.map((k) => ({ campo: CAMPO_PRODUTO[k], de: x[k], para: x.orig[k], produtoId: x.id, produtoNome: x.nome }));
    if (!changes.length) return;
    setBusyId(x.id);
    try {
      await gravar(data, { produtoId: x.id, projectId, projectName, override: {}, changes, acao: 'reversao' });
      toast.success('Edição desfeita. Voltou ao valor do monday.');
    } catch (e) {
      console.error('desfazerEdicao', e);
      toast.error('Não foi possível desfazer. Tente novamente.');
    } finally {
      setBusyId(null);
    }
  };

  return { salvar, desfazer, busyId };
}

/** Reverte um registro de edição do app: restaura os valores anteriores (sem tocar no monday). */
export async function reverterEdicaoApp(data: PainelData, e: LogEntry) {
  const porProduto = new Map<string, Mudanca[]>();
  for (const c of e.changes) {
    if (!c.produtoId) continue;
    porProduto.set(c.produtoId, [...(porProduto.get(c.produtoId) ?? []), c]);
  }
  const ajusteChanges = e.changes.filter((c) => CAMPOS[c.campo].board === 'E');
  if (ajusteChanges.length) {
    const atual = data.ajustes[e.projectId];
    const override: { nClt?: number | null; custoMensal?: number | null } = {};
    if (atual?.campos.includes('nClt')) override.nClt = atual.nClt ?? null;
    if (atual?.campos.includes('custoMensal')) override.custoMensal = atual.custoMensal ?? null;
    for (const c of ajusteChanges) {
      const k = CAMPOS[c.campo].local as 'nClt' | 'custoMensal';
      if (c.de === null) delete override[k];
      else override[k] = typeof c.de === 'number' ? c.de : null;
    }
    const res = await salvarAjusteEquipe({
      data: { projectId: e.projectId, projectName: e.projectName, override, acao: 'reversao', ref: e.id, changes: ajusteChanges.map((c) => ({ ...c, de: c.para, para: c.de })) },
    });
    data.setAjuste(e.projectId, res?.ajuste ?? null);
    if (res?.log) data.addLog(res.log);
  }
  for (const [produtoId, changes] of porProduto) {
    const orig = (data.produtos[e.projectId] ?? []).find((p) => p.id === produtoId);
    const atual = data.edicoes[produtoId];
    const override: ProdutoOverride = {};
    for (const k of KS) if (atual?.campos.includes(k)) Object.assign(override, { [k]: atual[k] ?? null });
    for (const c of changes) {
      const k = CAMPOS[c.campo].local as CampoProduto;
      if (orig && valorIgual(c.de, orig[k])) delete override[k];
      else Object.assign(override, { [k]: c.de });
    }
    await gravar(data, {
      produtoId, projectId: e.projectId, projectName: e.projectName, override, acao: 'reversao', ref: e.id,
      changes: changes.map((c) => ({ ...c, de: c.para, para: c.de })),
    });
  }
}
