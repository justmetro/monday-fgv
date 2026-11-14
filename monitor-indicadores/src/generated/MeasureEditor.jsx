import ItemLink from '@generated/ItemLink';
import { useEffect, useState } from 'react';
import { Loader2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { board } from '@generated/useIndicadores';
import { BOARD_IND, num, fmtPct } from '@generated/lib';

const STATUSES = ['Não Iniciado', 'Em Progresso', 'Concluído', 'Retroativo', 'Cancelado'];
const inp = 'h-10 w-full rounded-lg border border-input bg-card px-3 text-sm tabular-nums';
const lbl = 'flex min-w-0 flex-col gap-1.5 text-xs font-medium text-[hsl(var(--goal))]';

/** optional: writes Atingido Período / Total Período (and status) of the measurement; Resultado [V2] is computed by the board */
export default function MeasureEditor({ med, onSaved, saldo }) {
  const init = () => ({ n: med.n ?? '', d: med.d ?? '', status: med.status ?? 'Não Iniciado' });
  const [f, setF] = useState(init);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { setF(init()); setConfirm(false); }, [med.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k) => (e) => { setF((s) => ({ ...s, [k]: e.target.value })); setConfirm(false); };
  const changed = (k, orig) => orig != null && num(f[k]) !== orig;
  const overwrites = changed('n', med.n) || changed('d', med.d);
  const nn = num(f.n), dd = num(f.d);
  const save = async () => {
    if (nn != null && dd != null && nn > dd) return toast.error('Atingido Período não pode ser maior que Total Período.');
    if (overwrites && !confirm) return setConfirm(true);
    setSaving(true);
    try {
      await board.item(med.id).update({ atingidoPerodo: nn, totalPerodo: dd, status: f.status }).execute();
      toast.success('Medição salva no monday');
      setConfirm(false);
      onSaved?.();
    } catch (e) { console.error(e); toast.error('Falha ao salvar a medição.'); }
    setSaving(false);
  };
  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold">Preencher medição <span className="font-normal text-muted-foreground">(opcional)</span></h3>
        <ItemLink board={BOARD_IND} view="med" id={med.id} className="inline-flex items-center gap-1 text-xs font-semibold text-[hsl(var(--goal))] hover:underline">Ver na tabela MEDIÇÃO <ExternalLink className="h-3 w-3" /></ItemLink>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className={lbl}><span className="truncate">Atingido Período{saldo ? ' (saldo R$)' : ''}</span><input type="number" min="0" className={inp} value={f.n} onChange={set('n')} /></label>
        <label className={lbl}><span className="truncate">Total Período{saldo ? ' (orçado R$)' : ''}</span><input type="number" min="0" className={inp} value={f.d} onChange={set('d')} /></label>
        <div className={lbl}><span>Status</span>
          <Select value={f.status} onValueChange={(v) => setF((s) => ({ ...s, status: v }))}>
            <SelectTrigger aria-label="Status da medição" className="h-10 w-full rounded-lg bg-card"><SelectValue /></SelectTrigger>
            <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className={lbl}><span>Resultado previsto</span>
          <p className="flex h-10 items-center rounded-lg bg-muted px-3 text-sm font-semibold tabular-nums text-foreground">{dd > 0 ? fmtPct(Math.round(((nn ?? 0) / dd) * 1000) / 10) : 'sem casos'}</p>
        </div>
      </div>
      {confirm && <p className="rounded-lg bg-[hsl(var(--below)/0.1)] p-2 text-xs text-[hsl(var(--below-ink))]">Esta medição já tem valores preenchidos. Clique em "Confirmar e salvar" para sobrescrever.</p>}
      <button onClick={save} disabled={saving} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-60">
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}{confirm ? 'Confirmar e salvar' : 'Salvar'}
      </button>
    </div>
  );
}
