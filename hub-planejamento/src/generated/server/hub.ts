// Funções do servidor do Hub de Planejamento: execuções, documentos, etapas de IA em segundo plano,
// gravação do TAP (doc do quadro, via MCP da monday) e anexo dos documentos no 02.01.
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { mongo } from '../../../server/mongo';
import { currentCtx } from '../../../server/context';
import { tokenOAuth } from '../../../server/oauth';
import { gql } from '../../../server/monday';
import { chamarIA, MODELOS } from './iaCore';
import {
  promptAnalise, promptProdutos, promptEap, promptRiscos, promptPartes, promptIndicadores, promptComplemento,
  type ContextoProjeto, type DocTexto, type ProdutoResumo, type RiscoQuadro, type Prompt,
} from './prompts';
import { escreverTap, type DadosTap } from './tap';

export type Etapa = 'analise' | 'produtos' | 'eap' | 'riscos' | 'partes' | 'indicadores' | 'complemento' | 'tap';
const ETAPAS: Etapa[] = ['analise', 'produtos', 'eap', 'riscos', 'partes', 'indicadores', 'complemento', 'tap'];

export interface EstadoEtapa {
  status: 'nao_iniciada' | 'gerando' | 'pronta' | 'erro' | 'gravada';
  inicio?: string; fim?: string; erro?: string; progresso?: string;
  custo?: number; modelo?: string; tokens?: number;
  resultado?: unknown; gravadaEm?: string; gravadaPor?: string; resumoGravacao?: string;
}

export interface Execucao {
  _id: string; itemId: string; nomeItem: string; codigo: string; boardId?: string; boardUrl?: string;
  criadoPor: string; criadoPorNome?: string; criadoEm: string; atualizadoEm: string;
  modelo: string; contexto: ContextoProjeto;
  docs: { nome: string; tipo: string; chars: number }[];
  etapas: Partial<Record<Etapa, EstadoEtapa>>;
  hubItemId?: string;
}

const colRuns = async () => (await mongo()).collection<Execucao>('hub_runs');
const colDocs = async () => (await mongo()).collection<{ _id: string; docs: DocTexto[] }>('hub_docs');
const agora = () => new Date().toISOString();

function ctxOuErro() {
  const c = currentCtx();
  if (!c) throw new Error('Sessão inválida.');
  return c;
}

async function tokenIA(): Promise<string> {
  const t = await tokenOAuth();
  if (!t) throw new Error('O app ainda não foi autorizado na monday (OAuth). Peça a um admin para abrir /oauth/start.');
  return t;
}

async function nomeUsuario(id: string): Promise<string> {
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
  .validator(z.object({ runId: z.string(), docs: z.array(z.object({ nome: z.string(), tipo: z.string(), texto: z.string() })).min(1) }))
  .handler(async ({ data }) => {
    const docs: DocTexto[] = (data.docs as DocTexto[]).map((d: DocTexto) => ({ ...d, texto: d.texto.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n') }));
    const total = docs.reduce((s: number, d: DocTexto) => s + d.texto.length, 0);
    if (total > 1_500_000) throw new Error('Os documentos somam texto demais para a IA (mais de 1,5 milhão de caracteres). Envie só os documentos de pactuação principais.');
    await (await colDocs()).updateOne({ _id: data.runId }, { $set: { docs } }, { upsert: true });
    await (await colRuns()).updateOne({ _id: data.runId }, { $set: { docs: docs.map((d: DocTexto) => ({ nome: d.nome, tipo: d.tipo, chars: d.texto.length })), atualizadoEm: agora() } });
    return { ok: true, chars: total };
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

const rodando = new Map<string, Promise<void>>();

async function setEtapa(runId: string, etapa: Etapa, patch: Partial<EstadoEtapa>) {
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

const Entrada = z.object({
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
  const produtos = (entrada?.produtos ?? []) as ProdutoResumo[];
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
    const r = await rodarIA(promptIndicadores(p, docs, produtos), m); somar(r); resultado = r.data;
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
    const chave = `${data.runId}:${data.etapa}`;
    if (rodando.has(chave)) return { iniciada: false, motivo: 'Já está gerando.' };
    await tokenIA();
    await setEtapa(run._id, data.etapa, { status: 'gerando', inicio: agora(), erro: '', progresso: 'Lendo os documentos…', resultado: null });
    const job = executarEtapa(run, data.etapa, data.entrada)
      .catch(async (e) => {
        console.error(`[etapa ${data.etapa}]`, e);
        await setEtapa(run._id, data.etapa, { status: 'erro', fim: agora(), erro: e instanceof Error ? e.message : String(e), progresso: '' });
      })
      .finally(() => rodando.delete(chave));
    rodando.set(chave, job);
    return { iniciada: true };
  });

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
    }
    return run;
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
  const t = await tokenOAuth();
  return { autorizado: !!t };
});
