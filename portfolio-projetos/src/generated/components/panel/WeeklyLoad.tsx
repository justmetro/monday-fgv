import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { weeklyLoad, type Person } from '@generated/lib/allocation';
import { SearchSelect } from '../SearchSelect';
import { Panel, SectionTitle } from '../ui-bits';
import { PAL } from './ChartCard';
import { cn } from '@lib/utils';

const lbl = (ms: number) => new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
const tip = { contentStyle: { background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 12 } };

/** Carga semanal pelas datas planejadas: em que semanas cada pessoa terá menos atividades. */
export function WeeklyLoad({ people, today }: { people: Person[]; today: string }) {
  const [who, setWho] = useState('');
  const { cols, rows } = useMemo(() => weeklyLoad(people, today, 12), [people, today]);
  const series = cols.map((c, i) => ({ semana: lbl(c), v: who ? rows.find((r) => r.name === who)?.counts[i] ?? 0 : rows.reduce((a, r) => a + (r.counts[i] ?? 0), 0) }));
  const min = Math.min(...series.map((x) => x.v));
  const heat = rows.slice(0, 15);
  const max = Math.max(1, ...heat.flatMap((r) => r.counts));

  return (
    <Panel>
      <SectionTitle aside={<div className="w-64 max-w-full"><SearchSelect value={who} onChange={setWho} emptyLabel="Todas as pessoas" placeholder="Todas as pessoas" ariaLabel="Escolher pessoa" options={people.map((p) => ({ value: p.name, label: p.name }))} /></div>}>
        Carga por semana (próximas 12 semanas)
      </SectionTitle>
      <p className="mb-2 text-xs text-muted-foreground">Atividades em aberto cujo período planejado cruza cada semana. As barras mais claras marcam as semanas de menor carga{who ? ` de ${who}` : ''}.</p>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={series} margin={{ left: -16, right: 8 }}>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="semana" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip {...tip} formatter={(v) => [String(v), 'Atividades']} labelFormatter={(l) => `Semana de ${String(l)}`} />
            <Bar dataKey="v" radius={[3, 3, 0, 0]}>{series.map((x) => <Cell key={x.semana} fill={x.v === min ? PAL[1] : PAL[0]} />)}</Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mb-2 mt-5 text-sm font-medium">Mapa de carga · 15 pessoas com mais atividades</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-separate border-spacing-0.5 text-xs">
          <thead><tr><th className="p-1 text-left font-medium text-muted-foreground">Pessoa</th>{cols.map((c) => <th key={c} className="p-1 font-medium text-muted-foreground">{lbl(c)}</th>)}</tr></thead>
          <tbody>
            {heat.map((r) => {
              const lo = Math.min(...r.counts);
              return (
                <tr key={r.name}>
                  <td className="max-w-48 truncate p-1" title={r.name}>{r.name}</td>
                  {r.counts.map((n, i) => (
                    <td key={cols[i]} title={`${r.name} · semana de ${lbl(cols[i]!)}: ${n} atividade(s)`}
                      className={cn('h-7 rounded text-center font-mono tabular-nums', n === lo && 'ring-1 ring-[hsl(var(--ok))]', n / max > 0.6 && 'text-white')}
                      style={{ background: n ? `rgba(4, 72, 124, ${0.12 + (n / max) * 0.88})` : 'hsl(var(--muted))' }}>
                      {n}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">Contorno verde = semana com menor carga da pessoa. Atividades sem datas planejadas não entram no mapa.</p>
    </Panel>
  );
}
