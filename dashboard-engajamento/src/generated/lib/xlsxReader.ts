// Leitor mínimo de .xlsx no navegador (zip + XML), sem bibliotecas externas.
// Devolve a primeira planilha como matriz de textos.

function u16(v: DataView, o: number) {
  return v.getUint16(o, true);
}
function u32(v: DataView, o: number) {
  return v.getUint32(o, true);
}

async function inflateRaw(data: ArrayBuffer): Promise<ArrayBuffer> {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(stream).arrayBuffer();
}

export const zipEntries: { name: string; size: number }[] = [];

async function readZip(buf: ArrayBuffer, wanted: (name: string) => boolean): Promise<Map<string, string>> {
  zipEntries.length = 0;
  const view = new DataView(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) {
    if (u32(view, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Arquivo XLSX inválido ou corrompido.');

  const count = u16(view, eocd + 10);
  let p = u32(view, eocd + 16);
  const out = new Map<string, string>();
  const decoder = new TextDecoder('utf-8');

  for (let n = 0; n < count; n++) {
    if (u32(view, p) !== 0x02014b50) break;
    const method = u16(view, p + 10);
    const compSize = u32(view, p + 20);
    const fullSize = u32(view, p + 24);
    const nameLen = u16(view, p + 28);
    const extraLen = u16(view, p + 30);
    const commentLen = u16(view, p + 32);
    const localOffset = u32(view, p + 42);
    const name = decoder.decode(new Uint8Array(buf, p + 46, nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    zipEntries.push({ name, size: fullSize });

    if (!wanted(name)) continue;
    const lNameLen = u16(view, localOffset + 26);
    const lExtraLen = u16(view, localOffset + 28);
    const start = localOffset + 30 + lNameLen + lExtraLen;
    const raw = buf.slice(start, start + compSize);
    const content = method === 0 ? raw : method === 8 ? await inflateRaw(raw) : null;
    if (content) out.set(name, decoder.decode(content));
  }
  return out;
}

function byTag(node: Document | Element, tag: string): Element[] {
  return Array.from(node.getElementsByTagNameNS('*', tag));
}

function colIndex(ref: string): number {
  const letters = ref.replace(/[^A-Z]/gi, '').toUpperCase();
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** Endereço, tipo e valor bruto de cada célula (para diagnóstico). */
export interface XlsxCellInfo { ref: string; type: string; raw: string }

/** Dados internos do arquivo, só para o diagnóstico. */
export interface XlsxDebug {
  files: { name: string; size: number }[];
  sharedStringsName: string;
  sharedStringsBytes: number;
  sharedStringsCount: number;
  sheetPath: string;
  cellXml: (ref: string) => string;
}

export async function readXlsxFirstSheet(file: File): Promise<string[][]> {
  return (await readXlsxFirstSheetNamed(file)).rows;
}

/** Primeira aba do arquivo, com o nome dela (para mostrar na prévia).
 * links[linha][coluna] = destino do hiperlink da célula (relação da aba ou fórmula HYPERLINK), quando houver. */
export async function readXlsxFirstSheetNamed(file: File): Promise<{ name: string; sheetCount: number; rows: string[][]; links: string[][]; cells: XlsxCellInfo[][]; debug: XlsxDebug }> {
  const buf = await file.arrayBuffer();
  const files = await readZip(
    buf,
    (n) => n.startsWith('xl/') && (n.endsWith('.xml') || n.endsWith('.rels'))
  );
  const parser = new DOMParser();

  // Primeira planilha na ordem do workbook
  let sheetPath = '';
  let sheetName = '';
  let sheetCount = 1;
  const wb = files.get('xl/workbook.xml');
  const rels = files.get('xl/_rels/workbook.xml.rels');
  if (wb) {
    const sheets = byTag(parser.parseFromString(wb, 'application/xml'), 'sheet');
    sheetCount = Math.max(1, sheets.length);
    sheetName = sheets[0]?.getAttribute('name') ?? '';
  }
  if (wb && rels) {
    const firstSheet = byTag(parser.parseFromString(wb, 'application/xml'), 'sheet')[0];
    const rid =
      firstSheet?.getAttribute('r:id') ??
      firstSheet?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') ??
      '';
    const rel = byTag(parser.parseFromString(rels, 'application/xml'), 'Relationship').find((r) => r.getAttribute('Id') === rid);
    const target = rel?.getAttribute('Target') ?? '';
    if (target) sheetPath = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
  }
  if (!sheetPath || !files.has(sheetPath)) {
    sheetPath = Array.from(files.keys()).filter((k) => k.startsWith('xl/worksheets/sheet')).sort()[0] ?? '';
  }
  const sheetXml = files.get(sheetPath);
  if (!sheetXml) throw new Error('Não encontrei nenhuma planilha dentro do arquivo XLSX.');

  // Textos compartilhados: caminho pelas relações do workbook (sem assumir o nome do arquivo).
  // Texto rico: junta só os trechos <t> (fora da leitura fonética <rPh>).
  let ssPath = 'xl/sharedStrings.xml';
  if (rels) {
    const r = byTag(parser.parseFromString(rels, 'application/xml'), 'Relationship').find((x) => /sharedStrings$/i.test(x.getAttribute('Type') ?? ''));
    const t = r?.getAttribute('Target') ?? '';
    if (t) ssPath = t.startsWith('/') ? t.slice(1) : `xl/${t.replace(/^\.\//, '')}`;
  }
  const ssKey = files.has(ssPath) ? ssPath : Array.from(files.keys()).find((k) => k.toLowerCase() === ssPath.toLowerCase()) ?? '';
  const textOf = (el: Element | undefined) =>
    el ? byTag(el, 't').filter((t) => !t.parentElement || t.parentElement.localName !== 'rPh').map((t) => t.textContent ?? '').join('') : '';
  const shared: string[] = [];
  const ss = ssKey ? files.get(ssKey) : undefined;
  if (ss) byTag(parser.parseFromString(ss, 'application/xml'), 'si').forEach((si) => shared.push(textOf(si)));

  const sheetDoc = parser.parseFromString(sheetXml, 'application/xml');
  const serializer = new XMLSerializer();
  const xmlByRef = new Map<string, string>();
  // Valores ricos (xl/richData/rdrichvalue.xml): primeiro texto de cada <rv>
  const richValues: string[] = [];
  const rich = files.get('xl/richData/rdrichvalue.xml');
  if (rich) byTag(parser.parseFromString(rich, 'application/xml'), 'rv').forEach((rv) => {
    const vs = byTag(rv, 'v').map((v) => (v.textContent ?? '').trim());
    richValues.push(vs.find((v) => v.includes('@')) ?? vs.find((v) => v && !/^\d+$/.test(v)) ?? '');
  });
  // Hiperlinks da aba: <hyperlink ref="A2" r:id="rId1"/> → destino na relação da aba
  const relTargets = new Map<string, string>();
  const slash = sheetPath.lastIndexOf('/');
  const sheetRels = files.get(`${sheetPath.slice(0, slash)}/_rels/${sheetPath.slice(slash + 1)}.rels`);
  if (sheetRels) {
    byTag(parser.parseFromString(sheetRels, 'application/xml'), 'Relationship').forEach((r) => {
      const id = r.getAttribute('Id');
      if (id) relTargets.set(id, r.getAttribute('Target') ?? '');
    });
  }
  const linkByRef = new Map<string, string>();
  byTag(sheetDoc, 'hyperlink').forEach((h) => {
    const ref = (h.getAttribute('ref') ?? '').split(':')[0]?.toUpperCase() ?? '';
    const rid = h.getAttribute('r:id') ?? h.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') ?? '';
    const target = (rid ? relTargets.get(rid) : '') || h.getAttribute('display') || h.getAttribute('location') || '';
    if (ref && target) linkByRef.set(ref, target);
  });

  // Linhas indexadas pelo número real da linha no Excel (linhas ausentes no XML ficam vazias)
  const rows: string[][] = [];
  const links: string[][] = [];
  const cells: XlsxCellInfo[][] = [];
  let lastRow = 0;
  byTag(sheetDoc, 'row').forEach((rowEl) => {
    const rowNum = Number(rowEl.getAttribute('r')) || lastRow + 1;
    lastRow = rowNum;
    const ri = rowNum - 1;
    while (rows.length <= ri) { rows.push([]); links.push([]); cells.push([]); }
    const row = rows[ri]!;
    const rowLinks = links[ri]!;
    const rowCells = cells[ri]!;
    let nextCol = 0;
    Array.from(rowEl.children).filter((c) => c.localName === 'c').forEach((c) => {
      const ref = (c.getAttribute('r') ?? '').toUpperCase();
      const idx = ref ? colIndex(ref) : nextCol;
      nextCol = idx + 1;
      const type = c.getAttribute('t') ?? 'n';
      const vEl = Array.from(c.children).find((x) => x.localName === 'v');
      const isEl = Array.from(c.children).find((x) => x.localName === 'is');
      let raw = vEl?.textContent ?? (isEl ? textOf(isEl) : '');
      // Valor rico do Excel (atributo vm): texto guardado em xl/richData
      const vm = Number(c.getAttribute('vm') ?? '0');
      if (!raw && vm > 0) raw = richValues[vm - 1] ?? '';
      if (rowNum <= 12 && xmlByRef.size < 400) xmlByRef.set(ref || `${colName(idx)}${rowNum}`, serializer.serializeToString(c).slice(0, 600));
      let value = '';
      if (type === 's') value = shared[Number(raw)] ?? '';
      else if (type === 'inlineStr') value = isEl ? textOf(isEl) : raw;
      else if (type === 'b') value = raw === '1' ? 'TRUE' : raw === '0' ? 'FALSE' : raw;
      else value = raw; // 'str' (fórmula em texto), 'n' (número/data serial, convertida depois), 'e', valor em cache
      const cellRef = ref || `${colName(idx)}${rowNum}`;
      const formula = Array.from(c.children).find((x) => x.localName === 'f')?.textContent ?? '';
      const fLink = formula.match(/HYPERLINK\(\s*"([^"]+)"/i)?.[1] ?? '';
      const link = (linkByRef.get(cellRef) || fLink).trim();
      // Mesma célula repetida no XML (ou linha repetida): uma cópia vazia nunca apaga a que tem valor
      if (!value.trim() && !raw && row[idx]) return;
      while (row.length < idx) row.push('');
      row[idx] = value.trim();
      if (link) { while (rowLinks.length < idx) rowLinks.push(''); rowLinks[idx] = link; }
      while (rowCells.length < idx) rowCells.push({ ref: `${colName(rowCells.length)}${rowNum}`, type: '(vazia)', raw: '' });
      rowCells[idx] = { ref: cellRef, type, raw };
    });
  });

  // Células mescladas: o valor da célula do canto superior esquerdo vale para todo o intervalo
  byTag(sheetDoc, 'mergeCell').forEach((m) => {
    const [a, b] = (m.getAttribute('ref') ?? '').toUpperCase().split(':');
    if (!a || !b) return;
    const r1 = Number(a.replace(/[A-Z]/g, '')) - 1, r2 = Number(b.replace(/[A-Z]/g, '')) - 1;
    const c1 = colIndex(a), c2 = colIndex(b);
    const v = rows[r1]?.[c1] ?? '';
    if (!v) return;
    for (let r = r1; r <= r2; r++) {
      while (rows.length <= r) { rows.push([]); links.push([]); cells.push([]); }
      const row = rows[r]!;
      for (let c = c1; c <= c2; c++) {
        while (row.length < c) row.push('');
        if (!row[c]) row[c] = v;
      }
    }
  });
  const debug: XlsxDebug = {
    files: zipEntries.map((e) => ({ ...e })),
    sharedStringsName: ssKey || '(não encontrada)',
    sharedStringsBytes: ss ? ss.length : 0,
    sharedStringsCount: shared.length,
    sheetPath,
    cellXml: (r: string) => xmlByRef.get(r.toUpperCase()) ?? '(célula ausente no XML)',
  };
  return { name: sheetName || 'Planilha 1', sheetCount, rows, links, cells, debug };
}

function colName(i: number): string {
  let s = '';
  let n = i + 1;
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
