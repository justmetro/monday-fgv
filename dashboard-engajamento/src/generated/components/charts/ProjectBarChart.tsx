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
/** Rótulo curto em cima da barra: menos casas decimais quanto maior o número. */
const short = (v: number, d: number) => fmt(v, d === 0 || v >= 10 ? 0 : v >= 1 ? 1 : d);
/** Nome curto no eixo; o nome inteiro fica no tooltip. */
const abbr = (s: string, n = 18) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** Barras por projeto em ordem crescente, com rótulo do valor e linhas de referência opcionais. */
export function ProjectBarChart({ data, series, decimals = 0, refLines = [], height = 320, emptyText = 'Sem projetos nas semanas escolhidas.' }: Props) {
  if (!data.length) return <p className="py-10 text-center text-xs text-muted-foreground">{emptyText}</p>;
  const ser = series?.length ? series : [{ key: 'value', name: 'Valor' }];
  const multi = ser.length > 1;
  const values = data.flatMap((d) => ser.map((s) => Number(d[s.key] ?? 0)));
  const max = Math.max(...values, ...refLines.map((r) => r.y));
  // Muitas semanas: mesma cor, mais clara na mais antiga; o gráfico ganha largura e rola na horizontal
  const many = ser.length > COLORS.length;
  const colorOf = (i: number) => (many ? `hsl(var(--chart-3) / ${(0.2 + (0.8 * (i + 1)) / ser.length).toFixed(2)})` : COLORS[i % COLORS.length]);
  const minWidth = data.length * (multi ? Math.max(44, ser.length * 7 + 14) : 38) + 60;
  return (
    <div className="w-full">
      {many && (
        <div className="mb-2 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
          <span>{ser[0].name}</span>
          <span className="h-2.5 w-28 rounded-sm" style={{ background: 'linear-gradient(to right, hsl(var(--chart-3) / 0.25), hsl(var(--chart-3)))' }} />
          <span>{ser[ser.length - 1].name}</span>
          <span>· {ser.length} semanas, da mais antiga (clara) à mais recente (escura)</span>
        </div>
      )}
      <div className="w-full overflow-x-auto">
    <div style={{ height: multi && !many ? height + 24 : height, minWidth }} className="w-full [&_*:focus]:outline-none">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 18, right: 8, bottom: 0, left: -8 }} barGap={1} accessibilityLayer={false}>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} angle={-45} textAnchor="end" height={96}
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v: string) => abbr(v)} />
          <YAxis tickLine={false} axisLine={false} width={44} domain={[0, Math.ceil(max * 1.1) || 1]}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => fmt(v, 0)} />
          <Tooltip
            cursor={{ fill: 'hsl(var(--muted) / 0.5)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as ProjectBar;
              return (
                <div className="max-w-[340px] rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-sm">
                  <p className="font-medium text-foreground">{p.full}</p>
                  <div className={multi ? 'mt-1 grid grid-cols-3 gap-x-3 gap-y-0.5 text-[11px]' : 'mt-0.5'}>
                    {ser.map((s) => p[s.key] === undefined ? null : (
                      <p key={s.key} className="whitespace-nowrap text-foreground">
                        {multi && <span className="text-muted-foreground">{s.name.replace('Semana ', 'S')}: </span>}{fmt(Number(p[s.key]), decimals)}
                      </p>
                    ))}
                  </div>
                  {!multi && p.detail && <p className="text-muted-foreground">{p.detail}</p>}
                </div>
              );
            }}
          />
          {multi && !many && <Legend verticalAlign="top" height={24} iconSize={10} wrapperStyle={{ fontSize: 11 }} />}
          {refLines.map((r) => (
            <ReferenceLine key={r.label} y={r.y} stroke={r.color} strokeDasharray="5 4" strokeWidth={1.5}
              label={{ value: r.label, position: 'insideTopLeft', fontSize: 10, fill: r.color }} />
          ))}
          {ser.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.name} fill={multi ? colorOf(i) : 'hsl(var(--chart-3) / 0.55)'}
              fillOpacity={multi && !many ? 0.8 : 1} stroke={multi ? undefined : 'hsl(var(--chart-3))'} radius={[3, 3, 0, 0]} maxBarSize={multi ? (many ? 8 : 14) : 28}>
              {!multi && <LabelList dataKey={s.key} position="top" fontSize={9} fill="hsl(var(--foreground))" formatter={(v: unknown) => short(Number(v), decimals)} />}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
      </div>
    </div>
  );
}
