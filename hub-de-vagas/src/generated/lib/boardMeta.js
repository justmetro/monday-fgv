import { board } from '@generated/lib/data';
import { applyBoardLabels } from '@generated/lib/colors';
import { MAIN_BOARD, SUB_BOARD, VAGA_FIELDS, PERFIL_FIELDS, SUB_FIELDS, FAMILIA_COL_ID } from '@generated/lib/config';

export { MAIN_BOARD, SUB_BOARD };

// SDK key → monday column id, for status columns whose labels/colors we read live.
export const STATUS_COL_IDS = {
  main: {
    statusDaVaga: 'color_mm6d3c1k', prioridadeDaVaga: 'color_mm6d7y0a', senioridadeVaga: 'color_mm6dj9pp', eixoDeAtuao: 'color_mm6dvpp8',
    modalidadeDeContratao: 'color_mm6ddf0w', formaDePreenchimento: 'color_mm6dbmtr', statusDoPerfil: 'color_mm6dbe8j', gatilhoDaRealocao: 'color_mm6dz16g',
    senioridadeAtual: 'color_mm6dxjvs', vnculo: 'color_mm6dw92', interesseEmMudarDeCidade: 'color_mm6dhdty', colaboradoraDestaque: 'color_mm6d3pdf',
    statusProgresso: 'color_mm6h5hwe', criticidade: 'color_mm6htm6w', decisoDoComitDePessoas: 'color_mm6hykf7',
  },
  sub: { rodada: 'color_mm6d1z2k', resultadoDaRodada: 'color_mm6d517p', statusDoMatch: 'color_mm6dtr9r' },
};

// Column ids of the ONLY writable fields.
export const WRITE_COL_IDS = {
  match: { rodada: 'color_mm6d1z2k', resultadoDaRodada: 'color_mm6d517p', statusDoMatch: 'color_mm6dtr9r', prximaAo: 'text_mm6d8snk', dataDaEntrevista: 'date_mm6d33nf', dataDeEnvioDoCard: 'date_mm6dkwn4' },
  vaga: { statusDaVaga: 'color_mm6d3c1k', prioridadeDaVaga: 'color_mm6d7y0a', dataDeIncioPrevista: 'date_mm6dtgf0' },
  perfil: { statusDoPerfil: 'color_mm6dbe8j' },
};

const LABELS_Q = `query ($ids: [ID!]) { boards(ids: $ids) { id columns(types: [status]) { id settings_str } } }`;

function parseLabels(settingsStr) {
  try {
    const s = JSON.parse(settingsStr || '{}');
    const labels = s.labels ?? {};
    const colors = s.labels_colors ?? {};
    const pos = s.labels_positions_v2 ?? {};
    return Object.entries(labels)
      .filter(([, l]) => typeof l === 'string' && l.trim())
      .sort((a, b) => (pos[a[0]] ?? Number(a[0])) - (pos[b[0]] ?? Number(b[0])))
      .map(([idx, label]) => ({ index: Number(idx), label, color: colors[idx]?.color ?? null }));
  } catch { return []; }
}
// Dropdown settings: { labels: [{ id, name }] } (new) or { labels: { id: name } } (legacy).
function parseDropdown(settingsStr) {
  try {
    const l = JSON.parse(settingsStr || '{}').labels ?? [];
    return (Array.isArray(l) ? l.map((x) => x?.name) : Object.values(l)).filter((x) => typeof x === 'string' && x.trim());
  } catch { return []; }
}

// ---- Schema (column existence + live "Família de área" options) -------------
const SCHEMA_Q = `query ($ids: [ID!]) { boards(ids: $ids) { id cols: columns { id title } fam: columns(ids: ["${FAMILIA_COL_ID}"]) { id settings_str } } }`;
let schemaP = null;
export function fetchSchema(force = false) {
  if (!schemaP || force) {
    schemaP = board.executeGraphQL(SCHEMA_Q, { ids: [MAIN_BOARD, SUB_BOARD] }).then((res) => {
      const bs = res?.boards ?? [];
      const ids = (id) => new Set((bs.find((b) => String(b.id) === id)?.cols ?? []).map((c) => c.id));
      const main = ids(MAIN_BOARD), sub = ids(SUB_BOARD);
      const uniq = (l) => [...new Map(l.map((f) => [f.id, f])).values()];
      const missing = [
        ...uniq([...VAGA_FIELDS, ...PERFIL_FIELDS]).filter((f) => !main.has(f.id)).map((f) => ({ ...f, board: 'principal' })),
        ...SUB_FIELDS.filter((f) => !sub.has(f.id)).map((f) => ({ ...f, board: 'subitens' })),
      ];
      const famCol = bs.find((b) => String(b.id) === MAIN_BOARD)?.fam?.[0];
      return { ok: true, missing, familiaOptions: famCol ? parseDropdown(famCol.settings_str) : [] };
    }).catch((e) => { console.error('[schema] não foi possível validar colunas', e); schemaP = null; return { ok: false, missing: [], familiaOptions: [], error: errMsg(e) }; });
  }
  return schemaP;
}

// Live label settings (independent from the permission check). Never throws.
export async function fetchMeta() {
  try {
    const [res] = await Promise.all([board.executeGraphQL(LABELS_Q, { ids: [MAIN_BOARD, SUB_BOARD] }), fetchSchema()]);
    const boards = res?.boards ?? [];
    const labels = {};
    [[MAIN_BOARD, STATUS_COL_IDS.main], [SUB_BOARD, STATUS_COL_IDS.sub]].forEach(([id, ids]) => {
      const b = boards.find((x) => String(x.id) === id);
      const byCol = Object.fromEntries((b?.columns ?? []).map((c) => [c.id, parseLabels(c.settings_str)]));
      Object.entries(ids).forEach(([key, colId]) => { if (byCol[colId]?.length) labels[key] = byCol[colId]; });
    });
    applyBoardLabels(labels);
    return { labelsLive: Object.keys(labels).length > 0 };
  } catch (e) {
    console.error('Não foi possível ler as labels do quadro', e);
    return { labelsLive: false };
  }
}

// Permission check: minimal query, degraded field by field if the API rejects one.
const PERM_VARIANTS = [
  { me: 'id', board: 'id permissions owners { id }' },
  { me: 'id', board: 'id permissions' },
  { me: 'id', board: 'id' },
];
export const errMsg = (e) => e?.response?.errors?.[0]?.message ?? e?.errors?.[0]?.message ?? e?.message ?? String(e);

// → { status: 'ok' | 'warn' | 'safe' | 'readonly', main, sub, reason }
export async function checkPermissions() {
  let lastError = null;
  for (const v of PERM_VARIANTS) {
    const q = `query { me { ${v.me} }${v.board ? ` boards(ids: [${MAIN_BOARD}, ${SUB_BOARD}]) { ${v.board} }` : ''} }`;
    try {
      const res = await board.executeGraphQL(q);
      if (!res?.me?.id) throw new Error('Resposta sem usuário (me)');
      if (!(res?.boards ?? []).length) throw new Error('Quadros não retornados na checagem');
      if (lastError) console.warn('[perm] checagem concluída após degradar campos de boards. Último erro:', lastError);
      return { status: 'ok', main: true, sub: true, reason: null };
    } catch (e) {
      lastError = errMsg(e);
      console.error('[perm] falha na checagem com campos', v, '→', lastError, e);
    }
  }
  return { status: 'safe', main: true, sub: true, reason: lastError ?? 'Falha desconhecida na checagem de permissão' };
}

const MUT = `mutation ($b: ID!, $i: ID!, $v: JSON!) { change_multiple_column_values(board_id: $b, item_id: $i, column_values: $v) { id } }`;

export function writeColumn({ boardId, itemId, columnId, value }) {
  return board.executeGraphQL(MUT, { b: String(boardId), i: String(itemId), v: JSON.stringify({ [columnId]: value }) });
}
