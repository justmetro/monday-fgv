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
/** Marcas regulares do eixo Y (0; 0,5; 1... ou 0; 50; 100...). */
function niceTicks(max: number): number[] {
  const raw = (max || 1) / 5;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((x) => x >= raw) ?? 10 * pow;
  const top = Math.max(step, Math.ceil((max - 1e-9) / step) * step);
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => Math.round(i * step * 1000) / 1000);
}
/** Nome curto no eixo; o nome inteiro fica no tooltip. */
const abbr = (s: string, n = 18) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** Barras por projeto em ordem crescente, com rótulo do valor e linhas de referência opcionais. */
export function ProjectBarChart({ data: rawData, series: rawSeries, decimals = 0, refLines = [], height = 320, emptyText = 'Sem projetos nas semanas escolhidas.' }: Props) {
  if (!rawData.length) return <p className="py-10 text-center text-xs text-muted-foreground">{emptyText}</p>;
  let data = rawData;
  let series = rawSeries;
  // Até 3 projetos com várias semanas: as semanas vão para o eixo X e cada projeto vira uma série
  if (rawSeries && rawSeries.length > 1 && rawData.length <= 3) {
    data = rawSeries.map((s) => {
      const row: ProjectBar = { label: s.name, full: s.name, value: 0 };
      rawData.forEach((d, i) => { if (d[s.key] !== undefined) row[`p${i}`] = d[s.key]; });
      if (rawData.length === 1) row.value = Number(row.p0 ?? 0);
      return row;
    }).filter((r) => rawData.some((_, i) => r[`p${i}`] !== undefined));
    series = rawData.length === 1 ? undefined : rawData.map((d, i) => ({ key: `p${i}`, name: d.label }));
  }
  const ser = series?.length ? series : [{ key: 'value', name: rawData.length === 1 && rawSeries && rawSeries.length > 1 ? rawData[0].full : 'Valor' }];
  const multi = ser.length > 1;
  const values = data.flatMap((d) => ser.map((s) => Number(d[s.key] ?? 0)));
  const max = Math.max(...values, ...refLines.map((r) => r.y));
  const ticks = niceTicks(max);
  // Poucas barras: gráfico estreito e nomes na horizontal
  const few = !multi && data.length <= 4;
  // Mais de 3 projetos e várias semanas: tabela de calor (barras agrupadas ficam ilegíveis)
  if (multi && data.length > 3) return <HeatTable data={data} series={ser} decimals={decimals} refLines={refLines} />;
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
    <div style={{ height: multi && !many ? height + 24 : height, minWidth, maxWidth: few ? data.length * 180 + 120 : undefined }} className="w-full mx-auto [&_*:focus]:outline-none">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 18, right: 8, bottom: 0, left: -8 }} barGap={1} accessibilityLayer={false}>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} angle={few ? 0 : -45} textAnchor={few ? 'middle' : 'end'} height={few ? 30 : 96}
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v: string) => abbr(v)} />
          <YAxis tickLine={false} axisLine={false} width={44} ticks={ticks} domain={[0, ticks[ticks.length - 1]]} interval={0}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} />
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
              fillOpacity={multi && !many ? 0.8 : 1} stroke={multi ? undefined : 'hsl(var(--chart-3))'} radius={[3, 3, 0, 0]} maxBarSize={multi ? (many ? 8 : 14) : 28} minPointSize={2}>
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

/** Linhas = projetos, colunas = semanas; cor pela faixa esperada (com linhas de referência) ou pela intensidade. */
function HeatTable({ data, series, decimals, refLines }: { data: ProjectBar[]; series: BarSeries[]; decimals: number; refLines: { y: number; label: string }[] }) {
  const ys = refLines.map((r) => r.y).sort((a, b) => a - b);
  const latest = series[series.length - 1].key;
  const rows = [...data].sort((a, b) => Number(b[latest] ?? -1) - Number(a[latest] ?? -1));
  const max = Math.max(1, ...rows.flatMap((r) => series.map((s) => Number(r[s.key] ?? 0))));
  const bg = (v: number) => {
    if (ys.length >= 2) {
      if (v < ys[0]) return `rgba(223, 47, 74, ${0.12 + 0.35 * (1 - v / ys[0])})`;
      if (v <= ys[ys.length - 1]) return 'rgba(0, 200, 117, 0.35)';
      return 'rgba(0, 200, 117, 0.6)';
    }
    return `hsl(var(--chart-3) / ${(0.08 + 0.72 * (v / max)).toFixed(2)})`;
  };
  return (
    <div className="space-y-2">
      {ys.length >= 2 && (
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-4 rounded-sm" style={{ background: 'rgba(223,47,74,0.4)' }} />Abaixo de {fmt(ys[0], 0)}</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-4 rounded-sm" style={{ background: 'rgba(0,200,117,0.35)' }} />Entre {fmt(ys[0], 0)} e {fmt(ys[ys.length - 1], 0)}</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-4 rounded-sm" style={{ background: 'rgba(0,200,117,0.6)' }} />Acima de {fmt(ys[ys.length - 1], 0)}</span>
        </div>
      )}
      <div className="max-h-[520px] overflow-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-[11px] tabular-nums">
          <thead className="sticky top-0 z-10 bg-card">
            <tr>
              <th className="sticky left-0 z-20 bg-card px-2 py-1.5 text-left font-medium text-muted-foreground">Projeto</th>
              {series.map((s) => (
                <th key={s.key} className="px-1 py-1.5 text-center font-medium text-muted-foreground whitespace-nowrap">{s.name.replace('Semana ', 'S')}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-border/60">
                <td className="sticky left-0 z-10 max-w-[200px] truncate bg-card px-2 py-1 text-foreground" title={r.full}>{r.label}</td>
                {series.map((s) => {
                  const v = r[s.key];
                  return (
                    <td key={s.key} className="px-0.5 py-0.5">
                      <div className="min-w-[38px] rounded px-1 py-1 text-center text-foreground" title={`${r.full} · ${s.name}`}
                        style={{ background: v === undefined ? 'transparent' : bg(Number(v)) }}>
                        {v === undefined ? <span className="text-muted-foreground">·</span> : short(Number(v), decimals)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
