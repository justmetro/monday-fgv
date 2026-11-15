/** Minimal local shapes for the pdfmake document definition (the package ships no type entry here). */
type Content = Record<string, unknown>;
interface TDocumentDefinitions {
  [k: string]: unknown;
  footer?: (atual: number, total: number) => Content;
  content: Content[];
}
import { type CardInd, textoCard } from '@generated/lib/indicadoresCards';
import { type LinhaRel, COLS_REL, celula } from '@generated/lib/relatorioMensal';

/** Browser-only exports of the monthly report (dynamic imports inside the handlers). */
export interface Grafico { titulo: string; dataUrl: string; w: number; h: number }
export interface DadosExport { titulo: string; mes: string; geradoEm: string; resumo: string; cards: CardInd[]; graficos: Grafico[]; linhas: LinhaRel[] }

const TINTA = '1F2937';
const SUAVE = '4B5563';
const AZUL = '2F4A6D';
const LINHA = 'D1D5DB';
const NEG = 'A8382C';

/** Captures a chart frame as PNG (white background, 2× for print). */
export async function capturar(el: HTMLElement, titulo: string): Promise<Grafico> {
  const { toPng } = await import('html-to-image');
  const dataUrl = await toPng(el, { pixelRatio: 2, backgroundColor: '#ffffff', cacheBust: true, skipFonts: true });
  const r = el.getBoundingClientRect();
  return { titulo, dataUrl, w: r.width, h: r.height };
}

const negativo = (l: LinhaRel) => (l.saldo ?? 0) < 0;

/** A4 landscape: header (title, month, generation date), summary, cards, charts and the table (multi-page). */
export async function baixarPdf(d: DadosExport, arquivo: string) {
  const [m, fontes] = await Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')]);
  const pdfMake = (m as unknown as { default?: typeof m }).default ?? m;
  const vfs = ((fontes as unknown as { default?: Record<string, string> }).default ?? fontes) as unknown as Record<string, string>;
  const largura = 841.89 - 60;
  const cardsTabela = {
    table: {
      widths: ['*', '*', '*', '*'],
      body: chunk(d.cards, 4).map((linha) => [0, 1, 2, 3].map((i) => {
        const c = linha[i];
        if (!c) return { text: '' };
        return {
          stack: [
            { text: c.label, fontSize: 8, color: `#${SUAVE}` },
            { text: c.valor, fontSize: 13, bold: true, color: c.negativo ? `#${NEG}` : `#${TINTA}`, margin: [0, 2, 0, 1] },
            ...(c.k !== 'n' && textoCard(c) ? [{ text: textoCard(c), fontSize: 7, color: `#${SUAVE}` }] : []),
          ],
          margin: [4, 4, 4, 4],
        };
      })),
    },
    layout: { hLineColor: () => `#${LINHA}`, vLineColor: () => `#${LINHA}`, hLineWidth: () => 0.5, vLineWidth: () => 0.5 },
  } as Content;
  const cardN = d.cards.find((c) => c.k === 'n');
  const status = cardN ? textoCard(cardN) : '';
  const doc: TDocumentDefinitions = {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [30, 30, 30, 34],
    defaultStyle: { fontSize: 9, color: `#${TINTA}` },
    footer: (atual, total) => ({ text: `${d.titulo} · ${d.mes} · página ${atual} de ${total}`, alignment: 'center', fontSize: 7, color: `#${SUAVE}`, margin: [0, 12, 0, 0] }),
    content: [
      { text: d.titulo, fontSize: 18, bold: true, color: `#${AZUL}` },
      { text: `Mês de referência: ${d.mes}  ·  Gerado em ${d.geradoEm}`, fontSize: 9, color: `#${SUAVE}`, margin: [0, 2, 0, 10] },
      { text: d.resumo, fontSize: 10, lineHeight: 1.3, margin: [0, 0, 0, 10] },
      ...(status ? [{ text: `Por status: ${status}`, fontSize: 8, color: `#${SUAVE}`, margin: [0, 0, 0, 6] as [number, number, number, number] }] : []),
      cardsTabela,
      ...d.graficos.map((g): Content => ({
        stack: [{ text: g.titulo, fontSize: 11, bold: true, margin: [0, 0, 0, 4] }, { image: g.dataUrl, width: Math.min(largura, g.w * 0.62) }],
        margin: [0, 12, 0, 0], unbreakable: true,
      })),
      { text: 'Projetos do mês', fontSize: 11, bold: true, margin: [0, 14, 0, 4], pageBreak: 'before' },
      {
        table: {
          headerRows: 1,
          widths: ['*', 130, 75, 75, 75, 50],
          body: [
            COLS_REL.map((c) => ({ text: c.label, bold: true, fillColor: '#EEF2F6', alignment: c.num ? 'right' : 'left' })),
            ...d.linhas.map((l) => COLS_REL.map((c) => ({
              text: celula(l, c.k), alignment: c.num ? 'right' : 'left',
              color: (c.k === 'saldo' || c.k === 'pct') && negativo(l) ? `#${NEG}` : `#${TINTA}`,
            }))),
          ],
        },
        layout: { hLineColor: () => `#${LINHA}`, vLineWidth: () => 0, hLineWidth: () => 0.5, paddingTop: () => 3, paddingBottom: () => 3 },
      },
    ] as Content[],
    info: { title: `${d.titulo} · ${d.mes}` },
  };
  pdfMake.createPdf(doc as unknown as Parameters<typeof pdfMake.createPdf>[0], undefined, undefined, vfs).download(arquivo);
}

function chunk<T>(xs: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

/** Cover, cards, one slide per chart, and the table split in slides of up to 12 rows. */
export async function baixarPpt(d: DadosExport, arquivo: string) {
  const { pptxgen } = await import('@skills/pptx-export');
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_WIDE';
  pres.title = `${d.titulo} · ${d.mes}`;
  const fonte = 'Calibri';

  const capa = pres.addSlide();
  capa.background = { color: AZUL };
  capa.addText(d.titulo, { x: 0.8, y: 2.4, w: 11.7, h: 1, fontSize: 36, bold: true, color: 'FFFFFF', fontFace: fonte });
  capa.addText(d.mes, { x: 0.8, y: 3.5, w: 11.7, h: 0.6, fontSize: 22, color: 'D6E0EC', fontFace: fonte });
  capa.addText(`Gerado em ${d.geradoEm}`, { x: 0.8, y: 4.3, w: 11.7, h: 0.4, fontSize: 12, color: 'D6E0EC', fontFace: fonte });

  const titulo = (s: ReturnType<typeof pres.addSlide>, t: string) => {
    s.background = { color: 'FFFFFF' };
    s.addText(t, { x: 0.5, y: 0.3, w: 12.3, h: 0.6, fontSize: 22, bold: true, color: AZUL, fontFace: fonte });
  };

  const sc = pres.addSlide();
  titulo(sc, `Indicadores · ${d.mes}`);
  sc.addText(d.resumo, { x: 0.5, y: 0.95, w: 12.3, h: 0.9, fontSize: 11, color: SUAVE, fontFace: fonte, valign: 'top' });
  const cards = d.cards.filter((c) => c.k !== 'n').slice(0, 18);
  const cw = 12.3 / 6;
  cards.forEach((c, i) => {
    const x = 0.5 + (i % 6) * cw;
    const y = 2.0 + Math.floor(i / 6) * 1.75;
    sc.addShape(pres.ShapeType.rect, { x: x + 0.05, y, w: cw - 0.1, h: 1.6, fill: { color: 'F5F7FA' }, line: { color: LINHA, width: 0.5 } });
    sc.addText(c.label, { x: x + 0.15, y: y + 0.08, w: cw - 0.3, h: 0.35, fontSize: 10, color: SUAVE, fontFace: fonte });
    sc.addText(c.valor, { x: x + 0.15, y: y + 0.45, w: cw - 0.3, h: 0.55, fontSize: 18, bold: true, color: c.negativo ? NEG : TINTA, fontFace: fonte });
    if (textoCard(c)) sc.addText(textoCard(c), { x: x + 0.15, y: y + 1.0, w: cw - 0.3, h: 0.5, fontSize: 8, color: SUAVE, fontFace: fonte, valign: 'top' });
  });

  for (const g of d.graficos) {
    const s = pres.addSlide();
    titulo(s, g.titulo);
    s.addImage({ data: g.dataUrl, x: 0.5, y: 1.1, w: 12.3, h: 6, sizing: { type: 'contain', w: 12.3, h: 6 } });
  }

  const paginas = chunk(d.linhas, 12);
  paginas.forEach((ls, i) => {
    const s = pres.addSlide();
    titulo(s, `Projetos do mês${paginas.length > 1 ? ` (${i + 1}/${paginas.length})` : ''}`);
    const cab = COLS_REL.map((c) => ({ text: c.label, options: { bold: true, color: 'FFFFFF', fill: { color: AZUL }, align: c.num ? ('right' as const) : ('left' as const) } }));
    const corpo = ls.map((l) => COLS_REL.map((c) => ({
      text: celula(l, c.k),
      options: { color: (c.k === 'saldo' || c.k === 'pct') && negativo(l) ? NEG : TINTA, align: c.num ? ('right' as const) : ('left' as const) },
    })));
    s.addTable([cab, ...corpo], {
      x: 0.5, y: 1.1, w: 12.3, colW: [4.6, 2.3, 1.4, 1.4, 1.4, 1.2], fontSize: 10, fontFace: fonte,
      border: { type: 'solid', pt: 0.5, color: LINHA }, rowH: 0.42,
    });
  });

  await pres.writeFile({ fileName: arquivo });
}
