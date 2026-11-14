import { useEffect, useState } from 'react';
import { Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { Skeleton } from '@components/ui/skeleton';
import { useOrphans } from '@generated/hooks/useOrphans';
import { OrphanDeleteConsole } from '@generated/components/OrphanDeleteConsole';
import { cn } from '@lib/utils';

const PREVIEW = 200;
const SK = ['a', 'b', 'c', 'd', 'e'];

/** Aba "Limpar órfãos": riscos do 09.4 sem projeto vinculado. */
export function OrphansTab({ onBusyChange }) {
  const { list, del, load, deleteAll, clearResult } = useOrphans();
  const [confirmOpen, setConfirmOpen] = useState(false);
  useEffect(() => { onBusyChange?.(del.running); }, [del.running, onBusyChange]);

  const count = list.items.length;
  const shown = list.items.slice(0, PREVIEW);

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
      <section className="min-w-0 overflow-hidden rounded-[6px] border border-border bg-card">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border p-4 text-foreground">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">09.4 Riscos do Projeto · sem projeto vinculado</p>
            <p className="mt-1 flex items-baseline gap-2">
              {list.loading
                ? <Skeleton className="h-12 w-20 bg-[hsl(var(--ink-soft))]" />
                : <span className="text-[36px] font-light leading-none tabular-nums tracking-[-0.02em]">{count}</span>}
              <span className="text-sm text-muted-foreground">{count === 1 ? 'órfão' : 'órfãos'}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={load} disabled={list.loading || list.refetching || del.running}
              className="inline-flex min-h-9 items-center gap-2 rounded-[5px] border border-border px-3.5 text-[13px] hover:bg-[hsl(var(--ink-soft))] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-[hsl(var(--paper))]">
              <RefreshCw className={cn('size-4', list.refetching && 'animate-spin')} aria-hidden /> Atualizar
            </button>
            <button type="button" onClick={() => setConfirmOpen(true)} disabled={count === 0 || list.loading || del.running}
              className="inline-flex min-h-9 items-center gap-2 rounded-[5px] border border-[hsl(var(--err)/0.4)] bg-[hsl(var(--err)/0.15)] px-3.5 text-[13px] font-medium text-[hsl(var(--err))] hover:bg-[hsl(var(--err)/0.25)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-[hsl(var(--paper))]">
              {del.running ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />}
              Apagar órfãos
            </button>
          </div>
        </div>

        {list.error && <output className="block border-b border-border px-4 py-3 text-sm text-destructive">{list.error}</output>}

        <div className={cn('transition-opacity duration-200', list.refetching && 'opacity-60')}>
          {list.loading ? (
            <ul className="divide-y divide-border">
              {SK.map((k) => <li key={k} className="px-4 py-3"><Skeleton className="h-4 w-2/3" /></li>)}
            </ul>
          ) : count === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-base text-foreground">Nenhum risco órfão no 09.4.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Órfãos aparecem quando um item do 09.4 fica sem projeto em “rel_projeto”, por exemplo depois de apagar um projeto do 09.1.
              </p>
            </div>
          ) : (
            <ul className="max-h-[60dvh] divide-y divide-border overflow-y-auto">
              {shown.map((it) => (
                <li key={it.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-4 py-2.5 text-sm">
                  <span className="min-w-0 flex-1 break-words text-foreground">{it.name || '(sem nome)'}</span>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{it.id}</span>
                </li>
              ))}
              {count > PREVIEW && (
                <li className="px-4 py-3 text-sm text-muted-foreground">
                  e mais {count - PREVIEW} itens (todos serão incluídos na exclusão)
                </li>
              )}
            </ul>
          )}
        </div>
      </section>

      <aside className="min-w-0 lg:sticky lg:top-[64px] lg:self-start">
        <OrphanDeleteConsole
          del={del}
          count={count}
          confirmOpen={confirmOpen}
          setConfirmOpen={setConfirmOpen}
          onConfirm={() => { setConfirmOpen(false); deleteAll(); }}
          onClear={clearResult}
        />
      </aside>
    </div>
  );
}
