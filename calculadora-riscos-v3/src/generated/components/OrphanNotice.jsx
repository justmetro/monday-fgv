import { Unlink, X } from 'lucide-react';

/** Aviso exibido após cada rodada quando há riscos sem projeto no 09.4. Não apaga nada. */
export function OrphanNotice({ count, onOpen, onDismiss }) {
  if (!count) return null;
  return (
    <output className="flex flex-wrap items-center gap-3 rounded-[6px] border border-border bg-card px-4 py-3 text-sm text-foreground">
      <Unlink className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1 break-words">
        {count} {count === 1 ? 'risco está' : 'riscos estão'} no 09.4 sem projeto vinculado.
      </span>
      {onOpen && (
        <button type="button" onClick={onOpen}
          className="min-h-9 rounded-[5px] border border-[hsl(var(--input))] px-3.5 text-sm hover:bg-[hsl(var(--canvas-chrome))] focus-visible:outline-2 focus-visible:outline-ring">
          Ver em “Limpar órfãos”
        </button>
      )}
      <button type="button" onClick={onDismiss} aria-label="Fechar aviso"
        className="inline-flex size-9 items-center justify-center rounded-[5px] text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
        <X className="size-4" aria-hidden />
      </button>
    </output>
  );
}
