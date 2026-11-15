import { forwardRef, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmtBRL, fmtPct } from '@generated/lib/format';
import { rotuloMes } from '@generated/lib/periodo';
import type { PontoMes } from '@generated/lib/indicadores';

export interface Paleta { orc: string; plan: string; saldo: string; neg: string; status: string; texto: string; eixo: string; grade: string }
/** Screen: theme tokens. Report / exports: sober fixed colors that print well. */
export const PALETA_TELA: Paleta = {
  orc: 'hsl(var(--chart-1))', plan: 'hsl(var(--chart-3))', saldo: 'hsl(var(--chart-2))', neg: 'hsl(var(--danger))',
  status: 'hsl(var(--chart-5))', texto: 'hsl(var(--foreground))', eixo: 'hsl(var(--muted-foreground))', grade: 'hsl(var(--border))',
};
export const PALETA_IMPRESSAO: Paleta = {
  orc: '#2F4A6D', plan: '#9DB3CC', saldo: '#3D6B57', neg: '#A8382C', status: '#5B6B7F', texto: '#1F2937', eixo: '#4B5563', grade: '#E5E7EB',
};

const compacto = (v: number) => new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(v);
const dec = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const rotuloValor = (v: unknown) => (typeof v === 'number' && v !== 0 ? compacto(v) : '');
const mesCurto = (m: string) => rotuloMes(m).replace(/\/(\d{2})(\d{2})$/, '/$2');

interface Base { p: Paleta; altura?: number; animar?: boolean }

function TipValor({ active, payload, label }: { active?: boolean; payload?: { name?: string; value?: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground">
      <p className="font-medium">{label ? mesCurto(label) : ''}</p>
      {payload.map((x) => <p key={x.name} className="tnum text-muted-foreground">{x.name}: {fmtBRL(x.value ?? 0)}</p>)}
    </div>
  );
}

export function OrcPlanMes({ dados, p, altura = 280, animar = true }: Base & { dados: PontoMes[] }) {
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <BarChart data={dados} margin={{ top: 22, right: 8, bottom: 0, left: 4 }} barGap={2}>
        <CartesianGrid vertical={false} stroke={p.grade} />
        <XAxis dataKey="mes" tickFormatter={mesCurto} tick={{ fill: p.eixo, fontSize: 11 }} axisLine={false} tickLine={false} interval={0} />
        <YAxis tickFormatter={compacto} tick={{ fill: p.eixo, fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
        <Tooltip content={<TipValor />} cursor={{ fill: p.grade, opacity: 0.4 }} />
        <Legend wrapperStyle={{ fontSize: 12, color: p.texto }} iconType="square" />
        <Bar dataKey="orc" name="Orçado" fill={p.orc} maxBarSize={22} isAnimationActive={animar}>
          <LabelList dataKey="orc" position="top" formatter={rotuloValor} fill={p.texto} fontSize={10} />
        </Bar>
        <Bar dataKey="plan" name="Planejado" fill={p.plan} maxBarSize={22} isAnimationActive={animar}>
          <LabelList dataKey="plan" position="top" formatter={rotuloValor} fill={p.texto} fontSize={10} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function TipSaldo({ active, payload, label }: { active?: boolean; payload?: { payload?: PontoMes }[]; label?: string }) {
  const x = payload?.[0]?.payload;
  if (!active || !x) return null;
  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground">
      <p className="font-medium">{label ? mesCurto(label) : ''}</p>
      <ul className="tnum text-muted-foreground">
        <li>% de saldo: {fmtPct(x.pct)}</li>
        <li>Saldo: {fmtBRL(x.saldo)}</li>
        <li>Orçado: {fmtBRL(x.orc)}</li>
      </ul>
    </div>
  );
}
const pctEixo = (v: number) => `${dec.format(v)}%`;
const rotuloPct = (v: unknown) => (typeof v === 'number' ? pctEixo(v) : '');

/** % of saldo per month (Saldo ÷ Orçado × 100, Total cut); the R$ stays in the tooltip. */
export function SaldoMes({ dados, p, altura = 260, animar = true }: Base & { dados: PontoMes[] }) {
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <LineChart data={dados} margin={{ top: 22, right: 16, bottom: 0, left: 4 }}>
        <CartesianGrid vertical={false} stroke={p.grade} />
        <XAxis dataKey="mes" tickFormatter={mesCurto} tick={{ fill: p.eixo, fontSize: 11 }} axisLine={false} tickLine={false} interval={0} />
        <YAxis tickFormatter={pctEixo} tick={{ fill: p.eixo, fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
        <Tooltip content={<TipSaldo />} />
        <Line type="monotone" dataKey="pct" name="% de saldo" stroke={p.saldo} strokeWidth={2} dot={{ r: 3, fill: p.saldo }} connectNulls isAnimationActive={animar}>
          <LabelList dataKey="pct" position="top" formatter={rotuloPct} fill={p.texto} fontSize={10} />
        </Line>
      </LineChart>
    </ResponsiveContainer>
  );
}

export function StatusBarras({ dados, p, animar = true }: Base & { dados: { label: string; value: number }[] }) {
  const altura = Math.max(120, dados.length * 30 + 20);
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <BarChart data={dados} layout="vertical" margin={{ top: 4, right: 36, bottom: 4, left: 4 }} barCategoryGap={6}>
        <CartesianGrid horizontal={false} stroke={p.grade} />
        <XAxis type="number" allowDecimals={false} tick={{ fill: p.eixo, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="label" width={200} tick={{ fill: p.texto, fontSize: 12 }} axisLine={false} tickLine={false} interval={0} />
        <Bar dataKey="value" name="Projetos" fill={p.status} radius={[0, 3, 3, 0]} maxBarSize={18} isAnimationActive={animar}>
          <LabelList dataKey="value" position="right" fill={p.texto} fontSize={12} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Titled frame of a chart; forwards the ref so the report can capture it as an image. */
export const Quadro = forwardRef<HTMLDivElement, { titulo: string; nota?: ReactNode; children: ReactNode; className?: string }>(
  function Quadro({ titulo, nota, children, className }, ref) {
    return (
      <div ref={ref} className={className ?? 'min-w-0 rounded-[var(--radius-lg)] border border-border bg-card p-4'}>
        <p className="text-sm font-semibold text-foreground">{titulo}</p>
        {nota && <p className="mb-2 text-[11px] text-muted-foreground">{nota}</p>}
        {children}
      </div>
    );
  },
);
