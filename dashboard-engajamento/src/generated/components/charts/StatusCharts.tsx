import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { PersonWeek } from '@generated/lib/engagementMetrics';

// Situação da pessoa na semana, com as cores dos gráficos do quadro
export const STATUSES = [
  { key: 'never', label: 'Novo / Nunca logou', color: '#bb3354' },
  { key: 'disengaged', label: 'Desengajado', color: '#ffcb00' },
  { key: 'inactive', label: 'Inativo', color: '#df2f4a' },
  { key: 'engaged', label: 'Engajado', color: '#00c875' },
  { key: 'away', label: 'Afastado', color: '#a0a6b5' },
] as const;
type StatusKey = (typeof STATUSES)[number]['key'];

export function statusOf(p: PersonWeek): StatusKey {
  if (p.activeAbsence) return 'away';
  if (p.engaged) return 'engaged';
  if (p.daysWithoutAccess === null) return 'never';
  return p.inactive ? 'inactive' : 'disengaged';
}

function count(people: PersonWeek[]): Record<StatusKey, number> {
  const c = { never: 0, disengaged: 0, inactive: 0, engaged: 0, away: 0 };
  people.forEach((p) => { c[statusOf(p)]++; });
  return c;
}

const axisTick = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' };

/** Barras com a quantidade de pessoas em cada situação. */
export function StatusBarChart({ people, height = 260 }: { people: PersonWeek[]; height?: number }) {
  const c = count(people);
  // "Nunca logou" e "Afastado" só aparecem quando há alguém neles
  const data = STATUSES.filter((s) => c[s.key] > 0 || (s.key !== 'never' && s.key !== 'away')).map((s) => ({ ...s, value: c[s.key] }));
  if (!people.length) return <p className="py-10 text-center text-xs text-muted-foreground">Sem pessoas no recorte.</p>;
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisTick} interval={0} />
          <YAxis tickLine={false} axisLine={false} tick={axisTick} allowDecimals={false} />
          <Tooltip cursor={{ fill: 'hsl(var(--muted) / 0.5)' }} formatter={(v) => [`${v} pessoas`, 'Pessoas']} />
          <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={120}>
            {data.map((d) => <Cell key={d.key} fill={d.color} />)}
            <LabelList dataKey="value" position="top" fontSize={11} fill="hsl(var(--foreground))" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Uma barra horizontal empilhada por grupo (ex.: departamento), com a situação das pessoas. */
export function StatusByGroupChart({ groups, onSelect }: { groups: { name: string; people: PersonWeek[] }[]; onSelect?: (name: string) => void }) {
  const used = new Set<StatusKey>();
  const data = groups.map((g) => {
    const c = count(g.people);
    (Object.keys(c) as StatusKey[]).forEach((k) => { if (c[k]) used.add(k); });
    return { name: g.name, total: g.people.length, ...c };
  }).sort((a, b) => a.total - b.total);
  if (!data.length) return <p className="py-10 text-center text-xs text-muted-foreground">Sem pessoas no recorte.</p>;
  const series = STATUSES.filter((s) => used.has(s.key));
  return (
    <div style={{ height: Math.max(240, data.length * 30 + 70) }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 36, bottom: 0, left: 8 }}
          onClick={(e) => { const n = e?.activeLabel; if (onSelect && n) onSelect(String(n)); }}>
          <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
          <XAxis type="number" tickLine={false} axisLine={false} tick={axisTick} allowDecimals={false} />
          <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={150} tick={{ ...axisTick, fontSize: 10 }} interval={0} />
          <Tooltip cursor={{ fill: 'hsl(var(--muted) / 0.5)' }} />
          <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} stackId="a" fill={s.color} maxBarSize={18} cursor={onSelect ? 'pointer' : undefined}>
              {i === series.length - 1 && <LabelList dataKey="total" position="right" fontSize={10} fill="hsl(var(--foreground))" />}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
