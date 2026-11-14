import { useMemo, useState } from 'react';
import { History } from 'lucide-react';
import { Skeleton } from '@components/ui/skeleton';
import { LogList } from '@generated/components/painel/log/LogList';
import { useReverter } from '@generated/components/painel/log/useReverter';
import type { PainelData } from '@generated/hooks/usePainelData';

/** Histórico de alterações. Com projectId mostra só o projeto (drawer); sem, mostra todos (visão geral). */
export function HistoricoLista({ data, projectId, onOpenProject, inicial = 10 }: {
  data: PainelData; projectId?: string; onOpenProject?: (id: string) => void; inicial?: number;
}) {
  const { reverter, busyId, conflito, forcar, cancelarConflito } = useReverter(data);
  const [limite, setLimite] = useState(inicial);
  const entries = useMemo(() => (projectId ? data.logs.filter((l) => l.projectId === projectId) : data.logs), [data.logs, projectId]);
  const revertidos = useMemo(() => new Set(data.logs.map((l) => l.ref).filter((x): x is string => !!x)), [data.logs]);

  if (data.logsLoading && data.logs.length === 0) {
    return <div className="flex flex-col gap-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  }
  if (data.logsErro) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md bg-[hsl(var(--danger-soft))] px-4 py-3 text-sm text-[hsl(var(--danger-ink))]">
        Não foi possível carregar o histórico.
        <button type="button" onClick={data.retryLogs} className="min-h-9 rounded-md px-3 font-medium hover:underline">Tentar de novo</button>
      </div>
    );
  }
  if (entries.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <History className="size-4" aria-hidden /> Nenhuma alteração registrada pelo painel{projectId ? ' neste projeto' : ''}.
      </p>
    );
  }
  return (
    <div>
      <LogList entries={entries.slice(0, limite)} showProject={!projectId} onOpenProject={onOpenProject} onRevert={(e) => void reverter(e)} busyId={busyId} revertidos={revertidos} conflito={conflito} onForcar={forcar} onCancelarConflito={cancelarConflito} />
      {entries.length > limite && (
        <button type="button" onClick={() => setLimite((n) => n + 20)} className="mt-1 min-h-9 rounded-md px-2 text-sm text-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Mostrar mais ({entries.length - limite})
        </button>
      )}
    </div>
  );
}

export function HistoricoCard({ data, onOpen }: { data: PainelData; onOpen: (id: string) => void }) {
  return (
    <section className="soft-stack rounded-xl bg-card" aria-labelledby="hist-titulo">
      <div className="border-b border-border px-5 py-4">
        <h3 id="hist-titulo" className="text-base font-semibold tracking-[-0.01em] text-foreground">Histórico de alterações</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Salvamentos feitos pelo painel, com valor anterior e novo. Registrado nas atualizações do quadro Continuidade – Decisões.</p>
      </div>
      <div className="px-5 py-2">
        <HistoricoLista data={data} onOpenProject={onOpen} />
      </div>
    </section>
  );
}
