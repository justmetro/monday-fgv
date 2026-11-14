import { Loader2 } from 'lucide-react';
import { Checkbox } from '@components/ui/checkbox';
import { Skeleton } from '@components/ui/skeleton';
import { StatusBadge } from '@generated/components/StatusBadge';
import { cn } from '@lib/utils';

const fmtDate = (d) => {
  if (!d) return '-';
  const date = d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
};

function SkeletonRows() {
  return Array.from({ length: 6 }).map((_, i) => (
    <tr key={i} className="border-b border-border">
      <td className="px-4 py-2"><Skeleton className="size-4 rounded-[4px]" /></td>
      <td className="py-2 pr-4"><Skeleton className="h-4 w-3/4" /></td>
      <td className="py-2 pr-4"><Skeleton className="h-6 w-24 rounded-[3px]" /></td>
      <td className="py-2 pr-4"><Skeleton className="ml-auto h-4 w-8" /></td>
      <td className="hidden py-2 pr-4 sm:table-cell"><Skeleton className="h-4 w-20" /></td>
    </tr>
  ));
}

/** Tabela dos projetos do 09.1 com seleção por checkbox. */
export function ProjectTable({ items, loading, refetching, selected, onToggle, onTogglePage, disabled, emptyHint }) {
  const pageIds = items.map((i) => i.id);
  const selectedOnPage = pageIds.filter((id) => selected.has(id)).length;
  const headerState = selectedOnPage === 0 ? false : selectedOnPage === pageIds.length ? true : 'indeterminate';

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th scope="col" className="w-12 px-4 py-3">
              <Checkbox
                aria-label="Selecionar todos os projetos visíveis"
                checked={headerState}
                disabled={disabled || loading || !items.length}
                onCheckedChange={(v) => onTogglePage(pageIds, v === true)}
              />
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              <span className="inline-flex items-center gap-2">
                Projeto
                {refetching && <Loader2 className="size-3.5 animate-spin" aria-label="Atualizando" />}
              </span>
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">Calculadora</th>
            <th scope="col" className="py-2 pr-4 text-right font-medium">Riscos</th>
            <th scope="col" className="hidden py-2 pr-4 font-medium sm:table-cell">Última execução</th>
          </tr>
        </thead>
        <tbody className={cn('transition-opacity duration-200', refetching && 'opacity-50')}>
          {loading && <SkeletonRows />}
          {!loading && items.length === 0 && (
            <tr className="border-b border-border">
              <td colSpan={5} className="px-4 py-10 text-center">
                <p className="text-sm text-foreground">Nenhum projeto encontrado</p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{emptyHint}</p>
              </td>
            </tr>
          )}
          {!loading && items.map((it) => {
            const isSel = selected.has(it.id);
            return (
              <tr
                key={it.id}
                onClick={() => !disabled && onToggle(it.id)}
                className={cn(
                  'border-b border-border last:border-b-0 transition-colors duration-150',
                  disabled ? 'cursor-default' : 'cursor-pointer hover:bg-muted',
                  isSel && 'bg-[hsl(var(--primary)/0.08)]'
                )}
              >
                <td className="px-4 py-2 align-top" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    aria-label={`Selecionar ${it.name}`}
                    checked={isSel}
                    disabled={disabled}
                    onCheckedChange={() => onToggle(it.id)}
                  />
                </td>
                <td className="min-w-0 py-2 pr-4 align-top">
                  <span className="break-words leading-snug text-foreground">{it.name}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground sm:hidden">
                    Última execução: {fmtDate(it.dataDaLtimaExecuo)}
                  </span>
                </td>
                <td className="py-2 pr-4 align-top"><StatusBadge status={it.calculadora} /></td>
                <td className="py-2 pr-4 text-right align-top tabular-nums text-foreground">{it.riscosGerados ?? '-'}</td>
                <td className="hidden whitespace-nowrap py-2 pr-4 align-top tabular-nums text-muted-foreground sm:table-cell">
                  {fmtDate(it.dataDaLtimaExecuo)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
