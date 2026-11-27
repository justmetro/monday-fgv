import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { PersonWeek, WeekSummary } from '@generated/lib/engagementMetrics';
import { CollapsibleCard } from './CollapsibleCard';
import { MultiCheckSelect } from '../MultiCheckSelect';
import { brFromDate } from '@generated/lib/weeklySeries';

const MIN = 80;

interface Props {
  weeks: WeekSummary[];
  inScope: (p: PersonWeek) => boolean; // pessoas do recorte (projeto e departamento)
  selected: string;
  onSelect: (manager: string) => void;
}

/** % da equipe engajada por gerente: média das semanas marcadas, com linha do mínimo de 80%. */
export function ManagerEngagementChart({ weeks, inScope, selected, onSelect }: Props) {
  const options = useMemo(() => {
    const seen = new Set<string>();
    return [...weeks].sort((a, b) => b.windowStart.getTime() - a.windowStart.getTime())
      .filter((w) => (seen.has(w.weekKey) ? false : (seen.add(w.weekKey), true)))
      .map((w) => ({ value: w.weekKey, label: w.groupName || w.label, subtitle: `${brFromDate(w.windowStart)} a ${brFromDate(w.windowEnd)}` }));
  }, [weeks]);
  const [picked, setPicked] = useState<string[] | null>(null);
  useEffect(() => { if (picked === null && options.length) setPicked(options.map((o) => o.value)); }, [options, picked]);

  const data = useMemo(() => {
    const set = new Set(picked ?? []);
    const rates = new Map<string, number[]>();
    weeks.filter((w) => set.has(w.weekKey)).forEach((w) => {
      const byMgr = new Map<string, { e: number; n: number }>();
      w.people.filter((p) => inScope(p) && !p.activeAbsence).forEach((p) => p.managers.forEach((m) => {
        const c = byMgr.get(m) ?? { e: 0, n: 0 };
        c.n++; if (p.engaged) c.e++;
        byMgr.set(m, c);
      }));
      byMgr.forEach((c, m) => rates.set(m, [...(rates.get(m) ?? []), (c.e / c.n) * 100]));
    });
    return [...rates].map(([name, r]) => ({ name, value: Math.round((r.reduce((a, b) => a + b, 0) / r.length) * 10) / 10, weeks: r.length }))
      .sort((a, b) => a.value - b.value);
  }, [weeks, picked, inScope]);

  const below = data.filter((d) => d.value < MIN).length;

  return (
    <CollapsibleCard
      title="Engajamento geral por gerente"
      subtitle={`Média da % da equipe engajada nas semanas marcadas · ${below} de ${data.length} gerentes abaixo do mínimo de ${MIN}% · clique numa barra para segmentar`}
      actions={<MultiCheckSelect options={options} selected={picked ?? []} onChange={setPicked} noun={['semana', 'semanas']} buttonClassName="h-8 min-w-[150px]" />}
    >
      {data.length === 0 ? (
        <p className="py-10 text-center text-xs text-muted-foreground">Nenhuma semana marcada ou sem gerentes no recorte.</p>
      ) : (
        <div style={{ height: 380 }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 20, right: 8, bottom: 0, left: -8 }}
              onClick={(e) => { const n = e?.activeLabel; if (n) onSelect(selected === String(n) ? 'all' : String(n)); }}>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} angle={-40} textAnchor="end" height={100}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tickLine={false} axisLine={false} width={44} domain={[0, 100]} tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip cursor={{ fill: 'hsl(var(--muted) / 0.5)' }}
                formatter={(v, _n, item) => [`${Number(v).toLocaleString('pt-BR')}% (${(item.payload as { weeks: number }).weeks} semanas)`, 'Engajamento']} />
              <ReferenceLine y={MIN} stroke="hsl(var(--foreground))" strokeDasharray="5 4" strokeWidth={1.5}
                label={{ value: 'Mínimo', position: 'insideTopLeft', fontSize: 10, fill: 'hsl(var(--foreground))' }} />
              <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={32} cursor="pointer">
                {data.map((d) => <Cell key={d.name} fill="#cab641" fillOpacity={selected === 'all' || selected === d.name ? 1 : 0.35} />)}
                <LabelList dataKey="value" position="top" fontSize={10} fill="hsl(var(--foreground))" formatter={(v: unknown) => `${Number(v).toLocaleString('pt-BR')}%`} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </CollapsibleCard>
  );
}
