import { useState } from 'react';
import { Loader2 } from 'lucide-react';

interface Props {
  group: string;
  people: number;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (typed: string) => void;
}

/** Confirmação própria para apagar uma semana da Base: exige digitar o nome exato da semana. */
export function DeleteWeekDialog({ group, people, busy, onCancel, onConfirm }: Props) {
  const [typed, setTyped] = useState('');
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <dialog open aria-modal="true" className="static bg-card text-foreground max-w-md w-full rounded-3xl border border-border p-6 space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Apagar a semana “{group}”</h3>
        <p className="text-sm text-foreground">
          Serão apagadas da Base as {people} linhas de pessoas desta semana, o período e a validação dela. O quadro do monday não é alterado.
        </p>
        <p className="text-xs text-muted-foreground">
          Se o grupo ainda existir no quadro, a próxima importação pela API traz esta semana de volta. A exclusão fica registrada com seu nome e o horário.
        </p>
        <label className="block space-y-1.5 text-xs text-foreground">
          <span>Digite o nome da semana exatamente como está acima: <strong>{group}</strong></span>
          <input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus disabled={busy}
            className="w-full h-11 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className="h-10 px-4 rounded-xl border border-border text-xs disabled:opacity-50">Cancelar</button>
          <button type="button" disabled={busy || typed !== group} onClick={() => onConfirm(typed)}
            className="h-10 px-4 rounded-xl bg-destructive text-card text-xs font-medium disabled:opacity-50 inline-flex items-center gap-1.5">
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Apagar semana
          </button>
        </div>
      </dialog>
    </div>
  );
}
