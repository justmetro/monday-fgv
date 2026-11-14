import type { WeekSummary, PersonWeek } from './engagementMetrics';
import type { TrendPoint } from '../components/charts/WeeklyTrendChart';

const d2 = (n: number) => String(n).padStart(2, '0');
export const brFromDate = (d: Date) => `${d2(d.getDate())}/${d2(d.getMonth() + 1)}/${d.getFullYear()}`;
export const brFromIso = (iso: string) => iso.split('-').reverse().join('/');
export const projectCode = (name: string) => name.match(/(\d{4}\/\d{3})/)?.[1] ?? '';

/** Semanas em ordem cronológica, sem repetir o mesmo grupo. */
function chronological(weeks: WeekSummary[]): WeekSummary[] {
  const seen = new Set<string>();
  return [...weeks]
    .sort((a, b) => a.windowStart.getTime() - b.windowStart.getTime())
    .filter((w) => (seen.has(w.groupName) ? false : (seen.add(w.groupName), true)));
}

function withRunningAverage(points: Omit<TrendPoint, 'line'>[]): TrendPoint[] {
  let sum = 0, n = 0;
  return points.map((p) => {
    if (p.bar !== null) { sum += p.bar; n++; }
    return { ...p, line: n ? Math.round(sum / n) : null };
  });
}

/** % da equipe engajada por semana (barras) e média acumulada (linha). */
export function engagementSeries(weeks: WeekSummary[], filter?: (p: PersonWeek) => boolean): TrendPoint[] {
  return withRunningAverage(
    chronological(weeks).map((w) => {
      let rate: number | null = w.rate;
      if (filter) {
        const ppl = w.people.filter((p) => filter(p) && !p.activeAbsence);
        rate = ppl.length ? Math.round((ppl.filter((p) => p.engaged).length / ppl.length) * 100) : null;
      }
      return { label: w.groupName || w.label, range: `${brFromDate(w.windowStart)} a ${brFromDate(w.windowEnd)}`, bar: rate };
    })
  );
}
