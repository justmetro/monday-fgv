import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarRange, Loader2 } from 'lucide-react';
import { getPendingPeriodWeeks, setWeekPeriods } from '@generated/server/weekActions';
import { addDaysIso, periodError } from '@generated/lib/weekPeriod';
import { clearAllCachedSnapshots } from '@generated/lib/snapshotCache';

type Claim = { email?: string; id?: string; name?: string; isAdmin?: boolean } | undefined;
interface Props { clientClaim: Claim; refreshKey: number; onChanged: () => void }
interface Pending { group: string; people: number }

const inputCls = 'h-10 px-3 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60';

/** Semanas importadas sem período: início e fim para preencher várias de uma vez. */
export function PendingWeeksList({ clientClaim, refreshKey, onChanged }: Props) {
  const [weeks, setWeeks] = useState<Pending[]>([]);
  const [values, setValues] = useState<Record<string, { start: string; end: string }>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // O objeto da sessão muda a cada renderização: a leitura só se repete quando o e-mail muda
  const claimRef = useRef(clientClaim);
  claimRef.current = clientClaim;
  const email = clientClaim?.email;
  const load = useCallback(async () => {
    if (!email) return;
    try {
      const res = await getPendingPeriodWeeks({ data: { clientClaim: claimRef.current } });
      setWeeks(res?.weeks ?? []);
    } catch (e) {
      console.error('Erro ao listar semanas sem período:', e);
    }
  }, [email]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const setVal = (g: string, patch: Partial<{ start: string; end: string }>) =>
    setValues((v) => ({ ...v, [g]: { start: v[g]?.start ?? '', end: v[g]?.end ?? '', ...patch } }));

  const save = async () => {
    const items: { group: string; start: string; end: string }[] = [];
    const nextErrors: Record<string, string> = {};
    weeks.forEach((w) => {
      const v = values[w.group];
      if (!v?.start && !v?.end) return;
      const err = periodError(v?.start ?? '', v?.end ?? '');
      if (err) nextErrors[w.group] = err;
      else items.push({ group: w.group, start: v?.start ?? '', end: v?.end ?? '' });
    });
    setErrors(nextErrors);
    setNote(null);
    if (items.length === 0) { if (Object.keys(nextErrors).length === 0) setNote('Preencha o início e o fim de ao menos uma semana.'); return; }
    setBusy(true);
    try {
      const res = await setWeekPeriods({ data: { items, clientClaim } });
      const failed: Record<string, string> = { ...nextErrors };
      (res?.results ?? []).forEach((r) => { if (!r.ok) failed[r.group] = r.message ?? 'Não foi possível salvar.'; });
      setErrors(failed);
      const okCount = (res?.results ?? []).filter((r) => r.ok).length;
      setNote(okCount > 0 ? `${okCount} ${okCount === 1 ? 'período salvo' : 'períodos salvos'}. Essas semanas já entram nos scores.` : null);
      if (okCount > 0) { await clearAllCachedSnapshots(); onChanged(); }
      await load();
    } catch (e) {
      setNote((e as Error).message || 'Não foi possível salvar os períodos.');
    } finally { setBusy(false); }
  };

  if (weeks.length === 0) return null;
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <CalendarRange className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Semanas sem período ({weeks.length})</p>
          <p className="text-[11px] text-muted-foreground">Ficam fora dos scores e painéis até o período (domingo a sábado) ser salvo.</p>
        </div>
      </div>
      <ul className="space-y-3">
        {weeks.map((w) => (
          <li key={w.group} className="space-y-1">
            <div className="flex flex-wrap items-end gap-3">
              <span className="text-xs font-medium text-foreground w-40 min-w-0 break-words">{w.group} <span className="text-muted-foreground font-normal">· {w.people} pessoas</span></span>
              <label className="text-[11px] text-muted-foreground space-y-1">
                <span className="block">Início (domingo)</span>
                <input type="date" aria-label={`Início de ${w.group}`} value={values[w.group]?.start ?? ''} disabled={busy} className={inputCls}
                  onChange={(e) => setVal(w.group, { start: e.target.value, ...(e.target.value && !values[w.group]?.end ? { end: addDaysIso(e.target.value, 6) } : {}) })} />
              </label>
              <label className="text-[11px] text-muted-foreground space-y-1">
                <span className="block">Fim (sábado)</span>
                <input type="date" aria-label={`Fim de ${w.group}`} value={values[w.group]?.end ?? ''} disabled={busy} className={inputCls} onChange={(e) => setVal(w.group, { end: e.target.value })} />
              </label>
            </div>
            {errors[w.group] ? <p className="text-xs text-destructive break-words">{errors[w.group]}</p> : null}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void save()} disabled={busy}
          className="h-10 px-4 rounded-xl bg-[hsl(var(--brand-navy))] text-card text-xs font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1.5">
          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Salvar períodos preenchidos
        </button>
        {note ? <span className="text-xs text-foreground">{note}</span> : null}
      </div>
    </div>
  );
}
