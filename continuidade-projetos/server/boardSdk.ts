// Substitui o @api/BoardSDK do Vibe: mesmos métodos usados pelo app, sobre a API GraphQL do monday.
import COLS from './columns.json';
import { gql } from './monday';

type ColDef = { id: string; type: string; labels?: Record<string, number> };
type ColMap = Record<string, ColDef>;
const MAPS = COLS as unknown as Record<string, ColMap>;

const FRAG = `id type text value
  ... on StatusValue { label }
  ... on DropdownValue { values { label } }
  ... on DateValue { date }
  ... on TimelineValue { from to }
  ... on MirrorValue { display_value }
  ... on FormulaValue { display_value }
  ... on BoardRelationValue { linked_item_ids linked_items { id name } }
  ... on PeopleValue { persons_and_teams { id kind } }`;

const userNames = new Map<string, string>();
async function resolverNomes(ids: string[]) {
  const falta = [...new Set(ids)].filter((id) => !userNames.has(id));
  for (let i = 0; i < falta.length; i += 100) {
    const r = await gql<{ users: { id: string; name: string }[] }>('query ($ids: [ID!]) { users(ids: $ids) { id name } }', { ids: falta.slice(i, i + 100) });
    for (const u of r.users ?? []) userNames.set(String(u.id), u.name);
  }
}

function lerValor(def: ColDef, cv: any): unknown {
  if (!cv) return null;
  const parse = () => { try { return cv.value ? JSON.parse(cv.value) : null; } catch { return null; } };
  switch (def.type) {
    case 'text': case 'long_text': case 'email': case 'phone': return cv.text || null;
    case 'numbers': { const n = cv.text === null || cv.text === '' ? NaN : Number(cv.text); return Number.isFinite(n) ? n : null; }
    case 'status': return cv.label || cv.text || null;
    case 'dropdown': return (cv.values ?? []).map((v: { label: string }) => v.label);
    case 'date': return cv.date ? new Date(`${cv.date.slice(0, 10)}T00:00:00Z`) : null;
    case 'timeline': return cv.from || cv.to ? { from: (cv.from ?? '').slice(0, 10), to: (cv.to ?? '').slice(0, 10) } : null;
    case 'mirror': return { displayValue: cv.display_value ?? cv.text ?? null };
    case 'formula': return cv.display_value ?? cv.text ?? null;
    case 'board_relation': {
      const linked = (cv.linked_items ?? []).map((l: { id: string; name: string }) => ({ id: String(l.id), name: l.name }));
      const ids = (cv.linked_item_ids ?? []).map(String);
      for (const id of ids) if (!linked.some((l: { id: string }) => l.id === id)) linked.push({ id, name: '' });
      return { linkedItems: linked, linkedItemIds: ids };
    }
    case 'people': return (cv.persons_and_teams ?? []).map((p: { id: string; kind: string }) => ({ id: String(p.id), kind: p.kind, name: userNames.get(String(p.id)) ?? '' }));
    case 'link': { const v = parse(); return v?.url ? { url: v.url, text: v.text ?? '' } : null; }
    case 'checkbox': return !!parse()?.checked;
    default: return cv.text ?? null;
  }
}

const isoDia = (v: unknown) => {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
};

function escreverValor(def: ColDef, v: unknown): unknown {
  if (v === null || v === undefined || (Array.isArray(v) && v.length === 0)) {
    if (def.type === 'text' || def.type === 'numbers') return '';
    if (def.type === 'long_text') return { text: '' };
    return {};
  }
  switch (def.type) {
    case 'text': return String(v);
    case 'long_text': return { text: String(v) };
    case 'numbers': return String(v);
    case 'status': {
      const label = String(v);
      if (def.labels && !(label in def.labels)) throw new Error(`Rótulo inexistente na coluna: ${label}`);
      return { label };
    }
    case 'dropdown': return { labels: (v as string[]).map(String) };
    case 'date': return { date: isoDia(v) };
    case 'timeline': { const t = v as { from: string; to: string }; return { from: isoDia(t.from), to: isoDia(t.to) }; }
    case 'people': return { personsAndTeams: (v as { id: string; kind?: string }[]).map((p) => ({ id: Number(p.id), kind: p.kind ?? 'person' })) };
    case 'board_relation': {
      const o = v as { linkedItems?: { id: string }[]; itemIds?: string[] };
      return { item_ids: (o.linkedItems?.map((l) => l.id) ?? o.itemIds ?? []).map(Number) };
    }
    case 'link': { const o = v as { url: string; text?: string }; return { url: o.url, text: o.text ?? o.url }; }
    case 'checkbox': return v ? { checked: 'true' } : {};
    default: return String(v);
  }
}

function montarItem(map: ColMap, raw: any, cols: string[]) {
  const it: Record<string, unknown> = { id: String(raw.id), name: raw.name, updatedAt: raw.updated_at ?? null, createdAt: raw.created_at ?? null };
  const byId = new Map<string, any>((raw.column_values ?? []).map((c: any) => [c.id, c]));
  for (const k of cols) { const def = map[k]; if (def && def.id !== 'name') it[k] = lerValor(def, byId.get(def.id)); }
  if (raw.updates) it.updates = raw.updates;
  return it as any;
}

async function prepararPessoas(raws: any[]) {
  const ids: string[] = [];
  for (const r of raws) for (const c of r.column_values ?? []) for (const p of c.persons_and_teams ?? []) if (p.kind === 'person') ids.push(String(p.id));
  if (ids.length) await resolverNomes(ids);
}

class ItemsQuery {
  private cols: string[] = [];
  private rules: unknown[] = [];
  private order: unknown[] | null = null;
  private pag: { limit?: number; cursor?: string | null } = {};
  private upd: { limit: number; page?: number } | null = null;
  constructor(private boardId: string, private map: ColMap) {}
  withColumns(c: readonly string[]) { this.cols = [...c]; return this; }
  withUpdates(u: { limit: number; page?: number }) { this.upd = u; return this; }
  orderBy(o: { column: string; direction?: 'asc' | 'desc' }) {
    const id = o.column === 'name' ? 'name' : this.map[o.column]?.id ?? o.column;
    this.order = [{ column_id: id, direction: o.direction ?? 'asc' }];
    return this;
  }
  where(w: Record<string, unknown>) {
    for (const [k, v] of Object.entries(w)) {
      const def = this.map[k];
      if (!def) throw new Error(`Coluna desconhecida: ${k}`);
      if (def.type === 'board_relation') {
        const ids = typeof v === 'object' && v && 'itemId' in v ? [(v as { itemId: string }).itemId] : ((v as { itemIds?: string[] }).itemIds ?? []);
        this.rules.push({ column_id: def.id, compare_value: ids.map(Number), operator: 'any_of' });
      } else if (def.type === 'status') {
        const labels = (Array.isArray(v) ? v : [v]).map(String);
        const idx = labels.map((l) => def.labels?.[l]).filter((x) => x !== undefined);
        if (!idx.length) throw new Error(`Rótulo inexistente: ${labels.join(', ')}`);
        this.rules.push({ column_id: def.id, compare_value: idx, operator: 'any_of' });
      } else {
        this.rules.push({ column_id: def.id, compare_value: Array.isArray(v) ? v : [v], operator: 'any_of' });
      }
    }
    return this;
  }
  withPagination(p: { limit?: number; cursor?: string | null }) { this.pag = p; return this; }
  private campos() {
    const ids = this.cols.map((k) => this.map[k]?.id).filter((x): x is string => !!x && x !== 'name');
    const upd = this.upd ? `updates(limit: ${this.upd.limit}${this.upd.page ? `, page: ${this.upd.page}` : ''}) { id body text_body created_at creator { id name } }` : '';
    return `id name updated_at created_at column_values(ids: ${JSON.stringify(ids)}) { ${FRAG} } ${upd}`;
  }
  async execute(): Promise<{ items: any[]; cursor: string | null }> {
    const limit = Math.min(this.pag.limit ?? 100, 500);
    let page: { cursor: string | null; items: any[] };
    if (this.pag.cursor) {
      const r = await gql<any>(`query ($c: String!, $l: Int!) { next_items_page(cursor: $c, limit: $l) { cursor items { ${this.campos()} } } }`, { c: this.pag.cursor, l: limit });
      page = r.next_items_page;
    } else {
      const qp: Record<string, unknown> = {};
      if (this.rules.length) qp.rules = this.rules;
      if (this.order) qp.order_by = this.order;
      const r = await gql<any>(`query ($b: [ID!], $l: Int!, $qp: ItemsQuery) { boards(ids: $b) { items_page(limit: $l, query_params: $qp) { cursor items { ${this.campos()} } } } }`, { b: [this.boardId], l: limit, qp: Object.keys(qp).length ? qp : null });
      page = r.boards?.[0]?.items_page ?? { cursor: null, items: [] };
    }
    await prepararPessoas(page.items);
    return { items: page.items.map((it) => montarItem(this.map, it, this.cols)), cursor: page.cursor ?? null };
  }
}

function payload(map: ColMap, obj: Record<string, unknown>) {
  const cv: Record<string, unknown> = {};
  let name: string | undefined;
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (k === 'name') { name = String(v); continue; }
    const def = map[k];
    if (!def) throw new Error(`Coluna desconhecida: ${k}`);
    cv[def.id] = escreverValor(def, v);
  }
  return { name, cv };
}

class ItemRef {
  private cols: string[] = [];
  private upd: { limit: number; page?: number } | null = null;
  constructor(private boardId: string, private map: ColMap, private id?: string) {}
  withColumns(c: readonly string[]) { this.cols = [...c]; return this; }
  withUpdates(u: { limit: number; page?: number }) { this.upd = u; return this; }
  async execute(): Promise<any> {
    const ids = this.cols.map((k) => this.map[k]?.id).filter((x): x is string => !!x && x !== 'name');
    const upd = this.upd ? `updates(limit: ${this.upd.limit}${this.upd.page ? `, page: ${this.upd.page}` : ''}) { id body text_body created_at creator { id name } }` : '';
    const r = await gql<any>(`query ($i: [ID!]) { items(ids: $i) { id name updated_at created_at column_values(ids: ${JSON.stringify(ids)}) { ${FRAG} } ${upd} } }`, { i: [this.id] });
    const raw = r.items?.[0];
    if (!raw) return null;
    await prepararPessoas([raw]);
    return montarItem(this.map, raw, this.cols);
  }
  update(obj: Record<string, unknown>) {
    return {
      execute: async () => {
        const { name, cv } = payload(this.map, obj);
        if (name !== undefined) cv.name = name;
        if (!Object.keys(cv).length) return { id: this.id };
        await gql(`mutation ($b: ID!, $i: ID!, $v: JSON!) { change_multiple_column_values(board_id: $b, item_id: $i, column_values: $v, create_labels_if_missing: false) { id } }`, { b: this.boardId, i: this.id, v: JSON.stringify(cv) });
        return { id: this.id };
      },
    };
  }
  create(obj: Record<string, unknown>) {
    return {
      execute: async () => {
        const { name, cv } = payload(this.map, obj);
        const r = await gql<any>(`mutation ($b: ID!, $n: String!, $v: JSON) { create_item(board_id: $b, item_name: $n, column_values: $v) { id name } }`, { b: this.boardId, n: name ?? 'Novo item', v: JSON.stringify(cv) });
        return { id: String(r.create_item.id), name: r.create_item.name };
      },
    };
  }
  delete() {
    return { execute: async () => { await gql('mutation ($i: ID!) { delete_item(item_id: $i) { id } }', { i: this.id }); return { id: this.id }; } };
  }
  post() {
    return {
      create: (body: string) => ({
        execute: async () => {
          const r = await gql<any>('mutation ($i: ID!, $b: String!) { create_update(item_id: $i, body: $b) { id } }', { i: this.id, b: body });
          return { id: String(r.create_update.id) };
        },
      }),
    };
  }
}

class Board {
  readonly map: ColMap;
  constructor(readonly boardId: string) { this.map = MAPS[boardId] ?? {}; }
  items() { return new ItemsQuery(this.boardId, this.map); }
  item(id?: string | number) { return new ItemRef(this.boardId, this.map, id === undefined ? undefined : String(id)); }
  executeGraphQL(query: string, variables: Record<string, unknown> = {}) { return gql(query, variables); }
  get users() {
    const boardId = this.boardId;
    return {
      where: (w: { name?: string }) => ({
        withPagination: (p: { limit?: number; page?: number }) => ({
          execute: async () => (await gql<any>('query ($n: String, $l: Int, $p: Int) { users(name: $n, limit: $l, page: $p) { id name } }', { n: w.name ?? null, l: p.limit ?? 20, p: (p.page ?? 0) + 1 })).users ?? [],
        }),
      }),
      boardSubscribers: () => ({
        execute: async () => (await gql<any>('query ($b: [ID!]) { boards(ids: $b) { subscribers { id name } } }', { b: [boardId] })).boards?.[0]?.subscribers ?? [],
      }),
    };
  }
}

export class HistoricoDeProjetosBoard extends Board { constructor() { super('18399249920'); } }
export class LevantamentoDeProdutosBoard extends Board { constructor() { super('18398687489'); } }
export class DecisoesDoVibeBoard extends Board { constructor() { super('18436640715'); } }
export class EquipesRevisadasBoard extends Board { constructor() { super('18437180615'); } }

export type HistoricoDeProjetosBoardItem<_K extends string = string> = any;
export type LevantamentoDeProdutosBoardItem<_K extends string = string> = any;
export type DecisoesDoVibeBoardItem<_K extends string = string> = any;
export type EquipesRevisadasBoardItem<_K extends string = string> = any;
