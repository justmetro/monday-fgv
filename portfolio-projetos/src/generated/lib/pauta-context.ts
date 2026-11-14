// Contexto estratégico do projeto para a pauta de monitoramento. Reaproveita os cálculos existentes.
import type { ProjectDoc, ScheduleItemDoc } from '@generated/models';
import type { Model } from './metrics';
import { EMPTY_GLOBAL, k, scopeOps, type OpsModel } from './ops';
import { productRisks } from './product-risk';
import { isActive } from './risk-period';
import type { PautaContext } from './pauta-schema';

const T = (v: string | null | undefined, n = 200) => (v == null ? null : String(v).slice(0, n));
const S = (v: string | null | undefined, n = 200) => (v ?? '').slice(0, n);
const nrm = (s: string | null | undefined) => (s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const DAY = 86400000;
const days = (a: string, b: string) => Math.round((new Date(a.slice(0, 10)).getTime() - new Date(b.slice(0, 10)).getTime()) / DAY);

export function faseOf(p: ProjectDoc | undefined): PautaContext['fase'] {
  if (!p?.hStatus || (p.hStatusState && p.hStatusState !== 'ok')) return 'não informada';
  const s = nrm(p.hStatus);
  if (/encerramento/.test(s)) return 'encerramento';
  if (/execu/.test(s)) return 'execução';
  if (/planejamento/.test(s)) return 'planejamento';
  return 'não informada';
}

export function buildPautaContext(boardId: string, model: Model | null, ops: OpsModel | null): PautaContext {
  const p = model?.projectBy.get(boardId) ?? ops?.projectBy.get(boardId);
  const today = ops?.today ?? new Date().toISOString().slice(0, 10);
  const ctx: PautaContext = {
    fase: faseOf(p), statusOriginal: T(p?.hStatus), diasParaUltimaEntrega: null, hoje: today,
    produtos: { emAberto: 0, lista: [] },
    cronograma: { abertas: 0, atrasadas: 0, semResponsavel: 0, porFrente: [], criticas: [] },
    riscos: { total: 0, ativos: 0, lista: [], recorrentes: [] },
    indicadores: { total: 0, medicoes: [], tendencias: [], semApuracao: [] },
  };

  if (ops) {
    const scope = scopeOps(ops, { ...EMPTY_GLOBAL, projects: [boardId] });
    const ym = today.slice(0, 7);
    const pr = productRisks(ops, scope).filter((r) => r.product.projectBoardId === boardId);
    ctx.produtos.emAberto = pr.length;
    const ends = pr.map((r) => r.product.planEntrega ?? r.product.entregaPlanejada).filter((d): d is string => !!d).sort();
    const last = ends[ends.length - 1];
    ctx.diasParaUltimaEntrega = last ? days(last, today) : null;
    const riskyProd = new Set<string>();
    ctx.produtos.lista = pr
      .filter((r) => { const d = r.product.planEntrega ?? r.product.entregaPlanejada; return (d && d.slice(0, 7) === ym) || (d && d < today) || r.product.flagEntregaAtrasada || r.level === 'Crítico' || r.level === 'Alto'; })
      .sort((a, b) => b.index - a.index).slice(0, 10)
      .map((r) => {
        const x = r.product;
        if (r.level === 'Crítico' || r.level === 'Alto') riskyProd.add(x.itemId);
        const ent = x.planEntrega ?? x.entregaPlanejada;
        const pend = r.tasks.filter((t) => !t.done).sort((a, b) => Number(b.late) - Number(a.late) || (ent && a.fim && b.fim ? Math.abs(days(a.fim, ent)) - Math.abs(days(b.fim, ent)) : 0)).slice(0, 6);
        return {
          nome: S(x.name), status: T(x.status), periodo: x.planInicio || x.planEntrega ? `${x.planInicio ?? '?'} a ${x.planEntrega ?? '?'}` : null, entrega: T(ent),
          indice: r.index, nivel: r.level, semCronograma: r.special,
          fatores: { planejamento: S(r.plan.note), atrasadas: S(r.late.note), ritmo: S(r.pace.note) },
          valor: T(x.valorText), faturamento: T(x.faturamentoText), pagamento: T(x.statusPagamento),
          entregaAtrasada: !!x.flagEntregaAtrasada, entregueSemFaturamento: !!x.flagEntregueSemFaturamento, pagamentoPendente: !!x.flagPagamentoPendente,
          pendentes: pend.map((t) => ({ nome: S(t.name), tipo: t.kind, status: T(t.status), inicio: T(t.inicio), fim: T(t.fim), atrasada: t.late })),
        };
      });

    // Cronograma: mesma exclusão do Checklist; atraso pelas datas planejadas, Saúde como apoio.
    const closed = (x: ScheduleItemDoc) => ops.isDone(x) || /conclu|finaliz|cancel|despriori/.test(nrm(x.status));
    const all = scope.schedule.filter((x) => x.projectBoardId === boardId && !ops.isExcluded(x));
    const open = all.filter((x) => !closed(x));
    const late = (x: ScheduleItemDoc) => (!!x.fimPlanejado && x.fimPlanejado.slice(0, 10) < today) || !!x.flagAtrasada;
    ctx.cronograma.abertas = open.length;
    ctx.cronograma.atrasadas = open.filter(late).length;
    ctx.cronograma.semResponsavel = open.filter((x) => x.responsaveis.length === 0).length;
    const fr = new Map<string, { abertas: number; atrasadas: number; concluidasRecentes: number }>();
    all.forEach((x) => (x.frentes ? x.frentes.split(',').map((f) => f.trim()).filter(Boolean) : ['Sem frente']).forEach((f) => {
      const r = fr.get(f) ?? { abertas: 0, atrasadas: 0, concluidasRecentes: 0 };
      if (!closed(x)) { r.abertas++; if (late(x)) r.atrasadas++; }
      else if (ops.isDone(x) && x.fimPlanejado && days(today, x.fimPlanejado) <= 30) r.concluidasRecentes++;
      fr.set(f, r);
    }));
    ctx.cronograma.porFrente = [...fr.entries()].map(([frente, r]) => ({ frente: S(frente), ...r })).sort((a, b) => b.atrasadas - a.atrasadas || b.abertas - a.abertas).slice(0, 15);
    ctx.cronograma.criticas = open
      .map((x) => {
        const m: string[] = [];
        if (late(x)) m.push('fim planejado vencido');
        else if (ops.health(x) === 'bad') m.push('saúde atrasada (datas ainda no prazo)');
        if (x.responsaveis.length === 0) m.push('sem responsável');
        if (x.produtoIds.some((id) => riskyProd.has(id))) m.push('vinculada a produto de risco Crítico/Alto');
        return { x, m };
      })
      .filter((r) => r.m.length).sort((a, b) => b.m.length - a.m.length || S(a.x.fimPlanejado).localeCompare(S(b.x.fimPlanejado))).slice(0, 10)
      .map(({ x, m }) => ({ nome: S(x.name), frente: T(x.frentes), responsaveis: S(x.responsaveis.join(', ')) || 'nenhum', status: T(x.status), fimPlanejado: T(x.fimPlanejado), saude: T(x.saude), motivo: m.join('; ') }));

    // Riscos
    const rk = scope.risks.filter((x) => x.projectBoardId === boardId);
    const act = rk.filter((r) => isActive(r.periodo, today));
    ctx.riscos.total = rk.length; ctx.riscos.ativos = act.length;
    const lateNames = [...ctx.produtos.lista.filter((x) => x.entregaAtrasada || x.nivel === 'Crítico').map((x) => x.nome), ...open.filter(late).map((x) => x.name)].map(nrm).filter((n) => n.length > 5);
    const rec = new Map<string, number>();
    rk.forEach((r) => { const key = [r.tema, r.categoria].filter(Boolean).join(' / '); if (key) rec.set(key, (rec.get(key) ?? 0) + 1); });
    ctx.riscos.recorrentes = [...rec.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([tema, quantidade]) => ({ tema: S(tema), quantidade }));
    const sc = (r: (typeof rk)[number]) => ops.rank(boardId, 'levels', r.nivel) * 100 + ops.rank(boardId, 'probability', r.probabilidadeStatus) * 10 + ops.rank(boardId, 'impact', r.impactoStatus);
    ctx.riscos.lista = [...act].sort((a, b) => sc(b) - sc(a)).slice(0, 10).map((r) => {
      const sinais: string[] = [];
      if (r.flagSemResponsavel) sinais.push('sem responsável');
      if (r.flagAtualizacaoAntiga) sinais.push('atualização antiga');
      if (r.flagDivergencia) sinais.push('divergência entre status e fórmula');
      if (!r.resposta?.trim()) sinais.push('resposta em branco');
      const txt = nrm(`${r.causa ?? ''} ${r.efeito ?? ''} ${r.impactado ?? ''}`);
      if (lateNames.some((n) => txt.includes(n.slice(0, 40)))) sinais.push('relacionado a produto/atividade atrasada');
      return { nome: S(r.name), tema: T(r.tema), categoria: T(r.categoria), nivel: T(r.nivel), probabilidade: T(r.probabilidadeStatus), impacto: T(r.impactoStatus), estrategia: T(r.estrategia), resposta: T(r.resposta), responsaveis: S(r.responsaveis.join(', ')) || 'nenhum', ultimaAtualizacao: T(r.ultimaAtualizacao), causa: T(r.causa), efeito: T(r.efeito), sinais };
    });
  }

  if (model) {
    const inds = model.ds.indicators.filter((i) => i.projectBoardId === boardId && i.active !== false);
    const meds = model.ds.measurements.filter((m) => m.projectBoardId === boardId && !model.isExcluded(m));
    ctx.indicadores.total = inds.length;
    const ym = today.slice(0, 7);
    const indName = (m: (typeof meds)[number]) => S(model.indicatorsOf(m).map((i) => i.name).join(', ')) || 'sem indicador';
    const pick = meds.map((m) => {
      const why = model.isLate(m) ? 'prazo vencido sem apuração' : model.isConcluded(m) && model.goalClass(m) === 'notReached' ? 'meta não atingida' : m.prazo?.slice(0, 7) === ym ? 'medição do mês' : null;
      return { m, why };
    }).filter((r) => r.why).sort((a, b) => (a.why === 'prazo vencido sem apuração' ? 0 : a.why === 'meta não atingida' ? 1 : 2) - (b.why === 'prazo vencido sem apuração' ? 0 : b.why === 'meta não atingida' ? 1 : 2)).slice(0, 10);
    ctx.indicadores.medicoes = pick.map(({ m, why }) => ({ indicador: indName(m), medicao: S(m.name), motivo: why ?? '', prazo: T(m.prazo), periodo: T(m.periodo), meta: T(m.meta), valor: T(m.valorApurado), resultado: T(m.resultado), statusMeta: T(m.statusMeta), responsaveis: S(m.responsaveis.join(', ')) || 'nenhum' }));
    const series = inds.map((i) => ({ i, l: (model.medsOfInd.get(k(i.projectBoardId, i.itemId)) ?? []).filter((m) => model.isConcluded(m) && (m.valorApurado || m.resultado)).sort((a, b) => S(a.prazo).localeCompare(S(b.prazo))) }));
    ctx.indicadores.tendencias = series.filter((r) => r.l.length >= 2).slice(0, 8).map(({ i, l }) => ({ indicador: S(i.name), serie: l.slice(-6).map((m) => ({ prazo: T(m.prazo), valor: T(m.valorApurado), resultado: T(m.resultado) })) }));
    ctx.indicadores.semApuracao = series.filter((r) => r.l.length === 0).map((r) => {
      const all = model.medsOfInd.get(k(r.i.projectBoardId, r.i.itemId)) ?? [];
      const semResp = all.length === 0 || all.every((m) => m.responsaveis.length === 0);
      return `${S(r.i.name, 160)}${semResp ? ' (sem responsável pela coleta)' : ''}`;
    }).slice(0, 8);
  }
  return ctx;
}
