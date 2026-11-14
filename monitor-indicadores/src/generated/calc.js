import { isHit, cellState, stateOf, score, fmtNum, noCase } from '@generated/lib';

const r1 = (x) => Math.round(x * 10) / 10;

/** saldo indicators: numerator / denominator in R$ (IT1.3, IT1.4, unit in R$, or R$-sized totals) */
export const isSaldoInd = (i) => ['IT1.3', 'IT1.4'].includes(i.code) || /R\$|reais/i.test(i.unidade ?? '')
  || (!['IT1.1', 'IT1.2'].includes(i.code) && i.meds.some((m) => (m.d ?? 0) >= 1000));

/** Σ Atingido ÷ Σ Total of the given measurements (only the ones with cases) */
function sumUp(list, ind, extra) {
  const v = list.filter((m) => !noCase(m));
  const meta = (v.length ? v : list)[(v.length ? v : list).length - 1].meta;
  const base = { meta, saldo: !!ind.saldo, months: (v.length ? v : list).map((m) => m.period.month), qtd: v.length, ...extra };
  if (!v.length) return { ...base, n: 0, d: 0, apurado: null, state: extra.parcial ? 'parcial' : 'nocase' };
  const n = v.reduce((s, m) => s + (m.n ?? 0), 0), d = v.reduce((s, m) => s + m.d, 0);
  const apurado = r1((n / d) * 100);
  return { ...base, n, d, apurado, state: extra.parcial ? 'parcial' : stateOf(apurado, meta, ind.lower) };
}

/**
 * Result of a bucket — measurements of the MEDIÇÃO view only.
 * One month → that measurement (partial shown gray with its badge).
 * Several months → closed months only (Concluído / Retroativo): Σ Atingido Período ÷ Σ Total Período.
 */
export function consolidate(ind, year, months) {
  const ms = ind.meds.filter((m) => m.period.year === year && months.includes(m.period.month));
  if (!ms.length) return null;
  if (months.length === 1) return { ...ms[0], single: true, months: [ms[0].period.month], state: cellState(ms[0], ind.lower) };
  const closed = ms.filter((m) => !m.parcial);
  return closed.length ? sumUp(closed, ind, { parcial: false }) : sumUp(ms, ind, { parcial: true });
}

/** closed measurements with cases up to `upTo` — trend, alerts, streaks, footer */
export const closedMeds = (ind, year, upTo = 11) => ind.meds.filter((m) => m.period.year === year && !m.parcial && !noCase(m) && m.period.month <= upTo);

/** last closed month (no partial) of the year; fallback any measurement; fallback current month */
export function lastMonth(ind, year) {
  const closed = ind.flatMap((i) => i.meds.filter((m) => m.period.year === year && !m.parcial).map((m) => m.period.month));
  if (closed.length) return Math.max(...closed);
  const any = ind.flatMap((i) => i.meds.filter((m) => m.period.year === year).map((m) => m.period.month));
  return any.length ? Math.max(...any) : new Date().getMonth();
}

/** variation vs previous closed measurement (p.p.) for the closed measurement at `month` (or latest) */
export function trend(ind, year, month) {
  const v = closedMeds(ind, year);
  const idx = month == null ? v.length - 1 : v.findIndex((m) => m.period.month === month);
  if (idx < 1) return null;
  const cur = v[idx], prev = v[idx - 1];
  const delta = r1(cur.apurado - prev.apurado);
  return { delta, cur, prev, better: ind.lower ? delta < 0 : delta > 0 };
}
export const fmtDelta = (t) => (t ? `${t.delta > 0 ? '▲' : t.delta < 0 ? '▼' : '='} ${t.delta > 0 ? '+' : t.delta < 0 ? '−' : ''}${fmtNum(Math.abs(t.delta))} p.p.` : '');

/** trailing closed measurements below goal, up to `month` */
export function streak(ind, year, month = 11) {
  const v = closedMeds(ind, year, month);
  let s = 0;
  for (let i = v.length - 1; i >= 0 && v[i].meta != null && !isHit(v[i].apurado, v[i].meta, ind.lower); i--) s++;
  return s;
}

export function alerts(ind, year, upTo = 11) {
  const out = [];
  ind.forEach((i) => {
    const s = streak(i, year, upTo);
    if (s >= 3) out.push({ w: 100 + s, text: `${i.code} abaixo da meta há ${s} meses seguidos` });
    const v = closedMeds(i, year, upTo), last = v[v.length - 1];
    if (last && last.meta != null && !isHit(last.apurado, last.meta, i.lower)) {
      const gap = Math.abs(score(last.apurado, last.meta, i.lower));
      out.push({ w: gap, text: `${i.code} em ${last.period.label}: ${fmtNum(gap)} p.p. ${i.lower ? 'acima' : 'abaixo'} da meta` });
    }
    const t = last && trend(i, year, last.period.month);
    if (t && !t.better && Math.abs(t.delta) >= 10) out.push({ w: Math.abs(t.delta) / 2, text: `${i.code} caiu ${fmtNum(Math.abs(t.delta))} p.p. vs. medição anterior` });
  });
  return out.sort((a, b) => b.w - a.w).slice(0, 3);
}

/** 02.01 projects are listed in the side panel for consultation only (IT1.x) — they never change a number */
export const hasProjects = (code) => /^IT1\./i.test(code);
export const projYear = (p) => { const d = p.concPlan ?? p.assin ?? p.inicio; return d ? d.getUTCFullYear() : null; };
export const projectsOf = (projects, year, months) => projects.filter((p) => months.includes(p.mes) && projYear(p) === year);
