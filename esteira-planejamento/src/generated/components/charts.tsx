import { useId, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useReducedMotion } from '@generated/components/fx/motion';

export interface Datum {
  label: string;
  value: number;
  color?: string;
}

const AXIS = 'hsl(var(--muted-foreground))';
const GRID = 'hsl(var(--border))';

function TipBox({ active, payload }: { active?: boolean; payload?: { payload: Datum }[] }) {
  const d = payload?.[0]?.payload;
  if (!active || !d) return null;
  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground">
      <p className="font-medium">{d.label}</p>
      <p className="tnum text-muted-foreground">{d.value} projeto{d.value === 1 ? '' : 's'}</p>
    </div>
  );
}

interface Clicavel { onSelect?: (label: string) => void; selected?: string | null }

/** Opacity: the clicked category wins; otherwise the hovered bar stays full and the others dim to .35. */
function opac(sel: string | null | undefined, hover: number | null, label: string, i: number) {
  if (sel) return sel === label ? 1 : 0.3;
  if (hover !== null) return hover === i ? 1 : 0.35;
  return 1;
}

/** Brand gradient (212 → 199); `vertical` for column bars. */
function gradiente(id: string, vertical?: boolean) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1={vertical ? '1' : '0'} x2={vertical ? '0' : '1'} y2="0">
        <stop offset="0%" stopColor="hsl(212 74% 58%)" />
        <stop offset="100%" stopColor="hsl(199 55% 52%)" />
      </linearGradient>
    </defs>
  );
}

export function HBarChart({ data, height, labelWidth = 170, onSelect, selected }: { data: Datum[]; height: number; labelWidth?: number } & Clicavel) {
  const gid = `hb-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [hover, setHover] = useState<number | null>(null);
  const reduz = useReducedMotion();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 36, bottom: 4, left: 4 }} barCategoryGap={6}
        onMouseLeave={() => setHover(null)}>
        {gradiente(gid)}
        <CartesianGrid horizontal={false} stroke={GRID} strokeDasharray="0" />
        <XAxis type="number" allowDecimals={false} tick={{ fill: AXIS, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="label" width={labelWidth} tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
          axisLine={false} tickLine={false} interval={0} />
        <Tooltip cursor={{ fill: 'hsl(var(--surface-3))' }} content={<TipBox />} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={!reduz} animationDuration={600}
          className={onSelect ? 'cursor-pointer' : undefined}
          onMouseEnter={(_, i) => setHover(i)} onMouseLeave={() => setHover(null)}
          onClick={(_, i) => { const d = data[i]; if (d && onSelect) onSelect(d.label); }}>
          {data.map((d, i) => (
            <Cell key={d.label} fill={d.color ?? `url(#${gid})`} fillOpacity={opac(selected, hover, d.label, i)}
              className="transition-[fill-opacity] duration-200"
              stroke={selected === d.label ? 'hsl(var(--foreground))' : undefined} strokeWidth={selected === d.label ? 1.5 : 0} />
          ))}
          <LabelList dataKey="value" position="right" fill="hsl(var(--foreground))" fontSize={12} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function VBarChart({ data, height, onSelect, selected }: { data: Datum[]; height: number } & Clicavel) {
  const gid = `vb-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [hover, setHover] = useState<number | null>(null);
  const reduz = useReducedMotion();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 18, right: 8, bottom: 0, left: -18 }} barCategoryGap={4} onMouseLeave={() => setHover(null)}>
        {gradiente(gid, true)}
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 11 }} axisLine={false} tickLine={false} interval={0} />
        <YAxis allowDecimals={false} tick={{ fill: AXIS, fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip cursor={{ fill: 'hsl(var(--surface-3))' }} content={<TipBox />} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={!reduz} animationDuration={600}
          className={onSelect ? 'cursor-pointer' : undefined}
          onMouseEnter={(_, i) => setHover(i)} onMouseLeave={() => setHover(null)}
          onClick={(_, i) => { const d = data[i]; if (d && onSelect) onSelect(d.label); }}>
          {data.map((d, i) => (
            <Cell key={d.label} fill={`url(#${gid})`} fillOpacity={opac(selected, hover, d.label, i)} className="transition-[fill-opacity] duration-200"
              stroke={selected === d.label ? 'hsl(var(--foreground))' : undefined} strokeWidth={selected === d.label ? 1.5 : 0} />
          ))}
          <LabelList dataKey="value" position="top" fill="hsl(var(--foreground))" fontSize={11} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Thin stacked composition bar for the pipeline. */
export function CompositionBar({ data }: { data: Datum[] }) {
  const row: Record<string, number | string> = { k: 'esteira' };
  data.forEach((d, i) => (row[`s${i}`] = d.value));
  return (
    <ResponsiveContainer width="100%" height={14}>
      <BarChart data={[row]} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barCategoryGap={0}>
        <XAxis type="number" hide domain={[0, 'dataMax']} />
        <YAxis type="category" dataKey="k" hide />
        {data.map((d, i) => (
          <Bar key={d.label} dataKey={`s${i}`} stackId="a" fill={d.color} isAnimationActive={false} stroke="hsl(var(--card))" strokeWidth={1} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
