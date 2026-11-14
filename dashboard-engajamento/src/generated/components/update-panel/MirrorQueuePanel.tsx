import { errorText } from '@generated/lib/errorText';
import { useCallback, useEffect, useState } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import { getMirrorQueues } from '@generated/server/mirror';

type Queue = Awaited<ReturnType<typeof getMirrorQueues>>[number];
type Claim = { email?: string; id?: string; name?: string; isAdmin?: boolean } | undefined;

interface Props {
  clientClaim: Claim;
  running: boolean;
  refreshKey: number; // muda quando uma gravação termina
  onResend: (group: string) => void;
}

/** Semanas com o que ficou na Base e ainda não foi confirmado no quadro. Reenvio sem duplicar (localiza por e-mail). */
export function MirrorQueuePanel({ clientClaim, running, refreshKey, onResend }: Props) {
  const [queues, setQueues] = useState<Queue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setQueues((await getMirrorQueues({ data: { clientClaim } })) ?? []);
    } catch (e) {
      console.error('Fila de pendências:', errorText(e));
      setError('Não foi possível ler a fila de pendências.');
    } finally {
      setLoading(false);
    }
  }, [clientClaim]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  if (!loading && !error && queues.length === 0) return null;

  return (
    <section className="bg-card rounded-3xl soft-stack-card p-5 space-y-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Fila do quadro</p>
        <h3 className="text-base font-medium text-foreground">Semanas com pendências para reenviar</h3>
        <p className="text-xs text-muted-foreground">Reenvia só o que falta (itens, checks, último acesso e equipes), localizando cada pessoa por e-mail na semana. Nada é criado em dobro e nenhum check é removido.</p>
      </div>
      {loading && <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Lendo a fila…</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <ul className="divide-y divide-border">
        {queues.map((q) => (
          <li key={q.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{q.group}</p>
              <p className="text-[11px] text-muted-foreground">{q.pendingCount} pessoas com pendência · {q.checksPending} checks · atualizado {new Date(q.updatedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</p>
              {q.lastError && <p className="text-[11px] text-muted-foreground break-words">Último erro: {q.lastError}</p>}
            </div>
            <button type="button" disabled={running} onClick={() => onResend(q.group)}
              className="h-10 px-4 rounded-full bg-[hsl(var(--brand-navy))] text-card text-xs font-medium inline-flex items-center gap-1.5 hover:opacity-90 disabled:opacity-50 shrink-0">
              <RotateCcw className="w-3.5 h-3.5" /> Reenviar ao quadro
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
