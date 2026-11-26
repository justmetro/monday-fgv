// Integração com a Calculadora de Riscos v3 (09.1 a 09.4): o hub preenche as 8 características,
// roda o motor e envia os riscos ao grupo Riscos do quadro [PLAN], reaproveitando o código da v3.
import { gql, txt, fetchAllItems } from '@generated/lib/monday';
import { B_PROJ, loadContext, readProjects } from '@generated/lib/engineData';
import { processProject } from '@generated/lib/engineRun';
import { sendProject } from '@generated/lib/sendRun';
import { CP, itensDosGrupos, alterarItens, faixa, hojeISO } from '@generated/lib/quadros';

export interface Caracteristicas {
  c1_fat: string; c2_tipofat: string; c3_vig: string; c4_cli: string; c5_mod: string; c6_prod: string; c7_tipo: string[]; c8_equipe: string | null; c8_gr85: boolean;
  justificativas?: Record<string, string>;
}

const LINK = 'link_mm7nck8b';

/** Acha (pelo link do planejamento ou pelo nome) ou cria o projeto no 09.1 e grava as características. */
export async function prepararProjetoCalc(nome: string, planUrl: string, boardId: string, c: Caracteristicas, userId: string): Promise<string> {
  const itens = await fetchAllItems(B_PROJ, [LINK]);
  const achado = itens.find((it: any) => {
    let url = '';
    try { url = JSON.parse(it.cols[LINK]?.value || 'null')?.url ?? ''; } catch { url = ''; }
    return url.includes(`/boards/${boardId}`) || it.name.trim().toLowerCase() === nome.trim().toLowerCase();
  });
  const valores: Record<string, unknown> = {
    c1_fat: { labels: [c.c1_fat] }, c2_tipofat: { labels: [c.c2_tipofat] }, c3_vig: { labels: [c.c3_vig] }, c4_cli: { labels: [c.c4_cli] },
    c5_mod: { labels: [c.c5_mod] }, c6_prod: { labels: [c.c6_prod] }, c7_tipo: { labels: c.c7_tipo },
    c8_gr85: c.c8_gr85 ? { checked: 'true' } : null,
    [LINK]: { url: planUrl, text: 'Quadro [PLAN]' }, situacao: { label: 'Cadastro concluído' }, data_cad: { date: hojeISO() },
    responsavel: { personsAndTeams: [{ id: Number(userId), kind: 'person' }] },
  };
  if (c.c8_equipe) valores.c8_equipe = { labels: [c.c8_equipe] };
  if (achado) {
    await gql('mutation ($b: ID!, $i: ID!, $v: JSON!) { change_multiple_column_values(board_id: $b, item_id: $i, column_values: $v) { id } }', { b: String(B_PROJ), i: achado.id, v: JSON.stringify(valores) });
    return String(achado.id);
  }
  const d = await gql('mutation ($b: ID!, $n: String!, $v: JSON!) { create_item(board_id: $b, item_name: $n, column_values: $v) { id } }', { b: String(B_PROJ), n: nome, v: JSON.stringify(valores) });
  return String(d.create_item.id);
}

export async function rodarCalculadora(projetoCalcId: string, progresso: (m: string) => void) {
  const ctx = await loadContext((m: string) => progresso(m));
  const [proj] = await readProjects([projetoCalcId]);
  if (!proj) throw new Error('Projeto não encontrado no 09.1.');
  progresso('Gerando riscos pela metodologia…');
  return processProject(ctx, proj, (f: number) => progresso(`Gerando riscos… ${Math.round(f * 100)}%`));
}

export async function enviarAoPlanejamento(projetoCalcId: string, nome: string, planUrl: string, boardId: string, progresso: (m: string) => void) {
  return sendProject({ id: projetoCalcId, name: nome, url: planUrl, boardId }, {}, (m: string) => progresso(m));
}

export interface RiscoNoQuadro { id: string; nome: string; causa: string; efeito: string; categoria: string; estrategia: string; resposta: string; periodo: string; frente: string; daIA: boolean }

export async function riscosDoQuadro(boardId: string): Promise<RiscoNoQuadro[]> {
  const its = await itensDosGrupos(boardId, [CP.grupos.riscos], [CP.causa, CP.efeito, CP.categoria, CP.estrategia, CP.resposta, CP.periodo, CP.frentes]);
  return its.map((it) => ({
    id: it.id, nome: it.name, causa: txt(it.cols[CP.causa]), efeito: txt(it.cols[CP.efeito]), categoria: txt(it.cols[CP.categoria]),
    estrategia: txt(it.cols[CP.estrategia]), resposta: txt(it.cols[CP.resposta]), periodo: txt(it.cols[CP.periodo]), frente: txt(it.cols[CP.frentes]),
    daIA: /^RISCO \d+/i.test(it.name),
  }));
}

export interface Complemento { id: string; dia_inicio: number; dia_fim: number; frente: string; estrategia: string; resposta: string; aplicar?: boolean }

export async function aplicarComplemento(boardId: string, itens: Complemento[], inicio: string | null, progresso: (m: string) => void) {
  const sel = itens.filter((x) => x.aplicar !== false);
  await alterarItens(boardId, sel.map((x) => {
    const v: Record<string, unknown> = { [CP.estrategia]: { label: x.estrategia }, [CP.resposta]: { text: x.resposta } };
    if (x.frente) v[CP.frentes] = { label: x.frente };
    if (inicio && x.dia_inicio && x.dia_fim) v[CP.periodo] = faixa(inicio, x.dia_inicio, x.dia_fim);
    return { id: x.id, valores: v };
  }), (n) => progresso(`Completando riscos ${n}/${sel.length}…`));
  return sel.length;
}
