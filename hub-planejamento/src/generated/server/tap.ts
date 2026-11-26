// Preenche o doc "0. TAP" do quadro [PLAN] (doc de aba do quadro). A API GraphQL pública não alcança docs de aba,
// então a leitura e a escrita passam pelo servidor MCP hospedado da monday, com o token OAuth do app.
import { gql } from '../../../server/monday';
import { responsabilidades, type ModeloTap } from './conhecimento';

export interface DadosTap {
  nome_projeto: string;
  data_inicio_contrato: string;
  vigencia_contratual: string;
  valor_total: number | null;
  natureza_cliente: string;
  modalidade: string;
  experiencia_institucional: string;
  justificativa: string;
  resultado_principal: string;
  como_chega: string;
  resultados_quantitativos: string[];
  total_produtos: number;
  tipos_entrega: string[];
  processo_entrega: string[];
  perfis_equipe: string;
  fora_escopo: string[];
  necessidades: string[];
  modelo_tap: ModeloTap;
}

const MCP = 'https://mcp.monday.com/mcp';
let seq = 0;

async function mcp(tool: string, args: Record<string, unknown>, token: string): Promise<any> {
  const r = await fetch(MCP, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++seq, method: 'tools/call', params: { name: tool, arguments: args } }),
    signal: AbortSignal.timeout(110_000),
  });
  const bruto = await r.text();
  let j: any = null;
  try { j = JSON.parse(bruto); } catch {
    const linha = bruto.split('\n').find((l) => l.startsWith('data:'));
    if (linha) j = JSON.parse(linha.slice(5));
  }
  if (!r.ok || j?.error) throw new Error(`MCP da monday (${tool}): ${j?.error?.message ?? r.status}`);
  const txt = j?.result?.content?.[0]?.text ?? '';
  if (j?.result?.isError) throw new Error(`MCP da monday (${tool}): ${String(txt).slice(0, 300)}`);
  try { return JSON.parse(txt); } catch { return txt; }
}

interface Bloco { id: string; type: string; parent_block_id?: string | null; position?: number; content?: string }

function textoDoBloco(b: Bloco): string {
  try {
    const c = JSON.parse(b.content ?? '{}');
    return (c.deltaFormat ?? []).map((o: any) => (typeof o.insert === 'string' ? o.insert : o.insert?.text ?? '')).join('');
  } catch { return ''; }
}

/** Ordem de leitura do doc: blocos de topo pela posição; dentro de tabelas, célula a célula. */
function emOrdem(blocos: Bloco[]): Bloco[] {
  const filhos = new Map<string, Bloco[]>();
  for (const b of blocos) {
    const p = b.parent_block_id ?? '';
    if (!filhos.has(p)) filhos.set(p, []);
    filhos.get(p)!.push(b);
  }
  for (const xs of filhos.values()) xs.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const out: Bloco[] = [];
  const visitar = (b: Bloco) => {
    out.push(b);
    if (b.type === 'table') {
      try {
        const cells: { blockId: string }[][] = JSON.parse(b.content ?? '{}').cells ?? [];
        for (const linha of cells) for (const cel of linha) {
          const celula = blocos.find((x) => x.id === cel.blockId);
          if (celula) visitar(celula);
        }
      } catch { /* tabela sem células legíveis */ }
    } else {
      for (const f of filhos.get(b.id) ?? []) visitar(f);
    }
  };
  for (const b of filhos.get('') ?? []) visitar(b);
  return out;
}

const brl = (v: number | null) => (v == null ? 'Não identificado nos documentos' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const linhaFinal = { insert: { text: '\n' } };
const rotulado = (rotulo: string, valor: string) => [{ insert: { text: rotulo }, attributes: { bold: true } }, { insert: { text: valor } }, linhaFinal];
const simples = (valor: string) => [{ insert: { text: valor } }, linhaFinal];
const numerada = (xs: string[]) => xs.map((x, i) => `${i + 1}. ${x}`).join('\n');

export async function escreverTap(boardId: string, tap: DadosTap, autor: string, token: string, avisar: (m: string) => Promise<unknown>): Promise<string> {
  const d = await gql<{ boards: { views: { id: string; name: string; type: string | null }[] }[] }>('query ($b: [ID!]) { boards(ids: $b) { views { id name type } } }', { b: [boardId] });
  const vista = d.boards?.[0]?.views?.find((v) => /\btap\b/i.test(v.name));
  if (!vista) throw new Error('O quadro não tem a aba "0. TAP".');

  const lido = await mcp('read_docs', { board_id: boardId, view_id: vista.id, include_blocks: true, blocks_limit: 400 }, token);
  const doc = lido?.data?.[0];
  if (!doc?.id) throw new Error('Não consegui abrir o doc do TAP pelo MCP da monday.');
  const blocos = emOrdem(doc.blocks ?? []);
  const textos = blocos.map((b) => ({ b, t: textoDoBloco(b).trim() }));

  const ops: Record<string, unknown>[] = [];
  const apagar: string[] = [];
  const naoAchei: string[] = [];
  const tipoConteudo = (b: Bloco) => (/list/i.test(b.type) ? 'list_item' : 'text');
  const atualizar = (b: Bloco, delta: unknown[]) => ops.push({ operation_type: 'update_block', block_id: b.id, content: { block_content_type: tipoConteudo(b), delta_format: delta } });
  const acharComeco = (prefixo: string, desde = 0) => textos.findIndex((x, i) => i >= desde && x.t.toLowerCase().startsWith(prefixo.toLowerCase()));
  const porPrefixo = (prefixo: string, delta: (resto: string) => unknown[]) => {
    const i = acharComeco(prefixo);
    if (i < 0) { naoAchei.push(prefixo); return; }
    atualizar(textos[i].b, delta(textos[i].t));
  };
  const proximoMarcador = (marcador: string, desde: number) => textos.findIndex((x, i) => i > desde && x.t.startsWith(marcador));

  porPrefixo('Nome do projeto', () => rotulado('Nome do projeto: ', tap.nome_projeto));
  porPrefixo('TAP elaborado por', () => rotulado('TAP elaborado por: ', `${autor} (pré-preenchido pelo Hub de Planejamento, revisar)`));
  porPrefixo('Data de início do contrato', () => rotulado('Data de início do contrato: ', tap.data_inicio_contrato));
  porPrefixo('Vigência contratual', () => rotulado('Vigência contratual: ', tap.vigencia_contratual));
  porPrefixo('Valor total do projeto', () => rotulado('Valor total do projeto: ', brl(tap.valor_total)));
  porPrefixo('Natureza do cliente', () => rotulado('Natureza do cliente: ', tap.natureza_cliente));
  porPrefixo('Modalidade do atendimento', () => rotulado('Modalidade do atendimento: ', tap.modalidade));
  porPrefixo('Experiência Institucional', () => rotulado('Experiência Institucional: ', tap.experiencia_institucional));
  porPrefixo('[Inserir justificativa]', () => simples(tap.justificativa));
  const resultados = [tap.resultado_principal, tap.como_chega, ...(tap.resultados_quantitativos.length ? ['Resultados quantitativos esperados:', ...tap.resultados_quantitativos.map((x) => `• ${x}`)] : [])].filter(Boolean).join('\n');
  porPrefixo('[Inserir resultados]', () => simples(resultados));
  porPrefixo('3.1. TOTAL DE PRODUTOS', () => rotulado('3.1. TOTAL DE PRODUTOS PREVISTOS: ', `${tap.total_produtos} produtos previstos`));

  // 3.2. Tipos de entrega: troca o enunciado e remove a lista de opções do modelo.
  const iTipos = acharComeco('3.2. Tipos de entrega');
  if (iTipos >= 0) {
    atualizar(textos[iTipos].b, rotulado('3.2. Tipos de entrega: ', tap.tipos_entrega.join('; ') || 'Não identificado nos documentos'));
    const pai = textos[iTipos].b.parent_block_id;
    for (let k = iTipos + 1; k < textos.length && textos[k].b.parent_block_id === pai; k++) apagar.push(textos[k].b.id);
  } else naoAchei.push('3.2. Tipos de entrega');

  porPrefixo('[Inserir processo de entrega', () => simples(tap.processo_entrega.join('\n') || 'Não identificado nos documentos'));
  porPrefixo('[Inserir responsáveis]', () => simples(`A definir pela Coordenação de Planejamento.\nEspecialista(s): a definir\nGerente(s): a definir${tap.perfis_equipe && !/não identificado/i.test(tap.perfis_equipe) ? `\nPerfis indicados na proposta: ${tap.perfis_equipe}` : ''}`));

  // Responsabilidades conforme o modelo de TAP (padrão, CNCA ou GA)
  const resp = responsabilidades(tap.modelo_tap);
  const secoes: { cabecalho: string; itens: string[] | null }[] = [
    { cabecalho: '6.1. Responsabilidades Superintendência de Projetos', itens: resp.superintendencia },
    { cabecalho: '6.1.1. Responsabilidades Coordenação de Desenvolvimento', itens: resp.cdpe },
    { cabecalho: '6.1.1. Responsabilidades Superintendência de Ações Estruturadas', itens: resp.sae },
    { cabecalho: '6.2. Equipe Gestora', itens: resp.equipe },
  ];
  for (const s of secoes) {
    const ic = acharComeco(s.cabecalho);
    if (ic < 0) { naoAchei.push(s.cabecalho); continue; }
    const ip = proximoMarcador('[Inserir responsabilidade', ic);
    if (s.itens) {
      if (ip >= 0) atualizar(textos[ip].b, simples(numerada(s.itens)));
    } else {
      apagar.push(textos[ic].b.id);
      if (ip >= 0) apagar.push(textos[ip].b.id);
    }
  }

  porPrefixo('[Inserir não escopo]', () => simples(numerada(tap.fora_escopo) || 'Não identificado nos documentos'));

  // 8. Necessidades: o modelo traz cinco itens de lista numerada.
  const necess = textos.filter((x) => x.t.startsWith('[Inserir necessidades]'));
  const itens = tap.necessidades.length ? tap.necessidades : ['Não identificado nos documentos'];
  necess.forEach((x, k) => {
    if (k < itens.length) atualizar(x.b, simples(itens[k]));
    else apagar.push(x.b.id);
  });
  // Necessidades além das do modelo: um item numerado novo para cada uma, na mesma célula.
  // Todos entram logo depois do último item do modelo, em ordem inversa, para ficarem na ordem certa.
  const extras: Record<string, unknown>[] = [];
  const ultimo = necess[necess.length - 1]?.b;
  if (ultimo && itens.length > necess.length) {
    for (const t of itens.slice(necess.length).reverse()) {
      extras.push({
        operation_type: 'create_block', after_block_id: ultimo.id, ...(ultimo.parent_block_id ? { parent_block_id: ultimo.parent_block_id } : {}),
        block: { block_type: 'list_item', list_block_type: 'NUMBERED_LIST', delta_format: simples(t) },
      });
    }
  }
  if (!necess.length) naoAchei.push('[Inserir necessidades]');

  if (!ops.length) throw new Error('O doc do TAP não está no formato do modelo (nenhum campo para preencher). Ele já pode ter sido preenchido.');
  ops.push(...extras);
  if (apagar.length) ops.push({ operation_type: 'delete_blocks', block_ids: apagar.slice(0, 100) });

  for (let i = 0; i < ops.length; i += 20) {
    await avisar(`Gravando o TAP (${Math.min(i + 20, ops.length)} de ${ops.length} alterações)…`);
    await mcp('update_doc', { doc_id: String(doc.id), operations: ops.slice(i, i + 20) }, token);
  }
  return `TAP preenchido (${ops.length} alterações)${naoAchei.length ? `. Campos não encontrados no modelo: ${naoAchei.join(', ')}` : ''}.`;
}
