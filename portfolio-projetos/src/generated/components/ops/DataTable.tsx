import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronRight, Columns3, Download } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@components/ui/popover';
import { Checkbox } from '@components/ui/checkbox';
import { UNAVAILABLE, UNMAPPED } from '@generated/lib/format';
import { cn } from '@lib/utils';

type Rec = { unavailable: string[]; unmapped: string[] };
export type Col<T> = {
  id: string; label: string;
  /** Valor para ordenação e CSV. */
  value: (r: T) => string | number | null;
  render?: (r: T) => ReactNode;
  /** Campo lógico: mostra "indisponível"/"não mapeado" quando for o caso. */
  field?: string;
  hidden?: boolean; mono?: boolean; className?: string;
};

function cellState<T>(c: Col<T>, r: T): 'unmapped' | 'unavailable' | null {
  if (!c.field) return null;
  const rec = r as unknown as Rec;
  if (rec.unmapped?.includes(c.field)) return 'unmapped';
  if (rec.unavailable?.includes(c.field)) return 'unavailable';
  return null;
}

function toCsv<T>(cols: Col<T>[], rows: T[]): string {
  const esc = (v: unknown) => { const s = v == null ? '' : String(v); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const lines = [cols.map((c) => esc(c.label)).join(';')];
  rows.forEach((r) => lines.push(cols.map((c) => { const st = cellState(c, r); return esc(st === 'unmapped' ? UNMAPPED : st === 'unavailable' ? UNAVAILABLE : typeof c.value(r) === 'number' ? String(c.value(r)).replace('.', ',') : c.value(r)); }).join(';')));
  return `\uFEFF${lines.join('\n')}`;
}

const PAGE = 150;

export function DataTable<T>({ cols, rows, rowKey, expand, fileName, empty }: {
  cols: Col<T>[]; rows: T[]; rowKey: (r: T) => string; expand?: (r: T) => ReactNode | null; fileName: string; empty: string;
}) {
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(cols.filter((c) => c.hidden).map((c) => c.id)));
  const [sort, setSort] = useState<{ id: string; dir: 1 | -1 } | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState(PAGE);
  const vis = cols.filter((c) => !hidden.has(c.id));
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const c = cols.find((x) => x.id === sort.id);
    if (!c) return rows;
    return [...rows].sort((a, b) => {
      const x = c.value(a); const y = c.value(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'pt-BR', { numeric: true })) * sort.dir;
    });
  }, [rows, sort, cols]);

  const exportCsv = () => {
    const blob = new Blob([toCsv(vis, sorted)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${fileName}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="min-w-0 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground"><span className="font-mono text-foreground">{rows.length}</span> registro(s)</p>
        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild><button className="flex min-h-10 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm"><Columns3 className="size-4" aria-hidden />Colunas</button></PopoverTrigger>
            <PopoverContent align="end" className="max-h-80 w-64 overflow-y-auto p-1">
              {cols.map((c) => (
                <button key={c.id} onClick={() => setHidden((h) => { const n = new Set(h); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; })} className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-muted">
                  <Checkbox checked={!hidden.has(c.id)} />{c.label}
                </button>
              ))}
            </PopoverContent>
          </Popover>
          <button onClick={exportCsv} disabled={rows.length === 0} className="flex min-h-10 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm disabled:opacity-50"><Download className="size-4" aria-hidden />Exportar CSV</button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              {expand && <th className="w-10" aria-label="Expandir" />}
              {vis.map((c) => (
                <th key={c.id} className="whitespace-nowrap px-3 py-2 font-medium">
                  <button onClick={() => setSort((s) => (s?.id === c.id ? (s.dir === 1 ? { id: c.id, dir: -1 } : null) : { id: c.id, dir: 1 }))} className="inline-flex min-h-8 items-center gap-1 hover:text-foreground">
                    {c.label}{sort?.id === c.id && (sort.dir === 1 ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.length === 0 && <tr><td colSpan={vis.length + 1} className="p-6 text-center text-muted-foreground">{empty}</td></tr>}
            {sorted.slice(0, limit).map((r) => {
              const key = rowKey(r);
              const sub = expand?.(r) ?? null;
              const isOpen = open.has(key);
              return (
                <Fragment key={key}>
                  <tr className="align-top hover:bg-muted/40">
                    {expand && (
                      <td className="px-1 py-1">
                        {sub && <button aria-label={isOpen ? 'Recolher' : 'Expandir'} aria-expanded={isOpen} onClick={() => setOpen((o) => { const n = new Set(o); if (n.has(key)) n.delete(key); else n.add(key); return n; })} className="flex size-9 items-center justify-center rounded hover:bg-muted"><ChevronRight className={cn('size-4 transition-transform', isOpen && 'rotate-90')} aria-hidden /></button>}
                      </td>
                    )}
                    {vis.map((c) => {
                      const st = cellState(c, r);
                      return (
                        <td key={c.id} className={cn('max-w-72 px-3 py-2', c.mono && 'font-mono tabular-nums', c.className)}>
                          {st ? <span className="text-xs italic text-[hsl(var(--warn))]">{st === 'unmapped' ? UNMAPPED : UNAVAILABLE}</span> : c.render ? c.render(r) : <span className="line-clamp-2">{c.value(r) ?? <span className="text-muted-foreground">—</span>}</span>}
                        </td>
                      );
                    })}
                  </tr>
                  {isOpen && sub && <tr className="bg-muted/30"><td /><td colSpan={vis.length} className="px-3 py-2">{sub}</td></tr>}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {sorted.length > limit && (
        <button onClick={() => setLimit((l) => l + PAGE)} className="min-h-10 w-full rounded-md border border-border bg-card text-sm hover:bg-muted">Mostrar mais ({sorted.length - limit} restantes)</button>
      )}
    </div>
  );
}

/** Indicação visual das sinalizações gravadas na sincronização. */
export function Flags({ list }: { list: string[] }) {
  if (list.length === 0) return <span className="text-muted-foreground">—</span>;
  return <span className="flex flex-wrap gap-1">{list.map((f) => <span key={f} className="rounded-sm bg-[hsl(var(--warn-soft))] px-1.5 py-0.5 text-[11px] text-[hsl(var(--warn))]">{f}</span>)}</span>;
}
