// Lê o CSV bruto exportado do monday e monta o plano da semana na Base: uma linha por pessoa + semana.
// Envio normal: a semana é o período digitado (domingo a sábado); a Data da análise precisa estar dentro dele,
// e o check marcado é o do dia da Data da análise, só quando o "Ativo pela última vez" é igual a ela.
import type { StoredEngagementRow } from '@generated/models';
import { parseCsvRfc4180 } from './csvParser';
import { isActivatedStatus } from './userStatus';
import { parseDateFlexible, toISODate } from './dates';
import { brDate, OUTSIDE_PERIOD_MESSAGE, periodError, type WeekPeriod } from './weekPeriod';
import { emptyDayCounts, extractEmail, normText, weekdayOfIso, type WeekdayKey, WEEKDAYS } from './weekdays';
import { baseRowKey, mergeRow, rowFingerprint } from './baseRows';

export interface BoardColumnInfo {
  id: string;
  title: string;
  type: string;
  writable: boolean;
}

export interface PanelCsvPlan {
  rowsRead: number;
  discardedByStatus: number; // desativadas/sem status ativo SEM linha na semana (ignoradas)
  discardedByLabel: Record<string, number>; // por valor de "Status do usuário" (vazio = "(vazio)")
  duplicatesInCsv: number;
  titleRowsIgnored: number;
  rows: StoredEngagementRow[]; // todas as pessoas ativadas da semana (vão para a Base)
  deactivations: { name: string; email: string }[]; // pessoas com linha na semana que vêm desativadas no CSV
  deactivatedEmails: string[]; // e-mail (ou nome) das 10 primeiras
  reactivated: number; // linha da semana estava Desativado e o CSV traz Ativado
  updatedByStatus: Record<string, number>; // atualizadas, pelo status que a linha tinha na Base
  toCreate: number; // linhas novas na Base
  toUpdate: number; // linhas existentes que mudam
  unchanged: number;
  checksToMark: number; // checks novos na Base
  checksByWeekday: Record<WeekdayKey, number>;
  outsideWeek: number; // pessoas com último acesso fora da semana (sem check)
  noLastAccess: number;
  weekday: WeekdayKey;
  weekRangeLabel: string;
  weekStartIso: string;
  weekEndIso: string;
  matched: { csvHeader: string; columnTitle: string; type: string }[];
  ignoredByType: { csvHeader: string; columnTitle: string; type: string }[];
  unmatchedHeaders: string[];
  missingDayColumns: string[]; // dias sem coluna de check no quadro
  teamHeader: string | null; // cabeçalho exato do CSV usado como equipe
  teamFilled: number; // pessoas com equipe preenchida
  teamEmpty: number;
  teamBoardColumn: { title: string; type: string; writable: boolean } | null; // coluna de equipe no quadro (null = não achada ou quadro não lido)
}

/** Cabeçalhos aceitos para a equipe (o export do monday traz "Equipes"; antes só "Equipe" era lido). */
export const TEAM_HEADERS = ['equipes', 'equipe', 'times', 'time', 'teams', 'team'];

const STATUS_HEADER = 'status do usuario';
const LAST_ACCESS = 'ativo pela ultima vez';

function detectSeparator(text: string): ',' | ';' {
  let commas = 0;
  let semis = 0;
  let quoted = false;
  for (let i = 0; i < Math.min(text.length, 20000); i++) {
    const ch = text[i];
    if (ch === '"') quoted = !quoted;
    else if (!quoted && ch === ',') commas++;
    else if (!quoted && ch === ';') semis++;
  }
  return semis > commas ? ';' : ',';
}

export async function readCsvMatrix(file: File): Promise<string[][]> {
  const text = (await file.text()).replace(/^\uFEFF/, '');
  const parsed = parseCsvRfc4180(text, detectSeparator(text));
  return [parsed.headers, ...parsed.rows];
}


export function buildPanelPlan(
  matrix: string[][],
  analysisDate: string,
  period: WeekPeriod,
  groupName: string,
  baseGroupRows: StoredEngagementRow[],
  boardColumns: BoardColumnInfo[] | null
): { ok: true; plan: PanelCsvPlan } | { ok: false; message: string } {
  const weekday = weekdayOfIso(analysisDate);
  if (!weekday) return { ok: false, message: 'Data de análise inválida. Nada foi gravado.' };
  const bad = periodError(period.weekStart, period.weekEnd);
  if (bad) return { ok: false, message: `${bad} Nada foi gravado.` };
  if (analysisDate < period.weekStart || analysisDate > period.weekEnd) return { ok: false, message: `${OUTSIDE_PERIOD_MESSAGE}. Nada foi gravado.` };
  const weekStartIso = period.weekStart;
  const weekEndIso = period.weekEnd;

  const headerIdx = matrix.findIndex((r) => r.some((c) => normText(c) === STATUS_HEADER));
  if (headerIdx < 0) return { ok: false, message: 'A coluna "Status do usuário" não foi encontrada no CSV. Nada foi gravado.' };
  const header = matrix[headerIdx] ?? [];
  const H = header.map(normText);
  const statusIdx = H.indexOf(STATUS_HEADER);
  const lastAccessIdx = H.indexOf(LAST_ACCESS);
  if (lastAccessIdx < 0) return { ok: false, message: 'A coluna "Ativo pela última vez" não foi encontrada no CSV. Nada foi gravado.' };
  const emailIdx = H.findIndex((h) => h === 'e-mail' || h === 'email' || h === 'correio eletronico');
  const teamIdx = H.findIndex((h) => TEAM_HEADERS.includes(h));
  const teamHeader = teamIdx >= 0 ? (header[teamIdx] ?? '').trim() : null;
  const deptIdx = H.indexOf('departamento');
  const dayTitles = new Set(WEEKDAYS.map((w) => normText(w.title)));

  // Colunas do CSV que viram valores da linha (exceto nome, Date e checks, que o app controla)
  const valueIdx = header
    .map((h, i) => ({ h: h.trim(), i }))
    // Equipe vai em chamada própria no quadro (não junto da criação nem dos checks)
    .filter(({ h, i }) => i > 0 && i !== teamIdx && h && normText(h) !== 'date' && !dayTitles.has(normText(h)));

  const matched: PanelCsvPlan['matched'] = [];
  const ignoredByType: PanelCsvPlan['ignoredByType'] = [];
  const unmatchedHeaders: string[] = [];
  let missingDayColumns: string[] = [];
  if (boardColumns) {
    const byTitle = new Map(boardColumns.filter((c) => c.type !== 'name').map((c) => [normText(c.title), c]));
    valueIdx.forEach(({ h }) => {
      const col = byTitle.get(normText(h));
      if (!col) unmatchedHeaders.push(h);
      else if (!col.writable) ignoredByType.push({ csvHeader: h, columnTitle: col.title, type: col.type });
      else matched.push({ csvHeader: h, columnTitle: col.title, type: col.type });
    });
    missingDayColumns = WEEKDAYS.filter((w) => !boardColumns.some((c) => c.type === 'checkbox' && normText(c.title) === normText(w.title))).map((w) => w.title);
  }

  const existing = new Map(baseGroupRows.map((r) => [baseRowKey(r), r]));
  const emailKeyOf = (e: string | null | undefined) => (e ?? '').toLowerCase().replace(/\s+/g, '');
  const existingByEmail = new Map<string, StoredEngagementRow>();
  baseGroupRows.forEach((r) => { const k = emailKeyOf(r.email); if (k && !existingByEmail.has(k)) existingByEmail.set(k, r); });
  const deactCandidates = new Map<string, { name: string; email: string; rowKey: string }>();
  const activatedKeys = new Set<string>();
  let reactivated = 0;
  const updatedByStatus: Record<string, number> = {};
  const headerKey = H.join('|');
  let rowsRead = 0, discardedByStatus = 0, duplicatesInCsv = 0, titleRowsIgnored = 0;
  let toCreate = 0, toUpdate = 0, unchanged = 0, checksToMark = 0, outsideWeek = 0, noLastAccess = 0, teamFilled = 0;
  const checksByWeekday = emptyDayCounts();
  const discardedByLabel: Record<string, number> = {};
  const seen = new Set<string>();
  const rows: StoredEngagementRow[] = [];

  matrix.slice(headerIdx + 1).forEach((row) => {
    if (row.map(normText).join('|') === headerKey) return; // cabeçalho repetido por grupo do export
    const filled = row.filter((c) => c && c.trim()).length;
    if (filled === 0) return;
    if (filled === 1 && (row[0] ?? '').trim()) { titleRowsIgnored++; return; }
    rowsRead++;
    const name = (row[0] ?? '').trim();
    const email = extractEmail(emailIdx >= 0 ? row[emailIdx] : '') || (name.includes('@') ? extractEmail(name) : '');
    if (!isActivatedStatus(row[statusIdx])) {
      // Desativado/convite/vazio: só atualiza quem JÁ tem linha nesta semana; senão ignora (nada é criado)
      const ek = emailKeyOf(email);
      const prevRow = ek ? existingByEmail.get(ek) : existing.get(baseRowKey({ name: name || email, email: '', group: groupName.trim() }));
      if (!prevRow) {
        discardedByStatus++;
        const lbl = (row[statusIdx] ?? '').trim() || '(vazio)';
        discardedByLabel[lbl] = (discardedByLabel[lbl] ?? 0) + 1;
      } else if (isActivatedStatus(prevRow.userStatus)) {
        deactCandidates.set(baseRowKey(prevRow), { name: prevRow.name, email: prevRow.email, rowKey: baseRowKey(prevRow) });
      }
      return;
    }

    const lastAccessRaw = (row[lastAccessIdx] ?? '').trim();
    const la = parseDateFlexible(lastAccessRaw);
    const laIso = la ? toISODate(la) : null;

    const checkedDays: WeekdayKey[] = [];
    if (!laIso) noLastAccess++;
    else if (laIso === analysisDate) checkedDays.push(weekday);
    else if (laIso < weekStartIso || laIso > weekEndIso) outsideWeek++;

    const boardValues: Record<string, string> = {};
    valueIdx.forEach(({ h, i }) => { const v = (row[i] ?? '').trim(); if (v) boardValues[h] = v; });
    valueIdx.forEach(({ h, i }) => { if (i === statusIdx) boardValues[h] = 'Ativado'; });

    const r: StoredEngagementRow = {
      name: name || email, email,
      // Equipe exatamente como vem no CSV (várias equipes por pessoa ficam todas, sem cortar)
      team: teamIdx >= 0 ? (row[teamIdx] ?? '').trim() : '',
      department: deptIdx >= 0 ? (row[deptIdx] ?? '').trim() : '',
      lastAccess: lastAccessRaw || null,
      refDate: analysisDate,
      weekStart: weekStartIso,
      weekEnd: weekEndIso,
      userStatus: 'Ativado',
      group: groupName.trim(),
      checkedDays,
      boardValues,
    };
    const key = baseRowKey(r);
    if (seen.has(key)) { duplicatesInCsv++; return; }
    seen.add(key);
    activatedKeys.add(key);
    rows.push(r);
    if (r.team) teamFilled++;

    const prev = existing.get(key);
    const next = mergeRow(prev, r, 'analysis');
    const newChecks = (next.checkedDays ?? []).filter((d) => !(prev?.checkedDays ?? []).includes(d));
    newChecks.forEach((d) => { const k = d as WeekdayKey; checksByWeekday[k]++; });
    checksToMark += newChecks.length;
    if (!prev) toCreate++;
    else if (rowFingerprint(prev) === rowFingerprint(next)) unchanged++;
    else {
      toUpdate++;
      const st = isActivatedStatus(prev.userStatus) ? 'Ativado' : 'Desativado';
      updatedByStatus[st] = (updatedByStatus[st] ?? 0) + 1;
    }
    if (prev && !isActivatedStatus(prev.userStatus)) reactivated++;
  });

  // Quem aparece Ativado em outra linha do mesmo CSV não é desativado
  const deactivations = Array.from(deactCandidates.values()).filter((d) => !activatedKeys.has(d.rowKey)).map(({ name, email }) => ({ name, email }));

  return {
    ok: true,
    plan: {
      deactivations, deactivatedEmails: deactivations.slice(0, 10).map((d) => d.email || d.name), reactivated, updatedByStatus,
      rowsRead, discardedByStatus, discardedByLabel, duplicatesInCsv, titleRowsIgnored, rows,
      toCreate, toUpdate, unchanged, checksToMark, checksByWeekday, outsideWeek, noLastAccess,
      weekday, weekRangeLabel: `${brDate(weekStartIso)} a ${brDate(weekEndIso)}`, weekStartIso, weekEndIso,
      matched, ignoredByType, unmatchedHeaders, missingDayColumns,
      teamHeader, teamFilled, teamEmpty: rows.length - teamFilled,
      teamBoardColumn: (() => {
        const c = boardColumns?.find((x) => ['equipes', 'equipe', 'times', 'teams'].includes(normText(x.title)));
        return c ? { title: c.title, type: c.type, writable: c.writable } : null;
      })(),
    },
  };
}
