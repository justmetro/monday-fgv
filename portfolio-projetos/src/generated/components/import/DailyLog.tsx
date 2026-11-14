import { useState } from 'react';
import { CalendarClock, ChevronDown, ChevronRight } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@components/ui/sheet';
import { Skeleton } from '@components/ui/skeleton';
import { listDailyRuns } from '@generated/server/daily';
import { fmtDateTime } from '@generated/lib/format';
import { cn } from '@lib/utils';

type Run = Awaited<ReturnType<typeof listDailyRuns>>[number];
const dBR = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

/** Botão + painel com o log das últimas execuções da rotina diária. */
export function DailyLog() {
  const [open, setOpen] = useState(false);
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exp, setExp] = useState<string | null>(null);
  const load = async () => {
    setError(null);
    try { setRuns((await listDailyRuns({ data: {} })) ?? []); }
    catch (e) { console.error(e); setError('Não foi possível carregar o log da rotina diária.'); }
  };
  return (
    <>
      <button onClick={() => { setOpen(true); void load(); }} className="flex min-h-10 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm">
        <CalendarClock className="size-4" aria-hidden />Rotina diária · log
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader className="border-b border-border">
            <SheetTitle>Atualização diária dos projetos</SheetTitle>
            <SheetDescription>Todo dia útil, a partir de 00:00 (Brasília), a primeira sessão aberta do aplicativo atualiza todos os projetos, um por vez.</SheetDescription>
          </SheetHeader>
          <div className="space-y-2 px-4 pb-8">
            {error && <p className="text-sm text-destructive">{error}</p>}
            {!runs && !error && <><Skeleton className="h-16" /><Skeleton className="h-16" /></>}
            {runs?.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma execução registrada ainda.</p>}
            {runs?.map((r) => {
              const fails = r.results.filter((x) => !x.ok).length;
              const isOpen = exp === r.id;
              return (
                <div key={r.id} className="rounded-md border border-border">
                  <button onClick={() => setExp(isOpen ? null : r.id)} className="flex w-full items-start gap-2 p-3 text-left">
                    {isOpen ? <ChevronDown className="mt-0.5 size-4 shrink-0" /> : <ChevronRight className="mt-0.5 size-4 shrink-0" />}
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2 font-medium">{dBR(r.date)}
                        <span className={cn('rounded-full px-2 py-0.5 text-[11px]', r.status === 'running' ? 'bg-[hsl(var(--warn-soft))] text-[hsl(var(--warn))]' : fails ? 'bg-[hsl(var(--bad-soft))] text-destructive' : 'bg-[hsl(var(--ok-soft))] text-[hsl(var(--ok))]')}>
                          {r.status === 'running' ? 'Em andamento / interrompida' : fails ? `${fails} falha(s)` : 'Concluída'}
                        </span>
                      </span>
                      <span className="block text-xs text-muted-foreground">{r.results.length} de {r.total} projeto(s) · início {fmtDateTime(r.startedAt)}{r.finishedAt ? ` · fim ${fmtDateTime(r.finishedAt)}` : ''}{r.byName ? ` · sessão de ${r.byName}` : ''}</span>
                    </span>
                  </button>
                  {isOpen && (
                    <ul className="divide-y divide-border border-t border-border text-sm">
                      {r.results.map((x) => (
                        <li key={x.boardId} className="space-y-0.5 p-3">
                          <p className="flex items-center gap-2"><span className={cn('size-2 shrink-0 rounded-full', x.ok ? 'bg-[hsl(var(--ok))]' : 'bg-destructive')} /><span className="font-medium">{x.name}</span><span className="ml-auto text-xs text-muted-foreground">{fmtDateTime(x.at)}</span></p>
                          <p className="text-xs text-muted-foreground">{x.summary}</p>
                          {x.exportSummary && <p className={cn('text-xs', x.exportOk ? 'text-muted-foreground' : 'text-destructive')}>Exportação para a Monday: {x.exportSummary}</p>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
