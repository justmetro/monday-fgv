// Leitura dos quadros 09.1 e 09.4 no mesmo formato que o BoardSDK do Vibe entregava
// (campos com nomes camelCase), para os componentes de revisão e tratamento.
import { gql, sleep } from '@generated/lib/monday';
import { B_PROJ, B_RISCOS } from '@generated/lib/engineData';

type Kind = 'text' | 'num' | 'status' | 'drop' | 'people' | 'date' | 'check' | 'link' | 'rel';
type FieldMap = Record<string, [string, Kind]>;

export const PROJ_FIELDS: FieldMap = {
  situaoDoCadastro: ['situacao', 'status'],
  responsvel: ['responsavel', 'people'],
  dataDeCadastro: ['data_cad', 'date'],
  column1FaturamentoAoAno: ['c1_fat', 'drop'],
  column2TipoDeFaturamento: ['c2_tipofat', 'drop'],
  column3VignciaDoContrato: ['c3_vig', 'drop'],
  column4Cliente: ['c4_cli', 'drop'],
  column5Modalidade: ['c5_mod', 'drop'],
  column6ProdutosAoMs: ['c6_prod', 'drop'],
  column7TipologiaDeEntrega: ['c7_tipo', 'drop'],
  column8Equipe: ['c8_equipe', 'drop'],
  column85OutrosTiposDeContrataoMembrosEfetivos: ['c8_gr85', 'check'],
  calculadora: ['calc', 'status'],
  grsIdentificados: ['grs_ident', 'text'],
  riscosGerados: ['n_riscos', 'num'],
  dataDaLtimaExecuo: ['data_calc', 'date'],
  logAvisosDoMotor: ['log_calc', 'text'],
  versoMetodologia: ['versao', 'text'],
  linkDoPlanejamento: ['link_mm7nck8b', 'link'],
  envioAoPlanejamento: ['envio_plan', 'status'],
};

export const RISK_FIELDS: FieldMap = {
  projeto: ['rel_proj', 'rel'],
  idDoRisco: ['id_risco', 'text'],
  chaveNicaProjetorisco: ['chave', 'text'],
  gruposDeOrigem: ['grs_origem', 'drop'],
  sinalizaesDoMotor: ['sinal', 'text'],
  causaproblema: ['causa', 'text'],
  efeitoimpacto: ['efeito', 'text'],
  categoria: ['categoria', 'drop'],
  aplicabilidade: ['aplic', 'status'],
  justificativaDaAplicabilidade: ['justif', 'text'],
  refernciaBasePI: ['ref_pi', 'text'],
  probabilidade: ['prob', 'status'],
  impacto: ['imp', 'status'],
  grauDeRisco: ['grau', 'text'],
  nvelDeRisco: ['nivel', 'text'],
  estratgia: ['estrategia', 'status'],
  respostaPlanoDeAo: ['resposta', 'text'],
  responsvelPeloMonitoramento: ['responsavel', 'people'],
  prazo: ['prazo', 'date'],
  periodicidade: ['periodic', 'text'],
  statusDoTratamento: ['status_trat', 'status'],
};

const CV = `id text value
  ... on DropdownValue { values { label } }
  ... on CheckboxValue { checked }
  ... on FormulaValue { display_value }
  ... on BoardRelationValue { linked_item_ids }
  ... on PeopleValue { persons_and_teams { id kind } }`;

function convert(cv: any, kind: Kind): any {
  const text = String(cv?.display_value ?? cv?.text ?? '').trim();
  switch (kind) {
    case 'text': case 'status': return text || null;
    case 'num': return text === '' ? null : Number(text);
    case 'drop': return Array.isArray(cv?.values) && cv.values.length ? cv.values.map((v: any) => v.label) : text ? text.split(', ') : [];
    case 'check': return cv?.checked === true;
    case 'date': return text ? new Date(`${text.slice(0, 10)}T00:00:00.000Z`) : null;
    case 'rel': return (cv?.linked_item_ids ?? [])[0] ? String(cv.linked_item_ids[0]) : null;
    case 'link': {
      try { const v = JSON.parse(cv?.value || 'null'); return v?.url ? { url: v.url, label: v.text || v.url } : null; } catch { return null; }
    }
    case 'people': {
      const names = text ? text.split(', ') : [];
      return (cv?.persons_and_teams ?? []).map((p: any, i: number) => ({ id: String(p.id), kind: p.kind, name: names[i] ?? '' }));
    }
  }
}

export function mapItem(it: any, fields: FieldMap) {
  const byId: Record<string, any> = {};
  (it.column_values ?? []).forEach((c: any) => { byId[c.id] = c; });
  const out: Record<string, any> = { id: String(it.id), name: it.name ?? '' };
  for (const [k, [col, kind]] of Object.entries(fields)) out[k] = convert(byId[col], kind);
  return out;
}

const colsOf = (f: FieldMap) => Object.values(f).map(([c]) => c);

/** Lê todos os itens de um quadro (500 por página), com filtro opcional. */
export async function readAll(boardId: number, fields: FieldMap, queryParams?: unknown) {
  const sel = `cursor items { id name column_values(ids: $c) { ${CV} } }`;
  const first = await gql(
    `query ($b: [ID!], $c: [String!], $qp: ItemsQuery) { boards(ids: $b) { items_page(limit: 500, query_params: $qp) { ${sel} } } }`,
    { b: [String(boardId)], c: colsOf(fields), qp: queryParams ?? null },
  );
  const page = first?.boards?.[0]?.items_page;
  if (!page) throw new Error(`Não foi possível ler o quadro ${boardId}.`);
  const items = [...page.items];
  let cursor = page.cursor;
  while (cursor) {
    await sleep(250);
    const next = await gql(`query ($cur: String!, $c: [String!]) { next_items_page(limit: 500, cursor: $cur) { ${sel} } }`, { cur: cursor, c: colsOf(fields) });
    items.push(...(next?.next_items_page?.items ?? []));
    cursor = next?.next_items_page?.cursor ?? null;
  }
  return items.map((it: any) => mapItem(it, fields));
}

export async function readByIds(ids: string[], fields: FieldMap) {
  const res = await gql(`query ($ids: [ID!], $c: [String!]) { items(ids: $ids) { id name column_values(ids: $c) { ${CV} } } }`, { ids, c: colsOf(fields) });
  return (res?.items ?? []).map((it: any) => mapItem(it, fields));
}

export const readProjects = () => readAll(B_PROJ, PROJ_FIELDS);

/** Todos os riscos de um projeto no 09.4. */
export async function readProjectRiskItems(projectId: string) {
  const items = await readAll(B_RISCOS, RISK_FIELDS, {
    rules: [{ column_id: 'rel_proj', compare_value: [Number(projectId)], operator: 'any_of' }],
  });
  return items.filter((i: any) => i.projeto === String(projectId));
}
