// Substitui o BoardSDK do Vibe: mesma interface usada pelo app, sobre a API GraphQL do monday
// (monday-sdk-js com o token do usuário logado). Chaves de coluna = título em camelCase,
// sem acentos e sem pontuação, como o Vibe gerava; títulos repetidos ganham sufixo 1, 2...
import mondaySdk from 'monday-sdk-js';

const monday = mondaySdk();
const MAIN = '18427417720';
const SUB = '18427418240';
const API_VERSION = '2026-10';

function errOf(r) {
  const e = r?.errors?.[0] ?? (r?.error_message ? { message: r.error_message } : null);
  if (!e) return null;
  const err = new Error(e.message || 'Erro na API do monday');
  err.errors = r.errors; err.response = r;
  return err;
}

export async function api(query, variables) {
  let wait = 1500;
  for (let attempt = 1; ; attempt++) {
    let r;
    try {
      r = await monday.api(query, { variables: variables ?? {}, apiVersion: API_VERSION });
    } catch (e) {
      r = e?.data ?? e;
      if (!r?.errors && !r?.error_message) throw e;
    }
    const err = errOf(r);
    if (!err) return r?.data ?? r;
    const code = r?.errors?.[0]?.extensions?.code ?? '';
    if (attempt < 5 && /complexity|rate|limit|timeout|temporar/i.test(`${err.message} ${code}`)) {
      const s = r?.errors?.[0]?.extensions?.retry_in_seconds;
      await new Promise((res) => setTimeout(res, s ? s * 1000 + 300 : wait));
      wait = Math.min(wait * 2, 20000);
      continue;
    }
    throw err;
  }
}

// ---- Esquema: chave SDK → { id, type } por quadro ----
export function keyOf(title) {
  const t = String(title ?? '').replace(/[^\x00-\x7F]/g, '').replace(/[^A-Za-z0-9\s]/g, '');
  const w = t.split(/\s+/).filter(Boolean).map((x) => x.toLowerCase());
  if (!w.length) return '';
  return w[0] + w.slice(1).map((x) => x[0].toUpperCase() + x.slice(1)).join('');
}

let schemaP = null;
export function schema() {
  if (!schemaP) {
    schemaP = api(`query ($ids: [ID!]) { boards(ids: $ids) { id columns { id title type } } }`, { ids: [MAIN, SUB] }).then((d) => {
      const out = {};
      (d.boards ?? []).forEach((b) => {
        const m = {}; const seen = {};
        b.columns.forEach((c) => {
          if (c.id === 'name') return;
          const base = keyOf(c.title);
          const n = seen[base] ?? 0; seen[base] = n + 1;
          m[n ? `${base}${n}` : base] = { id: c.id, type: c.type };
        });
        out[String(b.id)] = m;
      });
      return out;
    }).catch((e) => { schemaP = null; throw e; });
  }
  return schemaP;
}

const CV = `id type text value
  ... on StatusValue { label }
  ... on DateValue { date }
  ... on DropdownValue { values { label } }
  ... on NumbersValue { number }
  ... on FormulaValue { display_value }
  ... on MirrorValue { display_value }
  ... on BoardRelationValue { linked_items { id name } }
  ... on LinkValue { url url_text }
  ... on CheckboxValue { checked }`;

function parse(cv) {
  if (!cv) return null;
  switch (cv.type) {
    case 'status': return cv.label ?? (cv.text || null);
    case 'date': return cv.date ? new Date(`${cv.date}T00:00:00Z`) : null;
    case 'dropdown': { const v = (cv.values ?? []).map((x) => x?.label).filter(Boolean); return v.length ? v : null; }
    case 'numbers': return cv.number ?? (cv.text ? Number(cv.text) : null);
    case 'formula': return cv.display_value ?? (cv.text || null);
    case 'mirror': return cv.display_value ?? (cv.text || null);
    case 'board_relation': return { linkedItems: (cv.linked_items ?? []).map((l) => ({ id: String(l.id), name: l.name })) };
    case 'link': return cv.url ? { url: cv.url, label: cv.url_text || cv.url, text: cv.url_text || cv.url } : null;
    case 'checkbox': return cv.checked ?? null;
    default: return cv.text || null;
  }
}

function resolve(map, keys) {
  const ids = []; const back = {};
  (keys ?? []).forEach((k) => { const c = map[k]; if (c) { ids.push(c.id); back[c.id] = k; } });
  return { ids, back };
}

function toItem(raw, back, subBack) {
  const it = { id: String(raw.id), name: raw.name, group: raw.group ? { id: raw.group.id, title: raw.group.title } : undefined };
  Object.values(back).forEach((k) => { it[k] = null; });
  (raw.column_values ?? []).forEach((cv) => { const k = back[cv.id]; if (k) it[k] = parse(cv); });
  if (subBack) it.subitems = (raw.subitems ?? []).map((s) => toItem(s, subBack));
  return it;
}

const itemFields = (subs) => `id name group { id title } column_values(ids: $cols) { ${CV} }${subs ? ` subitems { id name column_values(ids: $scols) { ${CV} } }` : ''}`;

class ItemsQuery {
  constructor() { this.cols = []; this.subCols = null; this.group = null; this.order = null; this.page = { limit: 100 }; }
  withColumns(c) { this.cols = c; return this; }
  withSubItems(c) { this.subCols = c; return this; }
  where(w) { if (w?.group) this.group = w.group; return this; }
  orderBy(o) { this.order = o; return this; }
  withPagination(p) { this.page = p ?? { limit: 100 }; return this; }
  async execute() {
    const s = await schema();
    const { ids, back } = resolve(s[MAIN], this.cols);
    const sub = this.subCols ? resolve(s[SUB], this.subCols) : null;
    const vars = { cols: ids, ...(sub ? { scols: sub.ids } : {}) };
    const varDefs = `$cols: [String!]${sub ? ', $scols: [String!]' : ''}`;
    const fields = `cursor items { ${itemFields(!!sub)} }`;
    let page;
    if (this.page.cursor) {
      const d = await api(`query ($c: String!, $l: Int!, ${varDefs}) { next_items_page(cursor: $c, limit: $l) { ${fields} } }`, { ...vars, c: this.page.cursor, l: this.page.limit ?? 100 });
      page = d.next_items_page;
    } else {
      const qp = this.order ? `, query_params: { order_by: [{ column_id: "${this.order.column === 'name' ? 'name' : (s[MAIN][this.order.column]?.id ?? 'name')}", direction: ${this.order.direction === 'desc' ? 'desc' : 'asc'} }] }` : '';
      const ip = `items_page(limit: $l${qp}) { ${fields} }`;
      const body = this.group ? `groups(ids: [$g]) { ${ip} }` : ip;
      const d = await api(`query ($b: [ID!], $l: Int!${this.group ? ', $g: String!' : ''}, ${varDefs}) { boards(ids: $b) { ${body} } }`, { ...vars, b: [MAIN], l: this.page.limit ?? 100, ...(this.group ? { g: this.group } : {}) });
      const b = d.boards?.[0];
      page = this.group ? b?.groups?.[0]?.items_page : b?.items_page;
    }
    return { items: (page?.items ?? []).map((r) => toItem(r, back, sub?.back)), cursor: page?.cursor ?? null };
  }
}

function encode(type, v) {
  if (v == null || v === '') {
    if (type === 'text' || type === 'long_text') return '';
    return null;
  }
  switch (type) {
    case 'status': return { label: String(v) };
    case 'date': { const d = v instanceof Date ? v : new Date(v); return isNaN(d) ? null : { date: d.toISOString().slice(0, 10) }; }
    case 'dropdown': return { labels: Array.isArray(v) ? v.map(String) : [String(v)] };
    case 'numbers': return String(v);
    case 'long_text': return { text: String(v) };
    case 'checkbox': return v ? { checked: 'true' } : null;
    default: return String(v);
  }
}

class Updater {
  constructor(board, id, vals) { this.board = board; this.id = id; this.vals = vals; }
  async execute() {
    const s = await schema();
    const map = s[this.board];
    const out = {};
    Object.entries(this.vals).forEach(([k, v]) => { const c = map[k]; if (!c) throw new Error(`Coluna não encontrada: ${k}`); out[c.id] = encode(c.type, v); });
    return api(`mutation ($b: ID!, $i: ID!, $v: JSON!) { change_multiple_column_values(board_id: $b, item_id: $i, column_values: $v) { id } }`, { b: this.board, i: String(this.id), v: JSON.stringify(out) });
  }
}

class ItemRef {
  constructor(id) { this.id = String(id); this.cols = []; }
  withColumns(c) { this.cols = c; return this; }
  update(vals) { return new Updater(MAIN, this.id, vals); }
  subitem(sid) { return { update: (vals) => new Updater(SUB, sid, vals) }; }
  async execute() {
    const s = await schema();
    const { ids, back } = resolve(s[MAIN], this.cols);
    const d = await api(`query ($i: [ID!], $cols: [String!]) { items(ids: $i) { ${itemFields(false)} } }`, { i: [this.id], cols: ids });
    const raw = d.items?.[0];
    return raw ? toItem(raw, back) : null;
  }
}

export class BoardSDK {
  items() { return new ItemsQuery(); }
  item(id) { return new ItemRef(id); }
  executeGraphQL(query, variables) { return api(query, variables); }
}
