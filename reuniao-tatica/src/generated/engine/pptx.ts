// Edição do PPT modelo direto no XML, preservando a formatação dos runs, células e gráficos.
import JSZip from 'jszip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

type El = any;

export const CORES_RISCO: Record<string, string> = { Alto: 'EA6B5E', Moderado: 'F2B84B', 'Sem risco': '31D38A', 'Não avaliado': '9CA3AF' };

const kids = (el: El, tag: string): El[] => {
  const out: El[] = [];
  for (let n = el?.firstChild; n; n = n.nextSibling) if (n.nodeName === tag) out.push(n);
  return out;
};
const all = (el: El, tag: string): El[] => Array.from(el.getElementsByTagName(tag));
const text = (el: El) => all(el, 'a:t').map((t) => t.textContent ?? '').join('');

export class Deck {
  private docs = new Map<string, El>();
  constructor(public zip: JSZip) {}

  static async open(buf: ArrayBuffer | Uint8Array) {
    return new Deck(await JSZip.loadAsync(buf));
  }

  async xml(path: string): Promise<El> {
    if (!this.docs.has(path)) {
      const f = this.zip.file(path);
      if (!f) throw new Error(`Arquivo ausente no PPT: ${path}`);
      this.docs.set(path, new DOMParser().parseFromString(await f.async('string'), 'text/xml'));
    }
    return this.docs.get(path);
  }

  slide(n: number) { return this.xml(`ppt/slides/slide${n}.xml`); }

  async chartOf(n: number): Promise<{ doc: El; path: string } | null> {
    const rels = await this.xml(`ppt/slides/_rels/slide${n}.xml.rels`);
    const rel = all(rels, 'Relationship').find((r) => /\/chart$/.test(r.getAttribute('Type')));
    if (!rel) return null;
    const path = 'ppt/' + rel.getAttribute('Target').replace(/^\.\.\//, '');
    return { doc: await this.xml(path), path };
  }

  /** Regrava a planilha embutida do gráfico (para "Editar dados" mostrar os valores novos). */
  async setChartWorkbook(chartPath: string, serieNome: string, cats: string[], vals: number[]) {
    const relsPath = chartPath.replace(/charts\/(chart\d+\.xml)$/, 'charts/_rels/$1.rels');
    const rels = this.zip.file(relsPath) ? await this.xml(relsPath) : null;
    const rel = rels && all(rels, 'Relationship').find((r) => /package$/.test(r.getAttribute('Type')));
    if (!rel) return;
    const target = 'ppt/' + rel.getAttribute('Target').replace(/^\.\.\//, '');
    this.zip.file(target, await xlsxSimples(serieNome, cats, vals));
  }

  async save(): Promise<Uint8Array> {
    const ser = new XMLSerializer();
    for (const [p, d] of this.docs) this.zip.file(p, ser.serializeToString(d));
    return this.zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  }
}

export function shape(doc: El, id: number): El {
  const c = all(doc, 'p:cNvPr').find((e) => e.getAttribute('id') === String(id));
  if (!c) throw new Error(`Forma ${id} não encontrada no modelo.`);
  let n = c;
  while (n && n.nodeName !== 'p:sp' && n.nodeName !== 'p:graphicFrame') n = n.parentNode;
  return n;
}

export const shapeText = (doc: El, id: number) => text(shape(doc, id));

/** Parágrafo a gravar: tpl = índice do parágrafo do modelo usado como formato; runs = texto de cada run. */
export interface Para { tpl?: number; runs: string[]; cor?: string }

function setRunText(r: El, t: string) {
  let te = kids(r, 'a:t')[0];
  if (!te) { te = r.ownerDocument.createElement('a:t'); r.appendChild(te); }
  while (te.firstChild) te.removeChild(te.firstChild);
  te.appendChild(r.ownerDocument.createTextNode(t));
}

function setColor(r: El, cor: string) {
  const rPr = kids(r, 'a:rPr')[0];
  if (!rPr) return;
  const fill = kids(rPr, 'a:solidFill')[0];
  const clr = fill && kids(fill, 'a:srgbClr')[0];
  if (clr) clr.setAttribute('val', cor);
}

/** Reescreve os parágrafos de um txBody (forma ou célula), clonando o formato dos parágrafos do modelo. */
export function setParas(txBody: El, paras: Para[]) {
  const tpls = kids(txBody, 'a:p').map((p) => p.cloneNode(true));
  if (!tpls.length) return;
  for (const p of kids(txBody, 'a:p')) txBody.removeChild(p);
  for (const para of paras) {
    const p = tpls[Math.min(para.tpl ?? 0, tpls.length - 1)].cloneNode(true);
    const runs = kids(p, 'a:r');
    const base = runs[runs.length - 1];
    para.runs.forEach((t, k) => {
      let r = runs[k];
      if (!r) {
        r = base ? base.cloneNode(true) : null;
        if (!r) return;
        const end = kids(p, 'a:endParaRPr')[0];
        end ? p.insertBefore(r, end) : p.appendChild(r);
      }
      setRunText(r, t);
      if (para.cor) setColor(r, para.cor);
    });
    runs.slice(para.runs.length).forEach((r) => p.removeChild(r));
    txBody.appendChild(p);
  }
}

const bodyOf = (sp: El) => kids(sp, 'p:txBody')[0] ?? kids(sp, 'a:txBody')[0];

export function setShape(doc: El, id: number, paras: Para[] | string) {
  const b = bodyOf(shape(doc, id));
  setParas(b, typeof paras === 'string' ? [{ runs: [paras] }] : paras);
}

/** Troca um trecho de texto dentro dos runs da forma (só quando o trecho está inteiro num run). */
export function replaceInShape(doc: El, id: number, de: string | RegExp, para: string) {
  for (const t of all(shape(doc, id), 'a:t')) {
    const v = t.textContent ?? '';
    const nv = v.replace(de, para);
    if (nv !== v) { while (t.firstChild) t.removeChild(t.firstChild); t.appendChild(t.ownerDocument.createTextNode(nv)); }
  }
}

// ---------- tabelas ----------
export interface RiskCellModel { tcPr: El; txBody: El }
export type RiskModels = Map<string, RiskCellModel>;

/** Guarda uma célula modelo para cada rótulo de risco ("● Alto", "● Moderado", "● Sem risco"). */
export function collectRiskModels(docs: El[]): RiskModels {
  const m: RiskModels = new Map();
  for (const d of docs) for (const tc of all(d, 'a:tc')) {
    const raw = text(tc).trim();
    const t = /^[CR]$/.test(raw) ? `classe:${raw}` : raw.replace('●', '').trim();
    if ((t in CORES_RISCO || t.startsWith('classe:')) && !m.has(t)) m.set(t, { tcPr: kids(tc, 'a:tcPr')[0]?.cloneNode(true), txBody: kids(tc, 'a:txBody')[0].cloneNode(true) });
  }
  return m;
}

export function tableRows(doc: El, id: number): string[][] {
  const tbl = all(shape(doc, id), 'a:tbl')[0];
  return kids(tbl, 'a:tr').map((tr) => kids(tr, 'a:tc').map((tc) => text(tc)));
}

/**
 * Grava as linhas de dados (a linha 0 do modelo é o cabeçalho). Linhas a mais são clonadas da última,
 * linhas sobrando são removidas. riskCols: colunas cujo valor é um rótulo de risco.
 */
export function setTable(doc: El, id: number, rows: string[][], risk: RiskModels, riskCols: number[] = [], classCols: number[] = []) {
  const tbl = all(shape(doc, id), 'a:tbl')[0];
  const trs = kids(tbl, 'a:tr');
  const header = trs[0];
  const data = trs.slice(1);
  const proto = data[data.length - 1] ?? header;
  rows.forEach((row, i) => {
    let tr = data[i];
    if (!tr) { tr = proto.cloneNode(true); tbl.appendChild(tr); }
    const tcs = kids(tr, 'a:tc');
    row.forEach((val, c) => {
      const tc = tcs[c];
      if (!tc) return;
      const cls = classCols.includes(c) ? risk.get(`classe:${val}`) : undefined;
      if (cls) {
        const nb = cls.txBody.cloneNode(true);
        tc.replaceChild(nb, kids(tc, 'a:txBody')[0]);
        const oldP = kids(tc, 'a:tcPr')[0];
        if (cls.tcPr && oldP) tc.replaceChild(cls.tcPr.cloneNode(true), oldP);
        setParas(nb, [{ runs: [val] }]);
        return;
      }
      if (riskCols.includes(c)) {
        const label = val in CORES_RISCO ? val : 'Não avaliado';
        const mod = risk.get(label) ?? risk.get('Sem risco');
        if (mod) {
          const oldB = kids(tc, 'a:txBody')[0], oldP = kids(tc, 'a:tcPr')[0];
          const nb = mod.txBody.cloneNode(true);
          tc.replaceChild(nb, oldB);
          if (mod.tcPr && oldP) tc.replaceChild(mod.tcPr.cloneNode(true), oldP);
          setParas(nb, [{ runs: [`● ${label}`], cor: risk.has(label) ? undefined : CORES_RISCO[label] }]);
          return;
        }
      }
      setParas(kids(tc, 'a:txBody')[0], [{ runs: [val] }]);
    });
  });
  data.slice(rows.length).forEach((tr) => tbl.removeChild(tr));
  // ajusta a altura do quadro para o número de linhas
  const gf = shape(doc, id);
  const ext = all(gf, 'a:ext').find((e) => e.parentNode?.nodeName === 'p:xfrm');
  if (ext) {
    const total = kids(tbl, 'a:tr').reduce((s, tr) => s + Number(tr.getAttribute('h') || 0), 0);
    if (total > 0) ext.setAttribute('cy', String(total));
  }
}

// ---------- gráficos ----------
export function setBarChart(chart: El, cats: string[], vals: number[], cores: string[]) {
  const ser = all(chart, 'c:ser')[0];
  const doc = chart;
  const mk = (tag: string) => doc.createElement(tag);
  const fillCache = (cache: El, values: string[], numeric: boolean) => {
    for (const pt of kids(cache, 'c:pt')) cache.removeChild(pt);
    kids(cache, 'c:ptCount')[0]?.setAttribute('val', String(values.length));
    values.forEach((v, i) => {
      const pt = mk('c:pt'); pt.setAttribute('idx', String(i));
      const ve = mk('c:v'); ve.appendChild(doc.createTextNode(v)); pt.appendChild(ve);
      cache.appendChild(pt);
    });
    if (numeric) { /* formatCode permanece */ }
  };
  const cat = kids(ser, 'c:cat')[0];
  const strCache = all(cat, 'c:strCache')[0] ?? all(cat, 'c:strLit')[0];
  if (strCache) fillCache(strCache, cats, false);
  const val = kids(ser, 'c:val')[0];
  const numCache = all(val, 'c:numCache')[0] ?? all(val, 'c:numLit')[0];
  if (numCache) fillCache(numCache, vals.map((v) => String(Math.round(v * 100) / 100)), true);
  // referências da planilha passam a apontar só para o número certo de linhas
  for (const f of [...all(cat, 'c:f'), ...all(val, 'c:f')]) {
    const v = f.textContent ?? '';
    const nv = v.replace(/\$(\d+)$/, `$${cats.length + 1}`);
    while (f.firstChild) f.removeChild(f.firstChild);
    f.appendChild(doc.createTextNode(nv));
  }
  // cor por barra conforme o risco
  for (const dpt of kids(ser, 'c:dPt')) {
    const idx = Number(kids(dpt, 'c:idx')[0]?.getAttribute('val'));
    if (idx >= cats.length) { ser.removeChild(dpt); continue; }
    const clr = all(dpt, 'a:srgbClr')[0];
    if (clr && cores[idx]) clr.setAttribute('val', cores[idx]);
  }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
async function xlsxSimples(serie: string, cats: string[], vals: number[]): Promise<Uint8Array> {
  const z = new JSZip();
  z.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
  z.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  z.file('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>');
  z.file('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>');
  const str = (ref: string, v: string) => `<c r="${ref}" t="inlineStr"><is><t>${esc(v)}</t></is></c>`;
  const rows = [`<row r="1">${str('A1', '')}${str('B1', serie)}</row>`, ...cats.map((c, i) => `<row r="${i + 2}">${str(`A${i + 2}`, c)}<c r="B${i + 2}"><v>${Math.round(vals[i] * 100) / 100}</v></c></row>`)];
  z.file('xl/worksheets/sheet1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.join('')}</sheetData></worksheet>`);
  return z.generateAsync({ type: 'uint8array' });
}

/** Acrescenta texto ao fim do último run da forma. */
export function appendToShape(doc: El, id: number, extra: string) {
  const ts = all(shape(doc, id), 'a:t');
  const t = ts[ts.length - 1];
  if (!t) return;
  const v = (t.textContent ?? '') + extra;
  while (t.firstChild) t.removeChild(t.firstChild);
  t.appendChild(t.ownerDocument.createTextNode(v));
}
