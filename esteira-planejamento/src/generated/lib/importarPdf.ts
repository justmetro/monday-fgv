import { normNome } from '@generated/lib/nomes';
import { PAUSADA, type Temp } from '@generated/lib/alocacao';

/**
 * Reader of the weekly "Reunião Semanal" PDF (slides 1456×816, one table per page). Browser only (pdf.js + canvas).
 * - "STATUS NEGOCIAÇÕES" (Nome | Etapa | Responsável): temperature = BACKGROUND COLOR of the Nome cell, compared with
 *   the 3 legend squares of the same page ("Expectativa de Assinatura | 15 a 30 dias", "30 a 45 dias", "45 a 60 dias").
 * - "LISTA DE PROSPECÇÕES": Etapa "PAUSADO" → Negociação pausada (other rows carry no temperature and are skipped).
 * - Cover, "Gratidão!", "DEMANDAS DA SEMANA" and "STATUS DEMANDAS" are ignored.
 */
export type FontePdf = 'negociacoes' | 'prospeccoes';
export interface LinhaPdf {
  nome: string; etapa: string; responsavel: string;
  /** Hex of the sampled background ('' for Lista de Prospecções). */
  cor: string;
  temp: Temp | null; pagina: number; fonte: FontePdf; aviso: string | null;
}

type RGB = [number, number, number];
interface Txt { s: string; x: number; y: number; w: number; h: number }
interface Linha { y: number; h: number; x: number; s: string }
interface Row { nome: Linha[]; etapa: Linha[]; resp: Linha[]; yTop: number; yBot: number }
interface Viewport { width: number; height: number; convertToViewportPoint: (x: number, y: number) => number[] }
export interface PaginaPdf {
  getTextContent: () => Promise<{ items: unknown[] }>;
  getViewport: (o: { scale: number }) => Viewport;
  render: (o: { canvasContext: CanvasRenderingContext2D; viewport: Viewport; canvas: HTMLCanvasElement }) => { promise: Promise<unknown> };
}

const norm = (s: string) => normNome(s).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const dist = (a: RGB, b: RGB) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const hexDe = (c: RGB) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/** Approximate legend colors — fallback only when a legend text is found but its square can't be sampled. */
const RESERVA: { temp: Temp; cor: RGB }[] = [
  { temp: '15 a 30 dias', cor: [0xf4, 0xcc, 0xcc] },
  { temp: '30 a 45 dias', cor: [0xfc, 0xe5, 0xcd] },
  { temp: '45 a 60 dias', cor: [0xff, 0xf2, 0xcc] },
];
const LIMIAR_COR = 30;

function tipoPagina(txts: Txt[]): FontePdf | null {
  const tudo = norm(txts.map((t) => t.s).join(' '));
  if (/status negociac/.test(tudo)) return 'negociacoes';
  if (/lista de prospecc/.test(tudo)) return 'prospeccoes';
  return null; // capa, Gratidão, Demandas da semana, Status demandas
}

/** Visual lines of one column: same baseline (tolerance) → items joined left to right. */
function linhasDe(ts: Txt[]): Linha[] {
  const ord = [...ts].sort((a, b) => b.y - a.y || a.x - b.x);
  const grupos: Txt[][] = [];
  for (const t of ord) {
    const g = grupos[grupos.length - 1];
    const ref = g?.[0];
    if (g && ref && Math.abs(ref.y - t.y) <= Math.max(3, ref.h * 0.45)) g.push(t);
    else grupos.push([t]);
  }
  return grupos.map((g) => {
    const xs = [...g].sort((a, b) => a.x - b.x);
    let s = '';
    let fim = -Infinity;
    for (const t of xs) {
      s += (s && t.x - fim > 1.5 ? ' ' : '') + t.s;
      fim = t.x + t.w;
    }
    const first = xs[0] as Txt;
    return { y: first.y, h: Math.max(...g.map((t) => t.h)), x: first.x, s: s.replace(/\s+/g, ' ').trim() };
  }).filter((l) => l.s);
}

const juntar = (ls: Linha[]) => ls.map((l) => l.s).join(' ').replace(/\s+/g, ' ').trim();

/** Table rows: a new row starts when "[" appears in the Nome column; following lines join the same name. */
function linhasTabela(txts: Txt[]): Row[] {
  const hNome = txts.filter((t) => norm(t.s) === 'nome').sort((a, b) => b.y - a.y)[0];
  const hEtapa = txts.filter((t) => norm(t.s) === 'etapa').sort((a, b) => b.y - a.y)[0];
  if (!hNome || !hEtapa) return [];
  const hResp = txts.filter((t) => norm(t.s).startsWith('responsavel')).sort((a, b) => b.y - a.y)[0];
  const topo = Math.min(hNome.y, hEtapa.y) - 2;
  const legenda = txts.filter((t) => /expectativa|\d{1,2} a \d{1,2} dias/.test(norm(t.s)));
  const piso = legenda.length ? Math.max(...legenda.map((t) => t.y)) + 2 : -Infinity;
  const corpo = txts.filter((t) => t.y < topo && t.y > piso);
  const lim1 = hEtapa.x - 4;
  const lim2 = hResp ? hResp.x - 4 : Infinity;
  const nome = linhasDe(corpo.filter((t) => t.x < lim1));
  const etapa = linhasDe(corpo.filter((t) => t.x >= lim1 && t.x < lim2));
  const resp = linhasDe(corpo.filter((t) => t.x >= lim2));

  const rows: Row[] = [];
  for (const l of nome) {
    const atual = rows[rows.length - 1];
    if (l.s.startsWith('[')) rows.push({ nome: [l], etapa: [], resp: [], yTop: l.y, yBot: l.y });
    else if (atual && atual.yBot - l.y <= l.h * 2.2) { atual.nome.push(l); atual.yBot = l.y; }
  }
  const atribuir = (ls: Linha[], k: 'etapa' | 'resp') => {
    for (const l of ls) {
      const cands = rows.filter((r) => l.y <= r.yTop + l.h * 1.2 && l.y >= r.yBot - l.h * 1.2);
      const centro = (r: Row) => Math.abs((r.yTop + r.yBot) / 2 - l.y);
      const r = cands.sort((a, b) => centro(a) - centro(b))[0];
      r?.[k].push(l);
    }
  };
  atribuir(etapa, 'etapa');
  atribuir(resp, 'resp');
  return rows;
}

interface Tela { px: (x: number, y: number) => RGB | null }

async function renderizar(page: PaginaPdf): Promise<Tela | null> {
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  return {
    px: (x, y) => {
      const [cx = -1, cy = -1] = viewport.convertToViewportPoint(x, y);
      const i = Math.round(cx);
      const j = Math.round(cy);
      if (i < 0 || j < 0 || i >= canvas.width || j >= canvas.height) return null;
      const k = (j * canvas.width + i) * 4;
      return [img[k] ?? 0, img[k + 1] ?? 0, img[k + 2] ?? 0];
    },
  };
}

/** Legend: for each band text, scan to the LEFT of its text block and keep the pixel closest to the expected color. */
function lerLegenda(txts: Txt[], tela: Tela): { temp: Temp; cor: RGB }[] {
  const out: { temp: Temp; cor: RGB }[] = [];
  for (const r of RESERVA) {
    const chave = r.temp.replace(' dias', '');
    const cand = txts.filter((t) => norm(t.s).includes(chave)).sort((a, b) => a.y - b.y)[0];
    if (!cand) continue;
    let ini = cand;
    for (let n = 0; n < 6; n++) {
      const ant = txts.find((t) => t !== ini && Math.abs(t.y - ini.y) <= 3 && t.x < ini.x && t.x + t.w >= ini.x - 25);
      if (!ant) break;
      ini = ant;
    }
    const meio = ini.y + ini.h * 0.35;
    let melhor: { c: RGB; d: number } | null = null;
    for (let dx = 1; dx <= 45; dx += 0.5) {
      const c = tela.px(ini.x - dx, meio);
      if (!c) continue;
      const d = dist(c, r.cor);
      if (!melhor || d < melhor.d) melhor = { c, d };
    }
    out.push({ temp: r.temp, cor: melhor && melhor.d <= 60 ? melhor.c : r.cor });
  }
  return out;
}

/** Background of the Nome cell, sampled left of the first text line; nearest legend color (RGB distance). */
function corDaLinha(r: Row, tela: Tela, legenda: { temp: Temp; cor: RGB }[]): { cor: RGB | null; temp: Temp | null } {
  const l = r.nome[0];
  if (!l) return { cor: null, temp: null };
  const amostras: RGB[] = [];
  for (const dx of [2, 3, 4, 5, 6]) for (const fy of [0.15, 0.35, 0.55]) {
    const c = tela.px(l.x - dx, l.y + l.h * fy);
    if (c) amostras.push(c);
  }
  let melhor: { c: RGB; temp: Temp; d: number } | null = null;
  for (const c of amostras) for (const lg of legenda) {
    const d = dist(c, lg.cor);
    if (!melhor || d < melhor.d) melhor = { c, temp: lg.temp, d };
  }
  if (melhor && melhor.d <= LIMIAR_COR) return { cor: melhor.c, temp: melhor.temp };
  return { cor: amostras[Math.floor(amostras.length / 2)] ?? null, temp: null };
}

function textos(items: unknown[]): Txt[] {
  const out: Txt[] = [];
  for (const it of items) {
    const o = it as { str?: string; transform?: number[]; width?: number; height?: number };
    if (!o.str?.trim() || !o.transform) continue;
    const t = o.transform;
    out.push({ s: o.str.trim(), x: t[4] ?? 0, y: t[5] ?? 0, w: o.width ?? 0, h: o.height || Math.hypot(t[2] ?? 0, t[3] ?? 0) || 10 });
  }
  return out;
}

/** Reads every page; projects in several pages keep the Status Negociações temperature. */
export async function lerPdfPrioridades(file: File): Promise<LinhaPdf[]> {
  // `?url` makes Vite emit the worker as an asset and return its final URL (works in the published app).
  const [pdfjs, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const neg: LinhaPdf[] = [];
  const pros: LinhaPdf[] = [];
  let legendaAnterior: { temp: Temp; cor: RGB }[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = (await doc.getPage(n)) as unknown as PaginaPdf;
    const txts = textos((await page.getTextContent()).items);
    const tipo = tipoPagina(txts);
    if (!tipo) continue;
    const rows = linhasTabela(txts);
    if (!rows.length) continue;
    if (tipo === 'prospeccoes') {
      for (const r of rows) {
        const etapa = juntar(r.etapa);
        if (!/\bpausad/.test(norm(etapa))) continue;
        pros.push({ nome: juntar(r.nome), etapa, responsavel: juntar(r.resp), cor: '', temp: PAUSADA, pagina: n, fonte: tipo, aviso: null });
      }
      continue;
    }
    const tela = await renderizar(page);
    const lida = tela ? lerLegenda(txts, tela) : [];
    const legenda = lida.length ? lida : legendaAnterior;
    if (lida.length) legendaAnterior = lida;
    for (const r of rows) {
      const { cor, temp } = tela && legenda.length ? corDaLinha(r, tela, legenda) : { cor: null, temp: null };
      neg.push({
        nome: juntar(r.nome), etapa: juntar(r.etapa), responsavel: juntar(r.resp), cor: cor ? hexDe(cor) : '', temp, pagina: n, fonte: tipo,
        aviso: temp ? null : legenda.length ? 'cor não reconhecida' : 'cor não reconhecida (legenda não encontrada)',
      });
    }
  }
  const visto = new Set<string>();
  const unicas = neg.filter((l) => { const k = norm(l.nome); if (visto.has(k)) return false; visto.add(k); return true; });
  return [...unicas, ...pros.filter((l) => { const k = norm(l.nome); if (visto.has(k)) return false; visto.add(k); return true; })];
}
