import type { ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Panel, SectionTitle } from '../ui-bits';

/** Paleta obrigatória dos gráficos novos. */
export const PAL = ['#04487C', '#5CBCD0', '#8A93C6', '#D0CB00', '#EE6184'] as const;
export const palAt = (i: number) => PAL[i % PAL.length] ?? PAL[0];
const tip = { contentStyle: { background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 12 } };

export type Datum<T> = { name: string; value: number; items: T[] };

export function countBy<T>(list: T[], key: (x: T) => string | string[]): Datum<T>[] {
  const map = new Map<string, T[]>();
  list.forEach((x) => { const ks = key(x); (Array.isArray(ks) ? (ks.length ? ks : ['Não informado']) : [ks]).forEach((kk) => map.set(kk, [...(map.get(kk) ?? []), x])); });
  return [...map.entries()].map(([name, items]) => ({ name, value: items.length, items })).sort((a, b) => b.value - a.value);
}

/** Barras clicáveis (horizontal por padrão: rótulos longos cabem melhor). */
export function BarCard<T>({ title, data, onPick, aside, colorBy, height }: { title: string; data: Datum<T>[]; onPick: (d: Datum<T>) => void; aside?: ReactNode; colorBy?: (name: string, i: number) => string; height?: number }) {
  const h = height ?? Math.max(160, Math.min(data.length, 12) * 34 + 30);
  return (
    <Panel>
      <SectionTitle aside={aside}>{title}</SectionTitle>
      {data.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Sem dados no recorte.</p> : (
        <div style={{ height: h }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.slice(0, 12)} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
              <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v: string) => (v.length > 22 ? `${v.slice(0, 21)}…` : v)} />
              <Tooltip {...tip} cursor={{ fill: 'hsl(var(--muted))' }} />
              <Bar dataKey="value" name="Itens" radius={[0, 3, 3, 0]} className="cursor-pointer" onClick={(d: unknown) => { const x = (d as { payload?: Datum<T> }).payload; if (x) onPick(x); }}>
                {data.slice(0, 12).map((d, i) => <Cell key={d.name} fill={colorBy ? colorBy(d.name, i) : palAt(i)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}

/** Barras agrupadas (ex.: previstos × entregues por mês). */
export function GroupedBars({ title, data, series, onPick }: { title: string; data: Record<string, string | number>[]; series: { key: string; label: string }[]; onPick?: (row: Record<string, string | number>, key: string) => void }) {
  return (
    <Panel>
      <SectionTitle>{title}</SectionTitle>
      {data.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Sem dados no recorte.</p> : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={36} />
              <Tooltip {...tip} cursor={{ fill: 'hsl(var(--muted))' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {series.map((s, i) => <Bar key={s.key} dataKey={s.key} name={s.label} fill={palAt(i)} radius={[3, 3, 0, 0]} className="cursor-pointer" onClick={(d: unknown) => { const x = (d as { payload?: Record<string, string | number> }).payload; if (x && onPick) onPick(x, s.key); }} />)}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}

/** Faixa de KPIs clicáveis no mesmo padrão visual do painel de indicadores. */
export function KpiRow({ items }: { items: { label: string; value: string; hint?: string; tone?: 'bad' | 'warn' | 'ok'; onClick?: () => void }[] }) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid-cols-6">
      {items.map((k) => (
        <button key={k.label} onClick={k.onClick} disabled={!k.onClick} className="min-w-0 bg-card p-4 text-left enabled:hover:bg-muted/60">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{k.label}</p>
          <p className={`mt-1 truncate font-mono font-light tabular-nums ${k.value.length > 10 ? 'text-lg' : 'text-2xl'} ${k.tone === 'bad' ? 'text-destructive' : k.tone === 'warn' ? 'text-[hsl(var(--warn))]' : k.tone === 'ok' ? 'text-[hsl(var(--ok))]' : ''}`}>{k.value}</p>
          {k.hint && <p className="mt-0.5 text-xs text-muted-foreground">{k.hint}</p>}
        </button>
      ))}
    </div>
  );
}
