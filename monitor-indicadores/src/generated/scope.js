import { MESES } from '@generated/lib';

/** single period filter: granularity + period inside it + base year */
export const GRANS = [['m', 'Mensal'], ['q', 'Trimestral'], ['s', 'Semestral'], ['y', 'Anual']];
const SIZE = { m: 1, q: 3, s: 6, y: 12 };
const range = (a, b) => Array.from({ length: Math.max(0, b - a + 1) }, (_, k) => a + k);

export const periodCount = (g) => 12 / (SIZE[g] ?? 1);
export const periodName = (g, p) => (g === 'm' ? MESES[p] : g === 'q' ? `${p + 1}º TRI` : g === 's' ? `${p + 1}º SEM` : '');
export const periodOfMonth = (g, month) => Math.floor(month / (SIZE[g] ?? 1));
export const monthsOf = (g, p) => range(p * SIZE[g], p * SIZE[g] + SIZE[g] - 1);

/**
 * raw { g, p, year } → { g, p, year, months (period), end, acMonths (Jan → end), label, short, acLabel }
 * label: "Mensal · Out/2026" · "Trimestral · 3º TRI/2026" · "Semestral · 1º SEM/2026" · "Anual · 2026"
 */
export function buildFiltro(raw) {
  const g = SIZE[raw?.g] ? raw.g : 'm';
  const year = raw?.year ?? new Date().getFullYear();
  const p = g === 'y' ? 0 : Math.max(0, Math.min(Number(raw?.p ?? 0), periodCount(g) - 1));
  const months = monthsOf(g, p);
  const end = months[months.length - 1];
  const short = g === 'y' ? String(year) : `${periodName(g, p)}/${year}`;
  return {
    g, p, year, months, end, acMonths: range(0, end), short,
    label: `${GRANS.find((x) => x[0] === g)[1]} · ${short}`,
    acLabel: end === 0 ? `Jan/${year}` : `Jan a ${MESES[end]}/${year}`,
  };
}

/** columns of the Visão relatório for the granularity (whole base year); `sel` = chosen period */
export function buckets(f) {
  const yy = String(f.year).slice(2);
  return Array.from({ length: periodCount(f.g) }, (_, p) => {
    const name = f.g === 'y' ? String(f.year) : periodName(f.g, p);
    return { key: `${f.g}${p}`, label: name, long: f.g === 'y' ? String(f.year) : `${name}/${yy}`, months: monthsOf(f.g, p), sel: p === f.p };
  });
}
