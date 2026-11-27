// Comparação da prévia com o que já está no quadro [PLAN] (novos, iguais, alterados e ausentes),
// aplicação das escolhas (adicionar, atualizar, arquivar) e remoção do que o hub gravou.
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { tokenAtual } from '../../../server/context';
import { colRuns, agora, ctxOuErro, rodando, setEtapa, tokenIA, type Execucao, type Etapa } from './hub';
import { registrar, produtosResumo } from './gravacao';
import {
  norm, semNumero, linhasEap, criarLinhasEap, ajustarAbaCronograma, mapaProdutos, valoresProduto, valoresRisco, valoresParte,
  valoresIndicador, medicoesDe, parteExterna, limparModelo,
  type Produto, type EapProduto, type Risco, type Parte, type Objetivo, type Indicador, type LinhaEap,
} from '@generated/lib/gravar';
import { CP, SUB, criarItens, alterarItens, arquivarItens, itensDosGrupos } from '@generated/lib/quadros';
import { gql, sleep } from '@generated/lib/monday';

export type EtapaQuadro = 'produtos' | 'eap' | 'riscos' | 'indicadores' | 'partes';
const ETAPAS_QUADRO = ['produtos', 'eap', 'riscos', 'indicadores', 'partes'] as const;
const ETAPAS_APAGAR = ['produtos', 'eap', 'riscos', 'indicadores', 'partes', 'calculadora'] as const;

export type Situacao = 'novo' | 'igual' | 'alterado' | 'ausente';
export interface CampoDiff { campo: string; quadro: string; previa: string }
export interface ItemDiff {
  chave: string; situacao: Situacao; titulo: string; nivel?: string; contexto?: string;
  campos?: CampoDiff[]; itemId?: string; doHub?: boolean; aviso?: string;
}
export interface Comparacao { em: string; itens: ItemDiff[]; avisos: string[]; total: Record<Situacao, number> }

// ---------- Linhas da prévia e do quadro ----------

export interface Campo { id: string; nome: string; numero?: boolean }
export interface LinhaP { chave: string; escopo: string; titulo: string; nome: string; nivel?: string; contexto?: string; pai?: string; valores: Record<string, unknown>; extra?: any }
export interface LinhaQ { chave: string; escopo: string; titulo: string; nome: string; itemId: string; nivel?: string; contexto?: string; cols: Record<string, { text?: string | null; value?: string | null; linked_item_ids?: string[] }>; pai?: string; subBoard?: string; legado?: boolean }

const CAMPOS: Record<EtapaQuadro, Campo[]> = {
  produtos: [
    { id: CP.descricao, nome: 'Descrição' }, { id: CP.meses, nome: 'Meses contratuais' }, { id: CP.valor, nome: 'Valor', numero: true },
    { id: CP.objetivo, nome: 'Objetivo' }, { id: CP.tipoEntrega, nome: 'Tipo de entrega' }, { id: CP.etapaProduto, nome: 'Fase' }, { id: CP.contratual, nome: 'Contratual início e entrega' },
  ],
  eap: [{ id: CP.cronograma, nome: 'Cronograma planejado' }],
  riscos: [
    { id: CP.tema, nome: 'Tema' }, { id: CP.categoria, nome: 'Categoria' }, { id: CP.impactado, nome: 'Impactado' }, { id: CP.causa, nome: 'Causa' },
    { id: CP.efeito, nome: 'Efeito' }, { id: CP.prob, nome: 'Probabilidade' }, { id: CP.imp, nome: 'Impacto' }, { id: CP.estrategia, nome: 'Estratégia' },
    { id: CP.resposta, nome: 'Resposta' }, { id: CP.cargoResp, nome: 'Cargo responsável' }, { id: CP.frentes, nome: 'Frente' }, { id: CP.periodo, nome: 'Período do risco' },
  ],
  indicadores: [
    { id: CP.tipoInd, nome: 'Tipo' }, { id: CP.descInd, nome: 'Descrição' }, { id: CP.formula, nome: 'Forma de cálculo' }, { id: CP.meta, nome: 'Meta', numero: true },
    { id: CP.unidade, nome: 'Unidade' }, { id: CP.temporalidade, nome: 'Temporalidade' }, { id: CP.coleta, nome: 'Coleta' }, { id: CP.polaridade, nome: 'Polaridade' },
    { id: CP.objetivo, nome: 'Objetivo' },
  ],
  partes: [
    { id: CP.cargoCliente, nome: 'Cargo do cliente' }, { id: CP.area, nome: 'Área' }, { id: CP.papel, nome: 'Papel' }, { id: CP.interesse, nome: 'Interesse' },
    { id: CP.poder, nome: 'Poder' }, { id: CP.expectativas, nome: 'Expectativas' }, { id: CP.riscosAssoc, nome: 'Riscos associados' },
  ],
};
const CAMPOS_SUB: Campo[] = [{ id: SUB.cronograma, nome: 'Cronograma planejado' }, { id: SUB.frentes, nome: 'Frente' }];

/** Texto que o monday mostraria para um valor que o hub grava. */
function textoDe(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  const o = v as Record<string, any>;
  if (o.label != null) return String(o.label);
  if (Array.isArray(o.labels)) return o.labels.join(', ');
  if (o.text != null) return String(o.text);
  if (o.from) return `${o.from} - ${o.to}`;
  if (o.date) return String(o.date);
  return '';
}
const limpa = (s: string) => String(s ?? '').replace(/\s+/g, ' ').replace(/…$/, '').trim();
function iguais(a: string, b: string, numero?: boolean) {
  if (numero) return Number(a || 0) === Number(b || 0);
  return limpa(a).toLowerCase() === limpa(b).toLowerCase();
}
const tokens = (s: string) => new Set(norm(s).split(' ').filter((x) => x.length > 2));
function jaccard(a: string, b: string) {
  const x = tokens(a), y = tokens(b);
  if (!x.size || !y.size) return 0;
  let i = 0;
  for (const t of x) if (y.has(t)) i++;
  // Um título contido no outro (ex.: nome encurtado) também conta, se o menor tiver ao menos 2 palavras.
  const contido = Math.min(x.size, y.size) >= 2 ? (i / Math.min(x.size, y.size)) * 0.85 : 0;
  return Math.max(i / (x.size + y.size - i), contido);
}

/** Casa prévia e quadro: primeiro pela chave exata, depois por semelhança do título dentro do mesmo escopo. */
function casar(ps: LinhaP[], qs: LinhaQ[]): Map<LinhaP, LinhaQ> {
  const par = new Map<LinhaP, LinhaQ>();
  const usados = new Set<LinhaQ>();
  const porChave = new Map<string, LinhaQ[]>();
  for (const q of qs) { if (!porChave.has(q.chave)) porChave.set(q.chave, []); porChave.get(q.chave)!.push(q); }
  for (const p of ps) {
    const q = porChave.get(p.chave)?.find((x) => !usados.has(x));
    if (q) { par.set(p, q); usados.add(q); }
  }
  const cand: { p: LinhaP; q: LinhaQ; s: number }[] = [];
  for (const p of ps) {
    if (par.has(p)) continue;
    for (const q of qs) {
      if (usados.has(q) || q.escopo !== p.escopo) continue;
      const s = jaccard(p.titulo, q.titulo);
      if (s >= 0.6) cand.push({ p, q, s });
    }
  }
  cand.sort((a, b) => b.s - a.s);
  for (const c of cand) {
    if (par.has(c.p) || usados.has(c.q)) continue;
    par.set(c.p, c.q); usados.add(c.q);
  }
  return par;
}

function camposDiff(p: LinhaP, q: LinhaQ, campos: Campo[]): CampoDiff[] {
  const out: CampoDiff[] = [];
  if (!iguais(p.titulo, q.titulo)) out.push({ campo: 'Nome', quadro: q.titulo, previa: p.titulo });
  for (const c of campos) {
    if (!(c.id in p.valores)) continue;
    const a = textoDe(p.valores[c.id]);
    const b = q.cols[c.id]?.text ?? '';
    if (!iguais(a, b, c.numero)) out.push({ campo: c.nome, quadro: limpa(b) || '(vazio)', previa: limpa(a) || '(vazio)' });
  }
  return out;
}

// ---------- Leitura do quadro ----------

async function itensComSub(boardId: string, grupo: string, cols: string[], subCols: string[]) {
  const out: { id: string; name: string; cols: Record<string, any>; subs: { id: string; name: string; board: string; cols: Record<string, any> }[] }[] = [];
  const campos = `items { id name column_values(ids: ${JSON.stringify(cols)}) { id text value ... on BoardRelationValue { linked_item_ids } } subitems { id name board { id } column_values(ids: ${JSON.stringify(subCols)}) { id text value } } }`;
  let cursor: string | null = null;
  do {
    const d: any = cursor
      ? await gql(`query ($c: String!) { next_items_page(limit: 100, cursor: $c) { cursor ${campos} } }`, { c: cursor })
      : await gql(`query ($b: [ID!], $g: CompareValue!) { boards(ids: $b) { items_page(limit: 100, query_params: { rules: [{ column_id: "group", compare_value: $g, operator: any_of }] }) { cursor ${campos} } } }`, { b: [boardId], g: [grupo] });
    const page: any = cursor ? d.next_items_page : d.boards[0].items_page;
    for (const it of page.items) {
      out.push({
        id: String(it.id), name: it.name, cols: Object.fromEntries(it.column_values.map((c: any) => [c.id, c])),
        subs: (it.subitems ?? []).map((s: any) => ({ id: String(s.id), name: s.name, board: String(s.board?.id ?? ''), cols: Object.fromEntries(s.column_values.map((c: any) => [c.id, c])) })),
      });
    }
    cursor = page.cursor;
  } while (cursor);
  return out;
}

const res = <T,>(run: Execucao, e: Etapa) => run.etapas[e]?.resultado as T | undefined;
const nomeRisco = (n: string) => n.replace(/^\s*RISCO\s*\d+\s*[|:–-]\s*/i, '').trim();
const ehRiscoIA = (n: string) => /^\s*RISCO \d+/i.test(n);

export interface Montado { ps: LinhaP[]; qs: LinhaQ[]; campos: Campo[]; avisos: string[]; extra?: any }

async function montar(run: Execucao, etapa: EtapaQuadro): Promise<Montado> {
  const boardId = run.boardId!;
  const inicio = run.contexto.inicioExecucao ?? null;
  const avisos: string[] = [];
  const campos = CAMPOS[etapa];
  const cols = campos.map((c) => c.id);

  if (etapa === 'produtos') {
    const produtos = res<{ produtos: Produto[] }>(run, 'produtos')?.produtos ?? [];
    const ps: LinhaP[] = produtos.map((p) => ({ chave: p.codigo.toUpperCase(), escopo: '', titulo: p.nome, nome: `${p.codigo} - ${p.nome}`, contexto: p.codigo, valores: valoresProduto(p, inicio), extra: p }));
    const its = await itensDosGrupos(boardId, [CP.grupos.produtos], [CP.codigo, ...cols]);
    const qs: LinhaQ[] = its.filter((it) => !/^PRODUTO \d+$/i.test(it.name.trim())).map((it) => {
      const cod = (String(it.cols[CP.codigo]?.text ?? '').trim() || it.name.match(/^\s*(P\d+)/i)?.[1] || it.name).toUpperCase();
      return { chave: cod, escopo: '', titulo: it.name.replace(/^\s*P\d+\s*[-–]\s*/i, ''), nome: it.name, itemId: it.id, contexto: cod, cols: it.cols };
    });
    return { ps, qs, campos, avisos };
  }

  if (etapa === 'eap') {
    if (!inicio) throw new Error('Defina a data de início da execução na aba Quadro.');
    const eap = res<{ produtos: EapProduto[] }>(run, 'eap')?.produtos ?? [];
    const mapa = await mapaProdutos(boardId);
    const { linhas } = linhasEap(eap, produtosResumo(run).map((p) => p.codigo), mapa, inicio);
    const ps: LinhaP[] = linhas.map((l) => ({
      chave: l.chave, escopo: l.nivel === 4 ? l.pai! : `${l.nivel}|${l.codigo}`, titulo: l.titulo, nome: l.nome, nivel: `Nível ${l.nivel}`,
      contexto: l.codigo, pai: l.pai, valores: l.valores, extra: l,
    }));
    const porId = Object.fromEntries(Object.entries(mapa).map(([c, id]) => [id, c]));
    const its = await itensComSub(boardId, CP.grupos.cronograma, [CP.eap, CP.produtoRel, CP.cronograma], [SUB.cronograma, SUB.frentes]);
    const qs: LinhaQ[] = [];
    const marcos = new Map<string, LinhaQ>(); // prefixo numérico "1.1.2" -> marco
    let legado = 0;
    for (const it of its) {
      const nivel = (String(it.cols[CP.eap]?.text ?? '').match(/\d/)?.[0]) ?? '';
      if (!/^[234]$/.test(nivel)) continue;
      const rel: string[] = (it.cols[CP.produtoRel]?.linked_item_ids ?? []).map(String);
      const cod = rel.length ? (porId[rel[0]] ?? '') : '';
      const titulo = semNumero(it.name);
      const prefixo = it.name.match(/^\s*(\d+(\.\d+)*)/)?.[1] ?? '';
      if (nivel === '4') {
        // Formato antigo: atividade como item solto (antes de virar subitem do marco).
        legado++;
        qs.push({ chave: `4L|${it.id}`, escopo: `legado`, titulo, nome: it.name, itemId: it.id, nivel: 'Nível 4 (item solto, formato antigo)', contexto: cod, cols: it.cols, legado: true });
        continue;
      }
      const q: LinhaQ = { chave: `${nivel}|${cod}|${norm(titulo)}`, escopo: `${nivel}|${cod}`, titulo, nome: it.name, itemId: it.id, nivel: `Nível ${nivel}`, contexto: cod, cols: it.cols };
      qs.push(q);
      if (nivel === '3') {
        marcos.set(prefixo, q);
        for (const s of it.subs) {
          const ts = semNumero(s.name);
          qs.push({ chave: `4|@${it.id}|${norm(ts)}`, escopo: `@${it.id}`, titulo: ts, nome: s.name, itemId: s.id, nivel: 'Nível 4', contexto: cod, cols: s.cols, pai: it.id, subBoard: s.board });
        }
      }
    }
    if (legado) avisos.push(`${legado} atividades estão no formato antigo (itens soltos, sem ser subitem do marco). Elas aparecem como ausentes; as atividades da prévia entram como subitens dos marcos.`);
    return { ps, qs, campos, avisos };
  }

  if (etapa === 'riscos') {
    const riscos = (res<{ riscos: Risco[] }>(run, 'riscos')?.riscos ?? []).filter((r) => r.incluir !== false);
    const ps: LinhaP[] = riscos.map((r) => ({ chave: norm(r.titulo), escopo: '', titulo: r.titulo, nome: `${r.id} | ${r.titulo}`, contexto: r.categoria, valores: valoresRisco(r, inicio), extra: r }));
    const its = await itensDosGrupos(boardId, [CP.grupos.riscos], cols);
    const qs: LinhaQ[] = its.filter((it) => ehRiscoIA(it.name) && !/^RISCO \d+$/i.test(it.name.trim())).map((it) => ({ chave: norm(nomeRisco(it.name)), escopo: '', titulo: nomeRisco(it.name), nome: it.name, itemId: it.id, contexto: String(it.cols[CP.categoria]?.text ?? ''), cols: it.cols }));
    avisos.push('Só entram na comparação os riscos específicos (RISCO NN). Os riscos da Calculadora ficam de fora.');
    return { ps, qs, campos, avisos };
  }

  if (etapa === 'partes') {
    const partes = (res<{ partes: Parte[] }>(run, 'partes')?.partes ?? []).filter((p) => p.incluir !== false && parteExterna(p));
    const ps: LinhaP[] = partes.map((p) => ({ chave: norm(p.nome), escopo: '', titulo: p.nome, nome: p.nome, contexto: p.classe, valores: valoresParte(p), extra: p }));
    const its = await itensDosGrupos(boardId, [CP.grupos.partes], cols);
    const qs: LinhaQ[] = its.filter((it) => !/^GRUPO \/ INSTITUI[ÇC][ÃA]O \d+$/i.test(it.name.trim())).map((it) => ({ chave: norm(it.name), escopo: '', titulo: it.name, nome: it.name, itemId: it.id, contexto: String(it.cols[CP.area]?.text ?? ''), cols: it.cols }));
    return { ps, qs, campos, avisos };
  }

  // indicadores
  const objetivos = res<{ objetivos: Objetivo[] }>(run, 'indicadores')?.objetivos ?? [];
  const ps: LinhaP[] = [];
  for (const o of objetivos) {
    for (const kr of o.krs ?? []) {
      const ck = `KR|${norm(kr.nome)}`;
      ps.push({ chave: ck, escopo: 'KR', titulo: kr.nome, nome: kr.nome, nivel: 'KR', contexto: o.objetivo, valores: valoresIndicador(kr, 'KR - Resultado Chave', o.objetivo), extra: { ind: kr, tipo: 'KR - Resultado Chave', objetivo: o.objetivo } });
      for (const kpi of kr.kpis ?? []) {
        ps.push({ chave: `KPI|${norm(kpi.nome)}`, escopo: 'KPI', titulo: kpi.nome, nome: kpi.nome, nivel: 'KPI', contexto: kr.nome, pai: ck, valores: valoresIndicador(kpi, 'KPI - Resultado de Processo', o.objetivo), extra: { ind: kpi, tipo: 'KPI - Resultado de Processo', objetivo: o.objetivo } });
      }
    }
  }
  const its = await itensDosGrupos(boardId, [CP.grupos.indicador], cols);
  const qs: LinhaQ[] = its.filter((it) => !/^INDICADOR (KR|KPI) \d+$/i.test(it.name.trim())).map((it) => {
    const tipo = /KPI/i.test(String(it.cols[CP.tipoInd]?.text ?? '')) ? 'KPI' : 'KR';
    return { chave: `${tipo}|${norm(it.name)}`, escopo: tipo, titulo: it.name, nome: it.name, itemId: it.id, nivel: tipo, contexto: String(it.cols[CP.objetivo]?.text ?? ''), cols: it.cols };
  });
  avisos.push('Indicadores atualizados mantêm as medições já criadas; indicadores novos entram com as suas medições; os arquivados levam as medições junto.');
  return { ps, qs, campos, avisos };
}

/** Diferença entre prévia e quadro. Na EAP, as atividades são casadas dentro do marco correspondente. */
export function diferenca(m: Montado, etapa: EtapaQuadro, hub: Set<string>) {
  const par = new Map<LinhaP, LinhaQ>();
  if (etapa === 'eap') {
    const n23p = m.ps.filter((p) => p.nivel !== 'Nível 4');
    const n23q = m.qs.filter((q) => q.nivel === 'Nível 2' || q.nivel === 'Nível 3');
    for (const [p, q] of casar(n23p, n23q)) par.set(p, q);
    // Chave da atividade do quadro passa a usar a chave do marco casado na prévia.
    const marcoP = new Map<string, string>();
    for (const [p, q] of par) if (p.nivel === 'Nível 3') marcoP.set(q.itemId, p.chave);
    const n4q = m.qs.filter((q) => q.nivel === 'Nível 4').map((q) => {
      const cm = q.pai ? marcoP.get(q.pai) : undefined;
      return cm ? { ...q, chave: `4|${cm}|${norm(q.titulo)}`, escopo: cm } : q;
    });
    for (const [p, q] of casar(m.ps.filter((p) => p.nivel === 'Nível 4'), n4q)) par.set(p, q);
  } else {
    for (const [p, q] of casar(m.ps, m.qs)) par.set(p, q);
  }
  const casados = new Set([...par.values()].map((q) => q.itemId));
  const itens: ItemDiff[] = [];
  for (const p of m.ps) {
    const q = par.get(p);
    if (!q) { itens.push({ chave: p.chave, situacao: 'novo', titulo: p.titulo, nivel: p.nivel, contexto: p.contexto }); continue; }
    const campos = camposDiff(p, q, p.nivel === 'Nível 4' ? CAMPOS_SUB : m.campos);
    itens.push({ chave: p.chave, situacao: campos.length ? 'alterado' : 'igual', titulo: p.titulo, nivel: p.nivel, contexto: p.contexto, campos, itemId: q.itemId, doHub: hub.has(q.itemId) });
  }
  for (const q of m.qs) {
    if (casados.has(q.itemId)) continue;
    itens.push({ chave: `q:${q.itemId}`, situacao: 'ausente', titulo: q.titulo, nivel: q.nivel, contexto: q.contexto, itemId: q.itemId, doHub: hub.has(q.itemId) });
  }
  const total = { novo: 0, igual: 0, alterado: 0, ausente: 0 } as Record<Situacao, number>;
  for (const i of itens) total[i.situacao]++;
  return { itens, par, total };
}

const idsDoHub = (run: Execucao, etapa: Etapa) => new Set<string>(run.etapas[etapa]?.itensQuadro ?? []);

async function carregar(runId: string) {
  const run = await (await colRuns()).findOne({ _id: runId });
  if (!run) throw new Error('Execução não encontrada.');
  if (!run.boardId) throw new Error('Vincule o quadro [PLAN] antes.');
  return run;
}

export const compararComQuadro = createServerFn()
  .validator(z.object({ runId: z.string(), etapa: z.enum(ETAPAS_QUADRO) }))
  .handler(async ({ data }) => {
    ctxOuErro();
    const token = await tokenIA();
    const run = await carregar(data.runId);
    if (run.etapas[data.etapa as Etapa]?.resultado == null) throw new Error('Gere a prévia desta etapa antes de comparar.');
    return tokenAtual.run(token, async () => {
      const m = await montar(run, data.etapa);
      const d = diferenca(m, data.etapa, idsDoHub(run, data.etapa));
      const comp: Comparacao = { em: agora(), itens: d.itens, avisos: m.avisos, total: d.total };
      await setEtapa(run._id, data.etapa, { comparacao: comp });
      return comp;
    });
  });

// ---------- Aplicar as escolhas ----------

async function aplicar(run: Execucao, etapa: EtapaQuadro, escolha: { adicionar: string[]; atualizar: string[]; arquivar: string[] }, prog: (m: string) => void) {
  const boardId = run.boardId!;
  const inicio = run.contexto.inicioExecucao ?? null;
  prog('Lendo o quadro de novo…');
  const m = await montar(run, etapa);
  const d = diferenca(m, etapa, idsDoHub(run, etapa));
  const add = new Set(escolha.adicionar), upd = new Set(escolha.atualizar), arq = new Set(escolha.arquivar);
  const porChave = new Map(d.itens.map((i) => [i.chave, i]));
  const novos = m.ps.filter((p) => add.has(p.chave) && porChave.get(p.chave)?.situacao === 'novo');
  const alterados = m.ps.filter((p) => upd.has(p.chave) && porChave.get(p.chave)?.situacao === 'alterado').map((p) => ({ p, q: d.par.get(p)! }));
  const ausentes = d.itens.filter((i) => arq.has(i.chave) && i.situacao === 'ausente' && i.itemId).map((i) => i.itemId!);
  const criados: string[] = [];
  const feito: string[] = [];

  if (alterados.length) {
    prog(`Atualizando ${alterados.length} itens…`);
    // Renomeia mantendo a numeração que o item já tem no quadro.
    const prefixo = (nome: string) => nome.match(/^\s*(\d+(\.\d+)*\.?|RISCO\s*\d+\s*\||P\d+\s*[-–])\s*/i)?.[0] ?? '';
    const principais = alterados.filter((x) => !x.q.subBoard);
    const subs = alterados.filter((x) => x.q.subBoard);
    // Não mexe em status nem responsável de item que já existe (podem ter sido ajustados à mão).
    const semStatus = (v: Record<string, unknown>) => { const { person: _p, [CP.status]: _s, [SUB.status]: _ss, [CP.statusMed]: _m, ...r } = v as any; return r; };
    const novoNome = (p: LinhaP, q: LinhaQ) => {
      if (iguais(p.titulo, q.titulo)) return {};
      const pre = prefixo(q.nome).trimEnd();
      return { name: (pre ? `${pre} ${p.titulo}` : p.titulo).slice(0, 255) };
    };
    if (principais.length) await alterarItens(boardId, principais.map(({ p, q }) => ({ id: q.itemId, valores: { ...semStatus(p.valores), ...novoNome(p, q) } })), undefined, true);
    if (subs.length) await alterarItens(subs[0].q.subBoard!, subs.map(({ p, q }) => ({ id: q.itemId, valores: { ...semStatus(p.valores), ...novoNome(p, q) } })), undefined, true);
    feito.push(`${alterados.length} atualizados`);
  }

  if (novos.length) {
    prog(`Adicionando ${novos.length} itens…`);
    if (etapa === 'produtos') {
      criados.push(...await criarItens(boardId, CP.grupos.produtos, novos.map((p) => ({ nome: p.nome, valores: p.valores })), (n) => prog(`Criando produtos ${n}/${novos.length}…`)));
    } else if (etapa === 'eap') {
      // Marcos já no quadro servem de pai para atividades novas.
      const existentes: Record<string, string> = {};
      for (const [p, q] of d.par) if (p.nivel === 'Nível 3') existentes[p.chave] = q.itemId;
      const out = await criarLinhasEap(boardId, novos.map((p) => p.extra as LinhaEap), existentes, prog);
      criados.push(...out.ids);
      if (out.semMarco) feito.push(`${out.semMarco} atividades sem marco no quadro ficaram de fora (adicione o marco junto)`);
      await ajustarAbaCronograma(boardId).catch(() => false);
    } else if (etapa === 'riscos') {
      const usados = m.qs.map((q) => Number(q.nome.match(/RISCO\s*(\d+)/i)?.[1] ?? 0));
      let n = Math.max(0, ...usados);
      await limparModelo(boardId, CP.grupos.riscos);
      criados.push(...await criarItens(boardId, CP.grupos.riscos, novos.map((p) => ({ nome: `RISCO ${String(++n).padStart(2, '0')} | ${p.titulo}`, valores: p.valores }))));
    } else if (etapa === 'partes') {
      await limparModelo(boardId, CP.grupos.partes);
      criados.push(...await criarItens(boardId, CP.grupos.partes, novos.map((p) => ({ nome: p.nome, valores: p.valores }))));
    } else {
      await limparModelo(boardId, CP.grupos.indicador);
      const idKr: Record<string, string> = {};
      for (const [p, q] of d.par) if (p.nivel === 'KR') idKr[p.chave] = q.itemId;
      const krs = novos.filter((p) => p.nivel === 'KR');
      const kpis = novos.filter((p) => p.nivel === 'KPI');
      const idsKr = await criarItens(boardId, CP.grupos.indicador, krs.map((p) => ({ nome: p.nome, valores: p.valores })), undefined, true);
      krs.forEach((p, i) => { idKr[p.chave] = idsKr[i]; });
      const idsKpi = await criarItens(boardId, CP.grupos.indicador, kpis.map((p) => ({ nome: p.nome, valores: { ...p.valores, ...(p.pai && idKr[p.pai] ? { [CP.krVinculado]: { item_ids: [Number(idKr[p.pai])] } } : {}) } })), undefined, true);
      const meds = [...krs.map((p, i) => medicoesDe(p.extra.ind as Indicador, idsKr[i], inicio)), ...kpis.map((p, i) => medicoesDe(p.extra.ind as Indicador, idsKpi[i], inicio))].flat();
      const idsMed = meds.length ? await criarItens(boardId, CP.grupos.medicao, meds) : [];
      criados.push(...idsKr, ...idsKpi, ...idsMed);
    }
    feito.push(`${novos.length} adicionados`);
  }

  if (ausentes.length) {
    prog(`Arquivando ${ausentes.length} itens…`);
    const alvo = etapa === 'indicadores' ? [...ausentes, ...await medicoesDosIndicadores(boardId, ausentes)] : ausentes;
    await arquivarItens(alvo);
    feito.push(`${ausentes.length} arquivados${alvo.length > ausentes.length ? ` (com ${alvo.length - ausentes.length} medições)` : ''}`);
  }
  return { resumo: feito.length ? `Comparação aplicada: ${feito.join(', ')}` : 'Nada a aplicar', criados, arquivados: ausentes };
}

async function medicoesDosIndicadores(boardId: string, ids: string[]) {
  const alvo = new Set(ids.map(Number));
  const its = await itensDosGrupos(boardId, [CP.grupos.medicao], [CP.indVinculado]);
  return its.filter((it) => ((it.cols[CP.indVinculado]?.linked_item_ids ?? []) as string[]).some((x) => alvo.has(Number(x)))).map((it) => it.id);
}

/** Roda em segundo plano no servidor, com o token de quem clicou, como as gravações. */
function emSegundoPlano(run: Execucao, etapa: Etapa, rotulo: string, fn: (prog: (m: string) => void) => Promise<Partial<Record<string, unknown>>>) {
  const c = ctxOuErro();
  const chave = `${run._id}:grav:${etapa}`;
  if (rodando.has(chave)) return { iniciada: false, motivo: 'Já há uma gravação em andamento nesta etapa.' };
  return (async () => {
    const token = await tokenIA();
    await setEtapa(run._id, etapa, { gravando: true, erroGravacao: '', progressoGravacao: rotulo, batidaGravacao: agora() });
    let ultimo = 0;
    const prog = (m: string) => {
      if (Date.now() - ultimo < 2000) return;
      ultimo = Date.now();
      setEtapa(run._id, etapa, { progressoGravacao: m, batidaGravacao: agora() }).catch(() => null);
    };
    const job = tokenAtual.run(token, async () => {
      try {
        const patch = await fn(prog);
        await setEtapa(run._id, etapa, { gravando: false, progressoGravacao: '', erroGravacao: '', ...patch });
        await registrar(run._id, c.userId);
      } catch (err) {
        console.error(`[${rotulo}]`, err);
        await setEtapa(run._id, etapa, { gravando: false, progressoGravacao: '', erroGravacao: err instanceof Error ? err.message : String(err) });
      }
    }).finally(() => rodando.delete(chave));
    rodando.set(chave, job);
    return { iniciada: true };
  })();
}

export const aplicarComparacao = createServerFn()
  .validator(z.object({ runId: z.string(), etapa: z.enum(ETAPAS_QUADRO), adicionar: z.array(z.string()), atualizar: z.array(z.string()), arquivar: z.array(z.string()) }))
  .handler(async ({ data }) => {
    const c = ctxOuErro();
    const run = await carregar(data.runId);
    return emSegundoPlano(run, data.etapa, 'Aplicando a comparação…', async (prog) => {
      const out = await aplicar(run, data.etapa, data, prog);
      const atual = (await (await colRuns()).findOne({ _id: run._id }))?.etapas[data.etapa as Etapa]?.itensQuadro ?? [];
      const fora = new Set(out.arquivados);
      return {
        status: 'gravada', gravadaEm: agora(), gravadaPor: c.userId, resumoGravacao: out.resumo, comparacao: null,
        itensQuadro: [...atual.filter((x: string) => !fora.has(x)), ...out.criados],
      };
    });
  });

// ---------- Apagar do quadro o que o hub gravou ----------

export interface ItemApagar { id: string; nome: string; grupo: string; doHub: boolean }

async function alvosApagar(run: Execucao, etapa: (typeof ETAPAS_APAGAR)[number]): Promise<ItemApagar[]> {
  const boardId = run.boardId!;
  if (etapa === 'calculadora') {
    const its = await itensDosGrupos(boardId, [CP.grupos.riscos], []);
    // Riscos do Cardápio enviados pela calculadora têm o código no nome (ex.: "R2-006 | ...").
    return its.filter((it) => /^\s*R\d*-\d+\s*\|/i.test(it.name)).map((it) => ({ id: it.id, nome: it.name, grupo: 'Riscos da calculadora', doHub: true }));
  }
  const hub = idsDoHub(run, etapa);
  const m = await montar(run, etapa);
  const d = diferenca(m, etapa, hub);
  // Itens gravados pelo hub (ids guardados) e itens que batem com a prévia desta execução.
  const ids = new Set<string>();
  for (const i of d.itens) if (i.itemId && (i.doHub || i.situacao === 'igual' || i.situacao === 'alterado')) ids.add(i.itemId);
  // Atividades no formato antigo (itens soltos de Nível 4) também foram gravadas pelo hub.
  const qs = m.qs.filter((q) => ids.has(q.itemId) || hub.has(q.itemId) || q.legado);
  const out: ItemApagar[] = qs.filter((q) => !q.subBoard).map((q) => ({ id: q.itemId, nome: q.nome, grupo: q.nivel ?? '', doHub: hub.has(q.itemId) }));
  // Atividades (subitens) saem junto com o marco; conta só as dos marcos que não estão na lista.
  const pais = new Set(out.map((x) => x.id));
  for (const q of qs) if (q.subBoard && !(q.pai && pais.has(q.pai))) out.push({ id: q.itemId, nome: q.nome, grupo: 'Nível 4', doHub: hub.has(q.itemId) });
  if (etapa === 'indicadores') {
    const meds = await medicoesDosIndicadores(boardId, out.map((x) => x.id));
    for (const id of meds) out.push({ id, nome: 'Medição', grupo: 'Medição', doHub: hub.has(id) });
  }
  return out;
}

export const previaApagar = createServerFn()
  .validator(z.object({ runId: z.string(), etapa: z.enum(ETAPAS_APAGAR) }))
  .handler(async ({ data }) => {
    ctxOuErro();
    const token = await tokenIA();
    const run = await carregar(data.runId);
    return tokenAtual.run(token, () => alvosApagar(run, data.etapa));
  });

export const apagarDoQuadro = createServerFn()
  .validator(z.object({ runId: z.string(), etapa: z.enum(ETAPAS_APAGAR), ids: z.array(z.string()).min(1), modo: z.enum(['arquivar', 'excluir']), confirmacao: z.string().optional() }))
  .handler(async ({ data }) => {
    ctxOuErro();
    if (data.modo === 'excluir' && data.confirmacao !== 'EXCLUIR') throw new Error('Para excluir de vez, confirme digitando EXCLUIR.');
    const run = await carregar(data.runId);
    const etapa = data.etapa as Etapa;
    return emSegundoPlano(run, etapa, data.modo === 'excluir' ? 'Excluindo do quadro…' : 'Arquivando no quadro…', async (prog) => {
      const permitidos = new Set((await alvosApagar(run, data.etapa)).map((x) => x.id));
      const ids = (data.ids as string[]).filter((x) => permitidos.has(x));
      if (data.modo === 'arquivar') await arquivarItens(ids);
      else {
        for (let i = 0; i < ids.length; i += 10) {
          const corpo = ids.slice(i, i + 10).map((id: string, k: number) => `d${k}: delete_item(item_id: ${Number(id)}) { id }`);
          await gql(`mutation { ${corpo.join(' ')} }`);
          prog(`Excluindo ${Math.min(i + 10, ids.length)} de ${ids.length}…`);
          await sleep(300);
        }
      }
      const temPrevia = run.etapas[etapa]?.resultado != null;
      const restantes = (run.etapas[etapa]?.itensQuadro ?? []).filter((x) => !ids.includes(x));
      return {
        status: temPrevia ? 'pronta' : 'nao_iniciada', itensQuadro: restantes, comparacao: null,
        resumoGravacao: `${ids.length} itens ${data.modo === 'excluir' ? 'excluídos de vez' : 'arquivados'} no quadro em ${agora().slice(0, 10).split('-').reverse().join('/')}`,
      };
    });
  });
