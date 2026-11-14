import type { StoredProjectItem } from '@generated/models';
import { NOT_A_PROJECT_FLAG, normalizeName } from './projectMatcher';

interface MappingRow {
  id: string;
  equipe: string;
  projeto: string;
}

const isFlag = (p: string) => normalizeName(p) === normalizeName(NOT_A_PROJECT_FLAG);

/** Contadores do de-para sobre os projetos ativos (igualdade normalizada pelo nome completo). */
export function teamMappingStats<R extends MappingRow>(activeProjects: StoredProjectItem[], rows: R[]) {
  const activeNames = new Set(activeProjects.map((p) => normalizeName(p.name)));
  const pointedTo = new Set(rows.filter((r) => !isFlag(r.projeto)).map((r) => normalizeName(r.projeto)));
  const withTeam = activeProjects.filter((p) => pointedTo.has(normalizeName(p.name)));
  const withoutTeam = activeProjects.filter((p) => !pointedTo.has(normalizeName(p.name)));
  const outsideRows = rows.filter((r) => !isFlag(r.projeto) && !activeNames.has(normalizeName(r.projeto)));
  return { withTeam, withoutTeam, outsideRows };
}
