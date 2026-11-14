// Leitura dos dois quadros da monday (Levantamento de Produtos e Quadro de Encaminhamentos).
export type Gql = (query: string, variables: Record<string, unknown>) => Promise<any>;

export const BOARD_PRODUTOS = 18398687489;
export const BOARD_ENCAMINHAMENTOS = 18437359258;

const P = {
  projeto: 'board_relation_mm0egp2d', valor: 'numeric_mm08x9pa', tipo: 'dropdown_mm08y086', riscoFat: 'color_mm5jy93q',
  riscoPag: 'color_mm7efnfd', entrega: 'date_mm08m5zr', empenho: 'color_mm323j0q', prevFat: 'date_mm16tcc0',
  fat: 'date_mm086ddm', prevPag: 'date_mm1azkd9', pag: 'date_mm12794s', coord: 'lookup_mm147y1x',
};
const E = {
  origem: 'color_mm8ksmjk', status: 'color_mm8hm36j', prazo: 'date_mm8h6vch', resp: 'multiple_person_mm8hsz6m',
  reuniao: 'date_mm8hygr', prioridade: 'color_mm8hw2tr', gestor: 'lookup_mm7q5hj0', projeto: 'board_relation_mm7qbzgp',
};

export interface Produto {
  id: string; nome: string; projeto: string; valor: number; tipo: string; riscoFat: string; riscoPag: string;
  entrega: string; empenho: string; prevFat: string; fat: string; prevPag: string; pag: string; coord: string;
}
export interface Encaminhamento {
  id: string; nome: string; grupo: string; origem: string; status: string; prazo: string; resp: string;
  reuniao: string; prioridade: string; gestor: string; projeto: string;
}

const CV = `column_values(ids: $c) { id text ... on BoardRelationValue { display_value } ... on MirrorValue { display_value } ... on FormulaValue { display_value } }`;

async function fetchAll(gql: Gql, board: number, cols: string[], onPage?: (n: number) => void) {
  const items: any[] = [];
  const first = await gql(`query ($b: [ID!], $c: [String!]) { boards(ids: $b) { items_page(limit: 500) { cursor items { id name group { title } ${CV} } } } }`, { b: [board], c: cols });
  let page = first?.boards?.[0]?.items_page;
  if (!page) throw new Error(`Não consegui ler o quadro ${board}. Verifique se você tem acesso a ele.`);
  items.push(...page.items);
  onPage?.(items.length);
  while (page.cursor) {
    const d = await gql(`query ($k: String!, $c: [String!]) { next_items_page(limit: 500, cursor: $k) { cursor items { id name group { title } ${CV} } } }`, { k: page.cursor, c: cols });
    page = d.next_items_page;
    items.push(...page.items);
    onPage?.(items.length);
  }
  return items.map((it) => {
    const v: Record<string, string> = {};
    for (const c of it.column_values) v[c.id] = String(c.display_value ?? c.text ?? '').trim();
    return { id: String(it.id), name: String(it.name ?? ''), group: String(it.group?.title ?? ''), v };
  });
}

export async function lerQuadros(gql: Gql, progresso?: (msg: string) => void) {
  const prods = await fetchAll(gql, BOARD_PRODUTOS, Object.values(P), (n) => progresso?.(`Levantamento de Produtos: ${n} itens lidos`));
  const encs = await fetchAll(gql, BOARD_ENCAMINHAMENTOS, Object.values(E), (n) => progresso?.(`Quadro de Encaminhamentos: ${n} itens lidos`));
  const produtos: Produto[] = prods.map(({ id, name, v }) => ({
    id, nome: name, projeto: v[P.projeto].replace(/\s+/g, ' '), valor: Number(v[P.valor].replace(',', '.')) || 0, tipo: v[P.tipo],
    riscoFat: v[P.riscoFat], riscoPag: v[P.riscoPag], entrega: v[P.entrega].slice(0, 10), empenho: v[P.empenho],
    prevFat: v[P.prevFat].slice(0, 10), fat: v[P.fat].slice(0, 10), prevPag: v[P.prevPag].slice(0, 10), pag: v[P.pag].slice(0, 10), coord: v[P.coord].split(',')[0].trim().toUpperCase(),
  }));
  const encaminhamentos: Encaminhamento[] = encs.map(({ id, name, group, v }) => ({
    id, nome: name, grupo: group, origem: v[E.origem], status: v[E.status], prazo: v[E.prazo].slice(0, 10), resp: v[E.resp],
    reuniao: v[E.reuniao].slice(0, 10), prioridade: v[E.prioridade], gestor: v[E.gestor].split(',')[0].trim(), projeto: v[E.projeto].replace(/\s+/g, ' '),
  }));
  return { produtos, encaminhamentos };
}
