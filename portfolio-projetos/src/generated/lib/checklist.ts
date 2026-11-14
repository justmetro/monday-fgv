import type { IndicatorDoc, MeasurementDoc, ProductDoc, RiskDoc, ScheduleItemDoc } from '@generated/models';
import { isDiscarded, k, type Model } from './metrics';
import type { OpsModel } from './ops';
import { typeKind } from './format';

export type CheckArea = 'Cronograma' | 'Riscos' | 'Produtos' | 'Indicadores' | 'Medições';
export type CheckCase = { projectBoardId: string; itemId: string; name: string; detail: string };
export type Check = { id: string; area: CheckArea; label: string; hint: string; total: number; totalBy: Map<string, number>; cases: CheckCase[]; unmappedProjects: number };
export const AREAS: CheckArea[] = ['Cronograma', 'Riscos', 'Produtos', 'Indicadores', 'Medições'];

type Rec = { projectBoardId: string; itemId: string; name: string; unmapped: string[] };

/** Monta uma verificação: registros sem o campo mapeado ficam fora e são contados por projeto. */
function check<T extends Rec>(id: string, area: CheckArea, label: string, hint: string, list: T[], fields: string[], fail: (x: T) => string | null): Check {
  const unm = new Set<string>();
  const ok = list.filter((x) => { const miss = fields.some((f) => x.unmapped.includes(f)); if (miss) unm.add(x.projectBoardId); return !miss; });
  const cases = ok.flatMap((x) => { const d = fail(x); return d ? [{ projectBoardId: x.projectBoardId, itemId: x.itemId, name: x.name, detail: d }] : []; });
  const totalBy = new Map<string, number>();
  ok.forEach((x) => totalBy.set(x.projectBoardId, (totalBy.get(x.projectBoardId) ?? 0) + 1));
  return { id, area, label, hint, total: ok.length, totalBy, cases, unmappedProjects: unm.size };
}
const empty = (v: string | null | undefined) => !v || !v.trim();

export function buildChecklist(m: Model | null, o: OpsModel | null, allow: (boardId: string) => boolean): Check[] {
  const out: Check[] = [];
  if (o) {
    // Só atividades em aberto: fora concluídas, canceladas, despriorizadas (e status marcados como excluídos).
    const closed = (x: ScheduleItemDoc) => o.isDone(x) || /conclu|finaliz|cancel|despriori/.test((x.status ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());
    const sch = o.ds.schedule.filter((x) => allow(x.projectBoardId) && !o.isExcluded(x) && !closed(x));
    const health = (x: ScheduleItemDoc) => o.health(x);
    out.push(
      check('s-prod', 'Cronograma', 'Vínculo a Produto', 'Atividades sem produto atribuído (Produto - Cronograma).', sch, ['produto'], (x) => (x.produtoIds.length === 0 && empty(x.produtoText) ? 'Sem produto vinculado' : null)),
      check('s-frente', 'Cronograma', 'Vínculo a Frente', 'Atividades sem frente atribuída.', sch, ['frentes'], (x) => (empty(x.frentes) ? 'Sem frente' : null)),
      check('s-resp', 'Cronograma', 'Atividades com Responsável', 'Atividades sem responsável.', sch, ['responsavel'], (x) => (x.responsaveis.length === 0 ? 'Sem responsável' : null)),
      check('s-datas', 'Cronograma', 'Datas Planejadas Preenchidas', 'Cronograma planejado em branco.', sch, ['cronograma'], (x) => (!x.inicioPlanejado && !x.fimPlanejado ? 'Cronograma planejado em branco' : null)),
      check('s-saude', 'Cronograma', 'Saúde Conforme Cronograma', 'Atividades sem saúde preenchida ou atrasadas e não concluídas.', sch, ['saude'], (x) => (empty(x.saude) ? 'Saúde não preenchida' : health(x) === 'bad' ? `Saúde: ${x.saude} · status ${x.status ?? '—'}` : null)),
    );
    const rk = o.ds.risks.filter((x) => allow(x.projectBoardId));
    out.push(
      check('r-resp', 'Riscos', 'Responsável do Risco', 'Riscos sem Responsável pelo Monitoramento.', rk, ['responsavel'], (x: RiskDoc) => (x.responsaveis.length === 0 ? 'Sem responsável pelo monitoramento' : null)),
      check('r-periodo', 'Riscos', 'Período Indicado', 'Período do Risco em branco.', rk, ['periodo'], (x: RiskDoc) => (empty(x.periodo) ? 'Período do Risco em branco' : null)),
    );
    const pr = o.ds.products.filter((x) => allow(x.projectBoardId) && !isDiscarded(x.status));
    const concluded = (p: ProductDoc) => !!p.status && (o.cfgBy.get(p.projectBoardId)?.productStatus?.delivered ?? []).includes(p.status);
    const progress = (p: ProductDoc) => !!p.status && /andamento|progress|execu/i.test(p.status.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
    out.push(
      check('p-plan', 'Produtos', 'Data de produtos', '"Planejado Início - Entrega" preenchido.', pr, ['planInicioEntrega'], (x) => (!x.planInicio && !x.planEntrega ? 'Planejado Início - Entrega em branco' : null)),
      check('p-entrega', 'Produtos', 'Data de entrega dos concluídos', 'Produtos concluídos com Entrega Real preenchida.', pr.filter(concluded), ['entregaReal'], (x) => (empty(x.entregaReal) ? `Status "${x.status}" sem Entrega Real` : null)),
      check('p-inicio', 'Produtos', 'Início real dos em andamento', 'Produtos em andamento com Começo Real preenchido.', pr.filter(progress), ['comecoReal'], (x) => (empty(x.comecoReal) ? `Status "${x.status}" sem Começo Real` : null)),
      check('p-valor', 'Produtos', 'Valor indicado', 'Todos os produtos com Valor Produto.', pr, ['valor'], (x) => (x.valor == null && empty(x.valorText) ? 'Sem valor' : null)),
      check('p-link', 'Produtos', 'Link dos entregues', 'Produtos entregues com Link do Produto.', pr.filter((p) => o.isDelivered(p)), ['link'], (x) => (empty(x.linkUrl) && empty(x.linkText) ? 'Entregue sem link' : null)),
    );
  }
  if (m) {
    const ind = m.ds.indicators.filter((x) => allow(x.projectBoardId));
    const f = (key: keyof IndicatorDoc, label: string) => (x: IndicatorDoc) => (empty(x[key] as string | null) ? `${label} em branco` : null);
    out.push(
      check('i-desc', 'Indicadores', 'Descrição do KR/KPI', 'Descrição preenchida.', ind, ['descricao'], f('descricao', 'Descrição')),
      check('i-obj', 'Indicadores', 'Objetivo cadastrado', 'Objetivo preenchido.', ind, ['objetivo'], f('objetivo', 'Objetivo')),
      check('i-pol', 'Indicadores', 'Polaridade', 'Polaridade preenchida.', ind, ['polaridade'], f('polaridade', 'Polaridade')),
      check('i-meta', 'Indicadores', 'Meta', 'Meta preenchida.', ind, ['meta'], f('meta', 'Meta')),
      check('i-un', 'Indicadores', 'Unidade de medida', 'Unidade preenchida.', ind, ['unidade'], f('unidade', 'Unidade')),
      check('i-qtd', 'Indicadores', 'Quantidade de medições', 'Quantidade de Medições indicada.', ind, ['qtdMedicoes'], f('qtdMedicoes', 'Quantidade de medições')),
      check('i-kr', 'Indicadores', 'KPI vinculado a KR', 'KPIs com KR vinculado.', ind.filter((x) => typeKind(x.tipo) === 'KPI'), ['krVinculado'], (x) => (x.krVinculadoIds.length === 0 && empty(x.krVinculadoText) ? 'KPI sem KR vinculado' : null)),
      check('i-med', 'Indicadores', 'Vinculados às medições', 'Indicadores com medições vinculadas.', ind, [], (x) => (x.medicaoIds.length === 0 && (m.medsOfInd.get(k(x.projectBoardId, x.itemId)) ?? []).length === 0 ? 'Sem medição vinculada' : null)),
      check('i-tfc', 'Indicadores', 'Temporalidade, fórmula e coleta', 'Os três campos preenchidos.', ind, [], (x) => {
        const miss = [['temporalidade', 'Temporalidade'], ['formula', 'Fórmula de cálculo'], ['formaColeta', 'Forma de coleta']].filter(([key]) => !x.unmapped.includes(key) && empty(x[key as keyof IndicatorDoc] as string | null)).map(([, l]) => l);
        return miss.length ? `Em branco: ${miss.join(', ')}` : null;
      }),
    );
    const med = m.ds.measurements.filter((x) => allow(x.projectBoardId) && !isDiscarded(x.statusMedicao) && !m.isExcluded(x));
    const done = med.filter((x) => m.isConcluded(x));
    out.push(
      check('m-base', 'Medições', 'Link da base de dados', 'Medições concluídas com link da base de dados.', done, ['baseDados'], (x: MeasurementDoc) => (x.baseDadosUrls.length === 0 && empty(x.baseDadosText) ? 'Concluída sem base de dados' : null)),
      check('m-resp', 'Medições', 'Responsável pela coleta', 'Responsável indicado.', med, ['responsavel'], (x) => (x.responsaveis.length === 0 ? 'Sem responsável' : null)),
      check('m-prazo', 'Medições', 'Prazo de medição', 'Prazo preenchido.', med, ['prazo'], (x) => (!x.prazo ? 'Sem prazo' : null)),
      check('m-valor', 'Medições', 'Valor apurado nas concluídas', 'Concluídas com valor apurado.', done, ['valorApurado'], (x) => (empty(x.valorApurado) ? 'Concluída sem valor apurado' : null)),
      check('m-venc', 'Medições', 'Prazo vencido sem apuração', 'Medições vencidas e não apuradas.', med, ['prazo'], (x) => (m.isLate(x) && empty(x.valorApurado) ? `Prazo ${x.prazo} vencido` : null)),
      check('m-meta', 'Medições', 'Meta da medição', 'Meta indicada.', med, ['meta'], (x) => (empty(x.meta) ? 'Sem meta' : null)),
    );
  }
  return out;
}
