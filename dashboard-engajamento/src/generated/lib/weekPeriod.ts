// Período da semana digitado nos envios (domingo a sábado). É a única fonte da semana do grupo.
export interface WeekPeriod { weekStart: string; weekEnd: string }

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

function at(iso: string): Date | null {
  const m = iso.match(ISO);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
  return isNaN(d.getTime()) || d.getMonth() !== Number(m[2]) - 1 ? null : d;
}

const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Soma dias a uma data AAAA-MM-DD; devolve '' se a data for inválida. */
export function addDaysIso(iso: string, days: number): string {
  const d = at(iso);
  return d ? toIso(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, 12)) : '';
}

/** Sábado seguinte (6 dias depois) ao início informado; null se a data for inválida. */
export function saturdayAfter(startIso: string): string | null {
  const d = at(startIso);
  if (!d) return null;
  return toIso(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 6, 12));
}

/** Mensagem de erro se o período não for um domingo a sábado de 7 dias; null se estiver certo. */
export function periodError(weekStart: string, weekEnd: string): string | null {
  if (!weekStart || !weekEnd) return 'Informe o início e o fim da semana.';
  const s = at(weekStart);
  const e = at(weekEnd);
  if (!s || !e) return 'Período da semana inválido.';
  if (s.getDay() !== 0) return 'O início da semana tem que ser um domingo e o fim, o sábado seguinte (7 dias, de domingo a sábado).';
  if (weekEnd !== saturdayAfter(weekStart)) return 'O fim da semana tem que ser o sábado seguinte ao domingo de início (7 dias, de domingo a sábado).';
  return null;
}

export const OUTSIDE_PERIOD_MESSAGE = 'A Data da análise está fora do período da semana';

export const brDate = (iso: string) => iso.split('-').reverse().join('/');
