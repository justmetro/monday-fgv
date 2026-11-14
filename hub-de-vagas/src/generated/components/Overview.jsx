import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { ArrowUpRight, AlertTriangle } from 'lucide-react';
import { MODULES, withPreset } from '@generated/lib/modules';
import { distinctValues, keysOf, EMPTY } from '@generated/lib/engine';
import { GlowDot } from '@generated/components/Pill';
import { cn } from '@lib/utils';
import MonthCompare from '@generated/components/MonthCompare';
import { CountUp } from '@generated/components/Age';
import { SITU, SEM_SITU, isDesalocado, vagaPrazo, TAP, desalocInfo, tapSituOf } from '@generated/lib/esteira';
import { toDate, monthLabelOf, monthKey } from '@generated/lib/data';
import VagasMesTable from '@generated/components/VagasMesTable';

const V = MODULES.vagas.fmap, P = MODULES.perfis.fmap;
const tip = { contentStyle: { background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 12, color: 'hsl(var(--popover-foreground))', boxShadow: 'var(--shadow-pop)' }, labelStyle: { color: 'hsl(var(--popover-foreground))' }, itemStyle: { color: 'hsl(var(--popover-foreground))' }, cursor: { fill: 'hsl(var(--accent) / 0.4)' } };
const axis = { stroke: 'hsl(var(--border))', tick: { fill: 'hsl(var(--muted-foreground))', fontSize: 11 }, fontSize: 11, tickLine: false, axisLine: false };

function Panel({ title, hint, children, className }) {
  return (
    <section className={cn('rounded-md border border-border bg-card p-4', className)}>
      <div className="mb-3 flex items-baseline justify-between gap-2"><h2 className="text-sm font-medium">{title}</h2>{hint && <span className="text-xs text-muted-foreground">{hint}</span>}</div>
      {children}
    </section>
  );
}

function Kpi({ label, value, onClick, tone }) {
  return (
    <button onClick={onClick} className="group flex min-w-0 flex-col gap-1 rounded-md border border-border bg-card p-4 text-left lift hover:shadow-[var(--glow-stack)]">
      <span className="flex items-center justify-between text-xs text-muted-foreground">{label}<ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" /></span>
      <span className={cn('text-3xl font-medium tabular-nums tracking-tight', tone === 'danger' && 'text-destructive')}><CountUp value={value} /></span>
    </button>
  );
}

export default function Overview({ data, go }) {
  const m = useMemo(() => {
    const abertas = data.vagas.filter((v) => keysOf(V.emAberto, v)[0] === 'Sim');
    const atrasadas = abertas.filter((v) => vagaPrazo(v) === 'Atrasada');
    const atrasoMes = Object.entries(atrasadas.reduce((o, v) => { const l = monthLabelOf(toDate(v.dataDeIncioPrevista)); o[l] = (o[l] ?? 0) + 1; return o; }, {})).sort((a, b) => monthKey(a[0]) - monthKey(b[0]));
    const vagasSemMatch = abertas.filter((v) => !v._matches.length).length;
    const pessoasSemMatch = data.perfis.filter((p) => desalocInfo(p) && !p._matches.length).length;
    const emMatch = data.perfis.filter((p) => p._emRodada).length;
    const entrevistados = data.perfis.filter((p) => p._entrevistado).length;
    const desaloc = data.perfis.filter(isDesalocado);
    const faixas = distinctValues(P.situacao, data.perfis).filter((x) => x.value !== EMPTY && x.value !== SITU.depois && !Object.values(SEM_SITU).includes(x.value));
    const over60 = data.perfis.filter((p) => keysOf(P.situacao, p)[0] === SITU.ocioso).length;
    const porProjeto = distinctValues(V.projeto, data.vagas).filter((x) => x.value !== EMPTY).sort((a, b) => b.count - a.count).slice(0, 10);
    const tapCount = (l) => data.perfis.filter((p) => tapSituOf(p) === l).length;
    const tap = { ociosa: tapCount(TAP.ociosa), desaloc: tapCount(TAP.desaloc), semInfo: tapCount(TAP.semFim) + tapCount(TAP.fora), ok: data.perfis.some((p) => p._tapOk) || !data.perfis.length };
    return { tap, abertas: abertas.length, atrasadas: atrasadas.length, emMatch, entrevistados, desaloc: desaloc.length, faixas, over60, porProjeto, atrasoMes, vagasSemMatch, pessoasSemMatch };
  }, [data]);

  return (
    <div className="flex flex-col gap-4">
      <section className="lattice relative overflow-hidden rounded-md border border-border bg-card p-5 sm:p-6">
        <div className="flex items-center gap-2 text-xs text-primary"><GlowDot /> Leitura ao vivo do quadro</div>
        <div className="mt-4 grid gap-6 lg:grid-cols-[1.2fr_2fr]">
          <button onClick={() => go('vagas', withPreset('vagas', 'atraso'))} className="text-left">
            <span className="block text-sm text-muted-foreground">Vagas em aberto</span>
            <span className="mt-1 block text-6xl font-medium leading-none tracking-[-0.04em] tabular-nums"><CountUp value={m.abertas} /></span>
            <span className="mt-3 inline-flex items-center gap-1.5 text-sm text-destructive"><AlertTriangle className="h-4 w-4" />{m.atrasadas} atrasadas</span>
          </button>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Kpi label="Vagas atrasadas" value={m.atrasadas} tone="danger" onClick={() => go('vagas', withPreset('vagas', 'atraso', { filters: { atraso: ['Atrasada'] } }))} />
            <Kpi label="Pessoas em rodada de match" value={m.emMatch} onClick={() => go('perfis', withPreset('perfis', 'perfis', { filters: { emRodada: ['Sim'] } }))} />
            <Kpi label="Já fizeram entrevista" value={m.entrevistados} onClick={() => go('perfis', withPreset('perfis', 'perfis', { filters: { entrevistado: ['Sim'] } }))} />
            <Kpi label="Desalocados" value={m.desaloc} onClick={() => go('perfis', withPreset('perfis', 'desaloc'))} />
            <Kpi label="Vagas abertas sem nenhum match" value={m.vagasSemMatch} tone={m.vagasSemMatch ? 'danger' : null} onClick={() => go('vagas', withPreset('vagas', 'atraso', { filters: { emAberto: ['Sim'] }, groupBy: [] }))} />
            <Kpi label="Pessoas disponíveis sem nenhum match" value={m.pessoasSemMatch} tone={m.pessoasSemMatch ? 'danger' : null} onClick={() => go('perfis', withPreset('perfis', 'desaloc', { filters: { situacao: [] } }))} />
            {m.tap.ok ? (
              <>
                <Kpi label={TAP.ociosa} value={m.tap.ociosa} tone={m.tap.ociosa ? 'danger' : null} onClick={() => go('perfis', withPreset('perfis', 'tap', { filters: { tap: [TAP.ociosa] }, groupBy: [] }))} />
                <Kpi label={TAP.desaloc} value={m.tap.desaloc} tone={m.tap.desaloc ? 'danger' : null} onClick={() => go('perfis', withPreset('perfis', 'tap', { filters: { tap: [TAP.desaloc] }, groupBy: [] }))} />
                {m.tap.semInfo > 0 && (
                  <button onClick={() => go('perfis', withPreset('perfis', 'tap', { filters: { tap: [TAP.semFim, TAP.fora] } }))} className="col-span-full text-left text-[11px] text-muted-foreground hover:text-foreground">
                    {m.tap.semInfo} pessoas com a função terminando ou terminada sem fim do TAP nos quadros de planejamento
                  </button>
                )}
              </>
            ) : (
              <div className="col-span-2 rounded-md border border-dashed border-border bg-card p-4 text-[11px] text-muted-foreground">Não foi possível ler os quadros de planejamento para calcular Ociosa e Em desalocação.</div>
            )}
          </div>
        </div>
        {m.atrasoMes.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <span className="text-xs text-muted-foreground">Atraso por mês de início previsto</span>
            {m.atrasoMes.map(([l, n]) => (
              <button key={l} onClick={() => go('vagas', withPreset('vagas', 'atraso', { filters: { atraso: ['Atrasada'], mesRef: [l] }, groupBy: [] }))} className="inline-flex items-center gap-2 rounded-full border border-destructive/40 bg-destructive/5 px-3 py-1 text-xs hover:border-destructive">{l}<span className="tabular-nums text-destructive">{n}</span></button>
            ))}
          </div>
        )}
        {m.faixas.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <span className="text-xs text-muted-foreground">Por data de disponibilidade{m.over60 ? ` · ${m.over60} ociosos (disponibilidade + 15 dias)` : ''}</span>
            {m.faixas.map((f) => (
              <button key={f.value} onClick={() => go('perfis', withPreset('perfis', 'desaloc', { filters: { situacao: [f.value] } }))}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1 text-xs hover:border-primary/50">
                {f.value}<span className="tabular-nums text-primary">{f.count}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <MonthCompare data={data} />

      <VagasMesTable vagas={data.allVagas} onOpen={(mes) => go('vagas', withPreset('vagas', 'mes', { filters: { statusDaVaga: [], mesRef: [mes] } }))} />

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Vagas por projeto" hint="10 maiores">
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={m.porProjeto} layout="vertical" margin={{ left: 8, right: 16 }}>
                <XAxis type="number" allowDecimals={false} {...axis} />
                <YAxis type="category" dataKey="value" width={150} {...axis} tickFormatter={(v) => (v.length > 22 ? v.slice(0, 21) + '…' : v)} />
                <Tooltip {...tip} formatter={(v) => [v, 'Vagas']} />
                <Bar dataKey="count" fill="hsl(var(--chart-2))" radius={[0, 3, 3, 0]} className="cursor-pointer"
                  onClick={(d) => go('vagas', withPreset('vagas', 'rodadas', { filters: { statusDaVaga: [], projeto: [d.payload?.value] } }))} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Pessoas por situação de desalocação" hint="referência: data de disponibilidade">
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={m.faixas} margin={{ left: -20, right: 8 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="value" {...axis} interval={0} tickFormatter={(v) => { const [a, b] = String(v).split(' — '); return a === 'A desalocar' ? b : a; }} />
                <YAxis allowDecimals={false} {...axis} />
                <Tooltip {...tip} formatter={(v) => [v, 'Pessoas']} />
                <Bar dataKey="count" fill="hsl(var(--chart-3))" radius={[3, 3, 0, 0]} className="cursor-pointer"
                  onClick={(d) => go('perfis', withPreset('perfis', 'desaloc', { filters: { situacao: [d.payload?.value] } }))} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
    </div>
  );
}
