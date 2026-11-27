import { Bar, CartesianGrid, ComposedChart, LabelList, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface TrendPoint {
  label: string; // "Semana 37"
  range: string; // "01/11/2026 a 07/11/2026"
  bar: number | null;
  line: number | null;
}

interface Props {
  data: TrendPoint[];
  barName: string;
  lineName: string;
  percent?: boolean; // eixos em %
  height?: number;
  emptyText?: string;
  hideLine?: boolean; // só as barras, com o valor em cima
}

const fmt = (v: number | null | undefined, percent?: boolean) =>
  v === null || v === undefined ? '—' : percent ? `${Math.round(v)}%` : v.toLocaleString('pt-BR');

/** Barras da semana + linha de tendência, no mesmo estilo nos painéis. */
export function WeeklyTrendChart({ data, barName, lineName, percent, height = 220, emptyText = 'Sem semanas para mostrar.', hideLine = false }: Props) {
  if (!data.length) return <p className="py-10 text-center text-xs text-muted-foreground">{emptyText}</p>;
  const sameAxis = Boolean(percent);
  // Tudo zerado: eixo fixo de 0 a 4 em vez de um eixo com uma marca só
  const allZero = data.every((d) => !d.bar && !d.line);
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: hideLine ? 20 : 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} interval="preserveStartEnd" />
          <YAxis yAxisId="bar" tickLine={false} axisLine={false} width={52} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            domain={percent ? [0, 100] : allZero ? [0, 4] : [0, 'auto']} ticks={allZero && !percent ? [0, 1, 2, 3, 4] : undefined} tickFormatter={(v) => fmt(v, percent)} allowDecimals={false} />
          <YAxis yAxisId="line" orientation="right" hide={sameAxis || hideLine} tickLine={false} axisLine={false} width={44}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} domain={percent ? [0, 100] : allZero ? [0, 4] : [0, 'auto']} ticks={allZero && !percent ? [0, 1, 2, 3, 4] : undefined} tickFormatter={(v) => fmt(v, percent)} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: 'hsl(var(--muted) / 0.5)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as TrendPoint;
              return (
                <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-sm">
                  <p className="font-medium text-foreground">{p.label}</p>
                  <p className="text-muted-foreground">{p.range}</p>
                  <p className="mt-1 text-foreground">{barName}: {fmt(p.bar, percent)}</p>
                  <p className="text-foreground">{lineName}: {fmt(p.line, percent)}</p>
                </div>
              );
            }}
          />
          <Bar minPointSize={2} yAxisId="bar" dataKey="bar" name={barName} fill="hsl(var(--chart-3) / 0.35)" stroke="hsl(var(--chart-3) / 0.6)" radius={[3, 3, 0, 0]} maxBarSize={56}>
            {hideLine && <LabelList dataKey="bar" position="top" fontSize={10} fill="hsl(var(--foreground))" formatter={(v: unknown) => fmt(Number(v), percent)} />}
          </Bar>
          {!hideLine && <Line yAxisId={sameAxis ? 'bar' : 'line'} dataKey="line" name={lineName} type="monotone" stroke="hsl(var(--chart-3))" strokeWidth={2}
            dot={{ r: 3.5, fill: 'hsl(var(--chart-3))', strokeWidth: 0 }} activeDot={{ r: 5 }} connectNulls />}
        </ComposedChart>
      </ResponsiveContainer>
      <div className="mt-1 flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-3 rounded-sm bg-[hsl(var(--chart-3)/0.35)] border border-[hsl(var(--chart-3)/0.6)]" />{barName}</span>
        {!hideLine && <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 bg-[hsl(var(--chart-3))]" />{lineName}</span>}
      </div>
    </div>
  );
}
