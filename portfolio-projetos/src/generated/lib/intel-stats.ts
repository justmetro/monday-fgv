import type { IndicatorDoc, MeasurementDoc } from '@generated/models';
import { isDiscarded, k, type Model } from './metrics';
import { typeKind } from './format';

/** Situação exclusiva de cada medição. */
export type Sit = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
export const SIT_LABEL: Record<Sit, string> = {
  A: 'Cancelada, despriorizada ou excluída',
  B: 'Concluída com meta alcançada',
  C: 'Concluída com meta não alcançada',
  D: 'Não concluída e atrasada',
  E: 'Pendente dentro do prazo',
  F: 'Concluída sem classificação válida de meta',
  G: 'Outra situação não avaliável',
};
export type Counts = Record<Sit, number>;
export const zero = (): Counts => ({ A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0 });

/** Exclusões primeiro; atraso recalculado na data de referência (America/Fortaleza). */
export function situation(m: Model, x: MeasurementDoc, ref: string): Sit {
  if (isDiscarded(x.statusMedicao) || m.isExcluded(x)) return 'A';
  if (m.isConcluded(x)) {
    const c = m.metaClass(x);
    return c === 'reached' ? 'B' : c === 'notReached' ? 'C' : 'F';
  }
  const d = x.prazo?.slice(0, 10);
  if (!d) return 'G';
  return d < ref ? 'D' : 'E';
}

export const rateOf = (c: Pick<Counts, 'B' | 'C' | 'D'>) => (c.B + c.C + c.D > 0 ? (c.B / (c.B + c.C + c.D)) * 100 : null);
export const rateConclOf = (c: Pick<Counts, 'B' | 'C'>) => (c.B + c.C > 0 ? (c.B / (c.B + c.C)) * 100 : null);
export const evalOf = (c: Counts) => c.B + c.C + c.D;

export type Ctx = {
  m: Model; ref: string; inPeriod: (x: MeasurementDoc) => boolean; sitBy: Map<string, Sit>;
  minMeds: number; minProj: number; projName: (id: string) => string;
};

export function medsOf(ctx: Ctx, i: IndicatorDoc) {
  return (ctx.m.medsOfInd.get(k(i.projectBoardId, i.itemId)) ?? []).filter(ctx.inPeriod);
}

export type GroupStat = {
  name: string; parent: string | null;
  indicators: number; projectIds: string[]; meds: number; counts: Counts;
  rate: number | null; rateConcl: number | null; projMean: number | null; projMeanN: number;
  topShare: { project: string; share: number } | null;
  eligible: boolean; presencePct: number | null; denom: number;
  byKind: { KR: Counts; KPI: Counts };
  examples: { ind: string; proj: string }[];
};

/** Estatística de um agrupamento: medições deduplicadas por (projectBoardId,itemId) dentro do grupo. */
export function groupStat(ctx: Ctx, name: string, parent: string | null, inds: IndicatorDoc[], denom: number, individual = false): GroupStat {
  const medKeys = new Map<string, MeasurementDoc>();
  const kindOfMed = new Map<string, 'KR' | 'KPI' | 'OUTRO'>();
  for (const i of inds) for (const x of medsOf(ctx, i)) {
    const key = k(x.projectBoardId, x.itemId);
    medKeys.set(key, x);
    if (!kindOfMed.has(key)) kindOfMed.set(key, typeKind(i.tipo));
  }
  const counts = zero();
  const byKind = { KR: zero(), KPI: zero() };
  const perProj = new Map<string, Counts>();
  for (const [key, x] of medKeys) {
    const s = ctx.sitBy.get(key) ?? 'G';
    counts[s]++;
    const kk = kindOfMed.get(key);
    if (kk === 'KR' || kk === 'KPI') byKind[kk][s]++;
    const pc = perProj.get(x.projectBoardId) ?? zero(); pc[s]++; perProj.set(x.projectBoardId, pc);
  }
  const projectIds = [...new Set(inds.map((i) => i.projectBoardId))];
  const projRates = [...perProj.values()].map(rateOf).filter((r): r is number => r !== null);
  const ev = evalOf(counts);
  let top: GroupStat['topShare'] = null;
  if (ev > 0) {
    let best = ''; let n = 0;
    perProj.forEach((c, id) => { if (evalOf(c) > n) { n = evalOf(c); best = id; } });
    top = { project: ctx.projName(best), share: (n / ev) * 100 };
  }
  return {
    name, parent, indicators: inds.length, projectIds, meds: medKeys.size, counts,
    rate: rateOf(counts), rateConcl: rateConclOf(counts),
    projMean: projRates.length ? projRates.reduce((a, b) => a + b, 0) / projRates.length : null, projMeanN: projRates.length,
    topShare: top,
    eligible: individual ? ev >= ctx.minMeds : ev >= ctx.minMeds && projectIds.length >= ctx.minProj,
    presencePct: denom > 0 ? (projectIds.length / denom) * 100 : null, denom,
    byKind,
    examples: inds.slice(0, 3).map((i) => ({ ind: i.name, proj: ctx.projName(i.projectBoardId) })),
  };
}

/** Ordena por presença em projetos, depois indicadores e medições. */
export const byPresence = (a: GroupStat, b: GroupStat) =>
  b.projectIds.length - a.projectIds.length || b.indicators - a.indicators || b.meds - a.meds;

export function ranking(list: GroupStat[], n = 5) {
  const ok = list.filter((g) => g.eligible && g.rate !== null);
  const sorted = [...ok].sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0) || evalOf(b.counts) - evalOf(a.counts));
  return { best: sorted.slice(0, n), worst: [...sorted].reverse().slice(0, n), reduced: list.filter((g) => !g.eligible && evalOf(g.counts) > 0) };
}

/** Tendência com intervalos reais entre datas e polaridade. Crescimento não é presumido como melhora. */
export function trendReal(meds: MeasurementDoc[], polaridade: string | null, parse: (s: string | null) => number | null) {
  const pts = meds
    .filter((x) => x.prazo)
    .map((x) => ({ t: Date.parse(x.prazo!.slice(0, 10)) / 86400000, v: parse(x.valorApurado) }))
    .filter((p): p is { t: number; v: number } => p.v !== null && Number.isFinite(p.t))
    .sort((a, b) => a.t - b.t);
  if (pts.length < 3) return null;
  const n = pts.length;
  const mt = pts.reduce((s, p) => s + p.t, 0) / n, mv = pts.reduce((s, p) => s + p.v, 0) / n;
  const den = pts.reduce((s, p) => s + (p.t - mt) ** 2, 0);
  if (den === 0) return null;
  const slope = pts.reduce((s, p) => s + (p.t - mt) * (p.v - mv), 0) / den;
  const span = pts[n - 1]!.t - pts[0]!.t;
  const rel = Math.abs(mv) > 1e-9 ? (slope * span) / Math.abs(mv) : slope * span;
  const dir: 'sobe' | 'cai' | 'estavel' = Math.abs(rel) < 0.05 ? 'estavel' : rel > 0 ? 'sobe' : 'cai';
  const p = (polaridade ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const up = /maior|positiv|cresc|quanto mais/.test(p), down = /menor|negativ|decresc|quanto menos/.test(p);
  const leitura = dir === 'estavel' ? 'Estável' : !up && !down ? 'Sem polaridade definida' : (dir === 'sobe') === up ? 'Melhora' : 'Piora';
  return { n, dias: Math.round(span), dir, leitura, primeiro: pts[0]!.v, ultimo: pts[n - 1]!.v };
}
