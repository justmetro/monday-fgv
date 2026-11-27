// Constantes únicas do Painel Geral: cortes de score e classificação em faixas.
// As cores (azul-marinho e azul claro) ficam em theme-tokens.css: --brand-navy, --brand-sky, --brand-sky-2.
import type { PersonWeek } from './engagementMetrics';

export const SCORE_HIGH_THRESHOLD = 80; // Score alto: 80% ou mais
export const SCORE_LOW_THRESHOLD = 50; // Score baixo: abaixo de 50%

export type ScoreBand = 'high' | 'medium' | 'low' | 'away' | 'engaged' | 'not_engaged' | 'inactive';

export const BAND_LABELS: Record<ScoreBand, string> = {
  high: 'Alto',
  medium: 'Médio',
  low: 'Baixo',
  away: 'Afastados',
  engaged: 'Engajados',
  not_engaged: 'Desengajados',
  inactive: 'Inativos',
};

/** Faixa da pessoa no período. null = sem dados para classificar. */
export function personBand(p: PersonWeek, weekly: boolean): ScoreBand | null {
  if (weekly) {
    if (p.activeAbsence) return 'away';
    return p.engaged ? 'engaged' : p.inactive ? 'inactive' : 'not_engaged';
  }
  if (p.periodScore.isAllAbsence) return 'away';
  const s = p.periodScore.scorePercent;
  if (s === null) return null;
  if (s >= SCORE_HIGH_THRESHOLD) return 'high';
  if (s < SCORE_LOW_THRESHOLD) return 'low';
  return 'medium';
}

export interface BandCounts {
  evaluated: number;
  away: number;
  high: number;
  medium: number;
  low: number;
  engaged: number;
  notEngaged: number; // Desengajados (mais de 7 dias sem acesso)
  inactive: number; // Inativos (mais de 30 dias sem acesso)
  ringValue: number | null;
}

export function countBands(people: PersonWeek[], weekly: boolean): BandCounts {
  const c: BandCounts = { evaluated: 0, away: 0, high: 0, medium: 0, low: 0, engaged: 0, notEngaged: 0, inactive: 0, ringValue: null };
  let scoreSum = 0;
  people.forEach((p) => {
    const b = personBand(p, weekly);
    if (b === null) return;
    if (b === 'away') {
      c.away++;
      return;
    }
    c.evaluated++;
    if (b === 'high') c.high++;
    else if (b === 'medium') c.medium++;
    else if (b === 'low') c.low++;
    else if (b === 'engaged') c.engaged++;
    else if (b === 'not_engaged') c.notEngaged++;
    else if (b === 'inactive') c.inactive++;
    if (!weekly) scoreSum += p.periodScore.scorePercent ?? 0;
  });
  if (c.evaluated > 0) {
    c.ringValue = weekly ? Math.round((c.engaged / c.evaluated) * 100) : Math.round(scoreSum / c.evaluated);
  }
  return c;
}

/** Nome legível do projeto: remove o número SGI do início (ex.: "2024/058 "). */
export function readableProjectName(fullName: string): string {
  if (!fullName) return '';
  return fullName.replace(/^\s*\d{4}\s*\/\s*\d+\s*[-–]?\s*/, '').trim() || fullName;
}

/** Situação semanal com a nomenclatura padrão. */
export function weeklyStatusLabel(p: PersonWeek): 'Afastado' | 'Engajado' | 'Desengajado' | 'Inativo' {
  if (p.activeAbsence) return 'Afastado';
  return p.engaged ? 'Engajado' : p.inactive ? 'Inativo' : 'Desengajado';
}
