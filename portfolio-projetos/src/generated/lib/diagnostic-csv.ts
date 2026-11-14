// Diagnóstico do projeto em CSV (gerado no navegador com os dados já carregados na tela).
// Reaproveita os cálculos existentes: productRisks, buildChecklist, ops.health, model.isLate/goalClass, isActive/periodOf.
import type { ProjectDoc, ScheduleItemDoc, ScheduleSubitemDoc } from '@generated/models';
import type { Model } from './metrics';
import { k, type OpsModel } from './ops';
import { EMPTY_GLOBAL, scopeOps } from './ops';
import { productRisks, type ProductRisk, type RiskLevel } from './product-risk';
import { AREAS, buildChecklist } from './checklist';
import { isActive, periodOf } from './risk-period';
import { groupIdOf, parseConfig } from './fields';
import { typeKind } from './format';

type Cell = string | number | boolean | null | undefined;
const DAY = 86400000;
const ts = (s: string | null | undefined) => (s && /^\d{4}-\d{2}-\d{2}/.test(s) ? Date.parse(s.slice(0, 10) + 'T00:00:00Z') : null);
const days = (a: string | null | undefined, b: string) => { const x = ts(a), y = ts(b); return x == null || y == null ? null : Math.round((x - y) / DAY); };
const d10 = (s: string | null | undefined) => (s ? s.slice(0, 10) : '');
const list = (a: (string | null | undefined)[]) => a.filter(Boolean).join(', ');

function cell(v: Cell): string {
  if (v == null) return '';
  let s = typeof v === 'boolean' ? (v ? 'Sim' : 'Não') : typeof v === 'number' ? (Number.isFinite(v) ? String(Math.round(v * 1000) / 1000) : '') : v;
  s = s.replace(/\r?\n|\r/g, ' ');
  if (s.length > 2000) s = s.slice(0, 2000);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[;"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const line = (a: Cell[]) => a.map(cell).join(';');

type Section = { name: string; head: string[]; rows: Cell[][]; missing?: boolean };
const RANK: Record<RiskLevel, number> = { Crítico: 4, Alto: 3, Médio: 2, Baixo: 1 };

/** Número de um texto "1.234,5" / "45%" / "0.8". */
function num(s: string | null): number | null {
  if (!s) return null;
  const t = s.replace(/[^\d,.-]/g, '');
  if (!t) return null;
  const v = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
  return Number.isFinite(v) ? v : null;
}

export function buildDiagnosticCsv(boardId: string, model: Model | null, ops: OpsModel | null): { filename: string; csv: string } {
  const p: ProjectDoc | undefined = model?.projectBy.get(boardId) ?? ops?.projectBy.get(boardId);
  if (!p) throw new Error('Projeto não encontrado nos dados carregados.');
  const cfg = parseConfig(p.config);
  const today = ops?.today ?? model?.today ?? new Date().toISOString().slice(0, 10);
  const has = { sched: !!cfg && !!groupIdOf(cfg, 'sched'), prod: !!cfg && !!groupIdOf(cfg, 'prod'), risk: !!cfg && !!groupIdOf(cfg, 'risk'), ind: !p.noIndicators };

  const scope = ops ? scopeOps(ops, { ...EMPTY_GLOBAL, projects: [boardId] }) : null;
  const sched = scope?.schedule ?? [];
  const subs = scope?.subitems ?? [];
  const prods = scope?.products ?? [];
  const rks = scope?.risks ?? [];
  const inds = model?.ds.indicators.filter((i) => i.projectBoardId === boardId) ?? [];
  const meds = model?.ds.measurements.filter((m) => m.projectBoardId === boardId) ?? [];
  const risksBy = new Map<string, ProductRisk>((ops && scope ? productRisks(ops, scope) : []).map((r) => [r.product.itemId, r]));
  const checks = buildChecklist(model, ops, (id) => id === boardId);

  // ——— Produtos ———
  const prodRows = prods.map((x) => {
    const r = risksBy.get(x.itemId);
    const ent = ops?.isDelivered(x) ?? false;
    const due = x.planEntrega ?? x.entregaPlanejada;
    const pend = (r?.tasks ?? []).filter((t) => !t.done).slice(0, 15).map((t) => `${t.kind} · ${t.name} · ${t.status ?? 'sem status'} · ${d10(t.inicio)} a ${d10(t.fim)}${t.late ? ' · atrasada' : ''}`).join(' | ');
    return [x.itemId, x.name, x.status, x.valor, x.faturamento, x.faturamentoText, x.pagamento, x.pagamentoText, x.statusPagamento, d10(x.envioCpa), d10(x.comecoReal), d10(x.entregaReal), d10(x.entregaPlanejada), d10(x.planInicio), d10(x.planEntrega), x.linkUrl ?? x.linkText,
      ent, ops?.isPaid(x) ?? false, due ? due.slice(0, 7) : '', ent ? null : days(due, today),
      !!x.flagEntregaAtrasada, !!x.flagSemEntregaPlanejada, !!x.flagEntregueSemFaturamento, !!x.flagPagamentoPendente,
      r?.index, r?.level, r ? r.special : null, r?.plan.pts, r?.plan.note, r?.late.pts, r?.late.note, r?.pace.pts, r?.pace.note, r?.plan.margin, d10(r?.plan.lastEnd),
      r?.tasks.length, r ? r.tasks.filter((t) => t.done).length : null, r ? r.tasks.filter((t) => !t.done).length : null, r?.late.count,
      r?.pace.current != null ? r.pace.current * 7 : null, r?.pace.required != null ? r.pace.required * 7 : null, pend] as Cell[];
  });

  // ——— Atividades ———
  const parentName = new Map(sched.map((x) => [x.itemId, x.name]));
  const prodLevel = (ids: string[]) => {
    const lv = ids.map((id) => risksBy.get(id)?.level).filter((l): l is RiskLevel => !!l).sort((a, b) => RANK[b] - RANK[a]);
    return lv[0] ?? '';
  };
  const prodNames = (ids: string[], text: string | null) => list(ids.map((id) => ops?.prodBy.get(k(boardId, id))?.name ?? null)) || (text ?? '');
  const act = (x: ScheduleItemDoc | ScheduleSubitemDoc, sub: boolean): Cell[] => {
    const done = ops?.isDone(x) ?? false;
    const lateDays = !done && x.fimPlanejado ? -(days(x.fimPlanejado, today) ?? 0) : 0;
    const h = !sub && ops ? ops.health(x as ScheduleItemDoc) : null;
    return [x.itemId, sub ? 'Subatividade' : 'Atividade', sub ? parentName.get((x as ScheduleSubitemDoc).parentItemId) ?? (x as ScheduleSubitemDoc).parentItemId : '', x.name,
      sub ? '' : (x as ScheduleItemDoc).frentes, list(x.responsaveis), x.status, sub ? '' : (x as ScheduleItemDoc).saude,
      h == null ? '' : h === 'ok' ? 'ok' : h === 'warn' ? 'atenção' : h === 'bad' ? 'ruim' : 'sem saúde',
      prodNames(x.produtoIds, x.produtoText), prodLevel(x.produtoIds), d10(x.inicioPlanejado), d10(x.fimPlanejado),
      done, ops?.isExcluded(x) ?? false, lateDays > 0, lateDays > 0 ? lateDays : 0, x.responsaveis.length === 0, !x.inicioPlanejado && !x.fimPlanejado, x.produtoIds.length === 0 && !x.produtoText];
  };
  const actRows = [...sched.map((x) => act(x, false)), ...subs.map((x) => act(x, true))];

  // ——— Riscos ———
  const pos = (kind: 'levels' | 'probability' | 'impact', v: string | null) => {
    if (!ops || !v) return '';
    const sc = ops.scaleOf(boardId, kind); const i = ops.rank(boardId, kind, v);
    return i >= 0 ? `${i + 1} de ${sc.length}` : '';
  };
  const riskRows = rks.map((r) => {
    const per = periodOf(r.periodo);
    return [r.itemId, r.name, r.periodo, per?.[0], per?.[1], r.tema, r.categoria, r.impactado, r.causa, r.efeito, r.probabilidadeStatus, r.impactoStatus, r.nivel,
      pos('levels', r.nivel), pos('probability', r.probabilidadeStatus), pos('impact', r.impactoStatus), r.estrategia, r.resposta, list(r.responsaveis),
      d10(r.ultimaAtualizacao), r.ultimaAtualizacao ? -(days(r.ultimaAtualizacao, today) ?? 0) : null, isActive(r.periodo, today),
      !!r.flagSemResponsavel, !!r.flagAtualizacaoAntiga, !!r.flagDivergencia] as Cell[];
  });

  // ——— Indicadores ———
  const indRows = inds.map((i) => {
    const ms = model?.medsOfInd.get(k(boardId, i.itemId)) ?? [];
    const apur = ms.filter((m) => model!.isConcluded(m) && (m.valorApurado || m.resultado)).sort((a, b) => (a.prazo ?? '').localeCompare(b.prazo ?? ''));
    const last = apur[apur.length - 1];
    let trend = '';
    if (apur.length >= 2) {
      const a = num(apur[apur.length - 2]!.valorApurado ?? apur[apur.length - 2]!.resultado), b = num(last!.valorApurado ?? last!.resultado);
      if (a != null && b != null) {
        const lowerBetter = /menor|negativ|reduc|redu[çc]/i.test(i.polaridade ?? '');
        const d = lowerBetter ? a - b : b - a;
        trend = Math.abs(d) < 1e-9 ? 'estável' : d > 0 ? 'melhorando' : 'piorando';
      }
    }
    return [i.itemId, i.name, i.descricao, i.objetivo, typeKind(i.tipo), i.krVinculadoText, i.formaColeta, i.temporalidade, i.meta, i.polaridade, i.unidade, i.formula, i.qtdMedicoes, i.resultadoConsolidado,
      ms.length, ms.filter((m) => model!.isConcluded(m)).length, ms.filter((m) => model!.isLate(m)).length, ms.filter((m) => model!.goalClass(m) === 'reached').length,
      last ? last.valorApurado ?? last.resultado : '', d10(last?.prazo), trend] as Cell[];
  });

  // ——— Medições ———
  const medRows = meds.map((m) => {
    const ii = model?.indicatorsOf(m) ?? [];
    const gc = model?.goalClass(m);
    const late = model?.isLate(m) ?? false;
    return [m.itemId, m.name, list(ii.map((x) => x.name)), list([...new Set(ii.map((x) => typeKind(x.tipo)))]), d10(m.prazo), m.periodo, m.statusMedicao, list(m.responsaveis), m.meta, m.valorApurado, m.resultado, m.statusMeta,
      gc === 'reached' ? 'atingida' : gc === 'notReached' ? 'não atingida' : 'sem classe', model?.isConcluded(m) ?? false, late, late ? -(days(m.prazo, today) ?? 0) : 0,
      m.baseDadosUrls.join(', '), m.baseDadosLabels.join(', ') || m.baseDadosText, !!m.flagSemBaseDados] as Cell[];
  });

  // ——— Checklist ———
  const incRows = checks.flatMap((c) => c.cases.map((x) => [c.area, c.id, c.hint, x.itemId, x.name, x.detail] as Cell[]));
  const byArea = AREAS.map((a) => checks.filter((c) => c.area === a).reduce((s, c) => s + c.cases.length, 0));
  const nInc = byArea.reduce((a, b) => a + b, 0);
  const nVer = checks.reduce((a, c) => a + (c.totalBy.get(boardId) ?? 0), 0);

  // ——— Resumo ———
  const open = prods.filter((x) => !(ops?.isDelivered(x) ?? false));
  const dues = open.map((x) => d10(x.planEntrega ?? x.entregaPlanejada)).filter(Boolean).sort();
  const lvl = (l: RiskLevel) => [...risksBy.values()].filter((r) => r.level === l).length;
  const vSched = sched.filter((x) => !(ops?.isExcluded(x) ?? false));
  const openAct = vSched.filter((x) => !(ops?.isDone(x) ?? false));
  const resumoHead = ['indicadores', 'medicoes', 'atividades', 'subatividades', 'produtos', 'riscos', 'produtos_em_aberto', 'produtos_entregues', 'produtos_em_atraso', 'produtos_risco_critico', 'produtos_risco_alto', 'produtos_risco_medio', 'produtos_risco_baixo',
    'proxima_entrega_planejada', 'ultima_entrega_planejada', 'dias_ate_ultima_entrega', 'atividades_abertas', 'atividades_atrasadas_datas', 'atividades_atrasadas_saude', 'atividades_sem_responsavel', 'atividades_sem_cronograma',
    'riscos_ativos', 'riscos_sem_responsavel', 'riscos_atualizacao_antiga', 'riscos_divergencia', 'medicoes_vencidas_sem_apuracao', 'medicoes_meta_nao_atingida',
    ...AREAS.map((a) => `inconsistencias_${a.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}`), 'inconsistencias_total', 'itens_verificados', 'pct_inconsistencia'];
  const resumo: Cell[] = [inds.length, meds.length, sched.length, subs.length, prods.length, rks.length, open.length, prods.length - open.length, prods.filter((x) => x.flagEntregaAtrasada).length,
    lvl('Crítico'), lvl('Alto'), lvl('Médio'), lvl('Baixo'), dues[0], dues[dues.length - 1], dues.length ? days(dues[dues.length - 1], today) : null,
    openAct.length, openAct.filter((x) => x.fimPlanejado && x.fimPlanejado.slice(0, 10) < today).length, openAct.filter((x) => ops?.health(x) === 'bad').length,
    openAct.filter((x) => x.responsaveis.length === 0).length, openAct.filter((x) => !x.inicioPlanejado && !x.fimPlanejado).length,
    rks.filter((r) => isActive(r.periodo, today)).length, rks.filter((r) => r.flagSemResponsavel).length, rks.filter((r) => r.flagAtualizacaoAntiga).length, rks.filter((r) => r.flagDivergencia).length,
    meds.filter((m) => model?.isLate(m)).length, meds.filter((m) => model?.isConcluded(m) && model.goalClass(m) === 'notReached').length,
    ...byArea, nInc, nVer, nVer ? (nInc / nVer) * 100 : null];

  const sections: Section[] = [
    { name: 'RESUMO', head: resumoHead, rows: [resumo] },
    { name: 'PRODUTOS', missing: !has.prod, head: ['id_item', 'nome', 'status', 'valor', 'faturamento_estimado_valor', 'faturamento_estimado_texto', 'pagamento_estimado_valor', 'pagamento_estimado_texto', 'status_pagamento', 'envio_cpa', 'comeco_real', 'entrega_real', 'entrega_planejada', 'planejado_inicio', 'planejado_entrega', 'link_produto', 'entregue', 'pago', 'mes_entrega_planejada', 'dias_para_entrega', 'flag_entrega_atrasada', 'flag_sem_entrega_planejada', 'flag_entregue_sem_faturamento', 'flag_pagamento_pendente', 'indice_risco', 'nivel_risco', 'caso_especial', 'pts_planejamento', 'nota_planejamento', 'pts_atrasos', 'nota_atrasos', 'pts_ritmo', 'nota_ritmo', 'margem_dias', 'ultimo_termino_cronograma', 'tarefas_vinculadas', 'tarefas_concluidas', 'tarefas_pendentes', 'tarefas_atrasadas', 'ritmo_atual_semana', 'ritmo_necessario_semana', 'atividades_pendentes_vinculadas'], rows: prodRows },
    { name: 'ATIVIDADES', missing: !has.sched, head: ['id_item', 'tipo', 'atividade_pai', 'nome', 'frente', 'responsaveis', 'status', 'saude', 'categoria_saude', 'produtos_vinculados', 'maior_nivel_risco_produto', 'inicio_planejado', 'fim_planejado', 'concluida', 'excluida', 'atrasada_pelas_datas', 'dias_atraso', 'sem_responsavel', 'sem_cronograma', 'sem_produto_vinculado'], rows: actRows },
    { name: 'RISCOS', missing: !has.risk, head: ['id_item', 'nome', 'periodo', 'periodo_inicio', 'periodo_fim', 'tema', 'categoria', 'impactado', 'causa', 'efeito', 'probabilidade', 'impacto', 'nivel', 'posicao_nivel', 'posicao_probabilidade', 'posicao_impacto', 'estrategia', 'resposta', 'responsaveis', 'ultima_atualizacao', 'dias_desde_atualizacao', 'ativo_hoje', 'flag_sem_responsavel', 'flag_atualizacao_antiga', 'flag_divergencia'], rows: riskRows },
    { name: 'INDICADORES', missing: !has.ind, head: ['id_item', 'nome', 'descricao', 'objetivo', 'tipo', 'kr_vinculado', 'forma_coleta', 'temporalidade', 'meta', 'polaridade', 'unidade', 'formula', 'qtd_medicoes_prevista', 'resultado_consolidado', 'medicoes_vinculadas', 'medicoes_concluidas', 'medicoes_vencidas', 'medicoes_meta_atingida', 'valor_ultima_apurada', 'prazo_ultima_apurada', 'tendencia'], rows: indRows },
    { name: 'MEDICOES', missing: !has.ind, head: ['id_item', 'nome', 'indicadores_vinculados', 'tipo_indicador', 'prazo', 'periodo', 'status_medicao', 'responsaveis', 'meta', 'valor_apurado', 'resultado', 'status_meta', 'classe_meta', 'concluida', 'vencida_sem_apuracao', 'dias_atraso', 'base_dados_link', 'base_dados_rotulo', 'flag_sem_base_dados'], rows: medRows },
    { name: 'INCONSISTENCIAS_CHECKLIST', head: ['area', 'id_verificacao', 'descricao_verificacao', 'id_item', 'nome_item', 'detalhe'], rows: incRows },
  ];

  const scale = (kind: 'levels' | 'probability' | 'impact') => (ops ? ops.scaleOf(boardId, kind).join(' < ') : '') || 'não configurada';
  const leia: [string, Cell][] = [
    ['projeto', p.name], ['codigo', p.hCode], ['id_quadro', p.boardId], ['fase_status', p.hStatus], ['gerentes', list(p.hManagers ?? [])], ['eixos', list(p.hAxes ?? [])],
    ['gerado_em', new Date().toISOString().slice(0, 19).replace('T', ' ')], ['ultima_sincronizacao', p.lastSuccessAt?.slice(0, 19).replace('T', ' ')], ['status_sincronizacao', p.syncStatus],
    ['secoes', 'LEIAME; RESUMO; PRODUTOS; ATIVIDADES; RISCOS; INDICADORES; MEDICOES; INCONSISTENCIAS_CHECKLIST'],
    ['secao_RESUMO', 'Uma linha com os números consolidados do projeto'],
    ['secao_PRODUTOS', 'Um registro por produto (entregues ou não), com índice de risco e fatores'],
    ['secao_ATIVIDADES', 'Atividades e subatividades do cronograma (coluna tipo)'],
    ['secao_RISCOS', 'Um registro por risco, com período, escala e sinalizações'],
    ['secao_INDICADORES', 'Um registro por KR/KPI, com medições e tendência'],
    ['secao_MEDICOES', 'Um registro por medição, com classe da meta e atraso'],
    ['secao_INCONSISTENCIAS_CHECKLIST', 'Um registro por caso encontrado pelo Checklist do aplicativo'],
    ['regra_1', 'Atraso de atividade deve ser avaliado pelas datas planejadas, não pela Saúde, que pode induzir a erro'],
    ['regra_2', 'Produtos já entregues ficam sem índice de risco'],
    ['regra_3', 'Campo vazio = sem dado no quadro de origem'],
    ['regra_4', 'Fases: Planejamento = produção e planejamento em definição; Execução = entregas em andamento; Encerramento = até 30 dias para o último produto'],
    ['regra_5_niveis_risco', scale('levels')], ['regra_5_probabilidade', scale('probability')], ['regra_5_impacto', scale('impact')],
    ['indice_risco_niveis', 'Crítico >= 70; Alto 45-69; Médio 20-44; Baixo < 20'],
  ];

  const out: string[] = ['##TABELA;LEIAME', line(['chave', 'valor']), ...leia.map((r) => line(r)), ''];
  for (const s of sections) {
    out.push(`##TABELA;${s.name}`, line(s.head));
    if (s.missing) out.push('(grupo não importado neste projeto)');
    else if (s.rows.length === 0) out.push('(sem registros)');
    else s.rows.forEach((r) => out.push(line(r)));
    out.push('');
  }
  const slug = (p.hCode ?? p.name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'projeto';
  return { filename: `diagnostico-${slug}-${today}.csv`, csv: '\uFEFF' + out.join('\r\n') };
}
