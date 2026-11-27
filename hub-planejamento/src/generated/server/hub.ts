// Funções do servidor do Hub de Planejamento: execuções, documentos, etapas de IA em segundo plano,
// gravação do TAP (doc do quadro, via MCP da monday) e anexo dos documentos no 02.01.
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { mongo } from '../../../server/mongo';
import { currentCtx } from '../../../server/context';
import { tokenDoUsuario, autorizacaoDoUsuario, linkAutorizacao } from '../../../server/oauth';
import { gql } from '../../../server/monday';
import { chamarIA, MODELOS } from './iaCore';
import {
  promptAnalise, promptProdutos, promptEap, promptRiscos, promptPartes, promptIndicadores, promptComplemento,
  type ContextoProjeto, type DocTexto, type ProdutoResumo, type RiscoQuadro, type Prompt,
} from './prompts';
import { escreverTap, type DadosTap } from './tap';

export type Etapa = 'analise' | 'produtos' | 'eap' | 'riscos' | 'partes' | 'indicadores' | 'complemento' | 'tap' | 'calculadora';
const ETAPAS: Etapa[] = ['analise', 'produtos', 'eap', 'riscos', 'partes', 'indicadores', 'complemento', 'tap', 'calculadora'];

export interface EstadoEtapa {
  status: 'nao_iniciada' | 'gerando' | 'pronta' | 'erro' | 'gravada';
  inicio?: string; fim?: string; erro?: string; progresso?: string;
  custo?: number; modelo?: string; tokens?: number;
  resultado?: unknown; gravadaEm?: string; gravadaPor?: string; resumoGravacao?: string;
  // Gravação no quadro em segundo plano (servidor)
  gravando?: boolean; progressoGravacao?: string; erroGravacao?: string; batidaGravacao?: string;
  /** Ids dos itens que o hub criou no quadro nesta etapa (para comparar e apagar depois). */
  itensQuadro?: string[];
  /** Última comparação da prévia com o quadro. */
  comparacao?: unknown;
}

export interface Execucao {
  _id: string; itemId: string; nomeItem: string; codigo: string; boardId?: string; boardUrl?: string;
  criadoPor: string; criadoPorNome?: string; criadoEm: string; atualizadoEm: string;
  modelo: string; contexto: ContextoProjeto;
  docs: { nome: string; tipo: string; chars: number }[];
  etapas: Partial<Record<Etapa, EstadoEtapa>>;
  hubItemId?: string;
}

export const colRuns = async () => (await mongo()).collection<Execucao>('hub_runs');
const colDocs = async () => (await mongo()).collection<{ _id: string; docs: DocTexto[] }>('hub_docs');
export const agora = () => new Date().toISOString();

export function ctxOuErro() {
  const c = currentCtx();
  if (!c) throw new Error('Sessão inválida.');
  return c;
}

export const SEM_AUTORIZACAO = 'Você ainda não autorizou o hub a agir no seu nome. Clique em Autorizar no topo do hub.';

/** Token da pessoa que está usando o hub (cada um autoriza uma vez). */
export async function tokenIA(): Promise<string> {
  const c = ctxOuErro();
  const t = await tokenDoUsuario(c.userId);
  if (!t) throw new Error(SEM_AUTORIZACAO);
  return t;
}

export async function nomeUsuario(id: string): Promise<string> {
  try {
    const d = await gql<{ users: { name: string }[] }>('query ($ids: [ID!]) { users(ids: $ids) { name } }', { ids: [id] });
    return d.users?.[0]?.name ?? '';
  } catch { return ''; }
}

const semDocsTexto = (r: Execucao) => r;

export const listarModelos = createServerFn().handler(async () => MODELOS);

export const criarExecucao = createServerFn()
  .validator(z.object({ itemId: z.string(), nomeItem: z.string(), codigo: z.string(), eixo02: z.string().optional(), valor02: z.number().nullable().optional(), cliente02: z.string().optional(), boardId: z.string().optional(), boardUrl: z.string().optional() }))
  .handler(async ({ data }) => {
    const c = ctxOuErro();
    const r: Execucao = {
      _id: randomUUID(), itemId: data.itemId, nomeItem: data.nomeItem, codigo: data.codigo,
      boardId: data.boardId, boardUrl: data.boardUrl,
      criadoPor: c.userId, criadoPorNome: await nomeUsuario(c.userId), criadoEm: agora(), atualizadoEm: agora(),
      modelo: 'monday-standard',
      contexto: { nomeItem: data.nomeItem, codigo: data.codigo, eixo02: data.eixo02, valor02: data.valor02 ?? null, cliente02: data.cliente02 },
      docs: [], etapas: {},
    };
    await (await colRuns()).insertOne(r);
    return semDocsTexto(r);
  });

export const listarExecucoes = createServerFn()
  .validator(z.object({ itemId: z.string() }))
  .handler(async ({ data }) => {
    const rs = await (await colRuns()).find({ itemId: data.itemId }, { projection: { 'etapas.analise.resultado': 0, 'etapas.produtos.resultado': 0, 'etapas.eap.resultado': 0, 'etapas.riscos.resultado': 0, 'etapas.partes.resultado': 0, 'etapas.indicadores.resultado': 0, 'etapas.complemento.resultado': 0 } }).sort({ criadoEm: -1 }).limit(20).toArray();
    return rs;
  });

export const obterExecucao = createServerFn()
  .validator(z.object({ runId: z.string() }))
  .handler(async ({ data }) => {
    const r = await (await colRuns()).findOne({ _id: data.runId });
    if (!r) throw new Error('Execução não encontrada.');
    return r;
  });

export const atualizarExecucao = createServerFn()
  .validator(z.object({
    runId: z.string(), boardId: z.string().optional(), boardUrl: z.string().optional(), hubItemId: z.string().optional(),
    modelo: z.string().optional(), inicioExecucao: z.string().nullable().optional(), diasVigencia: z.number().nullable().optional(),
  }))
  .handler(async ({ data }) => {
    const set: Record<string, unknown> = { atualizadoEm: agora() };
    if (data.boardId !== undefined) set.boardId = data.boardId;
    if (data.boardUrl !== undefined) set.boardUrl = data.boardUrl;
    if (data.hubItemId !== undefined) set.hubItemId = data.hubItemId;
    if (data.modelo !== undefined) {
      if (!MODELOS.some((m) => m.id === data.modelo)) throw new Error('Modelo de IA desconhecido.');
      set.modelo = data.modelo;
    }
    if (data.inicioExecucao !== undefined) set['contexto.inicioExecucao'] = data.inicioExecucao;
    if (data.diasVigencia !== undefined) set['contexto.diasVigencia'] = data.diasVigencia;
    await (await colRuns()).updateOne({ _id: data.runId }, { $set: set });
    return (await (await colRuns()).findOne({ _id: data.runId }))!;
  });

export const salvarDocumentos = createServerFn()
  .validator(z.object({ runId: z.string(), docs: z.array(z.object({ nome: z.string(), tipo: z.string(), texto: z.string() })).min(1), substituir: z.boolean().optional() }))
  .handler(async ({ data }) => {
    const novos: DocTexto[] = (data.docs as DocTexto[]).map((d: DocTexto) => ({ ...d, texto: d.texto.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n') }));
    // Soma aos documentos já salvos; arquivo com o mesmo nome substitui o anterior.
    const atuais = data.substituir ? [] : ((await (await colDocs()).findOne({ _id: data.runId }))?.docs ?? []);
    const nomes = new Set(novos.map((d) => d.nome));
    const docs = [...atuais.filter((d) => !nomes.has(d.nome)), ...novos];
    return gravarDocs(data.runId, docs);
  });

async function gravarDocs(runId: string, docs: DocTexto[]) {
  const total = docs.reduce((s: number, d: DocTexto) => s + d.texto.length, 0);
  if (total > 1_500_000) throw new Error('Os documentos somam texto demais para a IA (mais de 1,5 milhão de caracteres). Envie só os documentos de pactuação principais.');
  await (await colDocs()).updateOne({ _id: runId }, { $set: { docs } }, { upsert: true });
  await (await colRuns()).updateOne({ _id: runId }, { $set: { docs: docs.map((d: DocTexto) => ({ nome: d.nome, tipo: d.tipo, chars: d.texto.length })), atualizadoEm: agora() } });
  return { ok: true, chars: total, docs: docs.map((d) => ({ nome: d.nome, tipo: d.tipo, chars: d.texto.length })) };
}

/** Remove um ou vários documentos já salvos, ou troca o tipo deles. */
export const ajustarDocumentos = createServerFn()
  .validator(z.object({ runId: z.string(), remover: z.array(z.string()).optional(), tipos: z.record(z.string()).optional() }))
  .handler(async ({ data }) => {
    const fora = new Set(data.remover ?? []);
    const atuais = (await (await colDocs()).findOne({ _id: data.runId }))?.docs ?? [];
    const docs = atuais.filter((d) => !fora.has(d.nome)).map((d) => (data.tipos?.[d.nome] ? { ...d, tipo: data.tipos[d.nome] } : d));
    if (!docs.length) {
      await (await colDocs()).updateOne({ _id: data.runId }, { $set: { docs: [] } }, { upsert: true });
      await (await colRuns()).updateOne({ _id: data.runId }, { $set: { docs: [], atualizadoEm: agora() } });
      return { ok: true, chars: 0, docs: [] };
    }
    return gravarDocs(data.runId, docs);
  });

export const salvarEdicao = createServerFn()
  .validator(z.object({ runId: z.string(), etapa: z.enum(ETAPAS as [Etapa, ...Etapa[]]), resultado: z.unknown() }))
  .handler(async ({ data }) => {
    await (await colRuns()).updateOne({ _id: data.runId }, { $set: { [`etapas.${data.etapa}.resultado`]: data.resultado, atualizadoEm: agora() } });
    return { ok: true };
  });

export const marcarGravada = createServerFn()
  .validator(z.object({ runId: z.string(), etapa: z.enum(ETAPAS as [Etapa, ...Etapa[]]), resumo: z.string() }))
  .handler(async ({ data }) => {
    const c = ctxOuErro();
    await (await colRuns()).updateOne({ _id: data.runId }, { $set: {
      [`etapas.${data.etapa}.status`]: 'gravada', [`etapas.${data.etapa}.gravadaEm`]: agora(),
      [`etapas.${data.etapa}.gravadaPor`]: c.userId, [`etapas.${data.etapa}.resumoGravacao`]: data.resumo, atualizadoEm: agora(),
    } });
    return { ok: true };
  });

// ---------- Etapas de IA em segundo plano ----------

export const rodando = new Map<string, Promise<void>>();

export async function setEtapa(runId: string, etapa: Etapa, patch: Partial<EstadoEtapa>) {
  const set: Record<string, unknown> = { atualizadoEm: agora() };
  for (const [k, v] of Object.entries(patch)) set[`etapas.${etapa}.${k}`] = v;
  await (await colRuns()).updateOne({ _id: runId }, { $set: set });
}

async function rodarIA(prompt: Prompt, modelo: string) {
  return chamarIA(prompt, await tokenIA(), modelo);
}

async function emParalelo<T, R>(xs: T[], n: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(xs.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, xs.length) }, async () => {
    while (i < xs.length) { const k = i++; out[k] = await fn(xs[k], k); }
  }));
  return out;
}

export const Entrada = z.object({
  produtos: z.array(z.object({ codigo: z.string(), nome: z.string(), descricao: z.string(), dia_inicio: z.number().nullable().optional(), dia_fim: z.number().nullable().optional(), mes_inicio: z.number().optional(), mes_fim: z.number().optional(), valor: z.number().optional(), ordem: z.number() })).optional(),
  riscos: z.array(z.object({ id: z.string(), titulo: z.string() })).optional(),
  riscosQuadro: z.array(z.object({ id: z.string(), nome: z.string(), causa: z.string(), efeito: z.string(), categoria: z.string(), estrategia: z.string(), resposta: z.string() })).optional(),
  resumo: z.string().optional(),
  codigos: z.array(z.string()).optional(),
}).optional();

async function executarEtapa(run: Execucao, etapa: Etapa, entrada: z.infer<typeof Entrada>) {
  const docs = (await (await colDocs()).findOne({ _id: run._id }))?.docs ?? [];
  if (!docs.length && etapa !== 'complemento') throw new Error('Envie os documentos antes de gerar.');
  const p = run.contexto;
  const m = run.modelo || 'monday-standard';
  // Sem lista vinda da tela, usa os produtos já gerados nesta execução.
  const salvos = ((run.etapas?.produtos?.resultado as any)?.produtos ?? []) as any[];
  const produtos = (entrada?.produtos?.length ? entrada.produtos : salvos.map((x, i) => ({
    codigo: x.codigo, nome: x.nome, descricao: x.descricao, dia_inicio: x.dia_inicio, dia_fim: x.dia_fim,
    mes_inicio: x.mes_inicio, mes_fim: x.mes_fim, valor: x.valor, ordem: i + 1,
  }))) as ProdutoResumo[];
  let custo = 0, tokens = 0, modelo = m;
  const somar = (r: { custo: number | null; tokensEntrada: number; tokensSaida: number; modelo: string }) => { custo += r.custo ?? 0; tokens += r.tokensEntrada + r.tokensSaida; modelo = r.modelo; };

  let resultado: unknown;
  if (etapa === 'analise') {
    const r = await rodarIA(promptAnalise(p, docs), m); somar(r); resultado = r.data;
  } else if (etapa === 'produtos') {
    const r = await rodarIA(promptProdutos(p, docs), m); somar(r); resultado = r.data;
  } else if (etapa === 'eap') {
    if (!produtos.length) throw new Error('Grave ou aprove os produtos antes de gerar a EAP.');
    const alvo = entrada?.codigos?.length ? produtos.filter((x) => entrada.codigos!.includes(x.codigo)) : produtos;
    const lotes: ProdutoResumo[][] = [];
    for (let i = 0; i < alvo.length; i += 3) lotes.push(alvo.slice(i, i + 3));
    let feitos = 0;
    const partes = await emParalelo(lotes, 2, async (lote) => {
      const r = await rodarIA(promptEap(p, docs, lote, produtos), m); somar(r);
      feitos += lote.length;
      await setEtapa(run._id, etapa, { progresso: `${feitos} de ${alvo.length} produtos` });
      return (r.data as { produtos?: unknown[] })?.produtos ?? [];
    });
    resultado = { produtos: partes.flat() };
  } else if (etapa === 'riscos') {
    const r = await rodarIA(promptRiscos(p, docs, produtos), m); somar(r); resultado = r.data;
  } else if (etapa === 'partes') {
    const r = await rodarIA(promptPartes(p, docs, entrada?.riscos ?? []), m); somar(r); resultado = r.data;
  } else if (etapa === 'indicadores') {
    await setEtapa(run._id, etapa, { progresso: 'Lendo indicadores de planejamentos anteriores…' });
    const base = await baseIndicadores().catch((e) => { console.error('[base indicadores]', e); return null; });
    const refs = base ? referenciasIndicadores(base.itens, p.eixo02 ?? '') : { texto: '', usados: 0 };
    await setEtapa(run._id, etapa, { progresso: `Gerando OKRs com ${refs.usados} indicadores de referência…` });
    const r = await rodarIA(promptIndicadores(p, docs, produtos, refs.texto), m); somar(r);
    resultado = { ...(r.data as object), base: base ? { indicadores: base.itens.length, projetos: base.projetos, usados: refs.usados, em: base.em } : null };
  } else if (etapa === 'complemento') {
    const rq = (entrada?.riscosQuadro ?? []) as RiscoQuadro[];
    if (!rq.length) throw new Error('Nenhum risco da calculadora para completar.');
    const lotes: RiscoQuadro[][] = [];
    for (let i = 0; i < rq.length; i += 20) lotes.push(rq.slice(i, i + 20));
    let feitos = 0;
    const partes = await emParalelo(lotes, 2, async (lote) => {
      const r = await rodarIA(promptComplemento(p, produtos, lote, entrada?.resumo ?? ''), m); somar(r);
      feitos += lote.length;
      await setEtapa(run._id, etapa, { progresso: `${feitos} de ${rq.length} riscos` });
      return (r.data as { riscos?: unknown[] })?.riscos ?? [];
    });
    resultado = { riscos: partes.flat() };
  } else {
    throw new Error(`Etapa sem IA: ${etapa}`);
  }
  await setEtapa(run._id, etapa, { status: 'pronta', fim: agora(), resultado, custo: Math.round(custo * 10000) / 10000, tokens, modelo, progresso: '' });
}

export const gerarEtapa = createServerFn()
  .validator(z.object({ runId: z.string(), etapa: z.enum(['analise', 'produtos', 'eap', 'riscos', 'partes', 'indicadores', 'complemento']), entrada: Entrada }))
  .handler(async ({ data }) => {
    const run = await (await colRuns()).findOne({ _id: data.runId });
    if (!run) throw new Error('Execução não encontrada.');
    await tokenIA();
    return iniciarGeracao(run, data.etapa, data.entrada);
  });

/** Começa a geração de uma etapa de IA em segundo plano (também usada depois da calculadora). */
export async function iniciarGeracao(run: Execucao, etapa: Etapa, entrada: z.infer<typeof Entrada>) {
  const chave = `${run._id}:${etapa}`;
  if (rodando.has(chave)) return { iniciada: false, motivo: 'Já está gerando.' };
  await setEtapa(run._id, etapa, { status: 'gerando', inicio: agora(), erro: '', progresso: 'Lendo os documentos…', resultado: null });
  const job = executarEtapa(run, etapa, entrada)
    .catch(async (e) => {
      console.error(`[etapa ${etapa}]`, e);
      await setEtapa(run._id, etapa, { status: 'erro', fim: agora(), erro: e instanceof Error ? e.message : String(e), progresso: '' });
    })
    .finally(() => rodando.delete(chave));
  rodando.set(chave, job);
  return { iniciada: true };
}

/** Se o servidor reiniciou no meio de uma geração, marca a etapa como interrompida para poder gerar de novo. */
export const estadoEtapas = createServerFn()
  .validator(z.object({ runId: z.string() }))
  .handler(async ({ data }) => {
    const run = await (await colRuns()).findOne({ _id: data.runId });
    if (!run) throw new Error('Execução não encontrada.');
    for (const e of ETAPAS) {
      const st = run.etapas[e];
      if (st?.status === 'gerando' && !rodando.has(`${run._id}:${e}`) && Date.now() - Date.parse(st.inicio ?? agora()) > 90_000) {
        await setEtapa(run._id, e, { status: 'erro', erro: 'A geração foi interrompida (o servidor reiniciou). Gere de novo.', progresso: '' });
        st.status = 'erro'; st.erro = 'A geração foi interrompida (o servidor reiniciou). Gere de novo.';
      }
      // Gravação sem sinal de vida há 3 minutos: o servidor reiniciou no meio.
      if (st?.gravando && !rodando.has(`${run._id}:grav:${e}`) && Date.now() - Date.parse(st.batidaGravacao ?? agora()) > 180_000) {
        const msg = 'A gravação foi interrompida (o servidor reiniciou). Clique em gravar de novo.';
        await setEtapa(run._id, e, { gravando: false, erroGravacao: msg, progressoGravacao: '' });
        st.gravando = false; st.erroGravacao = msg;
      }
    }
    return run;
  });

// ---------- Base de indicadores de planejamentos anteriores ----------

interface IndBase { projeto: string; eixo: string; tipo: string; nome: string; descricao: string; formula: string; meta: string; unidade: string; temporalidade: string; coleta: string; polaridade: string }
const COLS_IND = ['18370004806__color_mm07qht8', 'long_text_mm1gn28m', '18370004806__text_mm0qr7n2', '18370004806__numeric_mm07cbq5', '18370004806__dropdown_mm078vv2', '18370004806__dropdown_mm077dhe', '18370004806__dropdown_mm0791cx', 'color_mm1hzeyh'];

async function baseIndicadores(): Promise<{ itens: IndBase[]; projetos: number; em: string }> {
  const col = (await mongo()).collection<{ _id: string; itens: IndBase[]; projetos: number; em: string }>('hub_base_indicadores');
  const atual = await col.findOne({ _id: 'base' });
  if (atual && Date.now() - Date.parse(atual.em) < 12 * 3600_000) return atual;
  // Eixo de cada quadro [PLAN] pelo link no 02.01
  const eixoPorQuadro = new Map<string, string>();
  let cursor: string | null = null;
  do {
    const d: any = cursor
      ? await gql('query ($c: String!) { next_items_page(limit: 500, cursor: $c) { cursor items { column_values(ids: ["link_mm383m1p", "dropdown_mm38v0xw"]) { id text value } } } }', { c: cursor })
      : await gql('query { boards(ids: [18412010674]) { items_page(limit: 500) { cursor items { column_values(ids: ["link_mm383m1p", "dropdown_mm38v0xw"]) { id text value } } } } }');
    const pg: any = cursor ? d.next_items_page : d.boards[0].items_page;
    for (const it of pg.items) {
      const link = it.column_values.find((c: any) => c.id === 'link_mm383m1p');
      const eixo = it.column_values.find((c: any) => c.id === 'dropdown_mm38v0xw')?.text ?? '';
      let url = '';
      try { url = JSON.parse(link?.value || 'null')?.url ?? ''; } catch { url = ''; }
      const id = url.match(/\/boards\/(\d+)/)?.[1];
      if (id) eixoPorQuadro.set(id, eixo);
    }
    cursor = pg.cursor;
  } while (cursor);
  const quadros = [...eixoPorQuadro.keys()];
  const itens: IndBase[] = [];
  let projetos = 0;
  for (let i = 0; i < quadros.length; i += 8) {
    const d: any = await gql(`query ($b: [ID!], $c: [String!]) { boards(ids: $b) { id name groups { id } items_page(limit: 200, query_params: { rules: [{ column_id: "group", compare_value: ["group_mm0gtzbd"], operator: any_of }] }) { items { name column_values(ids: $c) { id text } } } } }`, { b: quadros.slice(i, i + 8), c: COLS_IND }).catch(() => null);
    for (const b of d?.boards ?? []) {
      if (!b.groups?.some((g: any) => g.id === 'group_mm0gtzbd')) continue;
      const validos = (b.items_page?.items ?? []).filter((it: any) => !/^INDICADOR (KR|KPI) \d+$/i.test(it.name.trim()));
      if (!validos.length) continue;
      projetos++;
      for (const it of validos) {
        const v = (id: string) => it.column_values.find((c: any) => c.id === id)?.text ?? '';
        const desc = v('long_text_mm1gn28m'), formula = v('18370004806__text_mm0qr7n2');
        if (!desc && !formula) continue;
        itens.push({ projeto: String(b.name).replace(/^\[PLAN\]\s*/, '').slice(0, 80), eixo: eixoPorQuadro.get(String(b.id)) ?? '', tipo: v('18370004806__color_mm07qht8'), nome: it.name, descricao: desc, formula, meta: v('18370004806__numeric_mm07cbq5'), unidade: v('18370004806__dropdown_mm078vv2'), temporalidade: v('18370004806__dropdown_mm077dhe'), coleta: v('18370004806__dropdown_mm0791cx'), polaridade: v('color_mm1hzeyh') });
      }
    }
  }
  const doc = { _id: 'base', itens, projetos, em: agora() };
  await col.replaceOne({ _id: 'base' }, doc, { upsert: true });
  return doc;
}

function referenciasIndicadores(itens: IndBase[], eixo: string) {
  const e = eixo.trim().toLowerCase();
  const mesmo = itens.filter((x) => e && x.eixo.toLowerCase() === e);
  const outros = itens.filter((x) => !(e && x.eixo.toLowerCase() === e));
  const sel = [...mesmo.slice(0, 30), ...outros.filter((_, i) => i % Math.max(1, Math.floor(outros.length / 20)) === 0).slice(0, 20)];
  const texto = sel.map((x) => `[${x.eixo || 'sem eixo'} | ${x.projeto}] ${x.tipo || 'Indicador'} | ${x.nome} | ${x.descricao.replace(/\s+/g, ' ').slice(0, 220)} | cálculo: ${x.formula.slice(0, 160)} | meta ${x.meta} ${x.unidade} | ${x.temporalidade} | ${x.coleta} | ${x.polaridade}`).join('\n');
  return { texto, usados: sel.length };
}

export const infoBaseIndicadores = createServerFn().handler(async () => {
  const b = await baseIndicadores();
  const porEixo: Record<string, number> = {};
  for (const x of b.itens) porEixo[x.eixo || 'sem eixo'] = (porEixo[x.eixo || 'sem eixo'] ?? 0) + 1;
  return { indicadores: b.itens.length, projetos: b.projetos, em: b.em, porEixo };
});

// ---------- TAP no doc "0. TAP" do quadro ----------

export const gravarTap = createServerFn()
  .validator(z.object({ runId: z.string(), boardId: z.string(), tap: z.unknown() }))
  .handler(async ({ data }) => {
    const c = ctxOuErro();
    const chave = `${data.runId}:tap`;
    if (rodando.has(chave)) return { iniciada: false };
    const token = await tokenIA();
    const autor = (await nomeUsuario(c.userId)) || 'Hub de Planejamento';
    await setEtapa(data.runId, 'tap', { status: 'gerando', inicio: agora(), erro: '', progresso: 'Lendo o doc do TAP…' });
    const job = escreverTap(data.boardId, data.tap as DadosTap, autor, token, (msg) => setEtapa(data.runId, 'tap', { progresso: msg }))
      .then(async (resumo) => {
        await setEtapa(data.runId, 'tap', { status: 'gravada', fim: agora(), gravadaEm: agora(), gravadaPor: c.userId, resumoGravacao: resumo, progresso: '' });
      })
      .catch(async (e) => {
        console.error('[tap]', e);
        await setEtapa(data.runId, 'tap', { status: 'erro', fim: agora(), erro: e instanceof Error ? e.message : String(e), progresso: '' });
      })
      .finally(() => rodando.delete(chave));
    rodando.set(chave, job);
    return { iniciada: true };
  });

// ---------- Anexo dos documentos no item do 02.01 ----------

export const anexarDocumento = createServerFn()
  .validator(z.object({ itemId: z.string(), columnId: z.string(), nome: z.string(), base64: z.string(), mime: z.string().optional() }))
  .handler(async ({ data }) => {
    const token = await tokenIA();
    const bytes = Buffer.from(data.base64, 'base64');
    if (bytes.length > 45 * 1024 * 1024) throw new Error(`${data.nome}: arquivo grande demais para anexar (limite 45 MB).`);
    const form = new FormData();
    form.append('query', 'mutation ($file: File!, $item: ID!, $col: String!) { add_file_to_column(item_id: $item, column_id: $col, file: $file) { id } }');
    form.append('variables', JSON.stringify({ item: data.itemId, col: data.columnId }));
    form.append('map', JSON.stringify({ arquivo: 'variables.file' }));
    form.append('arquivo', new Blob([bytes], { type: data.mime || 'application/octet-stream' }), data.nome);
    const r = await fetch('https://api.monday.com/v2/file', { method: 'POST', headers: { Authorization: token, 'API-Version': '2026-10' }, body: form });
    const j: any = await r.json().catch(() => null);
    if (!r.ok || j?.errors?.length || j?.error_message) throw new Error(`Falha ao anexar ${data.nome}: ${j?.errors?.[0]?.message ?? j?.error_message ?? r.status}`);
    return { ok: true, assetId: j?.data?.add_file_to_column?.id ?? null };
  });

export const statusIA = createServerFn().handler(async () => {
  const c = ctxOuErro();
  return autorizacaoDoUsuario(c.userId);
});

export const pedirAutorizacao = createServerFn().handler(async () => {
  const c = ctxOuErro();
  return { url: await linkAutorizacao(c.userId) };
});
