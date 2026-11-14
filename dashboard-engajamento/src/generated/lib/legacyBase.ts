// "Base antiga": XLSX do formato antigo convertido em linhas da Base (uma por pessoa + grupo).
// Regras próprias desta seção (não valem para o envio normal):
// - descarta só Status "Deactivated - No Access"; as demais entram com Status do usuário "Ativado";
// - a semana é o período digitado (domingo a sábado); a Data da análise só limita os acessos depois do fim da semana;
// - check do dia do último acesso dentro do período; depois do fim e até a Data da análise = Sábado.
import type { StoredEngagementRow } from '@generated/models';
import { parseDateFlexible, toISODate } from './dates';
import { cleanDays, baseRowKey, mergeRow, rowFingerprint } from './baseRows';
import { emptyDayCounts, extractEmail, normText, weekdayOfIso, WEEKDAYS, type WeekdayKey } from './weekdays';

export const LEGACY_DISCARD_STATUS = 'Deactivated - No Access';

export interface LegacyReference { group: string; weekStart: string; weekEnd: string; emails: string[] }

export interface WeekRangeIso { weekStart: string; weekEnd: string }

export type LegacyAccessKind = 'in' | 'after' | 'none';

/**
 * Check da base antiga para um último acesso, com o período digitado (domingo a sábado):
 * - dentro do período: check do dia da semana da data;
 * - depois do fim da semana e até a Data da análise (inclusive): engajada, check sempre Sábado;
 * - vazio, anterior ao início ou posterior à Data da análise: sem check.
 * No máximo um check por pessoa.
 */
export function legacyAccess(lastAccess: string | null | undefined, analysisDate: string, range: WeekRangeIso): { days: WeekdayKey[]; kind: LegacyAccessKind } {
  const la = toISODate(parseDateFlexible(lastAccess ?? ''));
  if (!la || la > analysisDate || la < range.weekStart) return { days: [], kind: 'none' };
  if (la <= range.weekEnd) {
    const wd = weekdayOfIso(la);
    return wd ? { days: [wd], kind: 'in' } : { days: [], kind: 'none' };
  }
  return { days: ['sab'], kind: 'after' };
}

export function legacyChecks(lastAccess: string | null | undefined, analysisDate: string, range: WeekRangeIso): WeekdayKey[] {
  return cleanDays(legacyAccess(lastAccess, analysisDate, range).days) as WeekdayKey[];
}

/** Data do XLSX: número de série do Excel ou texto. Devolve AAAA-MM-DD ou null. */
export function xlsxDate(raw: string | undefined): string | null {
  const v = (raw ?? '').trim();
  if (!v) return null;
  if (/^\d+(\.\d+)?$/.test(v)) {
    const n = Number(v);
    if (n > 20000 && n < 80000) {
      const ms = Math.round((n - 25569) * 86400000);
      const d = new Date(ms);
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    }
  }
  const d = parseDateFlexible(v);
  return d ? toISODate(d) : null;
}

export interface LegacyPlan {
  sheetName: string;
  sheetCount: number;
  rowsRead: number;
  discarded: number; // Status "Deactivated - No Access"
  byStatus: Record<string, number>; // linhas que entraram, por status
  discardedByLabel: Record<string, number>;
  statusRead: Record<string, number>; // linhas lidas por valor de status
  statusFormat: 'novo' | 'antigo';
  candidateStats: { header: string; letter: string; ratio: number; role: string }[];
  duplicatesInFile: number;
  rows: StoredEngagementRow[];
  toCreate: number;
  toUpdate: number;
  unchanged: number;
  range: WeekRangeIso;
  checksByWeekday: Record<WeekdayKey, number>;
  inWeek: number; // acessos dentro do período digitado
  afterWeekSaturday: number; // acessos depois do fim da semana, até a Data da análise (marcados em Sábado)
  noCheck: number; // sem check (vazio, antes do início ou depois da Data da análise)
  analysisBeforeWeekEnd: boolean;
  noLastAccess: number;
  teamFilled: number;
  createdAtFilled: number;
  ignoredHeaders: string[];
  missingDayColumns: string[];
  boardHasCreatedAt: boolean | null; // null = quadro não lido
  noIdentification: number; // sem e-mail e sem nome
  sumOk: boolean; // lidas = Deactivated + sem identificação + duplicadas + fora da análise mais recente + entram
  notInReference: number;
  notInReferenceSamples: LegacySampleRow[];
  reference: { group: string; weekStart: string; weekEnd: string; people: number };
  firstRows: LegacySampleRow[];
  firstEntrants: { email: string; name: string }[];
  emailColumn: string;
  nameColumn: string;
}

export interface LegacySampleRow { email: string; name: string; status: string; lastAccess: string | null; team: string; createdAt: string | null }

/** E-mail da célula: texto simples/rico, "<...>", mailto:, ou o destino do hiperlink quando o texto não tem @. */
export function cellEmail(text: string | undefined, link: string | undefined): string {
  const clean = (s: string) => {
    let v = s.trim();
    try { v = decodeURIComponent(v); } catch { /* mantém */ }
    v = v.replace(/^mailto:/i, '').split('?')[0] ?? '';
    return extractEmail(v).trim().toLowerCase();
  };
  const t = (text ?? '').trim();
  if (t.includes('@')) {
    const e = clean(t);
    if (e) return e;
  }
  return link ? clean(link) : '';
}

export function buildLegacyPlan(
  matrix: string[][],
  sheet: { name: string; count: number },
  analysisDate: string,
  range: WeekRangeIso,
  groupName: string,
  baseGroupRows: StoredEngagementRow[],
  boardColumns: { title: string; type: string }[] | null,
  links?: string[][],
  cells?: { ref: string; type: string; raw: string }[][],
  reference?: LegacyReference | null
): { ok: true; plan: LegacyPlan } | { ok: false; message: string } {
  if (!reference) return { ok: false, message: 'Não há nenhuma semana com período definido na Base, então não existe referência de pessoas ativas. Envio da Base antiga bloqueado. Nada foi gravado.' };
  const refEmails = new Set(reference.emails.map((e) => e.toLowerCase().replace(/\s+/g, '')));
  const notInReference: LegacySampleRow[] = [];
  let notInReferenceCount = 0;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(analysisDate)) return { ok: false, message: 'Data da análise inválida. Nada foi gravado.' };
  // Cabeçalho procurado nas 10 primeiras linhas, ignorando maiúsculas, acentos, espaços e hífen
  const hk = (s: string | undefined) => normText(s).replace(/[\s-]+/g, '');
  const letter = (i: number) => (i < 0 ? '—' : i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26)));
  const CAND = ['name', 'nome', 'email'];
  const STATUS_H = ['status', 'userstatus', 'statusdousuario'];
  const headerIdx = matrix.slice(0, 10).findIndex((r) => r.some((c) => CAND.includes(hk(c))) && r.some((c) => hk(c) === 'ativopelaultimavez' || STATUS_H.includes(hk(c))));
  if (headerIdx < 0) {
    const first = matrix.slice(0, 10).find((r) => r.filter((c) => c && c.trim()).length > 1) ?? [];
    return { ok: false, message: `Não encontrei a linha de cabeçalho nas 10 primeiras linhas. Faltou: uma coluna "Name", "Nome" ou "E-mail" e "Status" ou "Ativo pela última vez" na mesma linha. Cabeçalhos encontrados na primeira linha preenchida: ${first.filter((c) => c.trim()).map((c) => `"${c.trim()}"`).join(', ') || '(nenhum)'}. Nada foi gravado.` };
  }
  const headerRow = matrix[headerIdx] ?? [];
  const H = headerRow.map((h) => hk(h));
  const found = `Cabeçalhos encontrados: ${headerRow.filter((c) => c.trim()).map((c) => `"${c.trim()}"`).join(', ') || '(nenhum)'}.`;
  const col = (t: string) => H.indexOf(t);
  const iLast = col('ativopelaultimavez');
  const iTeam = col('equipes');
  const iDept = col('departamento');
  const iStatus = H.findIndex((h) => STATUS_H.includes(h));
  const iCreated = col('criadoem');
  if (iLast < 0) return { ok: false, message: `Faltou a coluna "Ativo pela última vez". ${found} Nada foi gravado.` };
  // E-mail e nome são identificados pelo conteúdo: entre as colunas "Name", "Nome" e "E-mail", vence a de maior proporção de "@"
  const dataRows = matrix.slice(headerIdx + 1).map((row, pos) => ({ row, pos })).filter(({ row }) => row.filter((c) => c && c.trim()).length > 0);
  const candIdx = H.map((h, i) => (CAND.includes(h) ? i : -1)).filter((i) => i >= 0);
  const stats = candIdx.map((i) => {
    let nonEmpty = 0, withAt = 0;
    dataRows.forEach(({ row, pos }) => {
      const t = (row[i] ?? '').trim();
      const lk = links?.[headerIdx + 1 + pos]?.[i] ?? '';
      if (!t && !lk) return;
      nonEmpty++;
      if (t.includes('@') || lk.includes('@')) withAt++;
    });
    return { index: i, header: headerRow[i]?.trim() ?? '', letter: letter(i), nonEmpty, withAt, ratio: nonEmpty > 0 ? withAt / nonEmpty : 0 };
  });
  const best = stats.reduce<(typeof stats)[number] | null>((b, s) => (!b || s.ratio > b.ratio ? s : b), null);
  const ratioText = stats.map((s) => `coluna ${s.letter} "${s.header}": ${Math.round(s.ratio * 100)}% (${s.withAt} de ${s.nonEmpty})`).join(' · ');
  if (!best || best.ratio < 0.9) {
    return { ok: false, message: `Não consegui identificar a coluna de e-mail. Proporção de "@" por coluna candidata: ${ratioText || 'nenhuma coluna "Name", "Nome" ou "E-mail" encontrada'}. É preciso pelo menos 90%. ${found} Nada foi gravado.` };
  }
  const iEmail = best.index;
  const others = candIdx.filter((i) => i !== iEmail && H[i] !== 'email');
  const iNome = others.find((i) => H[i] === 'nome') ?? others[0] ?? -1;
  const candidateStats = stats.map((s) => ({ header: s.header, letter: s.letter, ratio: s.ratio, role: s.index === iEmail ? 'e-mail' : s.index === iNome ? 'nome' : 'ignorada' }));
  const known = new Set(['name', 'nome', 'email', 'ativopelaultimavez', 'equipes', 'departamento', 'criadoem', ...STATUS_H]);
  // Título, Função do usuário, Fórmula, Cargo, Engajamento - 30 dias, Última atualização (e qualquer outra) são ignoradas
  const ignoredHeaders = headerRow.filter((h, i) => h.trim() && !known.has(H[i] ?? '')).map((h) => h.trim());
  // Formato do status: novo ("Ativado" / "Desativado - ...") ou antigo (descarta só "Deactivated - No Access")
  const statusSeen = new Set(dataRows.map(({ row }) => normText(iStatus >= 0 ? row[iStatus] : '')).filter(Boolean));
  const newFormat = iStatus >= 0 && statusSeen.size > 0 && Array.from(statusSeen).every((s) => s === 'ativado' || s.startsWith('desativado'));
  const statusRead: Record<string, number> = {};
  const discardedByLabel: Record<string, number> = {};

  const existing = new Map(baseGroupRows.map((r) => [baseRowKey(r), r]));
  const byStatus: Record<string, number> = {};
  const checksByWeekday = emptyDayCounts();
  let rowsRead = 0, discarded = 0, noIdentification = 0, noEmail = 0, toCreate = 0, toUpdate = 0, unchanged = 0;
  let inWeek = 0, afterWeekSaturday = 0, noCheck = 0, noLastAccess = 0, teamFilled = 0, createdAtFilled = 0;
  const rawEmailSamples: string[] = [];
  let emptyEmailCells = 0;
  const firstRows: LegacySampleRow[] = [];
  // Candidatos por pessoa (chave = e-mail em minúsculas, ou nome quando não há e-mail)
  const byKey = new Map<string, { r: StoredEngagementRow; status: string }>();
  let candidates = 0;

  dataRows.forEach(({ row, pos }) => {
    rowsRead++;
    const rawEmail = row[iEmail] ?? '';
    if (!rawEmail.trim()) emptyEmailCells++;
    if (rawEmailSamples.length < 5) {
      const info = cells?.[headerIdx + 1 + pos]?.[iEmail];
      rawEmailSamples.push(`${info?.ref ?? `${letter(iEmail)}${headerIdx + 2 + pos}`} · tipo ${info?.type ?? '(vazia)'} · bruto "${info?.raw ?? ''}" · exibido "${rawEmail}"`);
    }
    const status = (iStatus >= 0 ? row[iStatus] ?? '' : '').trim();
    let email = cellEmail(rawEmail, links?.[headerIdx + 1 + pos]?.[iEmail]);
    let nome = (iNome >= 0 ? row[iNome] ?? '' : '').trim();
    if (!email && iNome >= 0) {
      // Coluna de e-mail sem "@" nesta linha, mas a de nome tem: o "@" da coluna de nome vira o e-mail e o nome vem da outra
      const alt = cellEmail(row[iNome], links?.[headerIdx + 1 + pos]?.[iNome]);
      if (alt) { email = alt; nome = rawEmail.trim(); }
    }
    const la = xlsxDate(row[iLast]);
    const team = iTeam >= 0 ? (row[iTeam] ?? '').trim() : '';
    const createdAt = iCreated >= 0 ? xlsxDate(row[iCreated]) : null;
    if (firstRows.length < 5) firstRows.push({ email, name: nome, status, lastAccess: la, team, createdAt });
    const statusLabel = status || '(vazio)';
    statusRead[statusLabel] = (statusRead[statusLabel] ?? 0) + 1;
    const drop = newFormat ? normText(status) !== 'ativado' : normText(status) === normText(LEGACY_DISCARD_STATUS);
    if (drop) { discarded++; discardedByLabel[statusLabel] = (discardedByLabel[statusLabel] ?? 0) + 1; return; }
    if (!email) noEmail++;
    if (!email && !nome) { noIdentification++; return; }
    const name = nome || email;
    const checks = legacyChecks(la, analysisDate, range);
    const department = iDept >= 0 ? (row[iDept] ?? '').trim() : '';
    const r: StoredEngagementRow = {
      name, email,
      // Equipe com o texto completo, sem cortar e sem dividir
      team,
      department,
      lastAccess: la,
      refDate: analysisDate,
      weekStart: range.weekStart,
      weekEnd: range.weekEnd,
      userStatus: 'Ativado',
      group: groupName.trim(),
      checkedDays: checks,
      boardValues: { ...(department ? { Departamento: department } : {}), 'Status do usuário': 'Ativado' },
      createdAt,
    };
    candidates++;
    const key = email ? `e:${email}` : `n:${normText(nome)}`;
    const cur = byKey.get(key);
    // E-mail repetido: fica a linha com "Ativo pela última vez" mais recente
    if (!cur || (la ?? '') > (cur.r.lastAccess ?? '')) byKey.set(key, { r, status });
  });

  const duplicatesInFile = candidates - byKey.size;
  const rows: StoredEngagementRow[] = [];
  byKey.forEach(({ r, status }) => {
    // Só entra quem está na semana de referência (e-mail em minúsculas, sem espaços)
    if (!r.email || !refEmails.has(r.email.toLowerCase().replace(/\s+/g, ''))) {
      notInReferenceCount++;
      if (notInReference.length < 10) notInReference.push({ email: r.email, name: r.name, status, lastAccess: r.lastAccess ?? null, team: r.team ?? '', createdAt: r.createdAt ?? null });
      return;
    }
    rows.push(r);
    const acc = legacyAccess(r.lastAccess, analysisDate, range);
    if (!r.lastAccess) noLastAccess++;
    if (acc.kind === 'in') inWeek++;
    else if (acc.kind === 'after') afterWeekSaturday++;
    else noCheck++;
    (r.checkedDays ?? []).forEach((d) => { checksByWeekday[d as WeekdayKey]++; });
    const label = status || '(vazio)';
    byStatus[label] = (byStatus[label] ?? 0) + 1;
    if (r.team) teamFilled++;
    if (r.createdAt) createdAtFilled++;
    const prev = existing.get(baseRowKey(r));
    const next = mergeRow(prev, r, 'analysis');
    if (!prev) toCreate++;
    else if (rowFingerprint(prev) === rowFingerprint(next)) unchanged++;
    else toUpdate++;
  });

  const notDiscarded = rowsRead - discarded;
  if (notDiscarded > 0 && noEmail / notDiscarded > 0.2) {
    return {
      ok: false,
      message: `Muitas linhas sem e-mail legível (${noEmail} de ${notDiscarded} na coluna ${letter(iEmail)} "${headerRow[iEmail] ?? ''}"). Nada foi gravado. Linhas de dados lidas: ${rowsRead} · células vazias na coluna do e-mail: ${emptyEmailCells}. Primeiras 5 células da coluna do e-mail: ${rawEmailSamples.join(' | ') || '(nenhuma)'}`,
    };
  }
  const sumOk = rowsRead === discarded + noIdentification + duplicatesInFile + notInReferenceCount + rows.length;

  const missingDayColumns = boardColumns
    ? WEEKDAYS.filter((w) => !boardColumns.some((c) => c.type === 'checkbox' && normText(c.title) === normText(w.title))).map((w) => w.title)
    : [];
  return {
    ok: true,
    plan: {
      sheetName: sheet.name, sheetCount: sheet.count, rowsRead, discarded, byStatus, duplicatesInFile, rows,
      discardedByLabel, statusRead, statusFormat: newFormat ? 'novo' : 'antigo', candidateStats,
      toCreate, toUpdate, unchanged, range, checksByWeekday, inWeek, afterWeekSaturday, noCheck, analysisBeforeWeekEnd: analysisDate < range.weekEnd, noLastAccess,
      teamFilled, createdAtFilled, ignoredHeaders, missingDayColumns,
      noIdentification, sumOk, firstRows,
      notInReference: notInReferenceCount, notInReferenceSamples: notInReference,
      reference: { group: reference.group, weekStart: reference.weekStart, weekEnd: reference.weekEnd, people: reference.emails.length },
      firstEntrants: rows.slice(0, 10).map((r) => ({ email: r.email, name: r.name })),
      emailColumn: `${letter(iEmail)} "${headerRow[iEmail] ?? ''}"`,
      nameColumn: iNome >= 0 ? `${letter(iNome)} "${headerRow[iNome] ?? ''}"` : '— (sem coluna de nome: o nome do item é o próprio e-mail)',
      boardHasCreatedAt: boardColumns ? boardColumns.some((c) => normText(c.title) === 'criado em') : null,
    },
  };
}
