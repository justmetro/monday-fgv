// Gera um .xlsx real, pronto para importar no quadro de histórico do monday
import { createSpreadsheet, addSheet } from '@skills/xlsx-export';
import type { ExplodedRow } from './csvParser';
import type { WeekSummary } from './engagementMetrics';
import { formatBR, mondayOf, toISODate, weekCode } from './dates';

// "Date" = data de referência da análise (o dashboard mede acesso na semana dela, de domingo a sábado)
export const IMPORT_COLUMNS = [
  'Nome',
  'E-mail',
  'Equipe',
  'Departamento',
  'Ativo Pela Última Vez',
  'Date',
  'Início da semana',
  'Semana',
  'Status do usuário',
];

export function buildWorkbook(rows: ExplodedRow[], week: WeekSummary | undefined, refDate: Date) {
  const monday = mondayOf(refDate);
  const code = weekCode(monday);
  const refIso = toISODate(refDate);
  const mondayIso = toISODate(monday);

  const importRows = rows.map((r) => [
    r.userName,
    r.email,
    r.team,
    r.department,
    toISODate(r.lastAccess),
    refIso,
    mondayIso,
    code,
    r.userStatus || 'Ativo',
  ]);

  const wb = createSpreadsheet({
    sheetName: 'Para importar',
    columns: IMPORT_COLUMNS,
    rows: importRows,
    autoFilter: true,
    freezeHeader: true,
    alternateRows: true,
  });

  if (week) {
    addSheet(
      wb,
      'Pessoas únicas',
      ['Nome', 'E-mail', 'Projetos', 'Departamentos', 'Último acesso', 'Engajamento'],
      week.people.map((p) => [
        p.name,
        p.email,
        p.teams.join(', '),
        p.departments.join(', '),
        formatBR(p.lastAccess),
        p.engaged ? 'Engajado' : 'Não engajado',
      ]),
      { autoFilter: true, freezeHeader: true, alternateRows: true }
    );
    addSheet(
      wb,
      'Por departamento',
      ['Departamento', 'Pessoas únicas', 'Engajadas', 'Taxa (%)'],
      week.departments.map((d) => [d.name, d.total, d.engaged, d.rate]),
      { autoFilter: true, freezeHeader: true }
    );
    addSheet(
      wb,
      'Por projeto ativo',
      ['Projeto', 'Pessoas únicas', 'Engajadas', 'Taxa (%)'],
      week.projects.map((p) => [p.name, p.total, p.engaged, p.rate]),
      { autoFilter: true, freezeHeader: true }
    );
    addSheet(
      wb,
      'Por gerente',
      ['Gerente', 'Pessoas únicas', 'Engajadas', 'Taxa (%)'],
      week.managers.map((m) => [m.name, m.total, m.engaged, m.rate]),
      { autoFilter: true, freezeHeader: true }
    );
  }

  return { wb, filename: `engajamento_${refIso}.xlsx` };
}
