// Períodos civis escolhíveis nos painéis (mês, trimestre, semestre e ano), de janeiro de 2026 até o período atual.
// Uma semana pertence ao período em que cai o último dia dela (o sábado).
import { toISODate, formatBR, type TimeGranularity } from './dates';

export type PeriodGranularity = Exclude<TimeGranularity, 'weekly'>;

export interface PeriodOption {
  key: string; // Ex.: "monthly:2026-09"
  granularity: PeriodGranularity;
  label: string; // "setembro/2026", "1T26", "1S26", "2026"
  longLabel: string; // "setembro de 2026", "1º trimestre de 2026"...
  start: Date;
  end: Date;
  startIso: string;
  endIso: string;
  rangeText: string; // "01/09/2026 a 30/09/2026"
}

const FIRST_YEAR = 2026;

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function make(
  granularity: PeriodGranularity,
  key: string,
  label: string,
  longLabel: string,
  startY: number,
  startM: number,
  months: number
): PeriodOption {
  const start = new Date(startY, startM, 1, 0, 0, 0, 0);
  const end = new Date(startY, startM + months, 0, 23, 59, 59, 999);
  return {
    key: `${granularity}:${key}`,
    granularity,
    label,
    longLabel,
    start,
    end,
    startIso: toISODate(start),
    endIso: toISODate(end),
    rangeText: `${formatBR(start)} a ${formatBR(end)}`,
  };
}

/** Opções do período para a granularidade, do mais recente para o mais antigo. Semanal não tem seletor. */
export function buildPeriodOptions(granularity: TimeGranularity, now: Date): PeriodOption[] {
  if (granularity === 'weekly') return [];
  const nowY = now.getFullYear();
  const nowM = now.getMonth();
  const out: PeriodOption[] = [];
  for (let y = FIRST_YEAR; y <= nowY; y++) {
    const yy = String(y).slice(2);
    if (granularity === 'monthly') {
      for (let m = 0; m < 12; m++) {
        if (y === nowY && m > nowM) break;
        out.push(make('monthly', `${y}-${String(m + 1).padStart(2, '0')}`, `${MONTHS[m]}/${y}`, `${MONTHS[m]} de ${y}`, y, m, 1));
      }
    } else if (granularity === 'quarterly') {
      for (let q = 0; q < 4; q++) {
        if (y === nowY && q * 3 > nowM) break;
        out.push(make('quarterly', `${y}-${q + 1}`, `${q + 1}T${yy}`, `${q + 1}º trimestre de ${y}`, y, q * 3, 3));
      }
    } else if (granularity === 'semiannual') {
      for (let s = 0; s < 2; s++) {
        if (y === nowY && s * 6 > nowM) break;
        out.push(make('semiannual', `${y}-${s + 1}`, `${s + 1}S${yy}`, `${s + 1}º semestre de ${y}`, y, s * 6, 6));
      }
    } else {
      out.push(make('annual', `${y}`, `${y}`, `ano de ${y}`, y, 0, 12));
    }
  }
  return out.reverse();
}

const isoDay = (s: string | undefined) => (s ?? '').slice(0, 10);

/** A semana (pelo sábado, último dia dela) cai dentro do período? */
export function weekInPeriod(weekEndIso: string, p: Pick<PeriodOption, 'startIso' | 'endIso'>): boolean {
  const e = isoDay(weekEndIso);
  return e !== '' && e >= p.startIso && e <= p.endIso;
}

/** Grupos (semanas com período definido) que caem no período. */
export function groupsInPeriod(weekGroups: { group: string; weekEnd: string }[], p: PeriodOption): string[] {
  return weekGroups.filter((w) => weekInPeriod(w.weekEnd, p)).map((w) => w.group);
}

/** Frase do período para títulos: "em setembro de 2026", "no 1º trimestre de 2026", "no ano de 2026". */
export function periodPhraseOf(p: Pick<PeriodOption, 'granularity' | 'longLabel'>): string {
  return `${p.granularity === 'monthly' ? 'em' : 'no'} ${p.longLabel}`;
}
