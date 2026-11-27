import { Bar, BarChart, CartesianGrid, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface ProjectBar { label: string; full: string; value: number; detail?: string }

interface Props {
  data: ProjectBar[];
  decimals?: number;
  refLines?: { y: number; label: string; color: string }[];
  height?: number;
  emptyText?: string;
}

const fmt = (v: number, d: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

/** Barras por projeto em ordem crescente, com rótulo do valor e linhas de referência opcionais. */
export function ProjectBarChart({ data, decimals = 0, refLines = [], height = 320, emptyText = 'Sem projetos nesta semana.' }: Props) {
  if (!data.length) return <p className="py-10 text-center text-xs text-muted-foreground">{emptyText}</p>;
  const max = Math.max(...data.map((d) => d.value), ...refLines.map((r) => r.y));
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 18, right: 8, bottom: 0, left: -8 }}>
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
                <div className="max-w-[280px] rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-sm">
                  <p className="font-medium text-foreground">{p.full}</p>
                  <p className="mt-1 text-foreground">{fmt(p.value, decimals)}</p>
                  {p.detail && <p className="text-muted-foreground">{p.detail}</p>}
                </div>
              );
            }}
          />
          {refLines.map((r) => (
            <ReferenceLine key={r.label} y={r.y} stroke={r.color} strokeDasharray="5 4" strokeWidth={1.5}
              label={{ value: r.label, position: 'insideTopLeft', fontSize: 10, fill: r.color }} />
          ))}
          <Bar dataKey="value" fill="hsl(var(--chart-3) / 0.55)" stroke="hsl(var(--chart-3))" radius={[3, 3, 0, 0]} maxBarSize={28}>
            <LabelList dataKey="value" position="top" fontSize={10} fill="hsl(var(--foreground))" formatter={(v: unknown) => fmt(Number(v), decimals)} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
