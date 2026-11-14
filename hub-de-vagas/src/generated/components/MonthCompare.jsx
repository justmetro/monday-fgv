import { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { toDate, MONTHS } from '@generated/lib/data';
import { normKey } from '@generated/lib/normalize';
import { todayUTC, isOne } from '@generated/lib/dates';
import { CountUp } from '@generated/components/Age';
import { cn } from '@lib/utils';

const mIdx = (d) => d.getUTCFullYear() * 12 + d.getUTCMonth();
const inMonth = (v, k) => { const d = toDate(v); return !!d && mIdx(d) === k; };
const mLabel = (k, short) => `${short ? MONTHS[k % 12].slice(0, 3) : MONTHS[k % 12]}/${short ? String(Math.floor(k / 12)).slice(2) : Math.floor(k / 12)}`;

export const METRICS = [
  { id: 'abertas', label: 'Vagas abertas', hint: 'em aberto no fim do mês', up: 'neutral', color: 'hsl(var(--chart-1))' },
  { id: 'preenchidas', label: 'Vagas preenchidas', hint: 'data de preenchimento no mês', up: 'good', color: 'hsl(var(--chart-2))' },
  { id: 'atrasadas', label: 'Vagas atrasadas', hint: 'abertas com início previsto vencido', up: 'bad', color: 'hsl(var(--destructive))' },
  { id: 'matches', label: 'Matches iniciados', hint: 'card enviado no mês', up: 'good', color: 'hsl(var(--chart-3))' },
  { id: 'realocacoes', label: 'Realocações concluídas', hint: 'perfil realocado com processo encerrado no mês', up: 'good', color: 'hsl(var(--chart-4))' },
  { id: 'progRec', label: 'Progressões recebidas', hint: 'pedido recebido no mês', up: 'neutral', color: 'hsl(var(--warning))' },
  { id: 'progEf', label: 'Progressões efetivadas', hint: 'efetivação em folha no mês', up: 'good', color: 'hsl(var(--chart-5))' },
];

function compute(data, k, today) {
  const y = Math.floor(k / 12), m = k % 12;
  const endT = Math.min(Date.UTC(y, m + 1, 1) - 1, Math.max(today, Date.UTC(y, m, 1)));
  const lateRef = Math.min(Date.UTC(y, m + 1, 1) - 1, today);
  const abertas = (data.allVagas ?? data.vagas).filter((v) => {
    const opened = toDate(v.dataDeAberturaDaVaga ?? v.createdAt);
    const fill = toDate(v.dataDePreenchimento);
    if (!opened || opened.getTime() > endT || normKey(v.statusDaVaga) === 'cancelada') return false;
    if (fill && fill.getTime() <= endT) return false;
    return isOne(v.vagaEmAberto) || !!fill;
  });
  return {
    abertas: abertas.length,
    atrasadas: abertas.filter((v) => { const d = toDate(v.dataDeIncioPrevista); return d && d.getTime() < lateRef; }).length,
    preenchidas: (data.allVagas ?? data.vagas).filter((v) => inMonth(v.dataDePreenchimento, k)).length,
    matches: (data.allMatches ?? data.matches).filter((x) => inMonth(x.dataDeEnvioDoCard, k)).length,
    realocacoes: data.perfis.filter((p) => normKey(p.statusDoPerfil).startsWith('realocad') && inMonth(p.dataDeEncerramentoDoProcesso ?? p.dataDeIncioNoDestino, k)).length,
    progRec: data.progs.filter((p) => inMonth(p.dataDeRecebimentoDoPedido, k)).length,
    progEf: data.progs.filter((p) => inMonth(p.dataDeEfetivaoEmFolha, k)).length,
  };
}

function Delta({ cur, prev, up }) {
  const diff = cur - prev;
  const pct = prev ? Math.round((diff / prev) * 100) : null;
  const Icon = diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus;
  const good = up === 'neutral' || diff === 0 ? null : (diff > 0) === (up === 'good');
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs tabular-nums', good === true && 'text-primary', good === false && 'text-destructive', good === null && 'text-muted-foreground')}
      title={`Mês anterior: ${prev}`}>
      <Icon className="h-3.5 w-3.5" />{diff > 0 ? '▲' : diff < 0 ? '▼' : ''} {pct != null ? `${Math.abs(pct)}%` : diff ? 'novo' : '0%'}
      <span className="text-muted-foreground">({diff > 0 ? '+' : ''}{diff})</span>
    </span>
  );
}

export default function MonthCompare({ data }) {
  const today = todayUTC();
  const nowK = mIdx(new Date(today));
  const [k, setK] = useState(nowK);
  const [hidden, setHidden] = useState(() => new Set());
  const options = Array.from({ length: 12 }, (_, i) => nowK - i);
  const cur = useMemo(() => compute(data, k, today), [data, k, today]);
  const prev = useMemo(() => compute(data, k - 1, today), [data, k, today]);
  const series = useMemo(() => Array.from({ length: 6 }, (_, i) => k - 5 + i).map((mk) => ({ mes: mLabel(mk, true), ...compute(data, mk, today) })), [data, k, today]);
  const toggle = (id) => setHidden((h) => { const s = new Set(h); if (s.has(id)) s.delete(id); else s.add(id); return s; });

  return (
    <section className="rounded-md border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Comparação entre períodos</h2>
          <p className="text-xs text-muted-foreground">{mLabel(k)} comparado a {mLabel(k - 1)}</p>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">Mês de referência
          <select value={k} onChange={(e) => setK(Number(e.target.value))} className="h-9 rounded-full border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {options.map((o) => <option key={o} value={o}>{mLabel(o)}</option>)}
          </select>
        </label>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {METRICS.map((mt) => (
          <div key={mt.id} title={mt.hint} className="lift flex min-w-0 flex-col gap-1 rounded-md border border-border bg-background/50 p-3">
            <span className="truncate text-xs text-muted-foreground">{mt.label}</span>
            <span className="text-2xl font-medium tabular-nums tracking-tight"><CountUp value={cur[mt.id]} /></span>
            <Delta cur={cur[mt.id]} prev={prev[mt.id]} up={mt.up} />
          </div>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-1.5">
        {METRICS.map((mt) => (
          <button key={mt.id} onClick={() => toggle(mt.id)} aria-pressed={!hidden.has(mt.id)}
            className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-opacity', hidden.has(mt.id) ? 'border-border opacity-50' : 'border-border bg-muted')}>
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: mt.color }} />{mt.label}
          </button>
        ))}
      </div>
      <div className="mt-3 h-64">
        <ResponsiveContainer>
          <LineChart data={series} margin={{ left: -20, right: 12, top: 8 }}>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="mes" stroke="hsl(var(--border))" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} stroke="hsl(var(--border))" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 12, boxShadow: 'var(--shadow-pop)' }}
              labelStyle={{ color: 'hsl(var(--popover-foreground))' }} itemStyle={{ color: 'hsl(var(--popover-foreground))' }} />
            {METRICS.filter((mt) => !hidden.has(mt.id)).map((mt) => (
              <Line key={mt.id} type="monotone" dataKey={mt.id} name={mt.label} stroke={mt.color} strokeWidth={2} dot={{ r: 2.5 }} activeDot={{ r: 4 }} isAnimationActive />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
