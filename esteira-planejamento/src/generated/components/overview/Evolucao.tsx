import { useEffect, useMemo, useRef, useState } from 'react';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { useVibeQuery } from '@vibe/db/client';
import { cn } from '@lib/utils';
import { type Projeto, fmtBRLCompact, fmtDate, fmtInt } from '@generated/lib/format';
import { type Granularidade, historicoDesde, metricasAtuais, serie } from '@generated/lib/evolucao';
import { snapshotsSemanais } from '@generated/models';
import { listarSnapshots, gravarSnapshot } from '@generated/server/snapshots';
import { Panel, InfoDica } from '@generated/components/ui-bits';

type Metrica = 'fluxo' | 'saldo';
const METRICAS: { k: Metrica; label: string }[] = [{ k: 'fluxo', label: 'Em planejamento' }, { k: 'saldo', label: 'Saldo financeiro' }];
const NOVOS = 'Novos projetos na esteira de planejamento';
const CONCLUIDOS = 'Projetos com planejamento concluído e validado no SGI';
const dec = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const seg = (on: boolean) => cn('h-11 rounded-[var(--radius-sm)] px-2.5 text-xs md:h-7', on ? 'bg-[hsl(var(--surface-3))] text-foreground' : 'text-muted-foreground hover:text-foreground');

function Comparativo({ label, atual, anterior, fmt, regra, menorMelhor, escopo }: {
  label: string; atual: number | null; anterior: number | null; fmt: (v: number) => string; regra: string; menorMelhor?: boolean; escopo: string;
}) {
  const delta = atual !== null && anterior !== null ? atual - anterior : null;
  const bom = delta === null || delta === 0 ? null : (delta > 0) !== !!menorMelhor;
  const Icon = delta === null || delta === 0 ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="flex min-w-0 flex-col gap-1 bg-card px-4 py-3">
      <p className="flex items-center gap-1 text-xs text-muted-foreground"><span className="truncate">{label}</span><InfoDica texto={regra} /></p>
      <p className="tnum text-2xl font-light leading-none tracking-[-0.02em] text-foreground">{atual === null ? '—' : fmt(atual)}</p>
      <p className={cn('tnum flex items-center gap-1 text-[11px]', bom === null ? 'text-[hsl(var(--fg-subtle))]' : bom ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--danger))]')}>
        <Icon className="size-3" aria-hidden />
        {delta === null ? 'sem período anterior' : `${delta > 0 ? '+' : ''}${fmt(delta)} vs. período anterior`}
      </p>
      <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--fg-subtle))]">{escopo}</p>
    </div>
  );
}

/**
 * "Evolução da esteira": monthly / quarterly series. `items` (current filters) rebuilds what the board dates allow;
 * `baseSnapshot` (whole esteira, no filters) feeds the weekly snapshot saved in the app.
 */
export function Evolucao({ items, baseSnapshot }: { items: Projeto[]; baseSnapshot: Projeto[] }) {
  const [g, setG] = useState<Granularidade>('mes');
  const [m, setM] = useState<Metrica>('fluxo');
  const q = useVibeQuery(['snapshots'], () => listarSnapshots({ data: {} }), { collections: [snapshotsSemanais.name] });
  const snaps = useMemo(() => q.data ?? [], [q.data]);

  // Weekly snapshot: written once per session per week (the server keeps one doc per week, latest wins).
  const gravado = useRef<string | null>(null);
  useEffect(() => {
    if (!baseSnapshot.length) return;
    const mtr = metricasAtuais(baseSnapshot);
    if (gravado.current === mtr.semana) return;
    gravado.current = mtr.semana;
    gravarSnapshot({ data: mtr }).catch((e) => { console.error('Falha ao gravar o retrato semanal', e); gravado.current = null; });
  }, [baseSnapshot]);

  const pontos = useMemo(() => serie(items, snaps, g), [items, snaps, g]);
  const desde = useMemo(() => historicoDesde(items, snaps), [items, snaps]);
  // Only closed periods: the current (partial) month/quarter is left out of the cards and the chart.
  const ult = pontos[pontos.length - 2];
  const ant = pontos[pontos.length - 3];
  const per = g === 'mes' ? 'mês' : 'trimestre';
  const fechado = ult?.rotulo ?? per;
  const grafico = useMemo(() => pontos.slice(0, -1), [pontos]);
  const ESTEIRA = 'Esteira inteira, sem filtros (retratos semanais gravados pelo app) — não segue os filtros do topo.';

  return (
    <Panel title="Evolução da esteira" recolhivel="evolucao" aside={
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{desde ? `histórico a partir de ${fmtDate(desde)}` : 'sem histórico ainda'}</span>
        <fieldset className="m-0 inline-flex rounded-[var(--radius-md)] border border-input p-0.5">
          <legend className="sr-only">Agrupar por</legend>
          <button type="button" aria-pressed={g === 'mes'} className={seg(g === 'mes')} onClick={() => setG('mes')}>Mês</button>
          <button type="button" aria-pressed={g === 'trimestre'} className={seg(g === 'trimestre')} onClick={() => setG('trimestre')}>Trimestre</button>
        </fieldset>
      </div>
    }>
      <div className="grid grid-cols-1 gap-px border-b border-border bg-border sm:grid-cols-3">
        <Comparativo label={`${NOVOS} · ${fechado}`} atual={ult?.entradas ?? null} anterior={ant?.entradas ?? null} fmt={(v) => fmtInt(v)}
          escopo="Filtros do topo aplicados"
          regra={`${NOVOS}: projetos com Início Planejamento no último ${per} fechado (${fechado}), comparado ao ${per} anterior. O ${per} atual (parcial) não aparece. Filtros do topo aplicados.`} />
        <Comparativo label={`${CONCLUIDOS} · ${fechado}`} atual={ult?.saidas ?? null} anterior={ant?.saidas ?? null} fmt={(v) => fmtInt(v)}
          escopo="Filtros do topo aplicados"
          regra={`${CONCLUIDOS}: projetos com Conclusão do Planejamento no último ${per} fechado (${fechado}), comparado ao ${per} anterior. O ${per} atual (parcial) não aparece. Filtros do topo aplicados.`} />
        <Comparativo label={`Saldo total · ${fechado}`} atual={ult?.saldoTotal ?? null} anterior={ant?.saldoTotal ?? null} fmt={(v) => fmtBRLCompact(v)}
          escopo="Esteira inteira, sem filtros"
          regra={`R$ Saldo Total (mesma base do Financeiro) no último retrato semanal do ${per} fechado. ${ESTEIRA}`} />
      </div>
      <div className="flex flex-wrap gap-1 px-4 pt-3">
        {METRICAS.map((x) => <button key={x.k} type="button" aria-pressed={m === x.k} className={seg(m === x.k)} onClick={() => setM(x.k)}>{x.label}</button>)}
      </div>
      <figure className="m-0 h-64 px-2 pb-3 pt-2" aria-label={`Evolução da esteira: ${METRICAS.find((x) => x.k === m)?.label} por ${per}`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={grafico} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="rotulo" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={m === 'saldo' ? 64 : 36}
              tickFormatter={(v: number) => (m === 'saldo' ? fmtBRLCompact(v) : dec.format(v))} />
            <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
              formatter={(v) => (typeof v === 'number' ? (m === 'saldo' ? fmtBRLCompact(v) : dec.format(v)) : '—')} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {m === 'fluxo' && <Bar dataKey="entradas" name={NOVOS} fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} />}
            {m === 'fluxo' && <Bar dataKey="saidas" name={CONCLUIDOS} fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} />}
            {m === 'fluxo' && <Line dataKey="emPlanejamento" name="Em planejamento" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} />}
            {m === 'saldo' && <Line dataKey="saldoTotal" name="Total" stroke="hsl(var(--chart-1))" strokeWidth={2} connectNulls />}
            {m === 'saldo' && <Line dataKey="saldoInsumo" name="Insumo" stroke="hsl(var(--chart-2))" strokeWidth={2} connectNulls />}
            {m === 'saldo' && <Line dataKey="saldoEquipe" name="Equipe" stroke="hsl(var(--chart-4))" strokeWidth={2} connectNulls />}
          </ComposedChart>
        </ResponsiveContainer>
      </figure>
      {m === 'saldo' && (
        <p className="px-4 pb-3 text-[11px] text-[hsl(var(--fg-subtle))]">
          Esteira inteira, sem filtros. Esta métrica não pode ser reconstruída pelas datas do quadro: vem dos retratos semanais gravados pelo app{snaps.length ? ` (${snaps.length} semana${snaps.length === 1 ? '' : 's'})` : ' — o primeiro foi gravado agora'}.
        </p>
      )}
    </Panel>
  );
}
