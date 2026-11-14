import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { addDaysIso, periodError } from '@generated/lib/weekPeriod';

interface Props {
  initialStart?: string;
  initialEnd?: string;
  disabled?: boolean;
  /** Devolve a mensagem de erro, ou null quando salvou. */
  onSave: (start: string, end: string) => Promise<string | null>;
  onCancel?: () => void;
}

const inputCls = 'h-10 px-3 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60';

/** Início e fim da semana (domingo a sábado), com validação antes de salvar. */
export function WeekPeriodForm({ initialStart = '', initialEnd = '', disabled, onSave, onCancel }: Props) {
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const save = async () => {
    const err = periodError(start, end);
    if (err) return setMessage(err);
    setBusy(true);
    setMessage(null);
    try {
      const res = await onSave(start, end);
      if (res) setMessage(res);
    } catch (e) {
      setMessage((e as Error).message || 'Não foi possível salvar o período.');
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-[11px] font-medium text-foreground">
          <span>Início (domingo)</span>
          <input type="date" value={start} disabled={disabled || busy} className={`${inputCls} block`}
            onChange={(e) => { setStart(e.target.value); if (e.target.value && (!end || end === addDaysIso(start, 6))) setEnd(addDaysIso(e.target.value, 6)); setMessage(null); }} />
        </label>
        <label className="space-y-1 text-[11px] font-medium text-foreground">
          <span>Fim (sábado)</span>
          <input type="date" value={end} disabled={disabled || busy} className={`${inputCls} block`} onChange={(e) => { setEnd(e.target.value); setMessage(null); }} />
        </label>
        <button type="button" disabled={disabled || busy || !start || !end} onClick={() => void save()}
          className="h-10 px-4 rounded-xl bg-[hsl(var(--brand-navy))] text-card text-xs font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1.5">
          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Salvar período
        </button>
        {onCancel ? <button type="button" onClick={onCancel} disabled={busy} className="h-10 px-3 rounded-xl border border-border text-xs hover:bg-muted disabled:opacity-50">Cancelar</button> : null}
      </div>
      {message ? <p className="text-xs text-destructive break-words">{message}</p> : null}
    </div>
  );
}
