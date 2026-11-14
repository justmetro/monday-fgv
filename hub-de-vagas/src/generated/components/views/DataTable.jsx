import { ArrowDown, ArrowUp, AlertTriangle } from 'lucide-react';
import { Cell } from '@generated/components/Pill';
import { cn } from '@lib/utils';

export default function DataTable({ columns, rows, sort, onSort, onRowClick, rowTone, accent, action }) {
  return (
    <div className="overflow-x-auto rounded-md border border-border bg-card" style={accent ? { borderLeft: `3px solid ${accent}` } : undefined}>
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            {columns.map((c) => {
              const active = sort?.key === c.key;
              return (
                <th key={c.key} className="whitespace-nowrap px-3 py-2 text-left font-medium">
                  {onSort ? (
                    <button onClick={() => onSort(c.key)} className={cn('inline-flex items-center gap-1 hover:text-foreground', active && 'text-primary')}>
                      {c.label}{active && (sort.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                    </button>
                  ) : c.label}
                </th>
              );
            })}
            {action && <th className="w-10 px-2 py-2"><span className="sr-only">Ações</span></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const tone = rowTone?.(r);
            return (
              <tr key={r.id} onClick={() => onRowClick(r)}
                className={cn('cursor-pointer border-b border-border last:border-0 hover:bg-accent/40', tone === 'danger' && 'bg-destructive/5', tone === 'warn' && 'bg-[hsl(var(--warning)/0.07)]')}>
                {columns.map((c, i) => (
                  <td key={c.key} className={cn('px-3 py-2 align-middle', i === 0 && 'font-medium')}>
                    {i === 0 ? (
                      <span className={cn('flex items-center gap-1.5', tone === 'danger' && 'text-destructive', tone === 'warn' && 'text-[hsl(var(--warning))]')}>
                        {tone && <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
                        <span className="line-clamp-2">{r[c.key] ?? r.name}</span>
                      </span>
                    ) : <Cell field={c} item={r} />}
                  </td>
                ))}
                {action && <td className="px-2 py-2 align-middle">{action(r)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
