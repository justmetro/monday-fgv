import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { Segmented } from '@generated/bits';
import { GRANS, periodCount, periodName, periodOfMonth } from '@generated/scope';
import { MESES_LONGOS } from '@generated/lib';

const trig = 'h-11 rounded-xl bg-card';
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Single period filter used by every tab, slide, PNG and PDF:
 * granularity (Mensal / Trimestral / Semestral / Anual) · period inside it · base year.
 */
export default function PeriodFilter({ f, onChange, years, lastClosed, partialMonths }) {
  // keep the same point in time: the last closed month if it is inside the current period, else the period end
  const setG = (g) => onChange({ g, p: periodOfMonth(g, f.months.includes(lastClosed) ? lastClosed : f.end), year: f.year });
  const opts = Array.from({ length: periodCount(f.g) }, (_, p) => p);
  const suffix = (p) => (f.g !== 'm' ? '' : partialMonths.includes(p) ? ' · parcial' : p === lastClosed ? ' · último fechado' : '');
  return (
    <fieldset className="m-0 flex min-w-0 flex-wrap items-center gap-1.5 border-0 p-0">
      <legend className="sr-only">Período</legend>
      <Segmented label="Granularidade" value={f.g} onChange={setG} options={GRANS} />
      {f.g !== 'y' && (
        <Select value={String(f.p)} onValueChange={(v) => onChange({ g: f.g, p: Number(v), year: f.year })}>
          <SelectTrigger aria-label="Período" className={`${trig} w-[200px]`}><SelectValue /></SelectTrigger>
          <SelectContent>
            {opts.map((p) => <SelectItem key={p} value={String(p)}>{f.g === 'm' ? cap(MESES_LONGOS[p]) : periodName(f.g, p)}{suffix(p)}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      <Select value={String(f.year)} onValueChange={(v) => onChange({ g: f.g, p: f.p, year: Number(v) })}>
        <SelectTrigger aria-label="Ano base" className={`${trig} w-28`}><SelectValue /></SelectTrigger>
        <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
      </Select>
    </fieldset>
  );
}
