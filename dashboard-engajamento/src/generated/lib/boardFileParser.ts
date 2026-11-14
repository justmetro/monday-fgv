// Lê arquivos exportados do monday (CSV ou XLSX) e localiza as colunas pelo nome do cabeçalho.
import { parseCsvRfc4180 } from './csvParser';
import { readXlsxFirstSheet } from './xlsxReader';

export interface ColumnSpec<K extends string> {
  key: K;
  label: string; // nome exibido ao usuário
  aliases: readonly string[]; // nomes aceitos no cabeçalho
  isDate?: boolean;
}

export const ENGAGEMENT_COLUMNS = [
  { key: 'name', label: 'Elemento', aliases: ['elemento', 'name', 'nome'] },
  { key: 'email', label: 'E-mail', aliases: ['e-mail', 'email'] },
  { key: 'team', label: 'Equipe', aliases: ['equipe', 'equipes'] },
  { key: 'department', label: 'Departamento', aliases: ['departamento', 'departamentos'] },
  { key: 'lastAccess', label: 'Ativo pela última vez', aliases: ['ativo pela ultima vez'], isDate: true },
  { key: 'weekStart', label: 'Início da semana', aliases: ['inicio da semana'], isDate: true },
  { key: 'refDate', label: 'Date', aliases: ['date', 'data'], isDate: true },
  { key: 'userStatus', label: 'Status do usuário', aliases: ['status do usuario'] },
] as const satisfies readonly ColumnSpec<string>[];

export const PROJECT_COLUMNS = [
  { key: 'name', label: 'Elemento', aliases: ['elemento', 'name', 'nome'] },
  { key: 'sgi', label: 'Nome SGI', aliases: ['nome sgi'] },
  { key: 'sigla', label: 'Sigla do projeto', aliases: ['sigla do projeto'] },
  { key: 'status', label: 'Status do projeto', aliases: ['status do projeto'] },
  { key: 'managers', label: 'Gerente atual', aliases: ['gerente atual'] },
  { key: 'axis', label: 'Eixo de projeto', aliases: ['eixo de projeto'] },
  { key: 'client', label: 'Cliente', aliases: ['cliente'] },
  {
    key: 'startDate',
    label: 'Início real da operação',
    aliases: [
      'inicio real da operacao',
      'início real da operação',
      'inicio real da operação',
      'início real da operacao',
      'data de inicio',
      'data de início',
      'inicio',
      'início',
      'start date',
      'data inicio',
      'data início',
    ],
    isDate: true,
  },
] as const satisfies readonly ColumnSpec<string>[];

type KeysOf<T extends readonly ColumnSpec<string>[]> = T[number]['key'];
export type EngagementFileRow = Record<KeysOf<typeof ENGAGEMENT_COLUMNS>, string>;
export type ProjectFileRow = Record<KeysOf<typeof PROJECT_COLUMNS>, string>;

export interface ParseResult<R> {
  rows: R[];
  missing: string[]; // colunas obrigatórias não encontradas
}

const norm = (s: string) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();

/** Converte número de série do Excel (ex.: 46321.54) em "AAAA-MM-DD" ou "AAAA-MM-DD HH:mm" */
function excelSerialToText(v: string): string {
  if (!/^\d+(\.\d+)?$/.test(v)) return v;
  const serial = Number(v);
  if (serial < 20000 || serial > 80000) return v;
  const d = new Date(Math.round((serial - 25569) * 86400000));
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  return serial % 1 === 0 ? day : `${day} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

async function readMatrix(file: File): Promise<string[][]> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.xlsx')) return readXlsxFirstSheet(file);
  if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
    let text = await file.text();
    if (text.includes('\uFFFD')) {
      const buf = await file.arrayBuffer();
      text = new TextDecoder('iso-8859-1').decode(buf);
    }
    const parsed = parseCsvRfc4180(text);
    return [parsed.headers, ...parsed.rows];
  }
  throw new Error('Formato não suportado. Envie um arquivo .csv ou .xlsx.');
}

/**
 * O export do monday pode repetir o cabeçalho a cada grupo e ter linhas de título de grupo.
 * Uma linha é cabeçalho quando contém todas as colunas obrigatórias; os dados são as linhas
 * que vêm depois de um cabeçalho, ignorando linhas vazias e títulos de grupo.
 */
export async function parseBoardFile<C extends readonly ColumnSpec<string>[]>(
  file: File,
  columns: C
): Promise<ParseResult<Record<C[number]['key'], string>>> {
  const matrix = await readMatrix(file);

  const headerMap = (row: string[]) => {
    const cells = row.map(norm);
    const map: Partial<Record<string, number>> = {};
    columns.forEach((c) => {
      const idx = cells.findIndex((h) => c.aliases.some((a) => norm(a) === h));
      if (idx >= 0) map[c.key] = idx;
    });
    return map;
  };

  const headerRows: number[] = [];
  let best: { found: number; map: Partial<Record<string, number>> } = { found: -1, map: {} };
  matrix.forEach((row, i) => {
    const map = headerMap(row);
    const found = Object.keys(map).length;
    if (found > best.found) best = { found, map };
    if (found === columns.length) headerRows.push(i);
  });

  if (headerRows.length === 0) {
    // startDate é opcional para manter compatibilidade com arquivos sem a coluna
    const required = columns.filter((c) => c.key !== 'startDate');
    const missing = required.filter((c) => best.map[c.key] === undefined).map((c) => c.label);
    if (missing.length > 0) {
      return { rows: [], missing };
    }
  }

  type Row = Record<C[number]['key'], string>;
  const rows: Row[] = [];
  const headerSet = new Set(headerRows);
  let current: Partial<Record<string, number>> | null = null;
  matrix.forEach((row, i) => {
    if (headerSet.has(i)) {
      current = headerMap(row);
      return;
    }
    if (!current || row.every((c) => !c || !c.trim())) return;
    if (headerSet.has(i + 1)) return; // título do próximo grupo
    const map: Partial<Record<string, number>> = current;
    const out = {} as Row;
    columns.forEach((c) => {
      const idx = map[c.key];
      const raw = idx === undefined ? '' : (row[idx] ?? '').trim();
      (out as Record<string, string>)[c.key] = c.isDate ? excelSerialToText(raw) : raw;
    });
    rows.push(out);
  });

  return { rows, missing: [] };
}
