import { Loader2, CircleX } from 'lucide-react';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription,
  AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@components/ui/alert-dialog';
import { cn } from '@lib/utils';

const SEGS = ['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10', 's11', 's12', 's13', 's14', 's15', 's16', 's17', 's18', 's19'];

function Num({ label, value, signal }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-[hsl(var(--paper-dim))]">{label}</dt>
      <dd className={cn('text-[28px] font-light leading-tight tabular-nums tracking-[-0.02em]', signal && value > 0 ? 'text-[hsl(var(--err))]' : 'text-[hsl(var(--paper))]')}>{value}</dd>
    </div>
  );
}

/** Painel escuro: confirmação, progresso da exclusão e resultado final. */
export function OrphanDeleteConsole({ del, count, confirmOpen, setConfirmOpen, onConfirm, onClear }) {
  const started = del.running || del.finished;
  const progress = del.total ? del.done / del.total : 0;
  const filled = Math.floor(progress * SEGS.length);

  return (
    <section aria-label="Exclusão de órfãos" className="rounded-[6px] border border-border bg-[hsl(var(--ink))] p-4 text-[hsl(var(--paper))]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[18px] font-medium">Exclusão</h2>
        {del.finished && !del.running && (
          <button type="button" onClick={onClear}
            className="min-h-9 rounded-[5px] border border-[hsl(var(--ink-line))] px-3.5 text-sm hover:bg-[hsl(var(--ink-soft))] focus-visible:outline-2 focus-visible:outline-[hsl(var(--paper))]">
            Limpar
          </button>
        )}
      </div>

      {!started && (
        <div className="space-y-3 text-sm text-[hsl(var(--paper-dim))]">
          <p className="text-[hsl(var(--paper))]">Revise a lista e clique em <strong className="font-medium">Apagar órfãos</strong>.</p>
          <p>Logo após a confirmação a lista é relida uma vez: itens que ganharam um projeto nesse meio-tempo são mantidos. Depois, todos são apagados de uma vez.</p>
          <p className="border-t border-[hsl(var(--ink-line))] pt-3 text-xs">
            As abas da calculadora e do envio só avisam quantos órfãos existem; nada é apagado sem esta confirmação.
          </p>
        </div>
      )}

      {started && (
        <div className="space-y-4" aria-live="polite">
          <div className="flex gap-1" role="progressbar" aria-valuemin={0} aria-valuemax={del.total} aria-valuenow={del.done} aria-label="Progresso da exclusão">
            {SEGS.map((k, i) => (
              <span key={k} className={cn('h-1 min-w-0 flex-1 rounded-[2px]',
                i < filled ? 'bg-primary' : i === filled && del.running ? 'bg-primary seg-active' : 'bg-[hsl(var(--track))]')} />
            ))}
          </div>
          <p className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 tabular-nums">
              {del.running && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {del.done}/{del.total} itens
            </span>
            <span className="tabular-nums text-[hsl(var(--paper-dim))]">{Math.round(progress * 100)}%</span>
          </p>
          <dl className="grid grid-cols-3 gap-3 border-t border-[hsl(var(--ink-line))] pt-3">
            <Num label="Apagados" value={del.deleted} />
            <Num label="Mantidos" value={del.skipped} />
            <Num label="Falhas" value={del.failures.length} signal />
          </dl>
          {del.failures.length > 0 && (
            <ul className="max-h-60 space-y-2 overflow-y-auto">
              {del.failures.map((f) => (
                <li key={f.id} className="flex gap-2 rounded-[6px] bg-[hsl(var(--ink-soft))] p-3 text-sm">
                  <CircleX className="mt-0.5 size-4 shrink-0 text-[hsl(var(--err))]" aria-hidden />
                  <span className="min-w-0 break-words">{f.name} ({f.id}): {f.msg}</span>
                </li>
              ))}
            </ul>
          )}
          {del.finished && <p className="text-sm text-[hsl(var(--paper-dim))]">Exclusão concluída.</p>}
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar {count} {count === 1 ? 'risco órfão' : 'riscos órfãos'} do 09.4?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A lista de itens sem projeto vinculado será relida uma vez e todos esses itens serão apagados de uma vez.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirm} className="rounded-[5px] bg-destructive text-[hsl(var(--background))] hover:bg-destructive/90">
              Apagar órfãos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
