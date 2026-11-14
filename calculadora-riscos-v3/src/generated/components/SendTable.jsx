import { Loader2, Link2Off } from 'lucide-react';
import { Checkbox } from '@components/ui/checkbox';
import { Skeleton } from '@components/ui/skeleton';
import { StatusBadge } from '@generated/components/StatusBadge';
import { linkBoardId, boardHref } from '@generated/hooks/useSendMeta';
import { cn } from '@lib/utils';

const SKELETON_KEYS = ['a', 'b', 'c', 'd', 'e', 'f'];

function Destino({ item, meta, pending }) {
  const bid = linkBoardId(item.linkDoPlanejamento);
  if (!bid) {
    return (
      <span className="inline-flex items-center gap-1.5 font-medium text-destructive">
        <Link2Off className="size-3.5" aria-hidden /> Sem link
      </span>
    );
  }
  if (pending && !meta) return <Skeleton className="h-4 w-32" />;
  const fallback = item.linkDoPlanejamento?.label || `Quadro ${bid}`;
  const name = meta?.destName || fallback;
  const noAccess = meta?.destChecked && !meta?.destName;
  return (
    <span className="block min-w-0">
      <a
        href={boardHref(item.linkDoPlanejamento) ?? undefined}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="break-words text-foreground underline-offset-2 hover:underline"
      >
        {name}
      </a>
      {noAccess && <span className="block text-xs text-destructive">Quadro não encontrado ou sem acesso</span>}
    </span>
  );
}

const APLIC_ORDER = ['Identificado', 'Em avaliação', 'Aplicável', 'Não aplicável'];

function Riscos({ risks }) {
  if (!risks) return <span className="text-muted-foreground" title="Não foi possível contar os riscos">-</span>;
  const labels = [
    ...APLIC_ORDER.filter((l) => risks.by[l]),
    ...Object.keys(risks.by).filter((l) => !APLIC_ORDER.includes(l)).sort(),
  ];
  return (
    <span className="block min-w-0">
      <span className="text-base tabular-nums text-foreground">{risks.total}</span>
      <span className="text-xs text-muted-foreground"> {risks.total === 1 ? 'risco' : 'riscos'}</span>
      {labels.length > 0 && (
        <span className="mt-0.5 block break-words text-xs leading-snug text-muted-foreground">
          {labels.map((l) => `${risks.by[l]} ${l}`).join(' · ')}
        </span>
      )}
    </span>
  );
}

/** Tabela de envio: destino lido do link, total de riscos no 09.4 e status do envio. */
export function SendTable({ items, loading, refetching, selected, onToggle, onTogglePage, disabled, meta, pending }) {
  const linkable = items.filter((i) => linkBoardId(i.linkDoPlanejamento)).map((i) => i.id);
  const selectedOnPage = linkable.filter((id) => selected.has(id)).length;
  const headerState = selectedOnPage === 0 ? false : selectedOnPage === linkable.length ? true : 'indeterminate';

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th scope="col" className="w-12 px-4 py-3">
              <Checkbox
                aria-label="Selecionar todos os projetos visíveis com link"
                checked={headerState}
                disabled={disabled || loading || !linkable.length}
                onCheckedChange={(v) => onTogglePage(linkable, v === true)}
              />
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              <span className="inline-flex items-center gap-2">
                Projeto
                {refetching && <Loader2 className="size-3.5 animate-spin" aria-label="Atualizando" />}
              </span>
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">Destino</th>
            <th scope="col" className="py-2 pr-4 font-medium">Riscos no 09.4</th>
            <th scope="col" className="py-2 pr-4 font-medium">Envio</th>
          </tr>
        </thead>
        <tbody className={cn('transition-opacity duration-200', refetching && 'opacity-50')}>
          {loading && SKELETON_KEYS.map((k) => (
            <tr key={k} className="border-b border-border">
              <td className="px-4 py-2"><Skeleton className="size-4 rounded-[4px]" /></td>
              <td className="py-2 pr-4"><Skeleton className="h-4 w-3/4" /></td>
              <td className="py-2 pr-4"><Skeleton className="h-4 w-32" /></td>
              <td className="py-2 pr-4"><Skeleton className="h-4 w-24" /></td>
              <td className="py-2 pr-4"><Skeleton className="h-6 w-20 rounded-[3px]" /></td>
            </tr>
          ))}
          {!loading && items.length === 0 && (
            <tr className="border-b border-border">
              <td colSpan={5} className="px-4 py-10 text-center">
                <p className="text-sm text-foreground">Nenhum projeto encontrado</p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Ajuste a busca ou o filtro de envio.</p>
              </td>
            </tr>
          )}
          {!loading && items.map((it) => {
            const hasLink = Boolean(linkBoardId(it.linkDoPlanejamento));
            const canSelect = hasLink && !disabled;
            const isSel = selected.has(it.id);
            const m = meta.get(it.id);
            const isPending = pending.has(it.id);
            return (
              <tr
                key={it.id}
                onClick={() => canSelect && onToggle(it.id)}
                className={cn(
                  'border-b border-border last:border-b-0 transition-colors duration-150',
                  canSelect ? 'cursor-pointer hover:bg-muted' : 'cursor-default',
                  isSel && 'bg-[hsl(var(--primary)/0.08)]'
                )}
              >
                <td className="px-4 py-2 align-top" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    aria-label={hasLink ? `Selecionar ${it.name}` : `${it.name}: sem link do planejamento`}
                    checked={isSel}
                    disabled={!canSelect}
                    onCheckedChange={() => onToggle(it.id)}
                  />
                </td>
                <td className="min-w-0 py-2 pr-4 align-top">
                  <span className="break-words leading-snug text-foreground">{it.name}</span>
                </td>
                <td className="min-w-0 max-w-[240px] py-2 pr-4 align-top">
                  <Destino item={it} meta={m} pending={isPending} />
                </td>
                <td className="min-w-0 max-w-[260px] py-2 pr-4 align-top">
                  {isPending && !m ? <Skeleton className="h-4 w-24" /> : <Riscos risks={m?.risks} />}
                </td>
                <td className="py-2 pr-4 align-top">
                  <StatusBadge status={it.envioAoPlanejamento} emptyLabel="Não enviado" />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
