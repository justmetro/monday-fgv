// Leitura e gravação nos quadros da monday pelo login de quem usa o hub (monday SDK).
import { gql, fetchAllItems, sleep, txt } from '@generated/lib/monday';

export const WS = 13402503;
export const B_0201 = 18412010674;
export const B_HUB = 18441661190;

export const C0201 = {
  status: 'color_mm3axm14', eixo: 'dropdown_mm38v0xw', valor: 'numeric_mm33ha60', cliente: 'text_mm6cqc6v', codigo: 'text_mm4dd4n0',
  vigencia: 'timerange_mm6vw3pb', assinatura: 'date_mm33km09', focal: 'person', quadro: 'link_mm383m1p', docs: 'file_mm9f3wqj', uf: 'dropdown_mm3815pa',
};

// Colunas do quadro [PLAN] v6 (iguais em todos os quadros criados pelo modelo)
export const CP = {
  grupos: { cronograma: 'group_mkx65fxg', produtos: 'group_title', indicador: 'group_mm0gtzbd', medicao: 'group_mm0g8q60', riscos: 'group_mkx6zkd3', partes: 'group_mm0q9sxj' },
  status: 'status', cronograma: 'timerange_mkx683na', frentes: 'color_mkyfzcfy', eap: '18423546593__dropdown_mm5q2max', produtoRel: 'board_relation_mkx6fhk',
  // Produtos
  codigo: 'text_mkx6zb99', descricao: '18423546593__text_mm5q27ah', meses: '18423546593__text_mm6470ww', valor: 'numeric_mkx6wcm', tipoEntrega: 'dropdown_mm7gtmhy',
  etapaProduto: 'color_mkx6cxq6', contratual: 'timerange_mkx6bqv7', objetivo: '18423546593__text_mm6cezpg', statusProduto: 'color_mkx62m2a', categoriaInsumo: 'dropdown_mm58yxh5',
  // Riscos
  tema: 'dropdown_mkx6jx0w', categoria: 'dropdown_mkx6g0d8', impactado: 'dropdown_mkx6cbyv', causa: 'long_text_mkx6r3mk', efeito: 'long_text_mkx610qv',
  prob: 'color_mkx6b6pv', imp: 'color_mkx66rff', estrategia: 'color_mkx62a0c', resposta: 'long_text_mkx6sp8g', cargoResp: 'text_mkx6p5fz', periodo: 'timerange_mkyfxmm1',
  eixoRisco: 'dropdown_mkx6jrha', riscosAssoc: 'text_mm7g99h8',
  // Partes interessadas
  cargoCliente: '18370004806__text_mm0qdk7c', area: '18370004806__text_mm0qq9jf', papel: '18370004806__dropdown_mm0qbmm5', interesse: '18370004806__color_mm0qw69m',
  poder: '18370004806__color_mm0qvbfv', expectativas: '18370004806__long_text_mm0qenb1',
  // Indicadores
  tipoInd: '18370004806__color_mm07qht8', descInd: 'long_text_mm1gn28m', formula: '18370004806__text_mm0qr7n2', meta: '18370004806__numeric_mm07cbq5',
  unidade: '18370004806__dropdown_mm078vv2', temporalidade: '18370004806__dropdown_mm077dhe', coleta: '18370004806__dropdown_mm0791cx', polaridade: 'color_mm1hzeyh',
  qtdMed: '18370004806__numeric_mm07hr82', prazoMed: '18370004806__date_mm0ghv21', indVinculado: '18370004806__board_relation_mm0q1pre', krVinculado: 'board_relation_mm46hwwg',
  statusMed: 'color_mm1gg0hb',
};

export interface Projeto {
  id: string; name: string; codigo: string; status: string; eixo: string; valor: number | null; cliente: string; uf: string;
  quadroUrl: string; quadroId: string | null; vigInicio: string | null; vigFim: string | null; assinatura: string | null; focal: string; temDocs: boolean;
}

const ATIVOS = ['Em andamento', 'Em revisão', 'Em replanejamento', 'Planejado aguardando assinatura', 'Novo Cadastro - 30 a 45 dias', 'Novo Cadastro - 45 a 60 dias'];
export const idQuadro = (url: string) => url.match(/\/boards\/(\d+)/)?.[1] ?? null;

export async function listarProjetos(): Promise<Projeto[]> {
  const items = await fetchAllItems(B_0201, Object.values(C0201), ({ rules: [{ column_id: 'group', compare_value: ['topics'], operator: 'any_of' }] } as any));
  return items
    .map((it: any) => {
      const c = it.cols;
      let link = '';
      try { link = JSON.parse(c[C0201.quadro]?.value || 'null')?.url ?? ''; } catch { link = ''; }
      let vig: { from?: string; to?: string } = {};
      try { vig = JSON.parse(c[C0201.vigencia]?.value || 'null') ?? {}; } catch { vig = {}; }
      const valor = Number(txt(c[C0201.valor]).replace(',', '.'));
      return {
        id: String(it.id), name: it.name, codigo: txt(c[C0201.codigo]).trim() || it.name.split(' ')[0], status: txt(c[C0201.status]),
        eixo: txt(c[C0201.eixo]), valor: Number.isFinite(valor) && txt(c[C0201.valor]) ? valor : null, cliente: txt(c[C0201.cliente]), uf: txt(c[C0201.uf]),
        quadroUrl: link, quadroId: idQuadro(link), vigInicio: vig.from ?? null, vigFim: vig.to ?? null,
        assinatura: (() => { try { return JSON.parse(c[C0201.assinatura]?.value || 'null')?.date ?? null; } catch { return null; } })(),
        focal: txt(c[C0201.focal]), temDocs: !!txt(c[C0201.docs]),
      } as Projeto;
    })
    .sort((a: Projeto, b: Projeto) => Number(ATIVOS.includes(b.status)) - Number(ATIVOS.includes(a.status)) || a.name.localeCompare(b.name, 'pt-BR'));
}

export const ehAtivo = (p: Projeto) => ATIVOS.includes(p.status);

export const PASTA_ATIVOS = 21012316;

export interface Candidato { id: string; name: string; url: string; criado: string; codigoBate: boolean; pastaId: string | null }

/** Quadros criados depois do clique no botão do 02.01 (o modelo cria a pasta e o quadro [PLAN]). Os que trazem o código vêm primeiro. */
export async function candidatosQuadro(codigo: string, desdeISO: string): Promise<Candidato[]> {
  const d = await gql(`query ($w: [ID!]) { boards(workspace_ids: $w, limit: 80, order_by: created_at, state: active) { id name created_at url type board_folder_id } }`, { w: [WS] });
  const desde = Date.parse(desdeISO) - 5 * 60_000;
  const cod = codigo.trim().toLowerCase();
  return (d?.boards ?? [])
    .filter((x: any) => x.type === 'board' && !/^subelementos/i.test(x.name) && Date.parse(x.created_at) >= desde && !/^(wf |workflow|teste conex|plan -> |sal[aá]rios|planejamento financeiro|cria[cç][aã]o quadro|quadro planejamento <>)/i.test(x.name))
    .map((x: any) => ({ id: String(x.id), name: x.name, url: x.url, criado: x.created_at, codigoBate: x.name.toLowerCase().includes(cod) || /c[oó]digo nome projeto/i.test(x.name), pastaId: x.board_folder_id ? String(x.board_folder_id) : null }))
    .sort((a: Candidato, b: Candidato) => Number(b.codigoBate) - Number(a.codigoBate) || Date.parse(b.criado) - Date.parse(a.criado));
}

/** Renomeia o quadro para "[PLAN] <nome do projeto>" e leva a pasta do projeto para 06. Planejamentos Ativos. */
export async function organizarQuadro(boardId: string, nomeProjeto: string, codigo: string, renomear: boolean, mover: boolean): Promise<string[]> {
  const feito: string[] = [];
  if (renomear) {
    await gql('mutation ($b: ID!, $v: String!) { update_board(board_id: $b, board_attribute: name, new_value: $v) }', { b: boardId, v: `[PLAN] ${nomeProjeto}`.slice(0, 255) });
    feito.push('quadro renomeado');
  }
  if (mover) try {
    const b = await gql('query ($b: [ID!]) { boards(ids: $b) { board_folder_id } }', { b: [boardId] });
    let pasta = b?.boards?.[0]?.board_folder_id ? String(b.boards[0].board_folder_id) : null;
    if (pasta) {
      // Sobe até a pasta de topo do projeto (o modelo cria subpastas dentro dela)
      for (let k = 0; k < 4; k++) {
        const f = await gql('query ($w: [ID!], $f: [ID!]) { folders(workspace_ids: $w, ids: $f) { id name parent { id } } }', { w: [WS], f: [pasta] });
        const pai = f?.folders?.[0]?.parent?.id ? String(f.folders[0].parent.id) : null;
        if (!pai || pai === String(PASTA_ATIVOS)) break;
        pasta = pai;
      }
      const f = await gql('query ($w: [ID!], $f: [ID!]) { folders(workspace_ids: $w, ids: $f) { id name parent { id } } }', { w: [WS], f: [pasta] });
      const topo = f?.folders?.[0];
      const doProjeto = topo && (String(topo.name).toLowerCase().includes(codigo.trim().toLowerCase()) || /planejamento de projeto/i.test(topo.name));
      if (topo && !topo.parent?.id && doProjeto) {
        await gql('mutation ($f: ID!, $p: ID!) { update_folder(folder_id: $f, parent_folder_id: $p) { id } }', { f: pasta, p: String(PASTA_ATIVOS) });
        feito.push('pasta movida para 06. Planejamentos Ativos');
      }
    }
  } catch (e) {
    feito.push(`pasta não movida (${String((e as Error)?.message ?? e).slice(0, 120)})`);
  }
  return feito;
}

export async function lerQuadroBasico(boardId: string) {
  const d = await gql(`query ($b: [ID!]) { boards(ids: $b) { id name url groups { id title } columns(ids: ["${CP.produtoRel}", "${CP.codigo}", "${CP.eap}"]) { id } } }`, { b: [boardId] });
  return d?.boards?.[0] ?? null;
}

export async function gravarLinkQuadro(itemId: string, url: string, nome: string) {
  await gql('mutation ($b: ID!, $i: ID!, $v: JSON!) { change_multiple_column_values(board_id: $b, item_id: $i, column_values: $v) { id } }', {
    b: String(B_0201), i: itemId, v: JSON.stringify({ [C0201.quadro]: { url, text: nome } }),
  });
}

export interface ItemGrupo { id: string; name: string; group: string; cols: Record<string, any> }

export async function itensDosGrupos(boardId: string, grupos: string[], colunas: string[]): Promise<ItemGrupo[]> {
  const out: ItemGrupo[] = [];
  let cursor: string | null = null;
  const cols = JSON.stringify(colunas);
  do {
    const d: any = cursor
      ? await gql(`query ($c: String!) { next_items_page(limit: 200, cursor: $c) { cursor items { id name group { id } column_values(ids: ${cols}) { id text value } } } }`, { c: cursor })
      : await gql(`query ($b: [ID!], $g: CompareValue!) { boards(ids: $b) { items_page(limit: 200, query_params: { rules: [{ column_id: "group", compare_value: $g, operator: any_of }] }) { cursor items { id name group { id } column_values(ids: ${cols}) { id text value } } } } }`, { b: [boardId], g: grupos });
    const page: any = cursor ? d.next_items_page : d.boards[0].items_page;
    for (const it of page.items) out.push({ id: String(it.id), name: it.name, group: it.group.id, cols: Object.fromEntries(it.column_values.map((c: any) => [c.id, c])) });
    cursor = page.cursor;
  } while (cursor);
  return out;
}

/** Cria itens em lotes de 8 por mutation. Devolve os ids na mesma ordem. */
// No servidor (token da pessoa, sem o vaivém do SDK) os lotes podem ser maiores e as pausas menores.
const NO_SERVIDOR = typeof window === 'undefined';
const LOTE = NO_SERVIDOR ? 20 : 8;
const PAUSA = NO_SERVIDOR ? 150 : 400;

export async function criarItens(boardId: string, grupo: string, itens: { nome: string; valores: Record<string, unknown> }[], onProgresso?: (n: number) => void, criarRotulos = false): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < itens.length; i += LOTE) {
    const lote = itens.slice(i, i + LOTE);
    const defs: string[] = [], corpo: string[] = [];
    const vars: Record<string, unknown> = { b: String(boardId), g: grupo };
    lote.forEach((it, k) => {
      defs.push(`$n${k}: String!, $v${k}: JSON!`);
      corpo.push(`c${k}: create_item(board_id: $b, group_id: $g, item_name: $n${k}, column_values: $v${k}, create_labels_if_missing: ${criarRotulos}) { id }`);
      vars[`n${k}`] = it.nome.slice(0, 255);
      vars[`v${k}`] = JSON.stringify(it.valores);
    });
    const d = await gql(`mutation ($b: ID!, $g: String!, ${defs.join(', ')}) { ${corpo.join(' ')} }`, vars);
    lote.forEach((_, k) => ids.push(String(d[`c${k}`].id)));
    onProgresso?.(ids.length);
    await sleep(PAUSA);
  }
  return ids;
}

export async function alterarItens(boardId: string, mudancas: { id: string; valores: Record<string, unknown> }[], onProgresso?: (n: number) => void, criarRotulos = false) {
  const lotes: (typeof mudancas)[] = [];
  for (let i = 0; i < mudancas.length; i += LOTE) lotes.push(mudancas.slice(i, i + LOTE));
  let feitos = 0;
  const um = async (lote: typeof mudancas) => {
    const defs: string[] = [], corpo: string[] = [];
    const vars: Record<string, unknown> = { b: String(boardId) };
    lote.forEach((m, k) => {
      defs.push(`$i${k}: ID!, $v${k}: JSON!`);
      corpo.push(`c${k}: change_multiple_column_values(board_id: $b, item_id: $i${k}, column_values: $v${k}, create_labels_if_missing: ${criarRotulos}) { id }`);
      vars[`i${k}`] = m.id;
      vars[`v${k}`] = JSON.stringify(m.valores);
    });
    await gql(`mutation ($b: ID!, ${defs.join(', ')}) { ${corpo.join(' ')} }`, vars);
    feitos += lote.length;
    onProgresso?.(feitos);
    await sleep(PAUSA);
  };
  // Alterar não depende de ordem: no servidor, até 3 lotes ao mesmo tempo.
  const paralelos = NO_SERVIDOR ? 3 : 1;
  let prox = 0;
  await Promise.all(Array.from({ length: Math.min(paralelos, lotes.length) }, async () => {
    while (prox < lotes.length) await um(lotes[prox++]);
  }));
}

export async function arquivarItens(ids: string[]) {
  for (let i = 0; i < ids.length; i += 10) {
    const corpo = ids.slice(i, i + 10).map((id, k) => `a${k}: archive_item(item_id: ${Number(id)}) { id }`);
    await gql(`mutation { ${corpo.join(' ')} }`);
    await sleep(300);
  }
}

// ---------- Datas ----------
export function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}
/** Dia N do projeto (dia 1 = início) para data ISO. */
export const diaParaData = (inicio: string, dia: number) => somarDias(inicio, Math.max(0, Math.round(dia) - 1));
export const faixa = (inicio: string, a: number, b: number) => {
  const de = diaParaData(inicio, Math.min(a, b));
  const ate = diaParaData(inicio, Math.max(a, b));
  return { from: de, to: ate };
};
export const hojeISO = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);

// ---------- Registro no 09.0 Hub de Planejamento ----------
export async function registrarNoHub(params: { hubItemId?: string; nome: string; itemId: string; runId: string; quadroUrl?: string; userId: string; etapas: string }): Promise<string> {
  const valores: Record<string, unknown> = {
    item_0201: params.itemId, run_id: params.runId, ultima: { date: hojeISO() }, etapas: { text: params.etapas },
    executor: { personsAndTeams: [{ id: Number(params.userId), kind: 'person' }] },
  };
  if (params.quadroUrl) valores.quadro_plan = { url: params.quadroUrl, text: 'Quadro [PLAN]' };
  if (params.hubItemId) {
    await gql('mutation ($b: ID!, $i: ID!, $v: JSON!) { change_multiple_column_values(board_id: $b, item_id: $i, column_values: $v) { id } }', { b: String(B_HUB), i: params.hubItemId, v: JSON.stringify(valores) });
    return params.hubItemId;
  }
  const d = await gql('mutation ($b: ID!, $n: String!, $v: JSON!) { create_item(board_id: $b, group_id: "topics", item_name: $n, column_values: $v) { id } }', { b: String(B_HUB), n: params.nome, v: JSON.stringify(valores) });
  return String(d.create_item.id);
}
