import { useMemo, useState } from 'react';
import { CalendarCheck, CalendarRange, CheckCircle2, Download, Loader2, Clock, Pencil, RotateCcw, Search, Trash2 } from 'lucide-react';
import type { BaseWeekStatusDoc, StoredEngagementRow } from '@generated/models';
import { WEEKDAYS, emptyDayCounts, normText } from '@generated/lib/weekdays';
import { formatBR, parseDateFlexible } from '@generated/lib/dates';
import { isoOf } from '@generated/lib/baseRows';
import { WeekPeriodForm } from './WeekPeriodForm';

interface Props {
  rows: StoredEngagementRow[];
  weekStatus: BaseWeekStatusDoc[];
  savingGroup: string | null;
  onValidate: (group: string) => void;
  onReopen: (group: string) => void;
  onDeleteWeek: (group: string, people: number) => void;
  onSetPeriod: (group: string, start: string, end: string) => Promise<string | null>;
  onExport: (group: string, ext: 'csv' | 'xlsx') => void;
  reprocessingGroup: string | null;
  onReprocess: (group: string) => void;
  onEdit: (row: StoredEngagementRow) => void;
}

const br = (iso: string) => iso.split('-').reverse().join('/');

/** Validação semana a semana: uma linha por pessoa, último acesso e checks de domingo a sábado. */
export function BaseWeekView({ rows, weekStatus, savingGroup, onValidate, onReopen, onDeleteWeek, onSetPeriod, onExport, reprocessingGroup, onReprocess, onEdit }: Props) {
  const [term, setTerm] = useState('');
  const weeks = useMemo(() => {
    const map = new Map<string, { group: string; weekStart: string; rows: StoredEngagementRow[] }>();
    rows.forEach((r) => {
      const k = normText(r.group);
      if (!k) return;
      const w = map.get(k) ?? { group: r.group ?? '', weekStart: r.weekStart ?? '', rows: [] };
      w.rows.push(r);
      if ((r.weekStart ?? '') > w.weekStart) w.weekStart = r.weekStart ?? '';
      map.set(k, w);
    });
    return Array.from(map.values()).sort((a, b) => b.weekStart.localeCompare(a.weekStart) || a.group.localeCompare(b.group));
  }, [rows]);
  const [selected, setSelected] = useState('');
  const [showPeriod, setShowPeriod] = useState(false);
  const week = weeks.find((w) => w.group === selected) ?? weeks[0];

  const range = week ? weekStatus.find((s) => normText(s.group) === normText(week.group)) : undefined;
  const totals = useMemo(() => {
    const byDay = emptyDayCounts();
    let outside = 0;
    let noAccess = 0;
    week?.rows.forEach((r) => {
      (r.checkedDays ?? []).forEach((d) => { if (d in byDay) byDay[d as keyof typeof byDay]++; });
      const la = isoOf(r.lastAccess);
      if (!la) noAccess++;
      else if (range?.weekStart && range.weekEnd && (la < range.weekStart || la > range.weekEnd)) outside++;
    });
    return { byDay, outside, noAccess, checks: Object.values(byDay).reduce((a, b) => a + b, 0) };
  }, [week, range]);

  if (!week) return <p className="text-xs text-muted-foreground">Nenhuma semana na Base ainda.</p>;
  const status = weekStatus.find((s) => normText(s.group) === normText(week.group));
  const validated = status?.status === 'validada';
  // A semana inteira já está carregada nesta aba, então a busca cobre todas as pessoas da semana
  const q = normText(term);
  const sorted = week.rows
    .filter((r) => !q || [r.name, r.email, r.team].some((v) => normText(v).includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
        <select value={week.group} onChange={(e) => { setSelected(e.target.value); setShowPeriod(false); }} aria-label="Semana" className="h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground">
          {weeks.map((w) => {
            const d = weekStatus.find((s) => normText(s.group) === normText(w.group));
            const label = d?.status === 'validada' ? 'validada' : d?.periodPending && !(d.weekStart && d.weekEnd) ? 'sem período' : 'pendente';
            return <option key={w.group} value={w.group}>{w.group} · {label}</option>;
          })}
        </select>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={reprocessingGroup === week.group} onClick={() => onReprocess(week.group)} className="h-10 px-3 rounded-xl border border-border text-xs hover:bg-muted disabled:opacity-50 inline-flex items-center gap-1.5">
            {reprocessingGroup === week.group ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />} Recalcular checks
          </button>
          <button type="button" onClick={() => onExport(week.group, 'xlsx')} className="h-10 px-3 rounded-xl border border-border text-xs hover:bg-muted inline-flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> Semana .xlsx</button>
          <button type="button" onClick={() => onExport(week.group, 'csv')} className="h-10 px-3 rounded-xl border border-border text-xs hover:bg-muted inline-flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> Semana .csv</button>
          <button type="button" disabled={validated} title={validated ? 'Semana validada: reabra para alterar o período' : undefined} onClick={() => setShowPeriod((v) => !v)} className="h-10 px-3 rounded-xl border border-border text-xs hover:bg-muted disabled:opacity-50 inline-flex items-center gap-1.5">
            <CalendarRange className="w-3.5 h-3.5" /> Definir período
          </button>
          <button type="button" disabled={validated} title={validated ? 'Semana validada: reabra para apagar' : undefined} onClick={() => onDeleteWeek(week.group, week.rows.length)} className="h-10 px-3 rounded-xl border border-destructive/30 bg-destructive/10 text-xs font-medium text-destructive hover:bg-destructive/20 disabled:opacity-50 inline-flex items-center gap-1.5">
            <Trash2 className="w-3.5 h-3.5" /> Apagar semana
          </button>
          {validated ? (
            <button type="button" disabled={savingGroup === week.group} onClick={() => onReopen(week.group)} className="h-10 px-3 rounded-xl border border-border text-xs font-medium hover:bg-muted disabled:opacity-50 inline-flex items-center gap-1.5">
              {savingGroup === week.group ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />} Reabrir semana
            </button>
          ) : (
            <button type="button" disabled={savingGroup === week.group} onClick={() => onValidate(week.group)} className="h-10 px-3 rounded-xl bg-[hsl(var(--brand-navy))] text-card text-xs font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1.5">
              {savingGroup === week.group ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Marcar como validada
            </button>
          )}
        </div>
      </div>

      {showPeriod && !validated ? (
        <div className="rounded-2xl border border-border p-4 space-y-2">
          <p className="text-xs text-muted-foreground">Período de domingo a sábado (7 dias). Ao salvar, os checks da semana são recalculados pelo “Ativo pela última vez” — só acrescenta, nunca desmarca.</p>
          <WeekPeriodForm key={`${week.group}-${range?.weekStart ?? ''}`} initialStart={range?.weekStart} initialEnd={range?.weekEnd} onCancel={() => setShowPeriod(false)}
            onSave={async (s, e) => { const err = await onSetPeriod(week.group, s, e); if (!err) setShowPeriod(false); return err; }} />
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1.4fr)_auto_auto] gap-4 rounded-2xl bg-muted/40 border border-border p-4 items-start">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Semana guardada</p>
          <p className="text-sm font-medium text-foreground inline-flex items-center gap-1.5 mt-1">
            <CalendarRange className="w-4 h-4 text-muted-foreground" />
            {range?.weekStart && range.weekEnd ? `${br(range.weekStart)} a ${br(range.weekEnd)}` : range?.periodPending ? 'Sem período (fora dos scores até definir)' : 'Sem intervalo guardado'}
          </p>
          {range?.rangeFromDate && <p className="text-[11px] text-muted-foreground">da data da análise {br(range.rangeFromDate)}</p>}
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Pessoas</p>
          <p className="text-3xl font-light tabular-nums text-foreground">{week.rows.length}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Checks da semana</p>
          <p className="text-3xl font-light tabular-nums text-foreground">{totals.checks}</p>
        </div>
        <div className="sm:col-span-3 pt-3 border-t border-border/70 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
          {WEEKDAYS.map((w) => <span key={w.key} className="tabular-nums">{w.short} <strong className="text-foreground">{totals.byDay[w.key]}</strong></span>)}
          <span className="tabular-nums">Fora da semana (sem check) <strong className="text-foreground">{range?.weekStart ? totals.outside : '—'}</strong></span>
          <span className="tabular-nums">Sem último acesso <strong className="text-foreground">{totals.noAccess}</strong></span>
          <span className={`sm:ml-auto inline-flex items-center gap-1.5 ${validated ? 'text-primary' : ''}`}>
            <CalendarCheck className="w-4 h-4" /> {validated ? `Validada por ${status?.updatedByName} em ${formatBR(parseDateFlexible(status?.updatedAt))}` : 'Pendente de validação'}
          </span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Buscar nome, e-mail ou equipe…" aria-label="Buscar pessoa na semana"
            className="w-full h-10 pl-8 pr-3 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <p className="text-xs text-muted-foreground tabular-nums">{sorted.length} de {week.rows.length} pessoas</p>
      </div>

      <div className="border border-border rounded-2xl overflow-auto max-h-[480px]">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead className="bg-muted text-[10px] uppercase tracking-wider text-muted-foreground sticky top-0 z-10">
            <tr>
              <th className="py-2.5 px-3 w-[320px]">Pessoa</th>
              <th className="py-2.5 px-3 whitespace-nowrap">Ativo pela última vez</th>
              {WEEKDAYS.map((w) => <th key={w.key} className="py-2.5 px-2 text-center w-10">{w.short}</th>)}
              <th className="py-2.5 px-3 w-12"><span className="sr-only">Editar</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {sorted.length === 0 ? (
              <tr><td colSpan={WEEKDAYS.length + 3} className="py-8 text-center text-muted-foreground">Nenhuma pessoa encontrada nesta semana.</td></tr>
            ) : sorted.map((r) => (
              <tr key={`${r.email || r.name}`} className="hover:bg-muted/30 align-top">
                <td className="py-2 px-3 max-w-[320px]"><div className="font-medium text-foreground break-words">{r.name}</div><div className="text-[11px] text-muted-foreground break-all">{r.email || '—'}</div><div className="text-[11px] text-muted-foreground break-words">Equipe: {r.team || '—'}</div></td>
                <td className="py-2 px-3 whitespace-nowrap text-foreground">{r.lastAccess || '—'}</td>
                {WEEKDAYS.map((w) => (
                  <td key={w.key} className="py-2 px-2 text-center">
                    {(r.checkedDays ?? []).includes(w.key) ? <span className="inline-block w-5 h-5 rounded-md bg-primary text-primary-foreground text-[11px] leading-5">✓</span> : <span className="text-muted-foreground/50">·</span>}
                  </td>
                ))}
                <td className="py-1.5 px-2">
                  <button type="button" aria-label={`Editar ${r.name}`} onClick={() => onEdit(r)} className="w-9 h-9 rounded-lg hover:bg-muted grid place-items-center text-muted-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
