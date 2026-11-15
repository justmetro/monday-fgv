import { type Projeto, parseNum, toDate } from '@generated/lib/format';
import { etapasDe, semValor } from '@generated/lib/farol';
import { temMesReferencia } from '@generated/lib/board-options';

export interface Taxa {
  pct: number | null;
  ok: number;
  n: number;
}

/**
 * % on time for a stage. Base = projects with the stage's completion date filled AND
 * "Mês Referência Resultado" ≠ "N/A" (the result formulas carry defaults otherwise).
 */
export function taxaNoPrazo(items: Projeto[], etapa: 'plan' | 'sgi', noPeriodo?: (d: Date) => boolean): Taxa {
  let ok = 0;
  let n = 0;
  for (const p of items) {
    const conc = etapa === 'plan' ? toDate(p.conclusoDoPlanejamento) : toDate(p.conclusoRegistroSgi);
    if (!conc || !temMesReferencia(p.msRefernciaResultado)) continue;
    if (noPeriodo && !noPeriodo(conc)) continue;
    const e = etapasDe(p).find((x) => x.key === etapa);
    if (!e) continue;
    n++;
    if (e.farol === 'noPrazo') ok++;
  }
  return { pct: n ? (ok / n) * 100 : null, ok, n };
}

function mediana(v: number[]): number | null {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function tempoPlanejamento(items: Projeto[]) {
  const vals = items
    .filter((p) => temMesReferencia(p.msRefernciaResultado))
    .map((p) => (semValor(p.tempoDePlanejamento) ? null : parseNum(p.tempoDePlanejamento)))
    .filter((x): x is number => x !== null);
  return {
    mediana: mediana(vals),
    media: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null,
    n: vals.length,
  };
}

export interface MediaN { media: number | null; n: number }
const mediaDe = (v: number[]): MediaN => ({ media: v.length ? v.reduce((a, b) => a + b, 0) / v.length : null, n: v.length });

/**
 * "Tempo de planejamento" block (same as the monday dashboard): average of Tempo de Planejamento (days) of the
 * given base, only projects with Mês Referência Resultado ≠ N/A; the quarter comes from the month of the
 * Mês Referência Resultado (the month the planning result counts for).
 */
export function tempoPorTrimestre(items: Projeto[], mesDe: (p: Projeto) => number | null) {
  const vals = items
    .map((p) => ({ m: mesDe(p), v: semValor(p.tempoDePlanejamento) ? null : parseNum(p.tempoDePlanejamento) }))
    .filter((x): x is { m: number; v: number } => x.m !== null && x.v !== null);
  return {
    ano: mediaDe(vals.map((x) => x.v)),
    tri: [0, 1, 2, 3].map((t) => mediaDe(vals.filter((x) => Math.floor((x.m - 1) / 3) === t).map((x) => x.v))),
  };
}

export const IT_KEYS = ['it11', 'it12', 'it13', 'it14'] as const;
export type ItKey = (typeof IT_KEYS)[number];
export const IT_LABEL: Record<ItKey, string> = { it11: 'IT1.1', it12: 'IT1.2', it13: 'IT1.3', it14: 'IT1.4' };

export function itValor(raw: string | null | undefined): number | null {
  return semValor(raw) ? null : parseNum(raw);
}

export function indicadoresIt(items: Projeto[]) {
  return IT_KEYS.map((k) => {
    const base = items.filter((p) => temMesReferencia(p.msRefernciaResultado));
    const raws = base.map((p) => p[k]).filter((r): r is string => itValor(r) !== null);
    const vals = raws.map((r) => itValor(r) as number);
    return {
      key: k,
      label: IT_LABEL[k],
      media: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null,
      n: vals.length,
    };
  });
}

const dec = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
/** IT indicators are always percentages, even when the formula omits "%". */
export function fmtIt(v: number | null): string {
  return v === null ? '—' : `${dec.format(v)}%`;
}
