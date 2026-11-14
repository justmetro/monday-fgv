import type { IndicatorClassDoc, IndicatorDoc, MeasurementDoc, ProjectDoc } from '@generated/models';
import { buildModel, k, type Dataset } from './metrics';
import { typeKind } from './format';
import { parseNum } from './trend';
import { byPresence, evalOf, groupStat, medsOf, ranking, situation, trendReal, zero, rateOf, rateConclOf, type Ctx, type GroupStat, type Sit } from './intel-stats';
import { buildInsights, type Insight, type Alert } from './intel-insights';

export const NO_AXIS = '__sem_eixo__';
export const UNCLASSIFIED = 'Não classificado';
export type IntelConfig = { projects: string[]; axes: string[]; from: string; to: string; tipo: 'all' | 'KR' | 'KPI'; minMeds: number; minProj: number };
export const DEFAULT_CFG: IntelConfig = { projects: [], axes: [], from: '', to: '', tipo: 'all', minMeds: 5, minProj: 3 };

export function axesOf(p: ProjectDoc): string[] { return p.hLink === 'confirmed' ? p.hAxes ?? [] : []; }
export function noAxisReason(p: ProjectDoc): string {
  if (p.hLink !== 'confirmed') return 'Sem vínculo com o Histórico';
  if (p.hAxesState === 'unavailable' || (p.hLastOk === false && !(p.hAxes ?? []).length)) return 'Eixo indisponível por falha de leitura';
  if (p.hAxesState === 'unmapped') return 'Coluna de eixo não mapeada';
  return 'Vinculado com eixo vazio';
}

export type Section = {
  label: string; projects: ProjectDoc[]; projectsNoInd: ProjectDoc[];
  indicators: IndicatorDoc[]; total: GroupStat;
  temas: GroupStat[]; subtemas: GroupStat[]; familias: GroupStat[]; inds: GroupStat[];
  rk: { temas: ReturnType<typeof ranking>; familias: ReturnType<typeof ranking>; inds: ReturnType<typeof ranking> };
  gaps: { semVinculo: number; naoClassificados: number; semMedicoes: number; concluidasSemMeta: number; semBaseDados: number };
  insights: Insight[]; alerts: Alert[];
};
export type Cell = { indicators: number; projects: number; pct: number | null; meds: number; ev: number; rate: number | null; B: number; C: number; D: number; denom: number; state: 'absent' | 'nobase' | 'reduced' | 'ok' };

export type Report = ReturnType<typeof buildReport>;

export function buildReport(ds: Dataset, classes: IndicatorClassDoc[], cfg: IntelConfig, ref: string, versao: number) {
  const m = buildModel(ds);
  const clsBy = new Map(classes.map((c) => [c.key, c]));
  const periodOn = !!(cfg.from || cfg.to);
  const inPeriod = (x: MeasurementDoc) => {
    if (!periodOn) return true;
    const d = x.prazo?.slice(0, 10);
    return !!d && (!cfg.from || d >= cfg.from) && (!cfg.to || d <= cfg.to);
  };
  const sitBy = new Map<string, Sit>(ds.measurements.map((x) => [k(x.projectBoardId, x.itemId), situation(m, x, ref)]));
  const projName = (id: string) => m.projectBy.get(id)?.name ?? id;
  const ctx: Ctx = { m, ref, inPeriod, sitBy, minMeds: cfg.minMeds, minProj: cfg.minProj, projName };

  const projOk = (p: ProjectDoc) => {
    if (cfg.projects.length && !cfg.projects.includes(p.boardId)) return false;
    if (!cfg.axes.length) return true;
    const ax = axesOf(p);
    return ax.some((a) => cfg.axes.includes(a)) || (ax.length === 0 && cfg.axes.includes(NO_AXIS));
  };
  const scoped = ds.projects.filter(projOk);
  const scopedIds = new Set(scoped.map((p) => p.boardId));
  const kindOk = (i: IndicatorDoc) => cfg.tipo === 'all' || typeKind(i.tipo) === cfg.tipo;
  const allInds = ds.indicators.filter((i) => scopedIds.has(i.projectBoardId) && kindOk(i));
  const inds = periodOn ? allInds.filter((i) => medsOf(ctx, i).length > 0) : allInds;
  const cls = (i: IndicatorDoc) => clsBy.get(k(i.projectBoardId, i.itemId)) ?? null;

  const section = (label: string, projs: ProjectDoc[], axis: string | null): Section => {
    const ids = new Set(projs.map((p) => p.boardId));
    const si = inds.filter((i) => ids.has(i.projectBoardId));
    const denom = projs.length;
    const groupBy = (key: (i: IndicatorDoc) => string, parent: (i: IndicatorDoc) => string | null) => {
      const g = new Map<string, IndicatorDoc[]>();
      si.forEach((i) => { const kk = key(i); g.set(kk, [...(g.get(kk) ?? []), i]); });
      return [...g.entries()].map(([n, list]) => groupStat(ctx, n, parent(list[0]!), list, denom)).sort(byPresence);
    };
    const temas = groupBy((i) => cls(i)?.tema ?? UNCLASSIFIED, () => null);
    const subtemas = groupBy((i) => { const c = cls(i); return c ? `${c.tema} › ${c.subtema}` : UNCLASSIFIED; }, (i) => cls(i)?.tema ?? null);
    const familias = groupBy((i) => cls(i)?.familia ?? UNCLASSIFIED, (i) => { const c = cls(i); return c ? `${c.tema} › ${c.subtema}` : null; });
    const indStats = si.map((i) => groupStat(ctx, i.name, projName(i.projectBoardId), [i], denom, true));
    const total = groupStat(ctx, label, null, si, denom);
    const medsScoped = ds.measurements.filter((x) => ids.has(x.projectBoardId) && inPeriod(x));
    const semVinculo = medsScoped.filter((x) => m.indicatorsOf(x).length === 0).length;
    const concl = medsScoped.filter((x) => sitBy.get(k(x.projectBoardId, x.itemId)) && ['B', 'C', 'F'].includes(sitBy.get(k(x.projectBoardId, x.itemId))!));
    const sec: Section = {
      label, projects: projs,
      projectsNoInd: projs.filter((p) => !allInds.some((i) => i.projectBoardId === p.boardId)),
      indicators: si, total, temas, subtemas, familias, inds: indStats,
      rk: { temas: ranking(temas.filter((t) => t.name !== UNCLASSIFIED)), familias: ranking(familias.filter((t) => t.name !== UNCLASSIFIED)), inds: ranking(indStats) },
      gaps: {
        semVinculo, naoClassificados: si.filter((i) => !cls(i)).length,
        semMedicoes: allInds.filter((i) => ids.has(i.projectBoardId) && medsOf(ctx, i).length === 0).length,
        concluidasSemMeta: concl.filter((x) => sitBy.get(k(x.projectBoardId, x.itemId)) === 'F').length,
        semBaseDados: concl.filter((x) => x.baseDadosUrls.length === 0 && !x.baseDadosText).length,
      },
      insights: [], alerts: [],
    };
    const r = buildInsights(ctx, sec, axis, cls, ds);
    sec.insights = r.insights; sec.alerts = r.alerts;
    return sec;
  };

  const overall = section(cfg.axes.length ? 'Carteira selecionada' : 'Carteira completa', scoped, null);
  const axisNames = cfg.axes.length ? cfg.axes : [...new Set(scoped.flatMap(axesOf))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const hasNoAxis = scoped.some((p) => axesOf(p).length === 0);
  const axisList = [...axisNames.filter((a) => a !== NO_AXIS), ...(hasNoAxis && (!cfg.axes.length || cfg.axes.includes(NO_AXIS)) ? [NO_AXIS] : [])];
  const axisProjects = (a: string) => scoped.filter((p) => (a === NO_AXIS ? axesOf(p).length === 0 : axesOf(p).includes(a)));
  const axes = axisList.map((a) => ({ axis: a, label: a === NO_AXIS ? 'Sem eixo informado' : a, sec: section(a === NO_AXIS ? 'Sem eixo informado' : a, axisProjects(a), a) }));

  // Matriz família × eixo (mesma taxonomia em todos os eixos).
  const famNames = overall.familias.map((f) => f.name);
  const matrix = famNames.map((f) => ({
    familia: f,
    cells: axes.map(({ sec }) => {
      const g = sec.familias.find((x) => x.name === f);
      const denom = sec.projects.length;
      if (!g) return { indicators: 0, projects: 0, pct: denom ? 0 : null, meds: 0, ev: 0, rate: null, B: 0, C: 0, D: 0, denom, state: 'absent' } as Cell;
      const ev = evalOf(g.counts);
      return { indicators: g.indicators, projects: g.projectIds.length, pct: g.presencePct, meds: g.meds, ev, rate: g.rate, B: g.counts.B, C: g.counts.C, D: g.counts.D, denom, state: ev === 0 ? 'nobase' : g.eligible ? 'ok' : 'reduced' } as Cell;
    }),
  }));
  const shared = axes.flatMap((a, i) => axes.slice(i + 1).map((b) => {
    const s = a.sec.projects.filter((p) => b.sec.projects.some((q) => q.boardId === p.boardId));
    return { a: a.label, b: b.label, n: s.length, names: s.map((p) => p.name) };
  })).filter((x) => x.n > 0);

  // Comparações entre eixos (somente bases elegíveis).
  const comparisons: { kind: string; familia: string; detail: string }[] = [];
  matrix.forEach((row) => {
    if (row.familia === UNCLASSIFIED) return;
    const present = row.cells.map((c, i) => ({ c, ax: axes[i]!.label })).filter((x) => x.c.state !== 'absent');
    const okc = present.filter((x) => x.c.state === 'ok' && x.c.rate !== null);
    if (present.length >= 2) comparisons.push({ kind: 'Recorrente em vários eixos', familia: row.familia, detail: `Presente em ${present.length} eixos: ${present.map((x) => x.ax).join(', ')}.` });
    if (present.length === 1 && axes.length > 1) comparisons.push({ kind: 'Concentrada em um eixo', familia: row.familia, detail: `Aparece apenas em ${present[0]!.ax} (${present[0]!.c.projects} projeto(s)).` });
    const low = okc.filter((x) => (x.c.rate ?? 100) < 60);
    if (low.length >= 2) comparisons.push({ kind: 'Baixo alcance em vários eixos', familia: row.familia, detail: low.map((x) => `${x.ax}: ${x.c.B}/${x.c.ev}`).join(' · ') });
    if (okc.length >= 2) {
      const s = [...okc].sort((p, q) => (q.c.rate ?? 0) - (p.c.rate ?? 0));
      const hi = s[0]!, lo = s[s.length - 1]!;
      const diff = (hi.c.rate ?? 0) - (lo.c.rate ?? 0);
      if (diff >= 25) {
        const rc = (c: Cell) => rateConclOf({ B: c.B, C: c.C }) ?? 0;
        const delay = Math.abs(rc(hi.c) - rc(lo.c)) < 10;
        comparisons.push({ kind: delay ? 'Diferença associada principalmente a atrasos' : 'Diferença de desempenho entre eixos', familia: row.familia,
          detail: `${hi.ax} ${hi.c.B}/${hi.c.ev} (atrasos ${hi.c.D}) vs ${lo.ax} ${lo.c.B}/${lo.c.ev} (atrasos ${lo.c.D}); diferença de ${diff.toFixed(0)} p.p.${delay ? ' Entre concluídas a diferença é menor que 10 p.p.' : ''}` });
      }
    }
  });

  // Tendências do mesmo indicador (datas reais e polaridade).
  const trends = overall.indicators.map((i) => {
    const t = trendReal(medsOf(ctx, i).filter((x) => m.isConcluded(x)), i.polaridade, parseNum);
    return t ? { ind: i.name, proj: projName(i.projectBoardId), unidade: i.unidade, ...t } : null;
  }).filter((x): x is NonNullable<typeof x> => !!x);

  const appendix = overall.indicators.map((i) => {
    const c = cls(i);
    const p = m.projectBy.get(i.projectBoardId);
    return {
      key: k(i.projectBoardId, i.itemId), ind: i.name, tipo: i.tipo, proj: projName(i.projectBoardId),
      eixos: p ? axesOf(p) : [], tema: c?.tema ?? UNCLASSIFIED, subtema: c?.subtema ?? '—', familia: c?.familia ?? '—',
      origem: c?.origem ?? null, revisado: !!c?.revisado, resultadoConsolidado: i.resultadoConsolidado, unidade: i.unidade,
    };
  });
  const metaDates = scoped.map((p) => p.hLastSuccessAt).filter((x): x is string => !!x).sort();
  const dataDates = scoped.map((p) => p.lastSuccessAt).filter((x): x is string => !!x).sort();
  return {
    cfg, ref, versao, generatedAt: new Date().toISOString(), periodOn,
    dataUpdated: { min: dataDates[0] ?? null, max: dataDates[dataDates.length - 1] ?? null },
    metaUpdated: { min: metaDates[0] ?? null, max: metaDates[metaDates.length - 1] ?? null },
    noAxisProjects: scoped.filter((p) => axesOf(p).length === 0).map((p) => ({ name: p.name, reason: noAxisReason(p) })),
    overall, axes, matrix, shared, comparisons, trends, appendix,
    sitTotals: overall.total.counts,
  };
}

export { zero, rateOf, evalOf };
