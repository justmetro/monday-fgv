import type { Report, Section } from '@generated/lib/intel';
import { evalOf, SIT_LABEL, type GroupStat, type Sit } from '@generated/lib/intel-stats';
import type { Insight } from '@generated/lib/intel-insights';
import { cellText } from './Matrix';
import { fdate, fp } from './report-parts';
import { METHOD, NOTES } from './report-text';

type Node = Record<string, unknown> | string;
const C = { ink: '#1f2a37', muted: '#6b7280', line: '#d8dde4', ok: '#1f8a5b', bad: '#c2410c', bar: '#3b6fb6', head: '#eef1f5' };
const h1 = (t: string, brk = true): Node => ({ text: t, style: 'h1', pageBreak: brk ? 'before' : undefined });
const h2 = (t: string): Node => ({ text: t, style: 'h2' });
const p = (t: string, style = 'body'): Node => ({ text: t, style });

function table(headers: string[], rows: string[][], widths?: (string | number)[]): Node {
  return {
    table: { headerRows: 1, dontBreakRows: true, widths: widths ?? headers.map((_, i) => (i === 0 ? '*' : 'auto')), body: [headers.map((h) => ({ text: h, style: 'th' })), ...rows.map((r) => r.map((c) => ({ text: c, style: 'td' })))] },
    layout: { hLineColor: () => C.line, vLineColor: () => C.line, fillColor: (i: number) => (i === 0 ? C.head : null), paddingTop: () => 3, paddingBottom: () => 3 },
    margin: [0, 4, 0, 10],
  };
}
const groupRows = (gs: GroupStat[]) => gs.map((g) => [
  g.parent ? `${g.name}\n(${g.parent})` : g.name, `${g.projectIds.length} (${fp(g.presencePct)} de ${g.denom})`, String(g.indicators), String(g.meds),
  String(evalOf(g.counts)), String(g.counts.B), String(g.counts.C), String(g.counts.D), fp(g.rate), fp(g.rateConcl), fp(g.projMean),
  g.eligible ? 'Destaque' : evalOf(g.counts) === 0 ? 'Sem base' : 'Base reduzida',
]);
const GH = ['Agrupamento', 'Projetos', 'Ind.', 'Med.', 'Aval.', 'B', 'C', 'D (atras.)', 'Taxa c/ atrasos', 'Entre concl.', 'Média proj.', 'Base'];

/** Gráfico vetorial de barras horizontais (taxa com atrasos). */
function bars(gs: GroupStat[], title: string): Node[] {
  const list = gs.filter((g) => g.rate !== null).slice(0, 10);
  if (!list.length) return [];
  const W = 300, rowH = 16;
  return [p(title, 'small'), {
    columns: [
      { width: 200, stack: list.map((g) => ({ text: g.name, fontSize: 7, margin: [0, 3, 0, 3.4], noWrap: true })) },
      { width: W + 10, canvas: list.flatMap((g, i) => [
        { type: 'rect', x: 0, y: i * rowH + 3, w: W, h: 10, color: '#eef1f5' },
        { type: 'rect', x: 0, y: i * rowH + 3, w: Math.max(1, (W * (g.rate ?? 0)) / 100), h: 10, color: C.bar },
      ]) },
      { width: '*', stack: list.map((g) => ({ text: `${fp(g.rate)} · ${g.counts.B}/${evalOf(g.counts)} · ${g.counts.D} atr.`, fontSize: 7, margin: [0, 3, 0, 3.4] })) },
    ], margin: [0, 2, 0, 10],
  }];
}
const insightNodes = (xs: Insight[]): Node[] => (xs.length ? xs.map((x) => ({
  stack: [
    { text: `${x.tipo}${x.eixo ? ` · ${x.eixo}` : ''}`, fontSize: 7, color: C.muted },
    { text: x.achado, bold: true, fontSize: 9 }, { text: `Evidência: ${x.evidencia}`, fontSize: 8 },
    ...(x.envolvidos.length ? [{ text: `Envolvidos: ${x.envolvidos.slice(0, 8).join('; ')}`, fontSize: 7.5, color: C.muted }] : []),
    { text: `Limitação: ${x.limitacao}`, fontSize: 7.5, color: C.muted }, { text: `Investigação: ${x.pergunta}`, fontSize: 8, color: C.bar },
  ], margin: [0, 0, 0, 7], unbreakable: true,
})) : [p('Nenhum achado atende aos critérios no recorte.', 'small')]);

function section(s: Section, axis: boolean): Node[] {
  const c = s.total.counts;
  const rk = (t: string, gs: GroupStat[]) => [h2(t), gs.length ? table(['Agrupamento', 'Taxa c/ atrasos', 'B / (B+C+D)', 'Atrasadas', 'Projetos'], gs.map((g) => [g.parent ? `${g.name} (${g.parent})` : g.name, fp(g.rate), `${g.counts.B}/${evalOf(g.counts)}`, String(g.counts.D), String(g.projectIds.length)])) : p('Nenhum agrupamento atinge os mínimos.', 'small')];
  return [
    table(['Projetos', 'Sem indicadores', 'Indicadores', 'Medições', 'Avaliáveis', 'B', 'C', 'D', 'Taxa c/ atrasos', 'Entre concluídas', 'Média proj.'],
      [[String(s.projects.length), String(s.projectsNoInd.length), String(s.indicators.length), String(s.total.meds), String(evalOf(c)), String(c.B), String(c.C), String(c.D), fp(s.total.rate), fp(s.total.rateConcl), fp(s.total.projMean)]], Array(11).fill('*')),
    ...(axis ? [p(`Denominador da presença: ${s.projects.length} projeto(s) do eixo, incluindo ${s.projectsNoInd.length} sem indicadores.`, 'small')] : []),
    p('Resultados abaixo da meta (C) e atrasos (D) são apresentados separadamente; ambos entram como não alcançados na taxa principal.', 'small'),
    h2('Temas'), table(GH, groupRows(s.temas.slice(0, 15))),
    h2('Famílias de indicadores'), ...bars(s.familias.filter((f) => f.eligible), 'Taxa de alcance considerando atrasos — famílias em destaque'),
    table(GH, groupRows(s.familias.slice(0, 30))),
    ...rk('Famílias — maiores taxas', s.rk.familias.best), ...rk('Famílias — menores taxas', s.rk.familias.worst),
    ...rk('Indicadores — melhores resultados', s.rk.inds.best), ...rk('Indicadores — piores resultados', s.rk.inds.worst),
    h2('Lacunas de informação'),
    table(['Lacuna', 'Quantidade'], [['Medições sem vínculo resolvido', String(s.gaps.semVinculo)], ['Indicadores não classificados', String(s.gaps.naoClassificados)], ['Indicadores sem medições', String(s.gaps.semMedicoes)], ['Concluídas sem meta válida (F)', String(s.gaps.concluidasSemMeta)], ['Concluídas sem base de dados', String(s.gaps.semBaseDados)]], ['*', 80]),
    h2('Insights'), ...insightNodes(s.insights),
    h2('Alertas'), ...(s.alerts.length ? s.alerts.slice(0, 25).map((a) => p(`${a.tipo}: ${a.texto} (${a.envolvidos.join('; ')})`, 'small')) : [p('Sem alertas.', 'small')]),
  ];
}

export async function downloadPdf(r: Report, summary: string[] | null) {
  const [{ default: pdfMake }, { default: fonts }] = await Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')]);
  const vfs = fonts?.pdfMake?.vfs ?? fonts?.vfs ?? fonts;
  if (pdfMake.addVirtualFileSystem) pdfMake.addVirtualFileSystem(vfs); else pdfMake.vfs = vfs;
  const o = r.overall;
  const recorte = [
    `Recorte: ${o.label}${r.cfg.axes.length ? ' (filtro de eixo ativo — não necessariamente a carteira completa)' : ''}`,
    `Projetos: ${r.cfg.projects.length ? `${r.cfg.projects.length} selecionados` : 'todos os habilitados'} · Eixos: ${r.cfg.axes.length ? r.axes.map((a) => a.label).join(', ') : 'todos'} · Tipo: ${r.cfg.tipo === 'all' ? 'todos' : r.cfg.tipo}`,
    `Prazo de Medição: ${r.periodOn ? `${r.cfg.from ? fdate(r.cfg.from) : 'início'} a ${r.cfg.to ? fdate(r.cfg.to) : 'fim'}` : 'sem filtro de período'} · Mínimos: ${r.cfg.minMeds} medições avaliáveis / ${r.cfg.minProj} projetos`,
    `Data de referência: ${fdate(r.ref)} (America/Fortaleza) · Gerado em ${new Date(r.generatedAt).toLocaleString('pt-BR')} · Taxonomia v${r.versao}`,
    `Dados importados atualizados entre ${fdate(r.dataUpdated.min)} e ${fdate(r.dataUpdated.max)} · Cadastro dos projetos (Histórico) entre ${fdate(r.metaUpdated.min)} e ${fdate(r.metaUpdated.max)}`,
  ];
  const content: Node[] = [
    { text: 'Relatório de inteligência dos indicadores', style: 'title', margin: [0, 160, 0, 8] },
    p('Painel de Projetos DGPE · Superintendência de Projetos — FGV DGPE', 'sub'),
    ...recorte.map((t) => p(t, 'small')),
    p('Medições atrasadas contam como metas não alcançadas na taxa principal e são apresentadas separadamente.', 'small'),
    h1('Resumo executivo'),
    ...(summary?.length ? [...summary.map((t) => p(t)), p('Texto interpretativo gerado por IA a partir dos números calculados abaixo.', 'small')] : []),
    table(['Situação', 'Medições'], (Object.keys(SIT_LABEL) as Sit[]).map((s) => [`${s} — ${SIT_LABEL[s]}`, String(r.sitTotals[s])]), ['*', 70]),
    p('Medições vinculadas a famílias diferentes aparecem em cada uma, mas uma única vez no total geral.', 'small'),
    ...insightNodes(o.insights.slice(0, 6)),
    h1('Mapa temático geral da carteira'), ...section(o, false),
    h1('Comparação entre eixos'), p(NOTES.multi, 'small'), p(NOTES.causal, 'small'),
  ];
  if (r.axes.length) {
    const chunk = 5;
    for (let a = 0; a < r.axes.length; a += chunk) {
      const ax = r.axes.slice(a, a + chunk);
      for (const mt of ['pct', 'rate'] as const) {
        content.push(h2(`Famílias × Eixos — ${mt === 'pct' ? '% de projetos do eixo com a família' : 'taxa de alcance considerando atrasos'}${r.axes.length > chunk ? ` (eixos ${a + 1}–${a + ax.length})` : ''}`));
        content.push(table(['Família', ...ax.map((x) => `${x.label} (${x.sec.projects.length} proj.)`)], r.matrix.slice(0, 40).map((row) => [row.familia, ...row.cells.slice(a, a + chunk).map((c) => { const t = cellText(c, mt); return `${t.v}\n${t.base}`; })])));
      }
    }
    content.push(p('“Ausente” = sem indicador no recorte do eixo · “Sem base” = presente sem medições avaliáveis · “base reduzida” = abaixo dos mínimos · 0% = resultado igual a zero.', 'small'));
    if (r.shared.length) content.push(h2('Projetos compartilhados entre eixos'), table(['Eixos', 'Projetos em comum'], r.shared.map((s) => [`${s.a} × ${s.b}`, String(s.n)]), ['*', 90]));
    if (r.comparisons.length) content.push(h2('Padrões entre eixos'), table(['Padrão', 'Família', 'Base'], r.comparisons.slice(0, 50).map((c) => [c.kind, c.familia, c.detail]), [110, 110, '*']));
  }
  r.axes.forEach((a) => content.push(h1(`Eixo: ${a.label}`), p(NOTES.inherit, 'small'), ...section(a.sec, true)));
  if (r.noAxisProjects.length) content.push(h2('Projetos sem eixo informado'), table(['Projeto', 'Motivo'], r.noAxisProjects.map((x) => [x.name, x.reason])));
  content.push(h1('Tendências do mesmo indicador'), p('Medições concluídas com valor numérico (mín. 3), com intervalos reais entre datas e polaridade. Sem probabilidades preditivas.', 'small'),
    r.trends.length ? table(['Indicador', 'Projeto', 'Pontos', 'Dias', 'Primeiro → último', 'Leitura'], r.trends.slice(0, 60).map((t) => [t.ind, t.proj, String(t.n), String(t.dias), `${t.primeiro.toLocaleString('pt-BR')} → ${t.ultimo.toLocaleString('pt-BR')}`, t.leitura])) : p('Sem séries comparáveis.', 'small'));
  content.push(h1('Qualidade dos dados, metodologia e limitações'), { ul: METHOD.map((m) => ({ text: m, fontSize: 8.5, margin: [0, 0, 0, 3] })) });
  content.push(h1('Apêndice — indicadores, projetos, eixos e classificações'),
    table(['Indicador', 'Tipo', 'Projeto', 'Eixos', 'Tema › Subtema › Família', 'Classificação', 'Resultado consolidado (original)'],
      r.appendix.map((x) => [x.ind, x.tipo ?? '—', x.proj, x.eixos.join(', ') || '—', `${x.tema} › ${x.subtema} › ${x.familia}`, `${x.origem ?? '—'}${x.revisado ? ' · revisada' : ''}`, `${x.resultadoConsolidado ?? '—'}${x.unidade ? ` ${x.unidade}` : ''}`]),
      ['*', 40, 90, 70, 120, 55, 70]));

  const doc = {
    pageSize: 'A4', pageOrientation: 'landscape', pageMargins: [36, 40, 36, 40], content,
    defaultStyle: { fontSize: 9, color: C.ink },
    styles: {
      title: { fontSize: 26, bold: true }, sub: { fontSize: 12, color: C.muted, margin: [0, 0, 0, 24] },
      h1: { fontSize: 16, bold: true, margin: [0, 0, 0, 8] }, h2: { fontSize: 11, bold: true, margin: [0, 8, 0, 4] },
      body: { fontSize: 9.5, margin: [0, 0, 0, 6], lineHeight: 1.25 }, small: { fontSize: 8, color: C.muted, margin: [0, 0, 0, 4] },
      th: { fontSize: 7.5, bold: true }, td: { fontSize: 7.5 },
    },
    footer: (cur: number, total: number) => ({ columns: [{ text: `Relatório de inteligência · referência ${fdate(r.ref)} · taxonomia v${r.versao}`, fontSize: 7, color: C.muted }, { text: `${cur} / ${total}`, alignment: 'right', fontSize: 7, color: C.muted }], margin: [36, 10, 36, 0] }),
    info: { title: 'Relatório de inteligência dos indicadores' },
  };
  pdfMake.createPdf(doc).download(`relatorio-inteligencia-${r.ref}.pdf`);
}
