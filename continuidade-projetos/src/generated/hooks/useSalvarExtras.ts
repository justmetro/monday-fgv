import { useCallback } from 'react';
import { salvarExtrasDecisao, type ParteExtra } from '@generated/server/projetos';
import { registrarLog } from '@generated/server/log';
import { decisaoVazia, type Decisao, type Row } from '@generated/lib/painel';
import type { Simulacao } from '@generated/lib/extras';
import type { PainelData } from '@generated/hooks/usePainelData';

export type Extras = { cat?: string | null; base?: string[]; sim?: Simulacao };
export type ResultadoExtras = { ok: boolean; gravado: string[]; falhas: string[] };

export const ROTULO_EXTRA: Record<ParteExtra['parte'], string> = { status: 'status', base: 'equipe base', simulacao: 'simulação por pessoa' };

const realId = (d: Decisao | undefined) => (d && !d.id.startsWith('tmp-') ? d.id : null);

/** Grava Status / Equipe base / Simulação (partes separadas) com atualização otimista e desfaz só o que falhar. */
export function useSalvarExtras(data: PainelData) {
  const { getDecisao, upsertDecisao, removeDecisao, addLog } = data;

  return useCallback(async (row: Row, x: Extras): Promise<ResultadoExtras> => {
    const p = row.projeto;
    const prev = getDecisao(p.id);
    const baseDec = prev ?? decisaoVazia(p);
    const novo: Decisao = {
      ...baseDec,
      ...(x.cat !== undefined ? { statusCat: x.cat } : {}),
      ...(x.base !== undefined ? { baseIds: x.base } : {}),
      ...(x.sim !== undefined ? { sim: x.sim } : {}),
    };
    upsertDecisao({ ...novo, updatedAt: new Date().toISOString() });

    const nomes = new Map((row.equipe?.todas ?? []).map((pp) => [pp.id, pp.nome] as const));
    try {
      const r = await salvarExtrasDecisao({
        data: {
          decisionId: realId(prev), projectId: p.id, projectName: p.name,
          statusCat: x.cat,
          base: x.base?.map((id) => ({ id, nome: nomes.get(id) ?? null })),
          sim: x.sim ? Object.entries(x.sim).map(([id, opcao]) => ({ id, nome: nomes.get(id) ?? null, opcao })) : undefined,
        },
      });
      if (!r?.id) throw new Error(r?.erro ?? 'Sem item de decisão');
      const partes = r.partes ?? [];
      const ok = partes.filter((pp) => pp.ok).map((pp) => pp.parte);
      const falhas = partes.filter((pp) => !pp.ok);
      for (const f of falhas) console.error('Parte não gravada no quadro Decisões:', f.parte, f.erro);
      if (r.decisao) {
        upsertDecisao(r.decisao, baseDec.id);
      } else {
        const rev: Partial<Decisao> = {};
        for (const f of falhas) {
          if (f.parte === 'status') rev.statusCat = baseDec.statusCat;
          if (f.parte === 'base') rev.baseIds = baseDec.baseIds;
          if (f.parte === 'simulacao') rev.sim = baseDec.sim;
        }
        upsertDecisao({ ...novo, ...rev, id: r.id, updatedAt: new Date().toISOString() }, baseDec.id);
      }
      if (ok.includes('status') && (baseDec.statusCat ?? null) !== (x.cat ?? null)) {
        registrarLog({
          data: { projectId: p.id, projectName: p.name, decisionId: r.id, changes: [{ campo: 'statusDeCategorizao', de: baseDec.statusCat ?? null, para: x.cat ?? null }] },
        }).then((e) => { if (e) addLog(e); }).catch((e: unknown) => console.error('registrarLog status', e));
      }
      return { ok: falhas.length === 0, gravado: ok.map((pp) => ROTULO_EXTRA[pp]), falhas: falhas.map((f) => ROTULO_EXTRA[f.parte]) };
    } catch (e) {
      console.error('salvarExtrasDecisao', e);
      if (prev) upsertDecisao(prev); else removeDecisao(baseDec.id);
      const falhas = [x.cat !== undefined && 'status', x.base !== undefined && 'equipe base', x.sim !== undefined && 'simulação por pessoa'].filter((v): v is string => !!v);
      return { ok: false, gravado: [], falhas };
    }
  }, [getDecisao, upsertDecisao, removeDecisao, addLog]);
}
