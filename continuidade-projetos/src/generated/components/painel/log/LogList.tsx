import { useState } from 'react';
import { ArrowRight, Loader2, Undo2 } from 'lucide-react';
import { Chip } from '@generated/components/painel/Chips';
import { CAMPOS, fmtValor, type LogEntry } from '@generated/lib/logCampos';

const fmtQuando = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export function LogList({ entries, showProject, onOpenProject, onRevert, busyId, revertidos, conflito, onForcar, onCancelarConflito }: {
  entries: LogEntry[]; showProject?: boolean; onOpenProject?: (id: string) => void;
  onRevert: (e: LogEntry) => void; busyId: string | null; revertidos: Set<string>;
  conflito?: { entry: LogEntry; campos: string[] } | null; onForcar?: () => void; onCancelarConflito?: () => void;
}) {
  const [confirmar, setConfirmar] = useState<string | null>(null);
  return (
    <ul className="divide-y divide-border">
      {entries.map((e) => {
        const revertido = revertidos.has(e.id);
        const busy = busyId === e.id;
        return (
          <li key={e.id} className="flex flex-col gap-2 py-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Chip tone={e.acao === 'reversao' ? 'warning' : 'info'}>{e.acao === 'reversao' ? 'Reversão' : 'Alteração'}</Chip>
              {e.origem === 'app' && <Chip tone="neutral" title="Edição guardada só no app; o monday não foi alterado">Só no app</Chip>}
              <span className="text-sm font-medium text-foreground">{e.user}</span>
              <span className="tnum text-xs text-muted-foreground">{fmtQuando(e.at)}</span>
              <span className="ml-auto flex items-center gap-1.5">
                {revertido ? (
                  <span className="text-xs text-muted-foreground">Revertido</span>
                ) : confirmar === e.id ? (
                  <>
                    <span className="text-xs text-muted-foreground">{e.origem === 'app' ? 'Restaurar valores anteriores no app?' : 'Regravar valores anteriores?'}</span>
                    <button type="button" onClick={() => { setConfirmar(null); onRevert(e); }} className="min-h-8 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Confirmar</button>
                    <button type="button" onClick={() => setConfirmar(null)} className="min-h-8 rounded-md px-2 text-xs text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Cancelar</button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={busy || busyId !== null}
                    onClick={() => setConfirmar(e.id)}
                    className="inline-flex min-h-8 items-center gap-1 rounded-md border border-border bg-card px-2.5 text-xs text-foreground hover:bg-accent disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Undo2 className="size-3.5" aria-hidden />} Reverter
                  </button>
                )}
              </span>
            </div>
            {conflito?.entry.id === e.id && (
              <div role="alert" className="flex flex-wrap items-center gap-2 rounded-md bg-[hsl(var(--warning-soft))] px-3 py-2 text-xs text-[hsl(var(--warning-ink))]">
                <span className="min-w-0 flex-1 break-words">Estes campos foram alterados depois: {conflito.campos.join(', ')}. Reverter mesmo assim?</span>
                <button type="button" onClick={onForcar} className="min-h-8 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Reverter mesmo assim</button>
                <button type="button" onClick={onCancelarConflito} className="min-h-8 rounded-md px-2 text-xs text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Cancelar</button>
              </div>
            )}
            {showProject && (
              onOpenProject ? (
                <button type="button" onClick={() => onOpenProject(e.projectId)} className="w-fit max-w-full truncate text-left text-sm text-primary hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {e.projectName}
                </button>
              ) : <span className="truncate text-sm text-foreground">{e.projectName}</span>
            )}
            <ul className="flex flex-col gap-1">
              {e.changes.map((c) => (
                <li key={`${c.campo}-${c.produtoId ?? ''}`} className="grid grid-cols-1 gap-x-2 text-xs sm:grid-cols-[180px_minmax(0,1fr)]">
                  <span className="min-w-0 break-words text-muted-foreground">
                    {CAMPOS[c.campo].label}{c.produtoNome ? ` · ${c.produtoNome}` : ''}
                  </span>
                  <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-foreground">
                    <span className="break-words text-muted-foreground line-through decoration-muted-foreground/50">{fmtValor(c.campo, c.de)}</span>
                    <ArrowRight className="size-3 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="break-words">{fmtValor(c.campo, c.para)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}
