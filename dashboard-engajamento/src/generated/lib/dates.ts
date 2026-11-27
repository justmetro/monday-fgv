// Utilitários de data e cálculo de janelas baseadas em meses cheios/calendário civil

export type TimeGranularity = 'weekly' | 'monthly' | 'quarterly' | 'semiannual' | 'annual';

export interface GranularityConfig {
  id: TimeGranularity;
  label: string;
  shortLabel: string;
  description: string;
  comparisonLabel: string;
}

export const GRANULARITIES: GranularityConfig[] = [
  {
    id: 'weekly',
    label: 'Semanal (dom a sáb)',
    shortLabel: 'Semana',
    description: 'Semana da data de referência, de domingo a sábado',
    comparisonLabel: 'semana anterior',
  },
  {
    id: 'monthly',
    label: 'Mensal (Mês cheio)',
    shortLabel: 'Mês',
    description: 'Acessos durante todo o mês da análise (01 ao fim do mês)',
    comparisonLabel: 'mês anterior',
  },
  {
    id: 'quarterly',
    label: 'Trimestral (3 meses)',
    shortLabel: 'Trimestre',
    description: 'Mês da análise + 2 meses cheios antecessores',
    comparisonLabel: 'trimestre anterior',
  },
  {
    id: 'semiannual',
    label: 'Semestral (Semestre)',
    shortLabel: 'Semestre',
    description: 'Semestre civil do ano (1º Sem: Jan-Jun ou 2º Sem: Jul-Dez)',
    comparisonLabel: 'semestre anterior',
  },
  {
    id: 'annual',
    label: 'Anual (Ano civil)',
    shortLabel: 'Ano',
    description: 'Ano civil completo da análise (01/01 a 31/12)',
    comparisonLabel: 'ano anterior',
  },
];

export function parseDateFlexible(value: string | null | undefined): Date | null {
  if (!value) return null;
  const clean = String(value).trim();
  if (!clean) return null;
  const lower = clean.toLowerCase();
  if (lower.includes('nunca') || lower.includes('não') || lower.includes('nao') || lower === '-' || lower === 'n/a') {
    return null;
  }

  // DD/MM/AAAA ou DD-MM-AAAA ou DD.MM.AAAA (com ou sem horário)
  const br = clean.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (br) {
    let year = parseInt(br[3], 10);
    if (year < 100) year += 2000;
    const d = new Date(
      year,
      parseInt(br[2], 10) - 1,
      parseInt(br[1], 10),
      br[4] ? parseInt(br[4], 10) : 12,
      br[5] ? parseInt(br[5], 10) : 0,
      br[6] ? parseInt(br[6], 10) : 0
    );
    return isNaN(d.getTime()) ? null : d;
  }

  // AAAA-MM-DD (com ou sem horário)
  const iso = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (iso) {
    const d = new Date(
      parseInt(iso[1], 10),
      parseInt(iso[2], 10) - 1,
      parseInt(iso[3], 10),
      iso[4] ? parseInt(iso[4], 10) : 12,
      iso[5] ? parseInt(iso[5], 10) : 0,
      iso[6] ? parseInt(iso[6], 10) : 0
    );
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const MONTH_SHORT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

export function analysisLabel(ref: Date, days: number = 7): string {
  const start = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - days, 0, 0, 0, 0);
  return `Referência ${formatBR(ref)} · acessos de ${shortDate(start)} a ${shortDate(ref)}`;
}

/**
 * Calcula os limites (início e fim) da janela temporal de engajamento conforme a granularidade:
 * - weekly: 7 dias antes da data de ref até o fim do dia de ref
 * - monthly: 1º dia do mês até o último dia do mês da ref
 * - quarterly: 1º dia de 2 meses antes até o último dia do mês da ref (3 meses cheios)
 * - semiannual: semestre civil (01/01 a 30/06 ou 01/07 a 31/12)
 * - annual: 01/01 a 31/12 do ano da ref
 */
export function getGranularityWindow(ref: Date, granularity: TimeGranularity): { start: Date; end: Date; label: string; periodName: string } {
  const y = ref.getFullYear();
  const m = ref.getMonth();

  if (granularity === 'weekly') {
    // Semana inteira da referência (segunda a domingo)
    const { start, end } = weekWindowOf(ref);
    const periodName = `Semana de ${formatBR(ref)}`;
    const label = `Referência ${formatBR(ref)} · acessos de ${shortDate(start)} a ${shortDate(end)}`;
    return { start, end, label, periodName };
  }

  if (granularity === 'monthly') {
    const start = new Date(y, m, 1, 0, 0, 0, 0);
    const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
    const periodName = `${MONTH_NAMES[m]}/${y}`;
    const label = `Mês de ${MONTH_NAMES[m]} de ${y} · acessos de 01/${String(m + 1).padStart(2, '0')} a ${end.getDate()}/${String(m + 1).padStart(2, '0')}`;
    return { start, end, label, periodName };
  }

  if (granularity === 'quarterly') {
    const start = new Date(y, m - 2, 1, 0, 0, 0, 0);
    const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
    const startM = start.getMonth();
    const startY = start.getFullYear();
    const periodName = `Trimestre (${MONTH_SHORT[startM]} - ${MONTH_SHORT[m]}/${y})`;
    const label = `Trimestre (${MONTH_NAMES[startM]}/${startY} a ${MONTH_NAMES[m]}/${y}) · ${shortDate(start)} a ${shortDate(end)}`;
    return { start, end, label, periodName };
  }

  if (granularity === 'semiannual') {
    const isFirstSemester = m < 6;
    const start = isFirstSemester ? new Date(y, 0, 1, 0, 0, 0, 0) : new Date(y, 6, 1, 0, 0, 0, 0);
    const end = isFirstSemester ? new Date(y, 5, 30, 23, 59, 59, 999) : new Date(y, 11, 31, 23, 59, 59, 999);
    const periodName = `${isFirstSemester ? '1º' : '2º'} Semestre/${y}`;
    const label = `${isFirstSemester ? '1º' : '2º'} Semestre de ${y} · ${shortDate(start)} a ${shortDate(end)}`;
    return { start, end, label, periodName };
  }

  // annual
  const start = new Date(y, 0, 1, 0, 0, 0, 0);
  const end = new Date(y, 11, 31, 23, 59, 59, 999);
  const periodName = `Ano ${y}`;
  const label = `Ano de ${y} · 01/01/${y} a 31/12/${y}`;
  return { start, end, label, periodName };
}

/** Segunda-feira 00:00 da semana da data informada */
export function mondayOf(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0 = domingo
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

/** Sexta-feira 23:59:59 da semana que começa na segunda informada */
export function fridayEndOf(monday: Date): Date {
  const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 4, 23, 59, 59, 999);
  return d;
}

/** Domingo 23:59:59 da semana que começa na segunda informada */
export function sundayEndOf(monday: Date): Date {
  return new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6, 23, 59, 59, 999);
}

/** Domingo 00:00 da semana (domingo a sábado) que contém a data */
export function sundayOf(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay());
}

/** Semana inteira da data: domingo 00:00 a sábado 23:59:59 (cada semana é um grupo do quadro) */
export function weekWindowOf(date: Date): { start: Date; end: Date } {
  const start = sundayOf(date);
  return { start, end: new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999) };
}

export function shortDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function toISODate(date: Date | null): string {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatBR(date: Date | null): string {
  if (!date) return '—';
  return date.toLocaleDateString('pt-BR');
}

export function isoWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function weekLabel(monday: Date): string {
  const friday = sundayEndOf(monday);
  return `Semana ${isoWeekNumber(monday)} · ${monday.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} a ${friday.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
}

export function weekCode(monday: Date): string {
  return `${monday.getFullYear()}-S${String(isoWeekNumber(monday)).padStart(2, '0')}`;
}
