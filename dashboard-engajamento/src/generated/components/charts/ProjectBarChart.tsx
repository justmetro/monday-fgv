import { Bar, BarChart, CartesianGrid, LabelList, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface ProjectBar { label: string; full: string; value: number; detail?: string; [series: string]: unknown }
export interface BarSeries { key: string; name: string }

interface Props {
  data: ProjectBar[];
  series?: BarSeries[]; // várias semanas: uma barra por semana em cada projeto
  decimals?: number;
  refLines?: { y: number; label: string; color: string }[];
  height?: number;
  emptyText?: string;
}

const COLORS = ['hsl(var(--chart-3))', 'hsl(var(--chart-1))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))', 'hsl(var(--chart-2))'];
const fmt = (v: number, d: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

/** Barras por projeto em ordem crescente, com rótulo do valor e linhas de referência opcionais. */
export function ProjectBarChart({ data, series, decimals = 0, refLines = [], height = 320, emptyText = 'Sem projetos nas semanas escolhidas.' }: Props) {
  if (!data.length) return <p className="py-10 text-center text-xs text-muted-foreground">{emptyText}</p>;
  const ser = series?.length ? series : [{ key: 'value', name: 'Valor' }];
  const multi = ser.length > 1;
  const values = data.flatMap((d) => ser.map((s) => Number(d[s.key] ?? 0)));
  const max = Math.max(...values, ...refLines.map((r) => r.y));
  return (
    <div style={{ height: multi ? height + 24 : height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 18, right: 8, bottom: 0, left: -8 }} barGap={1}>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} angle={-40} textAnchor="end" height={110}
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
          <YAxis tickLine={false} axisLine={false} width={44} domain={[0, Math.ceil(max * 1.1) || 1]}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => fmt(v, 0)} />
          <Tooltip
            cursor={{ fill: 'hsl(var(--muted) / 0.5)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as ProjectBar;
              return (
                <div className="max-w-[300px] rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-sm">
                  <p className="font-medium text-foreground">{p.full}</p>
                  {ser.map((s) => p[s.key] === undefined ? null : (
                    <p key={s.key} className="mt-0.5 text-foreground">{multi ? `${s.name}: ` : ''}{fmt(Number(p[s.key]), decimals)}</p>
                  ))}
                  {!multi && p.detail && <p className="text-muted-foreground">{p.detail}</p>}
                </div>
              );
            }}
          />
          {multi && <Legend verticalAlign="top" height={24} iconSize={10} wrapperStyle={{ fontSize: 11 }} />}
          {refLines.map((r) => (
            <ReferenceLine key={r.label} y={r.y} stroke={r.color} strokeDasharray="5 4" strokeWidth={1.5}
              label={{ value: r.label, position: 'insideTopLeft', fontSize: 10, fill: r.color }} />
          ))}
          {ser.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.name} fill={multi ? COLORS[i % COLORS.length] : 'hsl(var(--chart-3) / 0.55)'}
              fillOpacity={multi ? 0.75 : 1} stroke={multi ? undefined : 'hsl(var(--chart-3))'} radius={[3, 3, 0, 0]} maxBarSize={multi ? 14 : 28}>
              {!multi && <LabelList dataKey={s.key} position="top" fontSize={10} fill="hsl(var(--foreground))" formatter={(v: unknown) => fmt(Number(v), decimals)} />}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
