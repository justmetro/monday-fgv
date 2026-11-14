// Utilitários de data, janelas e períodos completos civis
import { parseDateFlexible, toISODate, formatBR, shortDate, type TimeGranularity } from './dates';

export * from './dates';

export interface EvaluatedPeriodWindow {
  periodName: string;
  label: string;
  start: Date; // Primeiro dia útil (segunda-feira ou 1º dia útil) do período
  end: Date;   // Data de corte / último dia útil do período
  monthsIncluded: number;
}

/**
 * Retorna o primeiro dia útil (segunda a sexta) do mês/ano
 */
function firstWorkingDayOfMonth(year: number, month: number): Date {
  const d = new Date(year, month, 1, 0, 0, 0, 0);
  const day = d.getDay();
  if (day === 0) d.setDate(2); // Domingo -> Segunda
  else if (day === 6) d.setDate(3); // Sábado -> Segunda
  return d;
}

/**
 * Retorna o último dia útil (segunda a sexta) de um determinado dia ou fim de mês
 */
function lastWorkingDayUpTo(limitDate: Date): Date {
  const d = new Date(limitDate.getFullYear(), limitDate.getMonth(), limitDate.getDate(), 23, 59, 59, 999);
  const day = d.getDay();
  if (day === 0) d.setDate(d.getDate() - 2); // Domingo -> Sexta
  else if (day === 6) d.setDate(d.getDate() - 1); // Sábado -> Sexta
  return d;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

/**
 * Regra alinhada de períodos:
 * - Semanal: última semana até a data de ref
 * - Mensal: semanas do mês corrido até a data de análise (1º dia útil ao último dia útil/data da análise)
 * - Trimestral: 3 meses corridos (2 meses cheios antecessores + mês corrido até o dia da análise)
 * - Semestral: 6 meses corridos (5 meses cheios antecessores + mês corrido até o dia da análise)
 * - Anual: 12 meses corridos (11 meses cheios antecessores + mês corrido até o dia da análise)
 */
export function getPreviousCivilPeriod(ref: Date, granularity: TimeGranularity): EvaluatedPeriodWindow {
  const y = ref.getFullYear();
  const m = ref.getMonth();

  if (granularity === 'monthly') {
    const start = firstWorkingDayOfMonth(y, m);
    const end = lastWorkingDayUpTo(ref);
    return {
      periodName: `Mês (${MONTH_NAMES[m]}/${y})`,
      label: `${MONTH_NAMES[m]} de ${y} · ${shortDate(start)} a ${shortDate(end)}`,
      start,
      end,
      monthsIncluded: 1,
    };
  }

  if (granularity === 'quarterly') {
    // 3 meses: 2 meses anteriores + mês corrido da ref
    const startMonthDate = new Date(y, m - 2, 1);
    const start = firstWorkingDayOfMonth(startMonthDate.getFullYear(), startMonthDate.getMonth());
    const end = lastWorkingDayUpTo(ref);
    const startM = startMonthDate.getMonth();
    const startY = startMonthDate.getFullYear();
    return {
      periodName: `Trimestre (${MONTH_NAMES[startM].slice(0, 3)} - ${MONTH_NAMES[m].slice(0, 3)}/${y})`,
      label: `Trimestre (${MONTH_NAMES[startM]}/${startY} a ${MONTH_NAMES[m]}/${y}) · ${shortDate(start)} a ${shortDate(end)}`,
      start,
      end,
      monthsIncluded: 3,
    };
  }

  if (granularity === 'semiannual') {
    // 6 meses: 5 meses anteriores + mês corrido da ref
    const startMonthDate = new Date(y, m - 5, 1);
    const start = firstWorkingDayOfMonth(startMonthDate.getFullYear(), startMonthDate.getMonth());
    const end = lastWorkingDayUpTo(ref);
    const startM = startMonthDate.getMonth();
    const startY = startMonthDate.getFullYear();
    return {
      periodName: `Semestre (${MONTH_NAMES[startM].slice(0, 3)} - ${MONTH_NAMES[m].slice(0, 3)}/${y})`,
      label: `Semestre (${MONTH_NAMES[startM]}/${startY} a ${MONTH_NAMES[m]}/${y}) · ${shortDate(start)} a ${shortDate(end)}`,
      start,
      end,
      monthsIncluded: 6,
    };
  }

  if (granularity === 'annual') {
    // 12 meses: 11 meses anteriores + mês corrido da ref
    const startMonthDate = new Date(y, m - 11, 1);
    const start = firstWorkingDayOfMonth(startMonthDate.getFullYear(), startMonthDate.getMonth());
    const end = lastWorkingDayUpTo(ref);
    const startM = startMonthDate.getMonth();
    const startY = startMonthDate.getFullYear();
    return {
      periodName: `Anual (${MONTH_NAMES[startM].slice(0, 3)}/${startY} a ${MONTH_NAMES[m].slice(0, 3)}/${y})`,
      label: `Anual (${MONTH_NAMES[startM]}/${startY} a ${MONTH_NAMES[m]}/${y}) · ${shortDate(start)} a ${shortDate(end)}`,
      start,
      end,
      monthsIncluded: 12,
    };
  }

  // Semanal fallback
  const start = new Date(y, m, ref.getDate() - 7, 0, 0, 0, 0);
  const end = lastWorkingDayUpTo(ref);
  return {
    periodName: `Semana de ${formatBR(ref)}`,
    label: `Referência ${formatBR(ref)} · ${shortDate(start)} a ${shortDate(end)}`,
    start,
    end,
    monthsIncluded: 0,
  };
}
