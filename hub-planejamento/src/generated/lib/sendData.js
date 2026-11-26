import { gql, sleep, fetchAllItems, fetchItemsByIds, txt, linkedIds, isRateLimit } from '@generated/lib/monday';
import { B_PROJ, B_MET, B_BASE, B_RISCOS } from '@generated/lib/engineData';

export const LINK_COL = 'link_mm7nck8b';
export const SYSTEM_BOARDS = new Set([B_PROJ, B_MET, B_BASE, B_RISCOS].map(String));
const RISK_COLS = ['rel_proj', 'rel_base', 'id_risco', 'causa', 'efeito', 'categoria', 'prob', 'imp', 'estrategia', 'resposta', 'responsavel', 'aplic', 'justif'];

/** Colunas do destino, identificadas por título (trim, minúsculas) e tipo. */
export const TARGETS = [
  { key: 'causa', title: 'Causa', type: 'long_text' },
  { key: 'efeito', title: 'Efeito', type: 'long_text' },
  { key: 'categoria', title: 'Categoria', type: 'dropdown' },
  { key: 'tema', title: 'Tema', type: 'dropdown' },
  { key: 'impactado', title: 'Impactado', type: 'dropdown' },
  { key: 'prob', title: 'Probabilidade', type: 'status' },
  { key: 'imp', title: 'Impacto', type: 'status' },
  { key: 'estrategia', title: 'Estratégia', type: 'status' },
  { key: 'resposta', title: 'Descrição da Resposta ao Risco', type: 'long_text' },
  { key: 'responsavel', title: 'Responsável pelo Monitoramento', type: 'people' },
];

/** Colunas opcionais: copiadas se existirem no destino; ausentes ou sem rótulo equivalente são ignoradas sem aviso. */
export const OPTIONAL_TARGETS = [
  { key: 'aplic', title: 'Aplicabilidade', type: 'status' },
  { key: 'justif', title: 'Justificativa', type: 'long_text' },
];

export const norm = (s) => String(s ?? '').trim().toLowerCase();
export const parseBoardId = (s) => String(s ?? '').match(/\/boards\/(\d+)/)?.[1] ?? null;

/** Vários rótulos: usa os valores do dropdown quando disponíveis, senão separa o texto por ", ". */
export const listLabels = (cv) => {
  if (Array.isArray(cv?.values) && cv.values.length) return cv.values.map((v) => String(v.label ?? '').trim()).filter(Boolean);
  return txt(cv).split(', ').map((s) => s.trim()).filter(Boolean);
};

/** Lê o "Link do Planejamento" (value + text) dos projetos e extrai o id do quadro (ignora /views/...). */
export async function readProjectLinks(ids) {
  const items = await fetchItemsByIds(ids, [LINK_COL]);
  return items.map((it) => {
    const cv = it.cols[LINK_COL];
    let url = '';
    try { url = JSON.parse(cv?.value || 'null')?.url || ''; } catch { url = ''; }
    const text = txt(cv);
    return { id: it.id, name: it.name, url, text, boardId: parseBoardId(url) || parseBoardId(text) };
  });
}

function labelsFromSettings(col) {
  let s = col.settings_str ?? col.settings;
  if (typeof s === 'string') {
    try { s = JSON.parse(s); } catch { s = null; }
  }
  const raw = s?.labels;
  const list = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? Object.values(raw) : [];
  return list
    .map((l) => (typeof l === 'string' ? l : l?.name ?? l?.label ?? ''))
    .map((l) => String(l).trim())
    .filter(Boolean);
}

/** Lê o quadro destino (grupos, views e colunas com rótulos). Retorna null se não existir / sem acesso. */
export async function readDestBoard(boardId) {
  const q = (field) => `query ($b: [ID!]) { boards(ids: $b) { id name groups { id title } views { id name } columns { id title type ${field} } } }`;
  let res;
  try {
    res = await gql(q('settings_str'), { b: [String(boardId)] });
  } catch (err) {
    if (isRateLimit(err) || !/settings_str/i.test(String(err?.message))) throw err;
    res = await gql(q('settings'), { b: [String(boardId)] });
  }
  const b = res?.boards?.[0];
  if (!b) return null;
  return { ...b, columns: (b.columns || []).map((c) => ({ ...c, labels: labelsFromSettings(c) })) };
}

/** View "Riscos" do quadro, ignorando maiúsculas e prefixo numérico (ex.: "5. RISCOS"). */
export function findRiscosView(views) {
  const clean = (n) => norm(n).replace(/^\d+\s*[.\-–:)]*\s*/, '').trim();
  return (views || []).find((v) => clean(v.name) === 'riscos') ?? null;
}

/** Mapeia as colunas esperadas no destino; devolve as encontradas e os títulos ausentes (só obrigatórias). */
export function mapColumns(columns) {
  const map = {};
  const missing = [];
  const find = (t) => columns.find((c) => norm(c.title) === norm(t.title) && c.type === t.type);
  TARGETS.forEach((t) => {
    const col = find(t);
    if (col) map[t.key] = { id: col.id, title: col.title, labels: col.labels };
    else missing.push(t.title);
  });
  OPTIONAL_TARGETS.forEach((t) => {
    const col = find(t);
    if (col) map[t.key] = { id: col.id, title: col.title, labels: col.labels, optional: true };
  });
  return { map, missing };
}

/** Itens já existentes no grupo "Riscos" do destino: ids (R..-..) e nomes. */
export async function readDestExisting(boardId, groupId) {
  const ids = new Set();
  const names = new Set();
  const add = (items) => (items || []).forEach((it) => {
    const m = String(it.name || '').match(/^\s*(R\d*-\d+)/);
    if (m) ids.add(m[1].toUpperCase());
    names.add(norm(it.name));
  });
  const first = await gql(
    'query ($b: [ID!], $g: [String]) { boards(ids: $b) { groups(ids: $g) { items_page(limit: 500) { cursor items { id name } } } } }',
    { b: [String(boardId)], g: [groupId] }
  );
  const page = first?.boards?.[0]?.groups?.[0]?.items_page;
  add(page?.items);
  let cursor = page?.cursor || null;
  while (cursor) {
    await sleep(250);
    const next = await gql('query ($c: String!) { next_items_page(limit: 500, cursor: $c) { cursor items { id name } } }', { c: cursor });
    add(next?.next_items_page?.items);
    cursor = next?.next_items_page?.cursor || null;
  }
  return { ids, names };
}

/** TODOS os riscos do 09.4 ligados ao projeto, qualquer aplicabilidade (paginação completa). */
export async function readProjectRisks(projectId) {
  const pid = String(projectId);
  let items;
  try {
    items = await fetchAllItems(B_RISCOS, RISK_COLS, {
      rules: [{ column_id: 'rel_proj', compare_value: [Number(pid)], operator: 'any_of' }],
    });
  } catch (err) {
    if (isRateLimit(err)) throw err;
    console.error('Filtro por projeto não aceito; lendo o 09.4 completo:', err);
    items = await fetchAllItems(B_RISCOS, RISK_COLS);
  }
  return items.filter((it) => linkedIds(it.cols.rel_proj).includes(pid));
}

/** Total de riscos por projeto no 09.4 e detalhamento por aplicabilidade. Map projetoId → { total, by }. */
export async function countProjectRisks(projectIds) {
  const ids = projectIds.map(String);
  const counts = new Map(ids.map((id) => [id, { total: 0, by: {} }]));
  const items = await fetchAllItems(B_RISCOS, ['rel_proj', 'aplic'], {
    rules: [{ column_id: 'rel_proj', compare_value: ids.map(Number), operator: 'any_of' }],
  });
  items.forEach((it) => {
    const label = txt(it.cols.aplic).trim() || 'Sem status';
    linkedIds(it.cols.rel_proj).forEach((pid) => {
      const c = counts.get(pid);
      if (!c) return;
      c.total += 1;
      c.by[label] = (c.by[label] || 0) + 1;
    });
  });
  return counts;
}

/** Tema e Impactado da Base 09.2 para os riscos ligados. Map riscoId → { tema, impactado }. */
export async function readBaseThemes(riskIds) {
  const out = new Map();
  if (!riskIds.length) return out;
  const items = await fetchItemsByIds(riskIds, ['tema', 'impactado']);
  items.forEach((it) => out.set(it.id, { tema: listLabels(it.cols.tema), impactado: listLabels(it.cols.impactado) }));
  return out;
}

/** Nomes dos quadros (para a lista). Map boardId → nome; ausentes = sem acesso / inexistente. */
export async function readBoardNames(boardIds) {
  const out = new Map();
  for (let i = 0; i < boardIds.length; i += 50) {
    const res = await gql('query ($b: [ID!]) { boards(ids: $b) { id name } }', { b: boardIds.slice(i, i + 50) });
    (res?.boards || []).forEach((b) => b && out.set(String(b.id), b.name));
  }
  return out;
}
