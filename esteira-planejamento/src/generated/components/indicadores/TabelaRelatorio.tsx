import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { cn } from '@lib/utils';
import { StatusPill } from '@generated/components/ui-bits';
import { type ColRel, type LinhaRel, COLS_REL, celula, ordenarLinhas } from '@generated/lib/relatorioMensal';

/** monday-like table of the month: Projeto | Status | Orçado | Planejado | Saldo | Saldo % — click a header to sort. */
export function TabelaRelatorio({ linhas }: { linhas: LinhaRel[] }) {
  const [sort, setSort] = useState<{ k: ColRel; dir: 'asc' | 'desc' }>({ k: 'projeto', dir: 'asc' });
  const ordenadas = useMemo(() => ordenarLinhas(linhas, sort.k, sort.dir), [linhas, sort]);
  if (!linhas.length) return <p className="py-6 text-center text-sm text-muted-foreground">Nenhum projeto na base Res. Acumulado até este mês.</p>;
  return (
    <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-border">
      <table className="w-full min-w-[760px] border-collapse text-[13px]">
        <thead className="bg-[hsl(var(--surface-2))] text-xs text-muted-foreground">
          <tr>
            {COLS_REL.map((c) => {
              const on = sort.k === c.k;
              const Icone = !on ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
              return (
                <th key={c.k} scope="col" aria-sort={on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className={cn('border-b border-border px-3 py-2 font-medium', c.num ? 'text-right' : 'text-left')}>
                  <button type="button" onClick={() => setSort((s) => ({ k: c.k, dir: s.k === c.k && s.dir === 'asc' ? 'desc' : 'asc' }))}
                    className={cn('inline-flex min-h-11 items-center gap-1 hover:text-foreground md:min-h-6', c.num && 'flex-row-reverse', on && 'text-foreground')}>
                    {c.label}<Icone className="size-3" aria-hidden />
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {ordenadas.map((l) => {
            const neg = (l.saldo ?? 0) < 0;
            return (
              <tr key={l.id} className="border-b border-border last:border-b-0">
                <td className="max-w-[380px] px-3 py-2 text-foreground">{l.projeto}</td>
                <td className="px-3 py-2"><StatusPill label={l.status} /></td>
                {(['orc', 'plan', 'saldo', 'pct'] as const).map((k) => (
                  <td key={k} className={cn('tnum whitespace-nowrap px-3 py-2 text-right',
                    l.marca && (k === 'saldo' || k === 'pct') ? 'text-[11px] uppercase tracking-wide text-muted-foreground' : neg && (k === 'saldo' || k === 'pct') ? 'font-medium text-[hsl(var(--danger))]' : 'text-foreground')}>
                    {celula(l, k)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
