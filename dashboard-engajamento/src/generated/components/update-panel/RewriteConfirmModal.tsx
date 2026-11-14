import { AlertTriangle, Loader2 } from 'lucide-react';

export interface ExistingWeek {
  people: number;
  checks: number;
  boardItems: number | null;
  inBoard: boolean;
  validated: boolean;
}

interface Props {
  group: string;
  existing: ExistingWeek;
  after: { people: number; checks: number };
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Confirmação própria (nunca window.confirm) para reescrever uma semana que já existe. */
export function RewriteConfirmModal({ group, existing, after, busy, onCancel, onConfirm }: Props) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Confirmar reescrita da semana">
      <div className="w-full max-w-lg rounded-3xl bg-card border border-border p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-2xl bg-destructive/10 text-destructive grid place-items-center shrink-0"><AlertTriangle className="w-5 h-5" /></span>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-foreground break-words">Reescrever “{group}”?</h3>
            <p className="text-xs text-muted-foreground mt-1">
              A semana será apagada da Base{existing.inBoard ? ' e o grupo dela será apagado no quadro do monday (com os itens)' : ''} e gravada de novo a partir do arquivo. Nenhuma outra semana é alterada.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-2xl border border-border p-3 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Hoje</p>
            <p className="text-foreground">{existing.people} pessoas na Base</p>
            <p className="text-foreground">{existing.checks} checks na Base</p>
            <p className="text-foreground">{existing.inBoard ? `${existing.boardItems ?? '?'} itens no grupo do quadro` : 'Sem grupo no quadro'}</p>
          </div>
          <div className="rounded-2xl border border-border bg-muted/40 p-3 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Depois (arquivo)</p>
            <p className="text-foreground">{after.people} pessoas</p>
            <p className="text-foreground">{after.checks} checks</p>
            <p className="text-foreground">{after.people} itens no quadro</p>
          </div>
        </div>
        {existing.validated ? <p className="text-xs text-muted-foreground">A semana está validada. A validação continua como está; a sua confirmação aqui basta.</p> : null}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className="h-11 px-4 rounded-full border border-border text-xs hover:bg-muted disabled:opacity-50">Cancelar</button>
          <button type="button" onClick={onConfirm} disabled={busy} className="h-11 px-5 rounded-full bg-destructive text-card text-xs font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center justify-center gap-2">
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Apagar e reescrever
          </button>
        </div>
      </div>
    </div>
  );
}
