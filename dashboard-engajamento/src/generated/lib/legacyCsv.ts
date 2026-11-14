// CSV (UTF-8) da Base antiga, lido com o mesmo leitor de CSV do envio normal e devolvido
// no mesmo formato do leitor de XLSX, para seguir exatamente as mesmas regras.
import { parseCsvRfc4180 } from './csvParser';
import type { XlsxCellInfo, XlsxDebug } from './xlsxReader';

/** Separador pelo cabeçalho (primeira linha, fora de aspas). */
function headerSeparator(text: string): ',' | ';' {
  let commas = 0, semis = 0, quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') quoted = !quoted;
    else if (!quoted && (ch === '\n' || ch === '\r')) break;
    else if (!quoted && ch === ',') commas++;
    else if (!quoted && ch === ';') semis++;
  }
  return semis > commas ? ';' : ',';
}

export async function readCsvAsSheet(file: File): Promise<{ name: string; sheetCount: number; rows: string[][]; links: string[][]; cells: XlsxCellInfo[][]; debug: XlsxDebug }> {
  const text = new TextDecoder('utf-8').decode(await file.arrayBuffer()).replace(/^\uFEFF/, '');
  const parsed = parseCsvRfc4180(text, headerSeparator(text));
  const rows = [parsed.headers, ...parsed.rows].map((r) => r.map((c) => (c ?? '').trim()));
  const cells = rows.map((r, ri) => r.map((c, ci) => ({ ref: `${String.fromCharCode(65 + (ci % 26))}${ri + 1}`, type: 'csv', raw: c })));
  return {
    name: file.name, sheetCount: 1, rows, links: [], cells,
    debug: { files: [], sharedStringsName: '(CSV)', sharedStringsBytes: 0, sharedStringsCount: 0, sheetPath: file.name, cellXml: () => '(CSV não tem XML)' },
  };
}
