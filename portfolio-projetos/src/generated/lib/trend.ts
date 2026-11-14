import type { MeasurementDoc } from '@generated/models';

/** Converte "184.5", "184,5%", "1.234,5" em número; retorna null se não numérico. */
export function parseNum(raw: string | null): number | null {
  if (raw == null) return null;
  let s = raw.trim().replace('%', '').replace(/\s/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function fmtAvg(n: number, pct: boolean): string {
  const out = n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  return pct ? `${out}%` : out;
}

/** Média simples dos Resultados numéricos das medições informadas. */
export function averageResult(meds: MeasurementDoc[]) {
  const vals = meds.map((m) => parseNum(m.resultado)).filter((n): n is number => n !== null);
  if (!vals.length) return null;
  const pct = meds.some((m) => m.resultado?.includes('%'));
  return { avg: vals.reduce((a, b) => a + b, 0) / vals.length, n: vals.length, pct };
}

export type Trend = { dir: 'up' | 'down' | 'stable'; n: number; first: number; last: number };

/**
 * Tendência das medições concluídas (ordenadas por Prazo de Medição) pela inclinação da reta de
 * mínimos quadrados. Variação total menor que 5% da média (ou 0,01) = estabilidade.
 */
export function trendOf(concluded: MeasurementDoc[]): Trend | null {
  const pts = concluded
    .filter((m) => m.prazo)
    .sort((a, b) => (a.prazo ?? '').localeCompare(b.prazo ?? ''))
    .map((m) => parseNum(m.valorApurado))
    .filter((n): n is number => n !== null);
  if (pts.length < 2) return null;
  const n = pts.length;
  const mx = (n - 1) / 2;
  const my = pts.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  pts.forEach((y, x) => { num += (x - mx) * (y - my); den += (x - mx) ** 2; });
  const change = (num / den) * (n - 1);
  const tol = Math.max(Math.abs(my) * 0.05, 0.01);
  const dir = Math.abs(change) <= tol ? 'stable' : change > 0 ? 'up' : 'down';
  return { dir, n, first: pts[0] ?? 0, last: pts[n - 1] ?? 0 };
}
