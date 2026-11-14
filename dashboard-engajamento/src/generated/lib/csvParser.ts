// Parser RFC-4180: respeita aspas, então vírgulas dentro de "Equipes" não viram colunas
import { parseDateFlexible } from './dates';

export interface ParsedCsvData {
  headers: string[];
  rows: string[][];
  delimiter: string;
}

export interface ExplodedRow {
  id: string;
  userName: string;
  email: string;
  team: string;
  department: string;
  lastAccessRaw: string;
  lastAccess: Date | null;
  userStatus: string;
  allTeams: string[];
}

export interface ColumnMapping {
  name: number;
  email: number;
  team: number;
  department: number;
  lastAccess: number;
  userStatus: number;
}

export function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/)[0] ?? '';
  const count = (ch: string) => firstLine.split(ch).length - 1;
  const tabs = count('\t');
  const semis = count(';');
  const commas = count(',');
  if (tabs > semis && tabs > commas) return '\t';
  if (semis > commas) return ';';
  return ',';
}

export function parseCsvRfc4180(text: string, customDelimiter?: string): ParsedCsvData {
  const source = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const delimiter = customDelimiter || detectDelimiter(source);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (inQuotes) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field.trim());
      field = '';
    } else if (ch === '\n') {
      row.push(field.trim());
      if (row.some((f) => f.length > 0)) rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    if (row.some((f) => f.length > 0)) rows.push(row);
  }

  if (rows.length === 0) return { headers: [], rows: [], delimiter };
  return { headers: rows[0] ?? [], rows: rows.slice(1), delimiter };
}

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

export function findColumnIndex(headers: string[], matchers: string[]): number {
  const norm = headers.map(normalize);
  for (const m of matchers) {
    const exact = norm.findIndex((h) => h === normalize(m));
    if (exact !== -1) return exact;
  }
  for (const m of matchers) {
    const partial = norm.findIndex((h) => h.includes(normalize(m)));
    if (partial !== -1) return partial;
  }
  return -1;
}

export function detectColumns(headers: string[]): ColumnMapping {
  const name = findColumnIndex(headers, ['nome', 'name', 'nome completo', 'usuario', 'colaborador', 'pessoa']);
  const email = findColumnIndex(headers, ['e-mail', 'email', 'mail', 'login']);
  let team = findColumnIndex(headers, ['equipes', 'equipe', 'teams', 'team', 'projetos', 'projeto']);
  if (team === -1 && headers.length > 13) team = 13; // coluna N
  const department = findColumnIndex(headers, ['departamento', 'departamentos', 'department', 'setor', 'area']);
  const lastAccess = findColumnIndex(headers, [
    'ultimo acesso', 'último acesso', 'last access', 'last login', 'ultimo login', 'data de acesso', 'acesso',
  ]);
  const userStatus = findColumnIndex(headers, [
    'status do usuario', 'status do usuário', 'user status', 'status', 'ativo/inativo', 'situacao', 'situação',
  ]);
  return { name, email, team, department, lastAccess, userStatus };
}

export function isUserDeactivated(statusRaw: string | undefined): boolean {
  if (!statusRaw) return false;
  const s = normalize(statusRaw);
  return (
    s.includes('desativado') ||
    s.includes('desativada') ||
    s.includes('inativo') ||
    s.includes('inativa') ||
    s.includes('deactivated') ||
    s.includes('disabled')
  );
}

export function splitMultiValues(cell: string | undefined): string[] {
  if (!cell) return [];
  return Array.from(
    new Set(
      cell
        .split(/[,;\n]+/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0)
    )
  );
}

/** Modo de geração de linhas: 1 linha por pessoa (mantém vírgulas) ou desmembrada */
export function explodeCsvData(
  parsed: ParsedCsvData,
  map: ColumnMapping,
  mode: 'one-per-person' | 'exploded' = 'one-per-person'
): ExplodedRow[] {
  const out: ExplodedRow[] = [];
  parsed.rows.forEach((row, idx) => {
    const cell = (i: number) => (i >= 0 ? row[i] ?? '' : '');
    const userStatus = cell(map.userStatus);

    // Se estiver desativado, descarta da exportação e análise
    if (isUserDeactivated(userStatus)) {
      return;
    }

    const userName = cell(map.name) || cell(map.email) || `Pessoa ${idx + 1}`;
    const email = cell(map.email);
    const lastAccessRaw = cell(map.lastAccess);
    const lastAccess = parseDateFlexible(lastAccessRaw);
    const rawTeam = cell(map.team);
    const rawDept = cell(map.department);
    const teams = splitMultiValues(rawTeam);
    const depts = splitMultiValues(rawDept);

    if (mode === 'one-per-person') {
      out.push({
        id: `${idx}-single`,
        userName,
        email,
        team: rawTeam,
        department: rawDept,
        lastAccessRaw,
        lastAccess,
        userStatus,
        allTeams: teams,
      });
      return;
    }

    const teamList = teams.length > 0 ? teams : [''];
    const deptList = depts.length > 0 ? depts : [''];
    teamList.forEach((team) => {
      deptList.forEach((department) => {
        out.push({
          id: `${idx}-${team}-${department}`,
          userName,
          email,
          team,
          department,
          lastAccessRaw,
          lastAccess,
          userStatus,
          allTeams: teams,
        });
      });
    });
  });
  return out;
}
