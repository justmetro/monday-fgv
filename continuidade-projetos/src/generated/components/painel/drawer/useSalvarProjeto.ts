import { useState } from 'react';
import { toast } from 'sonner';
import { saveContinuidade, updateProjeto } from '@generated/server/projetos';
import { registrarLog } from '@generated/server/log';
import { decisaoVazia, todayIso, type Decisao, type Projeto, type Row } from '@generated/lib/painel';
import { valorIgual, type CampoKey, type LogValor, type Mudanca } from '@generated/lib/logCampos';
import type { ParteSalva } from '@generated/server/projetos';
import type { PainelData } from '@generated/hooks/usePainelData';
import { rangeWrite, type DraftA, type DraftDecisao } from '@generated/components/painel/drawer/types';

type Args = {
  row: Row; a: DraftA; baseA: DraftA; d: DraftDecisao; baseD: DraftDecisao; dDirty: boolean;
};

/** A Data da decisão só muda quando Decisão, Meses de manutenção ou Perspectiva de renovação/aditivo mudam. */
export function decisaoChaveMudou(d: DraftDecisao, baseD: DraftDecisao): boolean {
  return d.decisao !== baseD.decisao || d.meses !== baseD.meses || d.perspectiva !== baseD.perspectiva;
}

/** Data da decisão vazia com Decisão ou Meses preenchidos: ao salvar, grava hoje. */
export function preencheDataDecisao(d: DraftDecisao, dec: Decisao | undefined): boolean {
  return !dec?.dataDecisao && (!!d.decisao || d.meses !== null);
}

/** Trava por projeto: criações em andamento no quadro Continuidade – Decisões (sobrevive a fechar/reabrir o drawer). */
const criacoesEmAndamento = new Map<string, Promise<string | null>>();

const realId = (d: Decisao | undefined) => (d && !d.id.startsWith('tmp-') ? d.id : null);

function mudou(list: Mudanca[], campo: CampoKey, de: LogValor, para: LogValor) {
  if (!valorIgual(de, para)) list.push({ campo, de, para });
}

export function useSalvarProjeto(data: PainelData) {
  const [saving, setSaving] = useState(false);

  const salvar = async ({ row, a, baseA, d, baseD, dDirty }: Args): Promise<boolean> => {
    const p = row.projeto;
    const hoje = todayIso();
    setSaving(true);

    // ── Quadro A (Status do Projeto e Alocação de Equipe são somente leitura) ──
    const patchA: NonNullable<Parameters<typeof updateProjeto>[0]>['data'] = { id: p.id };
    const projPatch: Partial<Projeto> = {};
    const logA: Mudanca[] = [];
    if (a.alerta !== baseA.alerta) { patchA.alertaDesalocao = a.alerta; projPatch.alertaDesalocacao = a.alerta; }
    if (JSON.stringify(a.contratual) !== JSON.stringify(baseA.contratual)) {
      patchA.inciofimContratual = rangeWrite(a.contratual); projPatch.contratual = a.contratual;
    }
    if (a.ultimaEntrega !== baseA.ultimaEntrega) { patchA.ltimaEntregaPrevista = a.ultimaEntrega; projPatch.ultimaEntrega = a.ultimaEntrega; }
    mudou(logA, 'alertaDesalocao', p.alertaDesalocacao, a.alerta);
    mudou(logA, 'inciofimContratual', p.contratual, a.contratual);
    mudou(logA, 'ltimaEntregaPrevista', p.ultimaEntrega, a.ultimaEntrega);
    const hasA = Object.keys(projPatch).length > 0;
    const prevProjeto = { ...p };

    // ── Quadro C ──
    const fields: NonNullable<Parameters<typeof saveContinuidade>[0]>['data']['fields'] = {};
    const decPatch: Partial<Decisao> = {};
    if (dDirty) {
      // Perspectiva antiga e data da perspectiva não são mais editadas: os valores já salvos no quadro ficam intactos.
      Object.assign(fields, {
        deciso: d.decisao,
        mesesDeManuteno: d.meses, detalheDaDeciso: d.detalhe.trim() ? d.detalhe : null,
        responsvelPelaDeciso: d.responsaveis.map((x) => x.id),
      });
      Object.assign(decPatch, {
        decisao: d.decisao, mesesManutencao: d.meses,
        detalhe: d.detalhe.trim() ? d.detalhe : null, responsaveis: d.responsaveis,
      });
      if (decisaoChaveMudou(d, baseD) || preencheDataDecisao(d, data.getDecisao(p.id) ?? row.decisao)) {
        fields.dataDaDeciso = hoje;
        decPatch.dataDecisao = hoje;
      }
    }
    const hasC = dDirty;

    // Se já houver criação em andamento para o projeto, aguarda e usa o id retornado.
    let decisionId = realId(data.getDecisao(p.id)) ?? realId(row.decisao);
    if (hasC && !decisionId) {
      const pend = criacoesEmAndamento.get(p.id);
      if (pend) decisionId = await pend.catch(() => null);
    }
    const prevDec = data.getDecisao(p.id) ?? row.decisao;
    const tmpId = `tmp-${p.id}`;
    const blank: Decisao = decisaoVazia(p);
    const baseDec: Decisao = prevDec ?? blank;

    // Mudanças do quadro C para o histórico (valor anterior = registro atual).
    const logC: Mudanca[] = [];
    const novo = { ...baseDec, ...decPatch };
    if (hasC) {
      mudou(logC, 'nClt', baseDec.nClt, novo.nClt);
      mudou(logC, 'custoMensalEquipeR', baseDec.custoMensal, novo.custoMensal);
      mudou(logC, 'atualizaoDaEquipe', baseDec.atualizacaoEquipe, novo.atualizacaoEquipe);
      mudou(logC, 'deciso', baseDec.decisao, novo.decisao);
      mudou(logC, 'mesesDeManuteno', baseDec.mesesManutencao, novo.mesesManutencao);
      mudou(logC, 'detalheDaDeciso', baseDec.detalhe, novo.detalhe);
      mudou(logC, 'responsvelPelaDeciso', baseDec.responsaveis, novo.responsaveis);
      mudou(logC, 'dataDaDeciso', baseDec.dataDecisao, novo.dataDecisao);
    }

    // Otimista
    if (hasA) data.patchProjeto(p.id, projPatch);
    if (hasC) data.upsertDecisao({ ...novo, updatedAt: new Date().toISOString() });

    const erros: string[] = [];
    let criado = false;
    let okA = false;
    let okC = false;
    let idC: string | null = decisionId;
    let partes: ParteSalva[] = [];

    const salvarC = async () => {
      if (decisionId) {
        const res = await saveContinuidade({ data: { decisionId, projectId: p.id, projectName: p.name, fields } });
        partes = res?.partes ?? [];
        return;
      }
      const promise = saveContinuidade({ data: { decisionId: null, projectId: p.id, projectName: p.name, fields } })
        .then((res) => {
          const id = res?.id ?? null;
          criado = !!res?.created;
          idC = id;
          partes = res?.partes ?? [];
          if (id) data.upsertDecisao({ ...novo, id, updatedAt: new Date().toISOString() }, baseDec.id);
          return id;
        });
      criacoesEmAndamento.set(p.id, promise);
      try {
        await promise;
      } finally {
        if (criacoesEmAndamento.get(p.id) === promise) criacoesEmAndamento.delete(p.id);
      }
    };

    await Promise.all([
      hasA
        ? updateProjeto({ data: patchA }).then(() => { okA = true; }).catch((err: unknown) => {
            console.error('updateProjeto', err);
            data.patchProjeto(p.id, prevProjeto);
            erros.push('prazos do projeto');
          })
        : Promise.resolve(),
      hasC
        ? salvarC().then(() => { okC = true; }).catch((err: unknown) => {
            console.error('saveContinuidade', err);
            if (prevDec) data.upsertDecisao(prevDec);
            else data.removeDecisao(tmpId);
            erros.push('decisão');
          })
        : Promise.resolve(),
    ]);

    // Cada parte do quadro C foi gravada separadamente: desfaz localmente só o que falhou.
    const rotuloParte: Record<ParteSalva['parte'], string> = { decisao: 'decisão', equipe: 'equipe', responsaveis: 'responsável pela decisão' };
    const parteDe = (c: CampoKey): ParteSalva['parte'] =>
      c === 'responsvelPelaDeciso' ? 'responsaveis' : (['nClt', 'nEstgio', 'custoMensalEquipeR', 'atualizaoDaEquipe'] as CampoKey[]).includes(c) ? 'equipe' : 'decisao';
    const falhasC = partes.filter((x) => !x.ok);
    const gravadasC = new Set(partes.filter((x) => x.ok).map((x) => x.parte));
    const gravouC = okC && (partes.length === 0 || gravadasC.size > 0);
    if (okC && falhasC.length) {
      const rev: Partial<Decisao> = {};
      for (const x of falhasC) {
        console.error('Parte não gravada no quadro Decisões:', x.parte, x.erro);
        if (x.parte === 'decisao') Object.assign(rev, { decisao: baseDec.decisao, mesesManutencao: baseDec.mesesManutencao, detalhe: baseDec.detalhe, dataDecisao: baseDec.dataDecisao });
        if (x.parte === 'responsaveis') Object.assign(rev, { responsaveis: baseDec.responsaveis });
        if (x.parte === 'equipe') Object.assign(rev, { nClt: baseDec.nClt, custoMensal: baseDec.custoMensal, atualizacaoEquipe: baseDec.atualizacaoEquipe });
        erros.push(rotuloParte[x.parte]);
      }
      data.upsertDecisao({ ...novo, ...rev, id: idC ?? baseDec.id, updatedAt: new Date().toISOString() });
    }

    // Histórico compartilhado (somente o que foi gravado com sucesso).
    const logCok = partes.length === 0 ? logC : logC.filter((m) => gravadasC.has(parteDe(m.campo)));
    const changes = [...(okA ? logA : []), ...(okC ? logCok : [])];
    if (changes.length) {
      try {
        const entry = await registrarLog({ data: { projectId: p.id, projectName: p.name, decisionId: idC, changes } });
        if (entry) data.addLog(entry);
      } catch (err) {
        console.error('registrarLog', err);
        toast.warning('Alterações salvas, mas não foi possível registrar no histórico.');
      }
    }

    setSaving(false);
    if (erros.length) {
      const gravado = [...(okA ? ['prazos do projeto'] : []), ...(gravouC ? [...gravadasC].map((x) => rotuloParte[x]) : [])];
      toast.error(`Não foi possível salvar: ${erros.join(' e ')}.${gravado.length ? ` Gravado: ${gravado.join(', ')}.` : ''} Tente novamente.`);
      return false;
    }
    toast.success(criado ? 'Salvo. Registro de decisão criado para o projeto.' : 'Alterações salvas no monday.');
    return true;
  };

  return { salvar, saving };
}
