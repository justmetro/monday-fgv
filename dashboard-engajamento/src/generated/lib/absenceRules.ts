// Regras de negócio de afastamentos (Férias e Licença) e impacto no cálculo de semanas
import { parseDateFlexible, toISODate } from './dates';
import { countsAsAbsence } from './vacationFlow';

export interface AbsenceInfo {
  id?: string;
  email: string;
  tipo: 'Férias' | 'Licença';
  inicio: string; // YYYY-MM-DD
  volta: string | null; // YYYY-MM-DD
  criadoEm?: string;
  criadoPor?: { id: string; name: string; email: string };
  // Fluxo de validação (somente departamento Projetos): pendente continua contando no engajamento
  fluxo?: 'projetos';
  status?: 'pendente' | 'validado';
  validadoPor?: { id: string; name: string; email: string };
  removido?: boolean;
}

/**
 * Retorna o início e o fim da semana (domingo 00:00 até sábado 23:59:59) que contém a data de referência da semana.
 */
export function getWeekBoundsForRefDate(refDate: Date): { weekStart: Date; weekEnd: Date } {
  const d = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
  const weekStart = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay(), 0, 0, 0, 0);
  const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6, 23, 59, 59, 999);
  return { weekStart, weekEnd };
}

/**
 * Determina se uma semana específica (identificada pela sua refDate) está fora da conta por motivo de afastamento.
 *
 * Regra estrita:
 * - A semana que contém a data de início conta normalmente.
 * - As semanas seguintes, até a semana anterior à que contém a data de volta, ficam fora da conta.
 * - A semana que contém a data de volta conta normalmente.
 * - Sem data de volta, todas as semanas depois da semana do início ficam fora.
 */
export function isWeekExcludedByAbsence(refDate: Date, absences: AbsenceInfo[]): { excluded: boolean; activeAbsence?: AbsenceInfo } {
  if (!absences || absences.length === 0) return { excluded: false };

  const { weekStart, weekEnd } = getWeekBoundsForRefDate(refDate);

  for (const abs of absences) {
    if (!countsAsAbsence(abs)) continue; // pendente de validação ou removido: a semana conta normalmente
    const inicioDate = parseDateFlexible(abs.inicio);
    if (!inicioDate) continue;

    const { weekStart: inicioWeekStart, weekEnd: inicioWeekEnd } = getWeekBoundsForRefDate(inicioDate);

    // Se a semana avaliada é a própria semana de início ou anterior a ela, ela CONTA normalmente (não excluída por este afastamento)
    if (weekStart.getTime() <= inicioWeekStart.getTime()) {
      continue;
    }

    // Se não há data de volta, qualquer semana posterior à semana de início é excluída
    if (!abs.volta) {
      if (weekStart.getTime() > inicioWeekEnd.getTime()) {
        return { excluded: true, activeAbsence: abs };
      }
    } else {
      const voltaDate = parseDateFlexible(abs.volta);
      if (!voltaDate) continue;
      const { weekStart: voltaWeekStart } = getWeekBoundsForRefDate(voltaDate);

      // A semana da volta conta normalmente. As semanas entre a semana posterior ao início e anterior à volta ficam excluídas.
      if (weekStart.getTime() > inicioWeekEnd.getTime() && weekStart.getTime() < voltaWeekStart.getTime()) {
        return { excluded: true, activeAbsence: abs };
      }
    }
  }

  return { excluded: false };
}

/**
 * Verifica se na exata data de referência a pessoa está ativamente afastada (para selos "Férias" ou "Licença" e status semanal).
 */
export function getActiveAbsenceOnDate(date: Date, absences: AbsenceInfo[]): AbsenceInfo | null {
  if (!absences || absences.length === 0) return null;
  const targetTime = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0).getTime();

  for (const abs of absences) {
    if (!countsAsAbsence(abs)) continue;
    const inicioDate = parseDateFlexible(abs.inicio);
    if (!inicioDate) continue;
    const start = new Date(inicioDate.getFullYear(), inicioDate.getMonth(), inicioDate.getDate(), 0, 0, 0).getTime();

    if (abs.volta) {
      const voltaDate = parseDateFlexible(abs.volta);
      if (voltaDate) {
        // Volta é o primeiro dia de trabalho, então o afastamento termina no dia anterior
        const end = new Date(voltaDate.getFullYear(), voltaDate.getMonth(), voltaDate.getDate(), 0, 0, 0).getTime();
        if (targetTime >= start && targetTime < end) {
          return abs;
        }
      }
    } else {
      if (targetTime >= start) {
        return abs;
      }
    }
  }

  return null;
}
