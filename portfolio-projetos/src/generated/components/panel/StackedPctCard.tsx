import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Panel, SectionTitle } from '../ui-bits';

export type Bucket = { key: string; label: string; color: string };
type Row = { name: string; total: number } & Record<string, number | string>;

/** Barras horizontais empilhadas 100% (uma por projeto). Clique em um segmento abre os itens. */
export function StackedPctCard<T>({ title, buckets, list, groupOf, bucketOf, onPick }: {
  title: string; buckets: Bucket[]; list: T[]; groupOf: (x: T) => string; bucketOf: (x: T) => string;
  onPick: (group: string, bucket: Bucket, items: T[]) => void;
}) {
  const groups = new Map<string, T[]>();
  list.forEach((x) => { const g = groupOf(x); groups.set(g, [...(groups.get(g) ?? []), x]); });
  const rows: Row[] = [...groups.entries()].map(([name, items]) => {
    const r: Row = { name, total: items.length };
    buckets.forEach((b) => { r[b.key] = items.filter((x) => bucketOf(x) === b.key).length; });
    return r;
  }).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const h = Math.max(160, rows.length * 34 + 70);
  const short = (s: string) => (s.length > 34 ? `${s.slice(0, 33)}…` : s);
  return (
    <Panel>
      <SectionTitle>{title}</SectionTitle>
      {rows.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Sem dados no recorte.</p> : (
        <div style={{ height: h }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" stackOffset="expand" margin={{ left: 4, right: 12, top: 4, bottom: 4 }}>
              <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tickFormatter={(v: number) => `${Math.round(v * 100)}%`} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={190} tickFormatter={short} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v, n, p) => { const t = Number((p.payload as Row).total) || 1; return [`${v} (${Math.round((Number(v) / t) * 100)}%)`, n]; }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {buckets.map((b) => (
                <Bar key={b.key} dataKey={b.key} name={b.label} stackId="a" fill={b.color} cursor="pointer"
                  onClick={(d: { payload?: Row }) => { const g = d.payload?.name; if (g) onPick(g, b, (groups.get(g) ?? []).filter((x) => bucketOf(x) === b.key)); }} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}
