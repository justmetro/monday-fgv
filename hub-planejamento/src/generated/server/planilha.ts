// Exporta o que foi gerado numa execução para uma planilha .xlsx (uma aba por etapa) e importa de volta.
// A aba oculta "_dados" guarda o JSON completo, para que campos fora das abas (checagens, pendências) voltem iguais.
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import * as XLSX from 'xlsx';
import { mongo } from '../../../server/mongo';
import { colRuns, agora, ctxOuErro, setEtapa, type Execucao, type Etapa, type EstadoEtapa } from './hub';
import type { Produto, EapProduto, Risco, Parte, Objetivo, Kr, Indicador } from '@generated/lib/gravar';

const ETAPAS_PLANILHA: Etapa[] = ['analise', 'produtos', 'eap', 'riscos', 'complemento', 'indicadores', 'partes'];
interface Arquivo { _id: string; nome: string; base64: string; criadoEm: string; userId: string }
const colArquivos = async () => (await mongo()).collection<Arquivo>('hub_arquivos');

type Linha = Record<string, string | number | boolean | null>;
const juntar = (xs: unknown) => (Array.isArray(xs) ? xs.join('\n') : xs == null ? '' : String(xs));
const separar = (v: unknown) => String(v ?? '').split(/\r?\n|;\s*/).map((x) => x.trim()).filter(Boolean);
const linhas = (v: unknown) => String(v ?? '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
const num = (v: unknown) => (v === '' || v == null ? null : Number(String(v).replace(',', '.')));
const sim = (v: unknown) => !/^(n[aã]o|false|0)$/i.test(String(v ?? '').trim());

// ---------- Análise e TAP: Seção | Campo | Valor ----------
const SECOES: [string, string][] = [['Ficha', 'ficha'], ['TAP', 'tap'], ['Calculadora', 'calculadora']];

function planoAnalise(a: any): Linha[] {
  const out: Linha[] = [];
  for (const [secao, k] of SECOES) {
    const o = a?.[k] ?? {};
    for (const [campo, v] of Object.entries(o)) {
      if (campo === 'justificativas' && v && typeof v === 'object') {
        for (const [c2, v2] of Object.entries(v as object)) out.push({ Seção: 'Calculadora (justificativas)', Campo: c2, Valor: String(v2 ?? '') });
        continue;
      }
      const valor = Array.isArray(v) ? (v.every((x) => typeof x !== 'object') ? v.join('\n') : JSON.stringify(v)) : v != null && typeof v === 'object' ? JSON.stringify(v) : (v as any);
      out.push({ Seção: secao, Campo: campo, Valor: valor ?? '' });
    }
  }
  return out;
}

/** Converte o texto da célula para o tipo que o campo tinha no JSON original. */
function comoOriginal(texto: unknown, original: unknown) {
  if (Array.isArray(original)) {
    if (original.some((x) => x && typeof x === 'object')) { try { return JSON.parse(String(texto)); } catch { return original; } }
    return linhas(texto);
  }
  if (typeof original === 'number') return num(texto);
  if (typeof original === 'boolean') return sim(texto);
  if (original && typeof original === 'object') { try { return JSON.parse(String(texto)); } catch { return original; } }
  if (original === null && (texto === '' || texto == null)) return null;
  return texto == null ? '' : String(texto);
}

function lerAnalise(rows: Linha[], base: any, pend: Linha[] | null) {
  const a = structuredClone(base ?? { ficha: {}, tap: {}, calculadora: {}, pendencias: [] });
  const chave: Record<string, string> = Object.fromEntries(SECOES.map(([s, k]) => [s, k]));
  for (const r of rows) {
    const secao = String(r['Seção'] ?? '').trim(), campo = String(r['Campo'] ?? '').trim();
    if (!campo) continue;
    if (secao === 'Calculadora (justificativas)') {
      a.calculadora = a.calculadora ?? {};
      a.calculadora.justificativas = { ...(a.calculadora.justificativas ?? {}), [campo]: String(r['Valor'] ?? '') };
      continue;
    }
    const k = chave[secao];
    if (!k) continue;
    a[k] = a[k] ?? {};
    a[k][campo] = comoOriginal(r['Valor'], a[k][campo]);
  }
  if (pend) a.pendencias = pend.map((r) => ({ instrumento: String(r['Instrumento'] ?? ''), pendencia: String(r['Pendência'] ?? ''), fontes: String(r['Fontes'] ?? ''), pergunta: String(r['Pergunta'] ?? '') })).filter((p) => p.pendencia);
  return a;
}

// ---------- Abas por etapa ----------
const produtoLinha = (p: Produto): Linha => ({
  Código: p.codigo, Nome: p.nome, Descrição: p.descricao, Objetivo: p.objetivo, 'Mês início': p.mes_inicio, 'Mês fim': p.mes_fim,
  'Dia início': p.dia_inicio, 'Dia fim': p.dia_fim, Valor: p.valor, Fase: p.fase, Tipologia: p.tipologia, 'Tipo de entrega': p.tipo_entrega, Fonte: p.fonte,
});
const lerProduto = (r: Linha): Produto => ({
  codigo: String(r['Código'] ?? '').trim(), nome: String(r['Nome'] ?? ''), descricao: String(r['Descrição'] ?? ''), objetivo: String(r['Objetivo'] ?? ''),
  mes_inicio: num(r['Mês início']) ?? 1, mes_fim: num(r['Mês fim']) ?? 1, dia_inicio: num(r['Dia início']), dia_fim: num(r['Dia fim']), valor: num(r['Valor']) ?? 0,
  fase: String(r['Fase'] ?? ''), tipologia: String(r['Tipologia'] ?? ''), tipo_entrega: String(r['Tipo de entrega'] ?? ''), fonte: String(r['Fonte'] ?? ''),
});

function eapLinhas(ps: EapProduto[]): Linha[] {
  const out: Linha[] = [];
  for (const p of ps) for (const e of p.entregaveis ?? []) {
    out.push({ Produto: p.codigo, Nível: 2, Nome: e.nome, 'Dia início': e.dia_inicio, 'Dia fim': e.dia_fim, Frente: '' });
    for (const m of e.marcos ?? []) {
      out.push({ Produto: p.codigo, Nível: 3, Nome: m.nome, 'Dia início': m.dia_inicio, 'Dia fim': m.dia_fim, Frente: '' });
      for (const a of m.atividades ?? []) out.push({ Produto: p.codigo, Nível: 4, Nome: a.nome, 'Dia início': a.dia_inicio, 'Dia fim': a.dia_fim, Frente: a.frente ?? '' });
    }
  }
  return out;
}
function lerEap(rows: Linha[]): { produtos: EapProduto[]; avisos: string[] } {
  const produtos: EapProduto[] = [];
  const avisos: string[] = [];
  for (const [i, r] of rows.entries()) {
    const cod = String(r['Produto'] ?? '').trim(), nome = String(r['Nome'] ?? '').trim(), nivel = Number(r['Nível']);
    if (!cod || !nome) continue;
    const ini = num(r['Dia início']) ?? 1, fim = num(r['Dia fim']) ?? ini;
    let p = produtos.find((x) => x.codigo === cod);
    if (!p) { p = { codigo: cod, entregaveis: [] }; produtos.push(p); }
    const e = p.entregaveis[p.entregaveis.length - 1];
    const m = e?.marcos[e.marcos.length - 1];
    if (nivel === 2) p.entregaveis.push({ nome, dia_inicio: ini, dia_fim: fim, marcos: [] });
    else if (nivel === 3) { if (e) e.marcos.push({ nome, dia_inicio: ini, dia_fim: fim, atividades: [] }); else avisos.push(`Cronograma, linha ${i + 2}: marco sem entregável antes, ignorado.`); }
    else if (nivel === 4) { if (m) m.atividades.push({ nome, dia_inicio: ini, dia_fim: fim, frente: String(r['Frente'] ?? '') }); else avisos.push(`Cronograma, linha ${i + 2}: atividade sem marco antes, ignorada.`); }
  }
  return { produtos, avisos };
}

const riscoLinha = (r: Risco): Linha => ({
  ID: r.id, Título: r.titulo, Categoria: r.categoria, Tema: r.tema, Impactado: (r.impactado ?? []).join('; '), Causa: r.causa, Efeito: r.efeito,
  Probabilidade: r.probabilidade, Impacto: r.impacto, Estratégia: r.estrategia, Resposta: r.resposta, 'Cargo responsável': r.cargo_responsavel, Frente: r.frente,
  'Dia início': r.dia_inicio, 'Dia fim': r.dia_fim, Produtos: (r.produtos ?? []).join('; '), Incluir: r.incluir === false ? 'não' : 'sim',
});
const lerRisco = (r: Linha): Risco => ({
  id: String(r['ID'] ?? ''), titulo: String(r['Título'] ?? ''), categoria: String(r['Categoria'] ?? ''), tema: String(r['Tema'] ?? ''), impactado: separar(r['Impactado']),
  causa: String(r['Causa'] ?? ''), efeito: String(r['Efeito'] ?? ''), probabilidade: String(r['Probabilidade'] ?? ''), impacto: String(r['Impacto'] ?? ''),
  estrategia: String(r['Estratégia'] ?? ''), resposta: String(r['Resposta'] ?? ''), cargo_responsavel: String(r['Cargo responsável'] ?? ''), frente: String(r['Frente'] ?? ''),
  dia_inicio: num(r['Dia início']) ?? 1, dia_fim: num(r['Dia fim']) ?? 1, produtos: separar(r['Produtos']), incluir: sim(r['Incluir']),
});

const indLinha = (o: string, tipo: 'KR' | 'KPI', i: Indicador): Linha => ({
  Objetivo: o, Tipo: tipo, Nome: i.nome, Descrição: i.descricao, 'Forma de cálculo': i.formula, Meta: i.meta, Unidade: i.unidade, Polaridade: i.polaridade,
  Temporalidade: i.temporalidade, Coleta: i.coleta, 'Medições (dias)': (i.medicoes ?? []).join('; '), Produtos: (i.produtos ?? []).join('; '), Referência: i.referencia ?? '',
});
function lerIndicadores(rows: Linha[]): { objetivos: Objetivo[]; avisos: string[] } {
  const objetivos: Objetivo[] = [];
  const avisos: string[] = [];
  for (const [i, r] of rows.entries()) {
    const nome = String(r['Nome'] ?? '').trim();
    if (!nome) continue;
    const ind: Indicador = {
      nome, descricao: String(r['Descrição'] ?? ''), formula: String(r['Forma de cálculo'] ?? ''), meta: num(r['Meta']) ?? 0, unidade: String(r['Unidade'] ?? ''),
      polaridade: String(r['Polaridade'] ?? ''), temporalidade: String(r['Temporalidade'] ?? ''), coleta: String(r['Coleta'] ?? ''),
      medicoes: separar(r['Medições (dias)']).map(Number).filter((x) => Number.isFinite(x)), produtos: separar(r['Produtos']), referencia: String(r['Referência'] ?? ''),
    };
    const textoObj = String(r['Objetivo'] ?? '').trim();
    if (/KPI/i.test(String(r['Tipo'] ?? ''))) {
      const kr = objetivos[objetivos.length - 1]?.krs.slice(-1)[0];
      if (kr) kr.kpis.push(ind); else avisos.push(`Indicadores, linha ${i + 2}: KPI sem KR antes, ignorado.`);
      continue;
    }
    let o = objetivos.find((x) => x.objetivo === textoObj);
    if (!o) { o = { objetivo: textoObj, krs: [] }; objetivos.push(o); }
    o.krs.push({ ...ind, kpis: [] } as Kr);
  }
  return { objetivos, avisos };
}

const parteLinha = (p: Parte): Linha => ({
  Nome: p.nome, 'Cargo do cliente': p.cargo_cliente, Área: p.area, Classe: p.classe, Papel: (p.papel ?? []).join('; '), Interesse: p.interesse, Poder: p.poder,
  Expectativas: p.expectativas, 'Riscos associados': p.riscos_associados, Incluir: p.incluir === false ? 'não' : 'sim',
});
const lerParte = (r: Linha): Parte => ({
  nome: String(r['Nome'] ?? ''), cargo_cliente: String(r['Cargo do cliente'] ?? ''), area: String(r['Área'] ?? ''), classe: String(r['Classe'] ?? ''), papel: separar(r['Papel']),
  interesse: String(r['Interesse'] ?? ''), poder: String(r['Poder'] ?? ''), expectativas: String(r['Expectativas'] ?? ''), riscos_associados: String(r['Riscos associados'] ?? ''), incluir: sim(r['Incluir']),
});

// ---------- Montagem da planilha ----------
const ABA = { leia: 'Leia-me', analise: 'Análise e TAP', pend: 'Pendências', produtos: 'Produtos', eap: 'Cronograma', riscos: 'Riscos', comp: 'Riscos da calculadora', ind: 'Indicadores', partes: 'Partes interessadas', dados: '_dados' };

function folha(rows: Linha[], cabecalho: string[]) {
  const ws = XLSX.utils.json_to_sheet(rows, { header: cabecalho });
  ws['!cols'] = cabecalho.map((h) => ({ wch: Math.min(60, Math.max(10, h.length + 2, ...rows.slice(0, 50).map((r) => Math.min(60, String(r[h] ?? '').length)))) }));
  return ws;
}

export function montarPlanilha(run: Execucao) {
  const wb = XLSX.utils.book_new();
  const r = (e: Etapa) => run.etapas[e]?.resultado as any;
  const leia: Linha[] = [
    { Campo: 'Projeto', Valor: run.nomeItem }, { Campo: 'Item do 02.01', Valor: run.itemId }, { Campo: 'Execução', Valor: run._id },
    { Campo: 'Exportado em', Valor: agora().slice(0, 16).replace('T', ' ') }, { Campo: 'Quadro [PLAN]', Valor: run.boardUrl ?? '' },
    { Campo: 'Como usar', Valor: 'Edite as abas e importe de volta no hub (botão Importar planilha). Não mude os nomes das colunas nem das abas. Linha nova entra na prévia; linha apagada sai. No Cronograma e nos Indicadores a ordem das linhas define a hierarquia: o marco (Nível 3) fica sob o entregável (Nível 2) acima dele, a atividade (Nível 4) sob o marco acima dela, e o KPI sob o KR acima dele.' },
    { Campo: 'Etapas exportadas', Valor: ETAPAS_PLANILHA.filter((e) => r(e) != null).join(', ') },
  ];
  XLSX.utils.book_append_sheet(wb, folha(leia, ['Campo', 'Valor']), ABA.leia);
  if (r('analise')) {
    XLSX.utils.book_append_sheet(wb, folha(planoAnalise(r('analise')), ['Seção', 'Campo', 'Valor']), ABA.analise);
    XLSX.utils.book_append_sheet(wb, folha((r('analise').pendencias ?? []).map((p: any) => ({ Instrumento: p.instrumento, Pendência: p.pendencia, Fontes: p.fontes, Pergunta: p.pergunta })), ['Instrumento', 'Pendência', 'Fontes', 'Pergunta']), ABA.pend);
  }
  if (r('produtos')) XLSX.utils.book_append_sheet(wb, folha((r('produtos').produtos ?? []).map(produtoLinha), ['Código', 'Nome', 'Descrição', 'Objetivo', 'Mês início', 'Mês fim', 'Dia início', 'Dia fim', 'Valor', 'Fase', 'Tipologia', 'Tipo de entrega', 'Fonte']), ABA.produtos);
  if (r('eap')) XLSX.utils.book_append_sheet(wb, folha(eapLinhas(r('eap').produtos ?? []), ['Produto', 'Nível', 'Nome', 'Dia início', 'Dia fim', 'Frente']), ABA.eap);
  if (r('riscos')) XLSX.utils.book_append_sheet(wb, folha((r('riscos').riscos ?? []).map(riscoLinha), ['ID', 'Título', 'Categoria', 'Tema', 'Impactado', 'Causa', 'Efeito', 'Probabilidade', 'Impacto', 'Estratégia', 'Resposta', 'Cargo responsável', 'Frente', 'Dia início', 'Dia fim', 'Produtos', 'Incluir']), ABA.riscos);
  if (r('complemento')) XLSX.utils.book_append_sheet(wb, folha((r('complemento').riscos ?? []).map((c: any) => ({ 'ID do item': c.id, 'Dia início': c.dia_inicio, 'Dia fim': c.dia_fim, Frente: c.frente, Estratégia: c.estrategia, Resposta: c.resposta, Aplicar: c.aplicar === false ? 'não' : 'sim' })), ['ID do item', 'Dia início', 'Dia fim', 'Frente', 'Estratégia', 'Resposta', 'Aplicar']), ABA.comp);
  if (r('indicadores')) {
    const rows: Linha[] = [];
    for (const o of (r('indicadores').objetivos ?? []) as Objetivo[]) for (const kr of o.krs ?? []) {
      rows.push(indLinha(o.objetivo, 'KR', kr));
      for (const kpi of kr.kpis ?? []) rows.push(indLinha(o.objetivo, 'KPI', kpi));
    }
    XLSX.utils.book_append_sheet(wb, folha(rows, ['Objetivo', 'Tipo', 'Nome', 'Descrição', 'Forma de cálculo', 'Meta', 'Unidade', 'Polaridade', 'Temporalidade', 'Coleta', 'Medições (dias)', 'Produtos', 'Referência']), ABA.ind);
  }
  if (r('partes')) XLSX.utils.book_append_sheet(wb, folha((r('partes').partes ?? []).map(parteLinha), ['Nome', 'Cargo do cliente', 'Área', 'Classe', 'Papel', 'Interesse', 'Poder', 'Expectativas', 'Riscos associados', 'Incluir']), ABA.partes);
  // JSON completo em pedaços (limite de 32 mil caracteres por célula), numa aba oculta.
  const json = JSON.stringify({ itemId: run.itemId, etapas: Object.fromEntries(ETAPAS_PLANILHA.map((e) => [e, r(e) ?? null])) });
  const pedacos: string[][] = [];
  for (let i = 0; i < json.length; i += 30000) pedacos.push([json.slice(i, i + 30000)]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pedacos), ABA.dados);
  wb.Workbook = { Sheets: wb.SheetNames.map((n) => ({ name: n, Hidden: n === ABA.dados ? 1 : 0 })) } as any;
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

const nomeArquivo = (run: Execucao) => `Hub de Planejamento - ${run.nomeItem.replace(/[\\/:*?"<>|[\]]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90)} - ${agora().slice(0, 10)}.xlsx`;

export const exportarPlanilha = createServerFn()
  .validator(z.object({ runId: z.string() }))
  .handler(async ({ data }) => {
    const c = ctxOuErro();
    const run = await (await colRuns()).findOne({ _id: data.runId });
    if (!run) throw new Error('Execução não encontrada.');
    if (!ETAPAS_PLANILHA.some((e) => run.etapas[e]?.resultado != null)) throw new Error('Nada gerado ainda nesta execução.');
    const buf = montarPlanilha(run);
    const id = randomUUID();
    const col = await colArquivos();
    await col.deleteMany({ criadoEm: { $lt: new Date(Date.now() - 60 * 60_000).toISOString() } }).catch(() => null);
    await col.insertOne({ _id: id, nome: nomeArquivo(run), base64: buf.toString('base64'), criadoEm: agora(), userId: c.userId });
    return { id, nome: nomeArquivo(run), base64: buf.toString('base64') };
  });

/** GET /arquivo/<id>: entrega a planilha exportada (link de uso curto, válido por 15 minutos). */
export async function servirArquivo(id: string): Promise<{ nome: string; bytes: Buffer } | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const a = await (await colArquivos()).findOne({ _id: id });
  if (!a || Date.now() - Date.parse(a.criadoEm) > 15 * 60_000) return null;
  return { nome: a.nome, bytes: Buffer.from(a.base64, 'base64') };
}

/** Lê a planilha e monta os resultados de cada etapa (sem gravar). */
export function lerPlanilha(buf: Buffer, run: Execucao, etapas?: string[]) {
  let wb: XLSX.WorkBook;
  try { wb = XLSX.read(buf, { type: 'buffer' }); } catch { throw new Error('Não consegui ler o arquivo. Envie a planilha .xlsx exportada pelo hub.'); }
  const aba = (n: string) => (wb.Sheets[n] ? (XLSX.utils.sheet_to_json(wb.Sheets[n], { defval: '' }) as Linha[]) : null);
  let base: any = {};
  if (wb.Sheets[ABA.dados]) {
    try {
      const aoa = XLSX.utils.sheet_to_json(wb.Sheets[ABA.dados], { header: 1, defval: '' }) as string[][];
      base = JSON.parse(aoa.map((l) => String(l[0] ?? '')).join(''));
    } catch { base = {}; }
  }
  if (base.itemId && base.itemId !== run.itemId) throw new Error('Esta planilha é de outro projeto do 02.01. Abra o projeto certo antes de importar.');
  const quer = (e: Etapa) => !etapas?.length || etapas.includes(e);
  const b = (e: Etapa) => base?.etapas?.[e] ?? (run.etapas[e]?.resultado as any) ?? null;
  const novos: Partial<Record<Etapa, unknown>> = {};
  const avisos: string[] = [];

  const an = aba(ABA.analise);
  if (quer('analise') && an) novos.analise = lerAnalise(an, b('analise'), aba(ABA.pend));
  const pr = aba(ABA.produtos);
  if (quer('produtos') && pr) novos.produtos = { ...(b('produtos') ?? { checagem: {} }), produtos: pr.map(lerProduto).filter((p) => p.codigo || p.nome) };
  const ea = aba(ABA.eap);
  if (quer('eap') && ea) { const x = lerEap(ea); avisos.push(...x.avisos); novos.eap = { ...(b('eap') ?? {}), produtos: x.produtos }; }
  const ri = aba(ABA.riscos);
  if (quer('riscos') && ri) novos.riscos = { ...(b('riscos') ?? {}), riscos: ri.map(lerRisco).filter((r) => r.titulo) };
  const co = aba(ABA.comp);
  if (quer('complemento') && co) novos.complemento = { riscos: co.map((r) => ({ id: String(r['ID do item'] ?? ''), dia_inicio: num(r['Dia início']) ?? 1, dia_fim: num(r['Dia fim']) ?? 1, frente: String(r['Frente'] ?? ''), estrategia: String(r['Estratégia'] ?? ''), resposta: String(r['Resposta'] ?? ''), aplicar: sim(r['Aplicar']) })).filter((r) => r.id) };
  const ind = aba(ABA.ind);
  if (quer('indicadores') && ind) { const x = lerIndicadores(ind); avisos.push(...x.avisos); novos.indicadores = { ...(b('indicadores') ?? {}), objetivos: x.objetivos }; }
  const pa = aba(ABA.partes);
  if (quer('partes') && pa) novos.partes = { ...(b('partes') ?? {}), partes: pa.map(lerParte).filter((p) => p.nome) };

  return { novos, avisos };
}

export const importarPlanilha = createServerFn()
  .validator(z.object({ runId: z.string(), base64: z.string(), etapas: z.array(z.string()).optional() }))
  .handler(async ({ data }) => {
    ctxOuErro();
    const run = await (await colRuns()).findOne({ _id: data.runId });
    if (!run) throw new Error('Execução não encontrada.');
    const { novos, avisos } = lerPlanilha(Buffer.from(data.base64, 'base64'), run, data.etapas);
    const feitas = Object.keys(novos) as Etapa[];
    if (!feitas.length) throw new Error('A planilha não tem nenhuma aba de etapa do hub.');
    if (feitas.some((e) => run.etapas[e]?.status === 'gerando' || run.etapas[e]?.gravando)) throw new Error('Há uma etapa gerando ou gravando agora. Espere terminar para importar.');
    for (const e of feitas) {
      const st: EstadoEtapa | undefined = run.etapas[e];
      // Etapa já gravada continua gravada (o quadro não muda); use Comparar com o quadro para levar as mudanças.
      await setEtapa(run._id, e, { resultado: novos[e], status: st?.status === 'gravada' ? 'gravada' : 'pronta', erro: '', comparacao: null });
    }
    return { etapas: feitas, avisos };
  });
