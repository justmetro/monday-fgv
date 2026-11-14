import { db } from '@vibe/db/server';
import type { VibeDoc } from '@vibe/db/server';
import { historyConfig, projects } from '@generated/models';
import type { HistoryConfigDoc, ProjectDoc } from '@generated/models';
import { extractCodes, isDuplicateName, matchProjects, type HItem } from '@generated/lib/history';
import { gql } from './monday.server';
import { loadAll } from './sync.server';

type CV = {
  id: string; type: string; text: string | null;
  label?: string | null;
  persons_and_teams?: { id: string; kind: string }[] | null;
  values?: { label: string }[] | null;
  tags?: { name: string }[] | null;
};
type Raw = { id: string; name: string; url: string; column_values: CV[] };
type FieldState = 'ok' | 'empty' | 'unmapped' | 'unavailable';

const FIELDS = `id name url column_values(ids:$c){ id type text
  ... on StatusValue { label }
  ... on PeopleValue { persons_and_teams { id kind } }
  ... on DropdownValue { values { label } }
  ... on TagsValue { tags { name } } }`;

export async function getConfig(): Promise<VibeDoc<HistoryConfigDoc> | null> {
  const docs = await db.collection(historyConfig).limit(1).get();
  return docs[0] ?? null;
}

const colsOf = (c: HistoryConfigDoc) => [c.statusCol, c.managerCol, c.axesCol, c.codeCol].filter((x): x is string => !!x);
const split = (t: string | null) => (t ?? '').split(',').map((s) => s.trim()).filter(Boolean);

/** Lê um campo respeitando o tipo real da coluna; distingue vazio, não mapeado e indisponível. */
function readField(item: Raw, colId: string | null): { state: FieldState; values: string[]; ids: string[] } {
  if (!colId) return { state: 'unmapped', values: [], ids: [] };
  const cv = item.column_values.find((c) => c.id === colId);
  if (!cv) return { state: 'unavailable', values: [], ids: [] };
  let values: string[] = [];
  let ids: string[] = [];
  if (cv.type === 'status') values = cv.label ? [cv.label] : [];
  else if (cv.type === 'people') { values = split(cv.text); ids = (cv.persons_and_teams ?? []).filter((p) => p.kind === 'person').map((p) => String(p.id)); }
  else if (cv.type === 'dropdown') values = (cv.values ?? []).map((v) => v.label).filter(Boolean);
  else if (cv.type === 'tags') values = (cv.tags ?? []).map((t) => t.name).filter(Boolean);
  else values = split(cv.text);
  return { state: values.length ? 'ok' : 'empty', values: [...new Set(values)], ids };
}

async function statusColors(cfg: HistoryConfigDoc): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!cfg.statusCol) return out;
  try {
    const r = await gql<{ boards: { columns: { settings_str: string }[] }[] }>(
      `query($b:[ID!],$c:[String]){ boards(ids:$b){ columns(ids:$c){ settings_str } } }`, { b: [cfg.boardId], c: [cfg.statusCol] });
    const s = JSON.parse(r.boards?.[0]?.columns?.[0]?.settings_str || '{}') as {
      labels?: Record<string, string> | { id?: number; label?: string; color?: string }[];
      labels_colors?: Record<string, { color?: string }>;
    };
    if (Array.isArray(s.labels)) s.labels.forEach((l) => l.label && l.color && out.set(l.label, l.color));
    else if (s.labels) Object.entries(s.labels).forEach(([idx, label]) => { const c = s.labels_colors?.[idx]?.color; if (label && c) out.set(label, c); });
  } catch (e) { console.error('[histórico] cores de status indisponíveis', e); }
  return out;
}

function toHItem(r: Raw, cfg: HistoryConfigDoc, colors: Map<string, string>): HItem {
  const nameCodes = extractCodes(r.name);
  const rawCol = cfg.codeCol ? readField(r, cfg.codeCol).values.join(', ') : '';
  const colCode = rawCol ? (extractCodes(rawCol)[0] ?? rawCol.trim()) : null;
  const status = readField(r, cfg.statusCol).values[0] ?? null;
  return {
    id: String(r.id), name: r.name, url: r.url,
    colCode, nameCodes,
    codes: colCode ? [colCode] : nameCodes,
    codeConflict: colCode && nameCodes.length > 0 && !nameCodes.includes(colCode) ? `Coluna de código (${colCode}) diverge do nome (${nameCodes.join(', ')}).` : null,
    duplicate: isDuplicateName(r.name),
    status, statusColor: status ? colors.get(status) ?? null : null,
    managers: readField(r, cfg.managerCol).values, axes: readField(r, cfg.axesCol).values,
  };
}

/** Leitura paginada completa do quadro (sem filtros/visualizações). */
export async function loadAllHistory(cfg: HistoryConfigDoc): Promise<HItem[]> {
  const c = colsOf(cfg).length ? colsOf(cfg) : ['name'];
  const first = await gql<{ boards: { items_page: { cursor: string | null; items: Raw[] } }[] }>(
    `query($b:[ID!],$c:[String!]){ boards(ids:$b){ items_page(limit:500){ cursor items{ ${FIELDS} } } } }`, { b: [cfg.boardId], c });
  const page = first.boards?.[0]?.items_page;
  if (!page) throw new Error('O quadro Histórico de Projetos não foi retornado pela consulta.');
  const raws = [...(page.items ?? [])];
  let cursor = page.cursor; let guard = 0;
  while (cursor && guard++ < 200) {
    const n = await gql<{ next_items_page: { cursor: string | null; items: Raw[] } }>(
      `query($cur:String!,$c:[String!]){ next_items_page(limit:500, cursor:$cur){ cursor items{ ${FIELDS} } } }`, { cur: cursor, c });
    raws.push(...(n.next_items_page?.items ?? []));
    cursor = n.next_items_page?.cursor ?? null;
  }
  const colors = await statusColors(cfg);
  return raws.map((r) => toHItem(r, cfg, colors));
}

/** Consulta em lote apenas os elementos vinculados (por ID). */
async function fetchByIds(cfg: HistoryConfigDoc, ids: string[]): Promise<Map<string, Raw>> {
  const out = new Map<string, Raw>();
  const c = colsOf(cfg).length ? colsOf(cfg) : ['name'];
  for (let i = 0; i < ids.length; i += 100) {
    const r = await gql<{ items: Raw[] }>(`query($i:[ID!],$c:[String!]){ items(ids:$i, limit:100){ ${FIELDS} } }`, { i: ids.slice(i, i + 100), c });
    (r.items ?? []).forEach((x) => out.set(String(x.id), x));
  }
  return out;
}

export const CLEAR_META: Partial<ProjectDoc> = {
  hBoardId: null, hItemId: null, hItemName: null, hItemUrl: null, hItemCode: null, hOrigin: null, hShared: null, hConflict: null,
  hStatus: null, hStatusColor: null, hManagers: [], hManagerIds: [], hAxes: [],
  hStatusState: null, hManagerState: null, hAxesState: null, hValidation: null,
};

/** Atualiza os metadados dos projetos vinculados, pelo ID do elemento. Falhas preservam valores anteriores. */
export async function refreshMeta(boardIds?: string[]) {
  const cfg = (await getConfig())?.data;
  const all = await loadAll<ProjectDoc>(projects);
  const targets = all.filter((p) => p.data.hLink === 'confirmed' && p.data.hItemId && (!boardIds || boardIds.includes(p.data.boardId)));
  const results: { boardId: string; name: string; ok: boolean; summary: string }[] = [];
  if (!cfg) return { results, error: 'Histórico de Projetos não configurado.' };
  const now = new Date().toISOString();
  let byId: Map<string, Raw>;
  let colors: Map<string, string>;
  try {
    [byId, colors] = await Promise.all([fetchByIds(cfg, [...new Set(targets.map((p) => p.data.hItemId!))]), statusColors(cfg)]);
  } catch (e) {
    const msg = `Falha de leitura do Histórico: ${e instanceof Error ? e.message : 'erro desconhecido'}. Dados anteriores preservados.`;
    for (const p of targets) {
      await db.collection(projects).doc(p.id).update({ hLastAttemptAt: now, hLastOk: false, hValidation: 'error', hLastMessage: msg });
      results.push({ boardId: p.data.boardId, name: p.data.name, ok: false, summary: msg });
    }
    return { results, error: msg };
  }
  for (const p of targets) {
    const raw = byId.get(p.data.hItemId!);
    if (!raw) {
      const msg = 'O elemento vinculado não foi retornado (pode ser restrição de acesso). Vínculo não validado; dados anteriores preservados.';
      await db.collection(projects).doc(p.id).update({ hLastAttemptAt: now, hLastOk: false, hValidation: 'not_returned', hLastMessage: msg });
      results.push({ boardId: p.data.boardId, name: p.data.name, ok: false, summary: msg });
      continue;
    }
    const h = toHItem(raw, cfg, colors);
    const st = readField(raw, cfg.statusCol), mg = readField(raw, cfg.managerCol), ax = readField(raw, cfg.axesCol);
    const upd: Partial<ProjectDoc> = {
      hItemName: h.name, hItemUrl: h.url, hBoardId: cfg.boardId, hItemCode: h.codes[0] ?? null,
      hCode: extractCodes(p.data.name).join(', ') || null,
      hStatusState: st.state, hManagerState: mg.state, hAxesState: ax.state,
      hLastAttemptAt: now, hLastSuccessAt: now, hLastOk: true, hValidation: 'ok',
    };
    // Valor indisponível mantém o anterior; vazio confirmado ou não mapeado limpa.
    if (st.state !== 'unavailable') { upd.hStatus = h.status; upd.hStatusColor = h.statusColor; }
    if (mg.state !== 'unavailable') { upd.hManagers = mg.values; upd.hManagerIds = mg.ids; }
    if (ax.state !== 'unavailable') upd.hAxes = ax.values;
    const notes: string[] = [];
    if (h.codeConflict) notes.push(h.codeConflict);
    const pc = extractCodes(p.data.name);
    const ic = h.codes[0];
    if (p.data.hOrigin === 'code' && pc.length === 1 && ic && pc[0] !== ic) notes.push(`Código do projeto (${pc[0]}) diverge do elemento (${ic}).`);
    if (p.data.hItemCode && ic && p.data.hItemCode !== ic) notes.push(`Código do elemento mudou de ${p.data.hItemCode} para ${ic}.`);
    upd.hConflict = notes.length ? notes.join(' ') : null;
    const msg = notes.length ? `Atualizado com divergência para revisão: ${notes.join(' ')}` : 'Cadastro atualizado.';
    upd.hLastMessage = msg;
    await db.collection(projects).doc(p.id).update(upd);
    results.push({ boardId: p.data.boardId, name: p.data.name, ok: true, summary: msg });
  }
  return { results, error: null as string | null };
}

export async function setLink(boardId: string, item: HItem, origin: 'code' | 'manual', shared: boolean) {
  const all = await loadAll<ProjectDoc>(projects);
  const p = all.find((x) => x.data.boardId === boardId);
  if (!p) throw new Error('Projeto não encontrado.');
  const cfg = (await getConfig())?.data;
  await db.collection(projects).doc(p.id).update({
    ...CLEAR_META, hLink: 'confirmed', hPendingReason: null, hOrigin: origin, hShared: shared,
    hBoardId: cfg?.boardId ?? null, hItemId: item.id, hItemName: item.name, hItemUrl: item.url, hItemCode: item.codes[0] ?? null,
    hCode: extractCodes(p.data.name).join(', ') || null,
  });
}

/** Ao importar um projeto novo: vincula só se a correspondência for inequívoca; senão marca pendente. */
export async function autoLink(boardId: string): Promise<string | null> {
  try {
    const cfg = (await getConfig())?.data;
    if (!cfg) return null;
    const all = await loadAll<ProjectDoc>(projects);
    const p = all.find((x) => x.data.boardId === boardId);
    if (!p || p.data.hLink === 'confirmed') return null;
    const items = await loadAllHistory(cfg);
    const row = matchProjects(all.map((x) => x.data), items).find((r) => r.boardId === boardId);
    const item = row?.kase === 'unique' ? items.find((h) => h.id === row.candidateIds[0]) : undefined;
    if (row && item) { await setLink(boardId, item, 'code', false); await refreshMeta([boardId]); return 'Vínculo com o Histórico encontrado por código.'; }
    await db.collection(projects).doc(p.id).update({ hLink: 'pending', hPendingReason: row?.kase ?? 'notFound', hCode: row?.codes.join(', ') || null });
    return 'Vínculo com o Histórico pendente de revisão.';
  } catch (e) {
    console.error('[histórico] vínculo automático falhou', e);
    return 'Não foi possível consultar o Histórico; vínculo pendente.';
  }
}
