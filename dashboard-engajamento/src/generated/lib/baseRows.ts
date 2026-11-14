// Regras únicas da Base (usadas na tela e no servidor): chave pessoa + semana, junção sem duplicar,
// formato de exportação e leitura do arquivo de reescrita.
import type { StoredEngagementRow } from '@generated/models';
import { parseDateFlexible, toISODate } from './dates';
import { WEEKDAYS, extractEmail, isWeekdayKey, normText, personMatchKey, sortDays } from './weekdays';

/** Chave da linha: pessoa (e-mail, ou nome sem e-mail) + semana (grupo). Igual na Base e no quadro. */
export function baseRowKey(r: { name: string; email: string; group?: string | null }): string {
  return `${personMatchKey(r.name, r.email)}|${normText(r.group)}`;
}

export function isoOf(raw: string | null | undefined): string | null {
  const d = parseDateFlexible(raw);
  return d ? toISODate(d) : null;
}

function laTime(raw: string | null | undefined): number {
  return parseDateFlexible(raw)?.getTime() ?? 0;
}

function pick(next: string | null | undefined, prev: string | null | undefined): string {
  return next && next.trim() ? next.trim() : (prev ?? '').trim();
}

/** Forma comparável da linha (para saber se algo mudou). */
export function rowFingerprint(r: StoredEngagementRow): string {
  return JSON.stringify([
    r.name, r.email.toLowerCase(), r.team, r.department, r.userStatus ?? '', isoOf(r.lastAccess) ?? r.lastAccess ?? '',
    r.refDate ?? '', r.weekStart ?? '', normText(r.group), sortDays(r.checkedDays ?? []).join(','),
  ]);
}

export type MergeMode =
  | 'analysis' // CSV da análise: soma checks, último acesso só avança, Date só avança
  | 'rewrite' // arquivo de reescrita: substitui campos informados, nunca remove check
  | 'board'; // quadro como referência: a linha fica igual à do quadro

/** Junta a linha nova na existente. Check já marcado nunca é removido (exceto no modo quadro). */
export function mergeRow(existing: StoredEngagementRow | undefined, incoming: StoredEngagementRow, mode: MergeMode): StoredEngagementRow {
  if (!existing || mode === 'board') {
    return { ...incoming, checkedDays: sortDays(incoming.checkedDays ?? []) };
  }
  const checks = sortDays(Array.from(new Set([...(existing.checkedDays ?? []), ...(incoming.checkedDays ?? [])])));
  const lastAccess =
    mode === 'rewrite'
      ? pick(incoming.lastAccess, existing.lastAccess) || null
      : laTime(incoming.lastAccess) > laTime(existing.lastAccess)
        ? incoming.lastAccess
        : existing.lastAccess ?? incoming.lastAccess;
  const refDate =
    mode === 'rewrite'
      ? pick(incoming.refDate, existing.refDate) || null
      : [existing.refDate, incoming.refDate].filter(Boolean).sort().pop() ?? null;
  return {
    name: pick(incoming.name, existing.name),
    email: pick(incoming.email, existing.email),
    team: pick(incoming.team, existing.team),
    department: pick(incoming.department, existing.department),
    userStatus: pick(incoming.userStatus, existing.userStatus),
    lastAccess,
    refDate,
    weekStart: pick(incoming.weekStart, existing.weekStart) || null,
    weekEnd: pick(incoming.weekEnd, existing.weekEnd) || null,
    group: pick(incoming.group, existing.group),
    checkedDays: checks,
    boardValues: { ...(existing.boardValues ?? {}), ...(incoming.boardValues ?? {}) },
    createdAt: pick(incoming.createdAt ?? '', existing.createdAt ?? '') || null,
  };
}

// ---------- Exportação e reimportação (mesma estrutura) ----------

export const BASE_FILE_COLUMNS = [
  'Semana',
  'Nome',
  'E-mail',
  'Equipe',
  'Departamento',
  'Status do usuário',
  'Ativo pela última vez',
  'Date',
  'Início da semana',
  ...WEEKDAYS.map((w) => w.title),
  'Validação da semana',
];

export function rowToFileCells(r: StoredEngagementRow, weekStatus: string): string[] {
  const checks = new Set(r.checkedDays ?? []);
  return [
    r.group ?? '',
    r.name,
    r.email,
    r.team,
    r.department,
    r.userStatus ?? '',
    r.lastAccess ?? '',
    r.refDate ?? '',
    r.weekStart ?? '',
    ...WEEKDAYS.map((w) => (checks.has(w.key) ? 'Sim' : 'Não')),
    weekStatus,
  ];
}

const TRUE_WORDS = new Set(['sim', 's', 'x', 'v', 'true', '1', 'yes', 'checked', 'marcado']);

export interface BaseFileParse {
  rows: StoredEngagementRow[];
  ignored: { row: number; reason: string }[];
}

/** Lê o arquivo de reescrita da Base (mesma estrutura da exportação). */
export function parseBaseFile(matrix: string[][]): { ok: true; data: BaseFileParse } | { ok: false; message: string } {
  const headerIdx = matrix.findIndex((r) => r.some((c) => normText(c) === 'semana'));
  if (headerIdx < 0) return { ok: false, message: 'O arquivo precisa ter a coluna "Semana" (use a mesma estrutura da exportação da Base).' };
  const header = (matrix[headerIdx] ?? []).map(normText);
  const col = (title: string) => header.indexOf(normText(title));
  const idx = {
    group: col('Semana'), name: col('Nome'), email: col('E-mail') >= 0 ? col('E-mail') : col('Email'),
    team: col('Equipe'), dept: col('Departamento'), status: col('Status do usuário'),
    la: col('Ativo pela última vez'), date: col('Date'), week: col('Início da semana'),
  };
  if (idx.name < 0 && idx.email < 0) return { ok: false, message: 'O arquivo precisa ter a coluna "Nome" ou "E-mail".' };
  const dayIdx = WEEKDAYS.map((w) => ({ key: w.key, i: col(w.title) }));
  const cell = (row: string[], i: number) => (i >= 0 ? (row[i] ?? '').trim() : '');

  const rows: StoredEngagementRow[] = [];
  const ignored: BaseFileParse['ignored'] = [];
  const seen = new Set<string>();
  matrix.slice(headerIdx + 1).forEach((row, k) => {
    const n = headerIdx + k + 2;
    if (row.every((c) => !c || !c.trim())) return;
    const group = cell(row, idx.group);
    const name = cell(row, idx.name);
    const email = extractEmail(cell(row, idx.email));
    if (!group) return ignored.push({ row: n, reason: 'Sem semana' });
    if (!name && !email) return ignored.push({ row: n, reason: 'Sem nome e sem e-mail' });
    const r: StoredEngagementRow = {
      group, name: name || email, email,
      team: cell(row, idx.team), department: cell(row, idx.dept), userStatus: cell(row, idx.status),
      lastAccess: cell(row, idx.la) || null,
      refDate: isoOf(cell(row, idx.date)), weekStart: isoOf(cell(row, idx.week)),
      checkedDays: dayIdx.filter((d) => d.i >= 0 && TRUE_WORDS.has(normText(row[d.i]))).map((d) => d.key),
    };
    const key = baseRowKey(r);
    if (seen.has(key)) return ignored.push({ row: n, reason: 'Pessoa repetida na mesma semana do arquivo' });
    seen.add(key);
    rows.push(r);
  });
  return { ok: true, data: { rows, ignored } };
}

/** Converte a lista de dias vinda da rede para o tipo dos dias. */
export function cleanDays(days: string[] | undefined): string[] {
  return sortDays((days ?? []).filter(isWeekdayKey));
}

/** Data e hora para nomes de arquivo: 2026-10-29_14h05 */
export function fileStamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}h${p(d.getMinutes())}`;
}
