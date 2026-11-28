import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ApusData } from '../../../../server/apus';
import { CollapsibleCard } from './CollapsibleCard';
import { MultiCheckSelect } from '../MultiCheckSelect';

const MIN = 80;

interface Props {
  data: ApusData | null; // semanas do quadro Relatórios dos projetos (histórico completo)
  scopeCode?: string | null; // projeto escolhido no filtro da aba (código AAAA/NNN)
  selected: string;
  onSelect: (manager: string) => void;
}

/** % de usuários engajados por gerente: média dos projetos-semana marcados no quadro, com linha do mínimo de 80%. */
export function ManagerEngagementChart({ data, scopeCode, selected, onSelect }: Props) {
  const options = useMemo(
    () => (data?.weeks ?? []).map((w) => ({ value: String(w.weekNumber), label: `Semana ${w.weekNumber}`, subtitle: w.weekLabel })),
    [data]
  );
  const [picked, setPicked] = useState<string[] | null>(null);
  useEffect(() => { if (picked === null && options.length) setPicked(options.map((o) => o.value)); }, [options, picked]);

  const chart = useMemo(() => {
    const set = new Set((picked ?? []).map(Number));
    const vals = new Map<string, number[]>();
    (data?.rows ?? [])
      .filter((r) => set.has(r.weekNumber) && r.pctEngaged !== null && (!scopeCode || r.code === scopeCode))
      .forEach((r) => r.managers.forEach((m) => vals.set(m, [...(vals.get(m) ?? []), r.pctEngaged as number])));
    return [...vals].map(([name, v]) => ({ name, value: Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10, weeks: v.length }))
      .sort((a, b) => a.value - b.value);
  }, [data, picked, scopeCode]);
  const below = chart.filter((d) => d.value < MIN).length;

  return (
    <CollapsibleCard
      title="Engajamento geral por gerente"
      subtitle={`Média da % de usuários engajados dos projetos-semana marcados (quadro Relatórios dos projetos, histórico desde a semana 0) · ${below} de ${chart.length} gerentes abaixo do mínimo de ${MIN}% · clique numa barra para segmentar`}
      actions={<MultiCheckSelect options={options} selected={picked ?? []} onChange={setPicked} noun={['semana', 'semanas']} buttonClassName="h-8 min-w-[150px]" />}
    >
      {chart.length === 0 ? (
        <p className="py-10 text-center text-xs text-muted-foreground">Nenhuma semana marcada ou sem gerentes no recorte.</p>
      ) : (
        <div style={{ height: 380 }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 20, right: 8, bottom: 0, left: -8 }}
              onClick={(e) => { const n = e?.activeLabel; if (n) onSelect(selected === String(n) ? 'all' : String(n)); }}>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} angle={-40} textAnchor="end" height={100}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tickLine={false} axisLine={false} width={44} domain={[0, 100]} tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip cursor={{ fill: 'hsl(var(--muted) / 0.5)' }}
                formatter={(v, _n, item) => [`${Number(v).toLocaleString('pt-BR')}% (${(item.payload as { weeks: number }).weeks} projetos-semana)`, 'Engajamento']} />
              <ReferenceLine y={MIN} stroke="hsl(var(--foreground))" strokeDasharray="5 4" strokeWidth={1.5}
                label={{ value: 'Mínimo', position: 'insideTopLeft', fontSize: 10, fill: 'hsl(var(--foreground))' }} />
              <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={32} cursor="pointer">
                {chart.map((d) => <Cell key={d.name} fill="#cab641" fillOpacity={selected === 'all' || selected === d.name ? 1 : 0.35} />)}
                <LabelList dataKey="value" position="top" fontSize={10} fill="hsl(var(--foreground))" formatter={(v: unknown) => `${Number(v).toLocaleString('pt-BR')}%`} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </CollapsibleCard>
  );
}
