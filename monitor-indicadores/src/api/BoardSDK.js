// Camada que substitui o BoardSDK do Vibe usando monday-sdk-js direto.
// Mesma interface usada no código: board.items().withColumns().where().withPagination().execute()
// e board.item(id).update({...}).execute().
import mondaySdk from 'monday-sdk-js';

const monday = mondaySdk();
monday.setApiVersion('2025-04');

async function gql(query, variables) {
  const r = await monday.api(query, { variables });
  if (r.errors?.length) throw new Error(r.errors.map((e) => e.message).join('; '));
  return r.data;
}

// chave usada no código do Vibe → [id da coluna, tipo]
const COLS_IND = {
  cdigo: ['text_mm0qs9yx', 'text'], objetivo: ['color_mm1rt136', 'status'], nvel: ['color_mm7wd928', 'status'],
  meta: ['numeric_mkzzer72', 'numbers'], polaridade: ['color_mm1b9tsw', 'status'], formaDeColeta: ['dropdown_mkzvbkyn', 'dropdown'],
  baseDeDados: ['link_mkzzhj36', 'link'], frmulaDeClculo: ['long_text_mkzz8s85', 'text'], situaoDoDado: ['color_mm7w6wzj', 'status'],
  medies: ['board_relation_mm0qazx', 'relation'], unidadeDeMedida: ['dropdown_mm02p8tg', 'dropdown'], exibirNoPainel: ['boolean_mm897vgm', 'checkbox'],
  status: ['color_mkzz8x5a', 'status'], perodoDeReferncia: ['timerange_mkzzmkh1', 'timeline'], resultadoV2: ['formula_mm8mhmrb', 'formula'],
  atingidoPerodo: ['numeric_mm8mfavh', 'numbers'], totalPerodo: ['numeric_mm8mx50t', 'numbers'],
  indicadorVinculadoRelaoAntiga: ['board_relation_mkzzqsbq', 'relation'], indicadorVinculado: ['dropdown_mm83pgex', 'dropdown'],
  prazoDaMedio: ['data', 'text'], nomeCurto: ['text_mm89wb6c', 'text'],
};
const COLS_PROJ = {
  gerente1: ['dropdown_mm6v1tw6', 'dropdown'], dataDeAssinatura: ['date_mm33km09', 'text'], conclusoDoPlanejamento: ['date_mm3325j4', 'text'],
  conclusoRegistroSgi: ['date_mm3397yt', 'text'], msRefernciaResultado: ['color_mm34v1y5', 'status'], statusPlanejamento: ['color_mm3axm14', 'status'],
  incioPlanejamento: ['data', 'text'],
};

const FRAG = `id type text
  ... on FormulaValue { display_value }
  ... on BoardRelationValue { linked_item_ids }
  ... on CheckboxValue { checked }
  ... on TimelineValue { from to }
  ... on LinkValue { url url_text }
  ... on DropdownValue { values { label } }`;

function parse(cv, tipo) {
  const vazio = (s) => (s === '' || s == null ? null : s);
  switch (tipo) {
    case 'numbers': return vazio(cv.text) == null ? null : Number(cv.text);
    case 'formula': return vazio(cv.display_value ?? cv.text);
    case 'dropdown': return (cv.values ?? []).map((v) => v.label);
    case 'link': return cv.url ? { url: cv.url, text: cv.url_text || cv.url, label: cv.url_text } : null;
    case 'relation': return { linkedItems: (cv.linked_item_ids ?? []).map((id) => ({ id: String(id) })) };
    case 'timeline': return cv.from ? { from: cv.from, to: cv.to } : null;
    case 'checkbox': return !!cv.checked;
    default: return vazio(cv.text);
  }
}

// filtro aplicado no navegador (os quadros são pequenos)
function match(item, where) {
  return Object.entries(where ?? {}).every(([k, v]) => {
    const atual = k === 'group' ? item.group?.id : item[k];
    const lista = [].concat(v);
    if (Array.isArray(atual)) return atual.some((a) => lista.includes(a));
    return lista.includes(atual);
  });
}

class Query {
  constructor(board) { this.board = board; this.cols = []; this.where_ = null; }
  withColumns(cols) { this.cols = cols; return this; }
  where(w) { this.where_ = w; return this; }
  withPagination() { return this; }
  async execute() {
    const map = this.board.map;
    const chaves = [...new Set([...this.cols, ...Object.keys(this.where_ ?? {}).filter((k) => k !== 'group')])].filter((k) => map[k]);
    const ids = chaves.map((k) => map[k][0]);
    const campos = `id name group { id } column_values(ids: ${JSON.stringify(ids)}) { ${FRAG} }`;
    let d = await gql(`query { boards(ids: ${this.board.id}) { items_page(limit: 500) { cursor items { ${campos} } } } }`);
    let pag = d.boards[0].items_page, brutos = pag.items, cursor = pag.cursor;
    while (cursor) {
      d = await gql(`query ($c: String!) { next_items_page(limit: 500, cursor: $c) { cursor items { ${campos} } } }`, { c: cursor });
      brutos = brutos.concat(d.next_items_page.items); cursor = d.next_items_page.cursor;
    }
    const porId = Object.fromEntries(chaves.map((k) => [map[k][0], k]));
    const items = brutos.map((it) => {
      const o = { id: String(it.id), name: it.name, group: it.group };
      it.column_values.forEach((cv) => {
        const k = porId[cv.id];
        if (k) o[k] = parse(cv, map[k][1]);
      });
      return o;
    }).filter((o) => match(o, this.where_));
    return { items, cursor: null };
  }
}

class ItemRef {
  constructor(board, id) { this.board = board; this.id = id; this.vals = {}; }
  update(vals) { this.vals = vals; return this; }
  async execute() {
    const cv = {};
    Object.entries(this.vals).forEach(([k, v]) => {
      const [id, tipo] = this.board.map[k];
      if (tipo === 'numbers') cv[id] = v == null ? '' : String(v);
      else if (tipo === 'status') cv[id] = v ? { label: v } : null;
      else cv[id] = v;
    });
    return gql(`mutation ($b: ID!, $i: ID!, $v: JSON!) { change_multiple_column_values(board_id: $b, item_id: $i, column_values: $v) { id } }`,
      { b: String(this.board.id), i: String(this.id), v: JSON.stringify(cv) });
  }
}

class Board {
  constructor(id, map) { this.id = id; this.map = map; }
  items() { return new Query(this); }
  item(id) { return new ItemRef(this, id); }
}

export class Board0102IndicadoresBoard extends Board { constructor() { super(18400760018, COLS_IND); } }
export class Board0201ProjetosEmPlanejamentoBoard extends Board { constructor() { super(18412010674, COLS_PROJ); } }
