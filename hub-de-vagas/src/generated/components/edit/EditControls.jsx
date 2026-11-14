import { useEffect, useState } from 'react';
import { Pencil, Lock, Loader2, Check, ShieldAlert, RotateCw } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@components/ui/popover';
import { useEdit } from '@generated/components/edit/EditProvider';
import { cn } from '@lib/utils';

const STATUS_TEXT = {
  safe: 'Modo seguro: não foi possível confirmar sua permissão. Você pode editar; cada valor só muda na tela depois que o monday confirmar a gravação.',
  warn: 'Edição liberada com aviso: o quadro tem edição restrita. A gravação no monday decide se a alteração é aceita.',
  readonly: 'Somente leitura.',
};

export default function EditControls() {
  const { editMode, setEditMode, anyEdit, checking, canFor, perm, denied, retryPerm, pending, savedAt } = useEdit();
  const [showSaved, setShowSaved] = useState(false);
  useEffect(() => {
    if (!savedAt) return undefined;
    setShowSaved(true);
    const t = setTimeout(() => setShowSaved(false), 4000);
    return () => clearTimeout(t);
  }, [savedAt]);

  const disabled = checking || !anyEdit;
  const wasDenied = denied.main || denied.sub;
  const reason = perm?.reason ?? (wasDenied ? 'O monday recusou a gravação por falta de permissão.' : null);
  const title = checking ? 'Verificando permissões…'
    : !anyEdit ? `Sem permissão de edição${reason ? ` — ${reason}` : ''}`
      : (!canFor('vaga') || !canFor('match')) ? (canFor('vaga') ? 'Você pode editar vagas/perfis, mas não os matches (subitens).' : 'Você pode editar os matches, mas não vagas/perfis.')
        : editMode ? 'Desligar modo edição' : 'Ligar modo edição';
  const on = editMode && !disabled;
  const showInfo = !checking && (perm?.status !== 'ok' || wasDenied);

  return (
    <div className="flex items-center gap-2">
      <span aria-live="polite" className="min-w-0 text-xs text-muted-foreground">
        {pending > 0 ? <span className="inline-flex items-center gap-1"><Loader2 className="h-3.5 w-3.5 animate-spin" />salvando…</span>
          : showSaved ? <span className="inline-flex items-center gap-1 text-primary"><Check className="h-3.5 w-3.5" />salvo</span> : null}
      </span>
      {showInfo && (
        <Popover>
          <PopoverTrigger asChild>
            <button title={reason ?? 'Detalhes da permissão'} aria-label="Detalhes da permissão de edição"
              className={cn('inline-flex h-9 w-9 items-center justify-center rounded-full border bg-card', perm?.status === 'safe' || wasDenied ? 'border-[hsl(var(--warning)/0.6)] text-[hsl(var(--warning))]' : 'border-border text-muted-foreground')}>
              <ShieldAlert className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 space-y-3 text-sm">
            <p className="font-medium">{wasDenied ? 'Gravação recusada — somente leitura' : STATUS_TEXT[perm?.status] ?? 'Permissão de edição'}</p>
            {reason && <p className="break-words rounded-md bg-muted px-2 py-1.5 font-mono text-xs text-muted-foreground">{reason}</p>}
            <button onClick={retryPerm} className="inline-flex h-9 items-center gap-2 rounded-full border border-border px-3 text-xs hover:border-primary/60">
              <RotateCw className="h-3.5 w-3.5" />Tentar de novo
            </button>
          </PopoverContent>
        </Popover>
      )}
      <button onClick={() => setEditMode(!editMode)} aria-pressed={on} disabled={disabled} title={title}
        className={cn('inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60',
          on ? 'border-primary/60 bg-accent font-medium text-accent-foreground shadow-[var(--glow-stack)]' : 'border-border bg-card text-muted-foreground enabled:hover:text-foreground')}>
        {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : !anyEdit ? <Lock className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
        <span className="hidden sm:inline">{!checking && !anyEdit ? 'Somente leitura' : perm?.status === 'safe' ? 'Modo edição (seguro)' : 'Modo edição'}</span>
        <span className={cn('relative h-4 w-7 rounded-full transition-colors', on ? 'bg-primary' : 'bg-muted-foreground/40')}>
          <span className={cn('absolute top-0.5 h-3 w-3 rounded-full bg-background transition-all', on ? 'left-3.5' : 'left-0.5')} />
        </span>
      </button>
    </div>
  );
}
