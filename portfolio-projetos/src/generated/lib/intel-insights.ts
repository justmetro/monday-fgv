import type { IndicatorClassDoc, IndicatorDoc } from '@generated/models';
import { k, type Dataset } from './metrics';
import { typeKind } from './format';
import { evalOf, medsOf, zero, rateOf, type Ctx, type GroupStat } from './intel-stats';
import type { Section } from './intel';

export type Insight = { achado: string; evidencia: string; eixo: string | null; envolvidos: string[]; limitacao: string; pergunta: string; tipo: string };
export type Alert = { tipo: string; texto: string; envolvidos: string[] };

const pct = (n: number | null) => (n === null ? 'sem base avaliável' : `${n.toFixed(1).replace('.', ',')}%`);
const base = (g: GroupStat) => `${g.counts.B}/${evalOf(g.counts)} (B/(B+C+D)), ${g.counts.D} atrasada(s), ${g.projectIds.length} projeto(s)`;

export function buildInsights(ctx: Ctx, sec: Section, axis: string | null, cls: (i: IndicatorDoc) => IndicatorClassDoc | null, ds: Dataset) {
  const eixo = axis === '__sem_eixo__' ? 'Sem eixo informado' : axis;
  const out: Insight[] = [];
  const add = (x: Omit<Insight, 'eixo'>) => out.push({ ...x, eixo });
  const lim = 'Mínimos de volume não garantem significância estatística; diferenças podem refletir metas, periodicidade e composição da carteira.';

  sec.temas.filter((t) => t.eligible && t.projectIds.length >= ctx.minProj && (t.rate ?? 100) < 60).slice(0, 3).forEach((t) => add({
    tipo: 'Tema frequente com baixo alcance', achado: `O tema "${t.name}" é frequente e tem alcance baixo.`, evidencia: `${pct(t.rate)} — ${base(t)}.`,
    envolvidos: t.examples.map((e) => `${e.ind} (${e.proj})`), limitacao: lim, pergunta: 'As metas desse tema são calibradas de forma semelhante entre os projetos?' }));

  sec.familias.filter((f) => f.eligible).forEach((f) => {
    const inds = sec.indicators.filter((i) => (cls(i)?.familia ?? '') === f.name);
    const perProj = new Map<string, ReturnType<typeof zero>>();
    inds.forEach((i) => medsOf(ctx, i).forEach((x) => { const s = ctx.sitBy.get(k(x.projectBoardId, x.itemId)) ?? 'G'; const c = perProj.get(i.projectBoardId) ?? zero(); c[s]++; perProj.set(i.projectBoardId, c); }));
    const low = [...perProj.entries()].filter(([, c]) => (rateOf(c) ?? 100) < 50);
    const good = [...perProj.entries()].filter(([, c]) => (rateOf(c) ?? 0) >= 85);
    if (low.length >= 2) add({ tipo: 'Dificuldade recorrente', achado: `A família "${f.name}" tem alcance abaixo de 50% em ${low.length} projetos.`, evidencia: `Agregado ${pct(f.rate)} — ${base(f)}.`,
      envolvidos: low.map(([id]) => ctx.projName(id)), limitacao: lim, pergunta: 'Há fatores operacionais comuns a esses projetos para essa medida?' });
    if (good.length >= ctx.minProj && (f.rate ?? 0) >= 85) add({ tipo: 'Bons resultados recorrentes', achado: `A família "${f.name}" alcança a meta de forma recorrente.`, evidencia: `${pct(f.rate)} — ${base(f)}.`,
      envolvidos: good.map(([id]) => ctx.projName(id)), limitacao: lim, pergunta: 'Que práticas desses projetos podem ser documentadas e replicadas?' });
    const ev = evalOf(f.counts);
    if (ev > 0 && f.counts.D / ev >= 0.4 && (f.rateConcl ?? 0) - (f.rate ?? 0) >= 25) add({ tipo: 'Resultado afetado por atrasos', achado: `O resultado de "${f.name}" é afetado principalmente por atrasos.`,
      evidencia: `Com atrasos: ${pct(f.rate)}; entre concluídas: ${pct(f.rateConcl)}; ${f.counts.D} de ${ev} avaliáveis estão atrasadas.`, envolvidos: f.examples.map((e) => e.proj), limitacao: 'A situação reflete os dados conhecidos na data de geração.', pergunta: 'As medições atrasadas estão pendentes de registro ou de execução?' });
    if (f.topShare && f.topShare.share >= 60 && f.projectIds.length > 1) add({ tipo: 'Concentração', achado: `As medições de "${f.name}" se concentram em um projeto.`,
      evidencia: `${f.topShare.project} concentra ${pct(f.topShare.share)} das ${ev} medições avaliáveis.`, envolvidos: [f.topShare.project], limitacao: 'A taxa agregada reflete principalmente esse projeto; compare com a média por projeto.', pergunta: 'A média simples por projeto conta uma história diferente?' });
  });

  if (sec.projectsNoInd.length) add({ tipo: 'Projetos sem indicadores', achado: `${sec.projectsNoInd.length} projeto(s) não têm indicadores no recorte.`, evidencia: `${sec.projectsNoInd.length} de ${sec.projects.length} projetos.`,
    envolvidos: sec.projectsNoInd.map((p) => p.name), limitacao: 'Inclui projetos cadastrados sem indicador elaborado.', pergunta: 'Há previsão de elaboração dos indicadores desses projetos?' });
  if (sec.gaps.semMedicoes) add({ tipo: 'Indicadores sem medições', achado: `${sec.gaps.semMedicoes} indicador(es) não têm medições vinculadas no recorte.`, evidencia: `${sec.gaps.semMedicoes} indicador(es).`, envolvidos: [], limitacao: 'Com período ativo, a ausência refere-se apenas ao recorte.', pergunta: 'As medições foram planejadas e vinculadas?' });
  if (sec.gaps.concluidasSemMeta) add({ tipo: 'Concluídas sem meta válida', achado: `${sec.gaps.concluidasSemMeta} medição(ões) concluída(s) sem classificação válida de meta.`, evidencia: `Ficam fora das taxas (situação F).`, envolvidos: [], limitacao: 'Não se presume sucesso nem fracasso.', pergunta: 'O Status da Meta foi preenchido?' });
  if (sec.gaps.semBaseDados) add({ tipo: 'Sem referência de base de dados', achado: `${sec.gaps.semBaseDados} medição(ões) concluída(s) sem referência de base de dados.`, evidencia: `${sec.gaps.semBaseDados} registros.`, envolvidos: [], limitacao: 'Afeta a rastreabilidade, não a taxa.', pergunta: 'Onde estão armazenadas as evidências dessas medições?' });

  // Possíveis redundâncias: mesmo projeto, mesma família, 2+ indicadores.
  const red = new Map<string, IndicatorDoc[]>();
  sec.indicators.forEach((i) => { const c = cls(i); if (!c) return; const kk = `${i.projectBoardId}|${c.familia}`; red.set(kk, [...(red.get(kk) ?? []), i]); });
  [...red.values()].filter((l) => l.length >= 2).slice(0, 5).forEach((l) => add({ tipo: 'Possível redundância', achado: `${l.length} indicadores da família "${cls(l[0]!)?.familia}" no mesmo projeto.`, evidencia: `Projeto ${ctx.projName(l[0]!.projectBoardId)}.`,
    envolvidos: l.map((i) => i.name), limitacao: 'Podem medir recortes distintos (público, período).', pergunta: 'Esses indicadores medem coisas diferentes ou podem ser consolidados?' }));

  // KPI alto vinculado a KR baixo.
  const rateInd = (i: IndicatorDoc) => { const c = zero(); medsOf(ctx, i).forEach((x) => c[ctx.sitBy.get(k(x.projectBoardId, x.itemId)) ?? 'G']++); return { r: rateOf(c), ev: evalOf(c), c }; };
  sec.indicators.filter((i) => typeKind(i.tipo) === 'KPI').forEach((kpi) => {
    const a = rateInd(kpi);
    if (a.r === null || a.r < 80 || a.ev < 2) return;
    kpi.krVinculadoIds.forEach((id) => {
      const kr = ds.indicators.find((x) => x.projectBoardId === kpi.projectBoardId && x.itemId === id);
      if (!kr) return;
      const b = rateInd(kr);
      if (b.r !== null && b.r < 50 && b.ev >= 2) add({ tipo: 'Divergência KPI × KR', achado: `KPI com alto alcance vinculado a KR com baixo alcance.`,
        evidencia: `KPI "${kpi.name}" ${a.c.B}/${a.ev}; KR "${kr.name}" ${b.c.B}/${b.ev}.`, envolvidos: [kpi.name, kr.name, ctx.projName(kpi.projectBoardId)],
        limitacao: 'Períodos e defasagens entre KPI e KR podem explicar a diferença; não há relação causal estabelecida.', pergunta: 'O KPI mede de fato um avanço que contribui para o KR?' });
    });
  });

  // Alertas explicáveis.
  const alerts: Alert[] = [];
  const in30 = new Date(Date.parse(ctx.ref) + 30 * 86400000).toISOString().slice(0, 10);
  sec.indicators.forEach((i) => {
    const ms = medsOf(ctx, i).filter((x) => x.prazo).sort((p, q) => (p.prazo ?? '').localeCompare(q.prazo ?? ''));
    const sits = ms.map((x) => ctx.sitBy.get(k(x.projectBoardId, x.itemId)) ?? 'G').filter((s) => s === 'B' || s === 'C' || s === 'D');
    const last2 = sits.slice(-2);
    if (last2.length === 2 && last2.every((s) => s !== 'B')) alerts.push({ tipo: 'Repetição de metas não alcançadas', texto: `"${i.name}" — últimas 2 medições avaliáveis sem alcance.`, envolvidos: [ctx.projName(i.projectBoardId)] });
    const r = rateInd(i);
    const next = ms.find((x) => ctx.sitBy.get(k(x.projectBoardId, x.itemId)) === 'E' && (x.prazo ?? '') <= in30);
    if (next && r.r !== null && r.r < 50) alerts.push({ tipo: 'Próxima medição com dificuldade anterior', texto: `"${i.name}" tem medição em ${next.prazo?.slice(0, 10)} e alcance anterior de ${r.c.B}/${r.ev}.`, envolvidos: [ctx.projName(i.projectBoardId)] });
  });
  sec.projects.forEach((p) => {
    const late = ds.measurements.filter((x) => x.projectBoardId === p.boardId && ctx.inPeriod(x) && ctx.sitBy.get(k(x.projectBoardId, x.itemId)) === 'D').length;
    if (late >= 3) alerts.push({ tipo: 'Acúmulo de medições atrasadas', texto: `${late} medições atualmente atrasadas.`, envolvidos: [p.name] });
  });
  return { insights: out, alerts };
}
