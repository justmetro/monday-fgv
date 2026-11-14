// Exportação da Base em CSV e XLSX, com a mesma estrutura usada na reescrita por arquivo.
import { createSpreadsheet } from '@skills/xlsx-export';
import type { StoredEngagementRow } from '@generated/models';
import { BASE_FILE_COLUMNS, fileStamp, rowToFileCells } from '@generated/lib/baseRows';
import { normText } from '@generated/lib/weekdays';

function slug(s: string): string {
  return normText(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'semana';
}

export function exportFileName(group: string | null, ext: 'csv' | 'xlsx'): string {
  return `base-engajamento_${group ? slug(group) : 'completa'}_${fileStamp()}.${ext}`;
}

function cellsOf(rows: StoredEngagementRow[], statusOf: (group: string) => string): string[][] {
  return rows.map((r) => rowToFileCells(r, statusOf(r.group ?? '')));
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadBaseCsv(rows: StoredEngagementRow[], group: string | null, statusOf: (g: string) => string) {
  const esc = (v: string) => (/[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [BASE_FILE_COLUMNS, ...cellsOf(rows, statusOf)].map((r) => r.map((c) => esc(c ?? '')).join(';'));
  download(new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), exportFileName(group, 'csv'));
}

export async function downloadBaseXlsx(rows: StoredEngagementRow[], group: string | null, statusOf: (g: string) => string) {
  const wb = createSpreadsheet({
    sheetName: 'Base',
    columns: BASE_FILE_COLUMNS,
    rows: cellsOf(rows, statusOf),
    autoFilter: true,
    freezeHeader: true,
    alternateRows: true,
  });
  const buffer = await wb.xlsx.writeBuffer();
  download(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), exportFileName(group, 'xlsx'));
}
