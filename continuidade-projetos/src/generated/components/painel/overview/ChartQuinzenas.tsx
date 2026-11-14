import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts';
import { X } from 'lucide-react';
import { ChartContainer, ChartTooltip, type ChartConfig } from '@components/ui/chart';
import { Skeleton } from '@components/ui/skeleton';
import { COR_MODALIDADE, MODALIDADES } from '@generated/lib/negocio';
import type { DQuinzena } from '@generated/lib/quinzenas';

const LEGENDA: Record<string, string> = {
  CLT: 'bg-[hsl(var(--chart-1))]', Bolsa: 'bg-[hsl(var(--chart-2))]', 'RPA fixo': 'bg-[hsl(var(--chart-3))]', 'Estágio': 'bg-[hsl(var(--chart-4))]',
};
const cfg = Object.fromEntries(MODALIDADES.map((m) => [m, { label: m, color: COR_MODALIDADE[m] }])) satisfies ChartConfig;

export function ChartQuinzenas({ data, loading, selecionada, onSelect }: {
  data: DQuinzena[]; loading: boolean; selecionada: string | null; onSelect: (key: string | null) => void;
}) {
  const total = data.reduce((s, d) => s + d.total, 0);
  const sel = data.find((d) => d.key === selecionada);
  return (
    <section className="soft-stack flex min-w-0 flex-col rounded-xl bg-card p-5" aria-labelledby="q-titulo">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 id="q-titulo" className="text-base font-semibold tracking-[-0.01em] text-foreground">Finalização de atuação prevista por quinzena</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Próximas 12 quinzenas · cada pessoa conta uma vez, na data final do último projeto dela · {total} pessoa(s). Clique numa barra para filtrar a lista.
          </p>
        </div>
        {sel && (
          <button type="button" onClick={() => onSelect(null)} className="inline-flex min-h-9 items-center gap-1 rounded-full border border-primary/60 bg-[hsl(var(--info-soft))] px-3 text-xs font-medium text-[hsl(var(--info-ink))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {sel.label} <X className="size-3.5" aria-label="Limpar filtro de quinzena" />
          </button>
        )}
      </div>
      <div className="mt-4">
        {loading ? <Skeleton className="h-[240px] w-full" /> : (
          <ChartContainer config={cfg} className="aspect-auto h-[240px] w-full">
            <BarChart
              data={data}
              margin={{ left: -16, right: 4 }}
              onClick={(s) => {
                const i = Number(s?.activeTooltipIndex);
                const d = Number.isFinite(i) ? data[i] : undefined;
                if (d) onSelect(d.key === selecionada ? null : d.key);
              }}
              className="cursor-pointer"
            >
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval="preserveStartEnd" />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <ChartTooltip cursor={{ fillOpacity: 0.4 }} content={(p) => {
                const d = p.payload?.[0]?.payload as DQuinzena | undefined;
                if (!p.active || !d) return null;
                return (
                  <div className="min-w-44 rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
                    <p className="mb-1 font-medium">{d.titulo}</p>
                    {MODALIDADES.filter((m) => d[m] > 0).map((m) => (
                      <p key={m} className="flex justify-between gap-4"><span className="text-muted-foreground">{m}</span><span className="tnum font-medium">{d[m]}</span></p>
                    ))}
                    <p className="mt-1 flex justify-between gap-4 border-t border-border pt-1"><span>Total</span><span className="tnum font-medium">{d.total}</span></p>
                  </div>
                );
              }} />
              {MODALIDADES.map((m, idx) => (
                <Bar key={m} dataKey={m} stackId="m" fill={COR_MODALIDADE[m]} radius={idx === MODALIDADES.length - 1 ? [3, 3, 0, 0] : 0}>
                  {data.map((d) => <Cell key={d.key} fill={COR_MODALIDADE[m]} fillOpacity={selecionada && d.key !== selecionada ? 0.35 : 1} />)}
                </Bar>
              ))}
            </BarChart>
          </ChartContainer>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {MODALIDADES.map((m) => (
          <span key={m} className="inline-flex items-center gap-1.5"><span className={`size-2 rounded-sm ${LEGENDA[m]}`} aria-hidden />{m}</span>
        ))}
      </div>
    </section>
  );
}
