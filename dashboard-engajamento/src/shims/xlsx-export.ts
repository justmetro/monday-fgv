import ExcelJS from 'exceljs';

type Cell = string | number | boolean | Date | null | undefined;
interface SheetOpts { autoFilter?: boolean; freezeHeader?: boolean; alternateRows?: boolean }

export function addSheet(wb: ExcelJS.Workbook, name: string, columns: string[], rows: Cell[][], opts: SheetOpts = {}) {
  const ws = wb.addWorksheet(name.slice(0, 31));
  ws.addRow(columns);
  rows.forEach((r) => ws.addRow(r.map((c) => (c === undefined ? null : c))));
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
  if (opts.freezeHeader) ws.views = [{ state: 'frozen', ySplit: 1 }];
  if (opts.autoFilter && columns.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  if (opts.alternateRows) {
    for (let i = 2; i <= rows.length + 1; i++) {
      if (i % 2 === 1) ws.getRow(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    }
  }
  ws.columns.forEach((col, i) => {
    let w = String(columns[i] ?? '').length;
    rows.slice(0, 500).forEach((r) => { w = Math.max(w, String(r[i] ?? '').length); });
    col.width = Math.min(60, Math.max(10, w + 2));
  });
  return ws;
}

export function createSpreadsheet(o: { sheetName: string; columns: string[]; rows: Cell[][] } & SheetOpts) {
  const wb = new ExcelJS.Workbook();
  addSheet(wb, o.sheetName, o.columns, o.rows, o);
  return wb;
}
