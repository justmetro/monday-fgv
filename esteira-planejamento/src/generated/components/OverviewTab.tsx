import { useCallback, useEffect, useMemo, useState } from 'react';
import { AbrirFechando } from '@generated/components/AbrirProjeto';
import { type PeriodoGlobal, noPeriodo, rotuloPeriodoGlobal } from '@generated/lib/periodo';
import type { Changes } from '@generated/server/projetos';
import { DrilldownSheet } from '@generated/components/DrilldownSheet';
import { cn } from '@lib/utils';
import { type Projeto, fmtInt, fmtPct, toDate } from '@generated/lib/format';
import { SemEixoUf } from '@generated/components/overview/SemEixoUf';
import { Evolucao } from '@generated/components/overview/Evolucao';
import { STATUS_PLAN_ORDEM, TONE_DOT, toneOf, corDe, dotDe } from '@generated/lib/status';
import { OPT, isInativo } from '@generated/lib/board-options';
import { tempoPlanejamento } from '@generated/lib/metricas';
import { type ResAcumulado, regraResAcumulado } from '@generated/lib/resAcumulado';
import { TempoBloco, ItLinhas, fmtDias1 } from '@generated/components/overview/TempoEIt';
import { Panel, EmptyState, InfoDica } from '@generated/components/ui-bits';
import { HBarChart, VBarChart, CompositionBar, type Datum } from '@generated/components/charts';
import { NumberTicker } from '@generated/components/fx/NumberTicker';
import { SpotlightCard } from '@generated/components/fx/SpotlightCard';

function contar(items: Projeto[], pick: (p: Projeto) => string[] | null | undefined): Datum[] {
  const m = new Map<string, number>();
  for (const p of items) {
    const vals = pick(p)?.filter(Boolean) ?? [];
    // Projects without a value are left out ("Não informado" is not shown).
    for (const v of vals) m.set(v, (m.get(v) ?? 0) + 1);
  }
  return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

function porStatus(items: Projeto[], pick: (p: Projeto) => string | null, ordem: string[], vazio: string): Datum[] {
  const m = new Map<string, number>();
  for (const p of items) {
    const k = pick(p) ?? vazio;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  const extras = [...m.keys()].filter((k) => !ordem.includes(k) && k !== vazio);
  return [...ordem, ...extras, vazio].map((label) => ({
    label, value: m.get(label) ?? 0, color: corDe(label === vazio ? null : label),
  }));
}

function Kpi({ label, n, fmt, unit, foot, regra }: { label: string; n: number | null; fmt: (v: number) => string; unit?: string; foot: string; regra: string }) {
  return (
    <SpotlightCard className="flex min-w-0 flex-col gap-1 border-border px-4 py-4 sm:px-5 [&:not(:first-child)]:border-t sm:[&:not(:first-child)]:border-t-0 sm:[&:not(:first-child)]:border-l">
      <p className="flex items-start gap-1 text-xs text-muted-foreground"><span className="min-w-0">{label}</span><InfoDica texto={regra} /></p>
      <p className="tnum text-4xl font-light leading-none tracking-[-0.02em] text-foreground">
        {n === null ? '—' : <NumberTicker value={n} format={fmt} className="fx-num" />}
        {unit && <span className="ml-1 text-base font-normal text-muted-foreground">{unit}</span>}
      </p>
      <p className="text-xs text-[hsl(var(--fg-subtle))]">{foot}</p>
    </SpotlightCard>
  );
}

type Dim = 'status' | 'eixo' | 'radar' | 'uf';
const DIM_NOME: Record<Dim, string> = { status: 'Status Planejamento', eixo: 'Eixo', radar: 'Radar Monitoramento', uf: 'Localidade' };

/** Same bucketing rules the charts use, so the drill-down list always matches the clicked count. */
function pertence(p: Projeto, dim: Dim, label: string): boolean {
  if (dim === 'status') return (p.statusPlanejamento ?? 'Sem status') === label;
  if (dim === 'radar') return (p.radarMonitoramento ?? 'Sem radar') === label;
  const vals = (dim === 'eixo' ? p.eixo : p.uf)?.filter(Boolean) ?? [];
  return vals.includes(label);
}



interface OverviewProps {
  items: Projeto[];
  /** Same filters with Finalizados always included — period goals and "Planejados em …". */
  concluidos: Projeto[];
  /** Status hidden by default, switched on in the top bar. */
  mostrar: Record<Opcional, boolean>;
  opcoesStatus: string[];
  salvar: (p: Projeto, c: Changes) => Promise<boolean>;
  /** Whole esteira without filters (weekly snapshot of "Evolução"). */
  baseSnapshot: Projeto[];
  /** Global period (header): "Planejados" uses the conclusion dates inside it. */
  periodo: PeriodoGlobal | null;
  /** Base "Res. Acumulado" of the selected year (top filters applied, Finalizados included). */
  resAcum: ResAcumulado;
}

/** Visão geral base: the funnel's list — no Novo Cadastro / Pausado (cancelled ones are already excluded globally). */
export const OPCIONAIS = ['Novo Cadastro - 30 a 45 dias', 'Novo Cadastro - 45 a 60 dias', 'Pausado'] as const;
export type Opcional = (typeof OPCIONAIS)[number];
const ehOpcional = (st: string | null | undefined): st is Opcional => !!st && (OPCIONAIS as readonly string[]).includes(st);

export function OverviewTab({ items: todos, concluidos, mostrar, opcoesStatus, salvar, baseSnapshot, periodo, resAcum }: OverviewProps) {
  // Own month selector (inside the selected year) for the monthly IT row; independent of the header period.
  const mesPadrao = () => (resAcum.ano === new Date().getFullYear() ? new Date().getMonth() + 1 : 12);
  const [mesIt, setMesIt] = useState(mesPadrao);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setMesIt(mesPadrao()); }, [resAcum.ano]);
  const tempo = useMemo(() => tempoPlanejamento(resAcum.items), [resAcum.items]);
  // Single base for the total, the funnel, the charts and every KPI that counts projects.
  const items = useMemo(
    () => todos.filter((p) => !ehOpcional(p.statusPlanejamento) || mostrar[p.statusPlanejamento]),
    [todos, mostrar],
  );
  // Period goals: always over the concluded projects (Finalizados included), filtered by conclusion date
  // with the single global period control of the header (no period = all dates).
  const metas = useMemo(() => {
    const dentro = (d: Date | null) => !!d && noPeriodo(d, periodo);
    const planejados = concluidos.filter((p) =>
      (p.statusPlanejamento === 'Instrumento Concluído' || p.statusPlanejamento === 'Finalizado (Plan + SGI)') &&
      dentro(toDate(p.conclusoDoPlanejamento)));
    return { planejados };
  }, [concluidos, periodo]);
  const rotulo = rotuloPeriodoGlobal(periodo);
  const [ordemFunil, setOrdemFunil] = useState<'esteira' | 'qtd'>('esteira');
  const [drill, setDrill] = useState<{ dim: Dim; label: string } | null>(null);
  const fecharDrill = useCallback(() => setDrill(null), []);
  const abrir = (dim: Dim) => (label: string) => setDrill({ dim, label });
  const sel = (dim: Dim) => (drill?.dim === dim ? drill.label : null);
  const drillItens = useMemo(
    () => (drill ? items.filter((p) => pertence(p, drill.dim, drill.label)).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')) : []),
    [items, drill],
  );
  const s = useMemo(() => {
    const status = porStatus(items, (p) => p.statusPlanejamento, STATUS_PLAN_ORDEM, 'Sem status');
    const radar = porStatus(items, (p) => p.radarMonitoramento, OPT.radarMonitoramento, 'Sem radar');
    return {
      status: status.filter((d) => (d.label !== 'Sem status' || d.value > 0) && (!ehOpcional(d.label) || mostrar[d.label])),
      radar: radar.filter((d) => d.label !== 'Sem radar' || d.value > 0),
      // Eixo / UF: every funnel status except "Novo Cadastro".
      eixo: contar(items, (p) => p.eixo),
      uf: contar(items, (p) => p.uf),
      // "ativos" uses the same rule as the farol (not an inactive Status Planejamento).
      composicao: {
        ativos: items.filter((p) => !isInativo(p.statusPlanejamento)).length,
        finalizados: items.filter((p) => p.statusPlanejamento === 'Finalizado (Plan + SGI)').length,
      },
    };
  }, [items, mostrar]);



  if (!items.length) {
    return (
      <div className="flex flex-col gap-4">
        <EmptyState title="Nenhum projeto no escopo atual"
          hint="Ajuste os filtros no topo ou ligue as opções em “Incluir:” para ampliar o escopo." />
      </div>
    );
  }

  const listaStatus = s.status;
  const statusComDados = listaStatus.filter((d) => d.value > 0);
  const funil = ordemFunil === 'qtd' ? [...s.status].sort((a, b) => b.value - a.value) : s.status;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
        <SemEixoUf items={items} />
      </div>
      <section className="fx-rise fx-conic fx-grain relative overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card">
        <div className="fx-stagger grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Projetos na esteira" n={items.length} fmt={(v) => fmtInt(Math.round(v))}
            regra="Quantidade de projetos do grupo Esteira no escopo dos filtros (sem cancelados). É a soma das barras do funil por Status Planejamento."
            foot={`Retrato atual · ${fmtInt(s.composicao.ativos)} ativos · ${fmtInt(s.composicao.finalizados)} finalizados · soma do funil`} />
          <Kpi label={`Planejados · ${rotulo}`} n={metas.planejados.length} fmt={(v) => fmtInt(Math.round(v))}
            regra="Projetos com Status Planejamento “Instrumento Concluído” ou “Finalizado (Plan + SGI)” cuja Conclusão do Planejamento cai no período escolhido."
            foot="Instrumento Concluído ou Finalizado, por data de conclusão do planejamento" />
          <Kpi label="Tempo de planejamento (mediana)" n={tempo.mediana} fmt={(v) => fmtDias1(v).replace(' dias', '')} unit={tempo.mediana === null ? undefined : 'dias'}
            regra={`Mediana da coluna Tempo de Planejamento (dias) dos projetos da base Res. Acumulado com Mês Referência Resultado diferente de N/A. ${regraResAcumulado(resAcum)}`}
            foot={`Res. Acumulado ${resAcum.ano} · n = ${tempo.n}`} />
          <Kpi label="Tempo de planejamento (média)" n={tempo.media} fmt={(v) => fmtDias1(v).replace(' dias', '')} unit={tempo.media === null ? undefined : 'dias'}
            regra={`Média da coluna Tempo de Planejamento (dias) dos projetos da base Res. Acumulado com Mês Referência Resultado diferente de N/A. ${regraResAcumulado(resAcum)}`}
            foot={`Res. Acumulado ${resAcum.ano} · n = ${tempo.n}`} />
        </div>

        <TempoBloco res={resAcum} />
        <ItLinhas res={resAcum} mes={mesIt} setMes={setMesIt} />

        <div className="border-t border-border px-4 pb-4 pt-3 sm:px-5">
          <p className="mb-2 text-xs text-muted-foreground">Composição da esteira por Status Planejamento</p>
          <CompositionBar data={statusComDados} />
          <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-5">
            {listaStatus.map((d) => (
              <li key={d.label} className={cn('min-w-0', d.value === 0 && 'opacity-45')}>
                <button type="button" onClick={() => abrir('status')(d.label)} aria-pressed={sel('status') === d.label}
                  className={cn('flex w-full min-w-0 items-baseline gap-2 rounded-[var(--radius-sm)] px-1 text-left transition-colors duration-150 hover:bg-[hsl(var(--surface-2))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    sel('status') === d.label && 'bg-[hsl(var(--accent-soft))] ring-1 ring-primary')}>
                  <span className={cn('size-2 shrink-0 translate-y-[-1px] rounded-full', dotDe(d.label === 'Sem status' ? null : d.label))} aria-hidden />
                  <NumberTicker value={d.value} className="tnum text-lg font-medium text-foreground" />
                  <span className="min-w-0 truncate text-xs text-muted-foreground" title={d.label}>{d.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Panel title="Funil por Status Planejamento" aside={
          <fieldset className="m-0 inline-flex overflow-hidden rounded-[var(--radius-md)] border border-input p-0 text-xs">
            <legend className="sr-only">Ordem do funil</legend>
            {([['esteira', 'Ordem da esteira'], ['qtd', 'Nº de projetos']] as const).map(([k, l], i) => (
              <button key={k} type="button" aria-pressed={ordemFunil === k} onClick={() => setOrdemFunil(k)}
                className={cn('h-11 px-2.5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:h-7',
                  i > 0 && 'border-l border-input',
                  ordemFunil === k ? 'bg-[hsl(var(--accent-soft))] font-medium text-foreground' : 'text-muted-foreground hover:bg-[hsl(var(--surface-3))]')}>
                {l}
              </button>
            ))}
          </fieldset>
        }>
          <div className="px-2 py-3">
            <HBarChart data={funil} height={funil.length * 30 + 20} labelWidth={200} onSelect={abrir('status')} selected={sel('status')} />
          </div>
        </Panel>
        <Panel title="Planejamento de projeto por eixo" aside={<span className="text-xs text-muted-foreground">um projeto pode ter mais de um eixo</span>}>
          <div className="px-2 py-3">
            <HBarChart data={s.eixo} height={Math.max(s.eixo.length * 30 + 20, 160)} labelWidth={190} onSelect={abrir('eixo')} selected={sel('eixo')} />
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Panel title="Radar Monitoramento">
          <ul className="divide-y divide-border">
            {s.radar.map((d) => {
              const pct = items.length ? (d.value / items.length) * 100 : 0;
              return (
                <li key={d.label}>
                  <button type="button" onClick={() => abrir('radar')(d.label)} aria-pressed={sel('radar') === d.label}
                    className={cn('flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-[hsl(var(--surface-2))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                      sel('radar') === d.label && 'bg-[hsl(var(--accent-soft))] shadow-[inset_3px_0_0_hsl(var(--primary))]')}>
                    <span className={cn('size-2 shrink-0 rounded-full', TONE_DOT[toneOf(d.label === 'Sem radar' ? null : d.label)])} aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-foreground" title={d.label}>{d.label}</span>
                    <NumberTicker value={d.value} className="tnum text-xl font-light text-foreground" />
                    <span className="tnum w-12 text-right text-xs text-muted-foreground">{fmtPct(pct)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="px-4 pb-3 pt-1"><CompositionBar data={s.radar.filter((d) => d.value > 0)} /></div>
        </Panel>
        <Panel title="Projetos por Localidade">
          <div className="overflow-x-auto px-2 py-3">
            <div className="min-w-[560px]">
              <VBarChart data={s.uf} height={240} onSelect={abrir('uf')} selected={sel('uf')} />
            </div>
          </div>
        </Panel>
      </div>
      <p className="text-xs text-[hsl(var(--fg-subtle))]">Clique em uma barra, etapa ou item da legenda para ver os projetos da categoria.</p>

      <Evolucao items={concluidos} baseSnapshot={baseSnapshot} />

      <AbrirFechando fechar={fecharDrill}>
        <DrilldownSheet titulo={drill ? drill.label : null} subtitulo={drill ? DIM_NOME[drill.dim] : ''} projetos={drillItens}
          opcoesStatus={opcoesStatus} salvar={salvar} onClose={fecharDrill} />
      </AbrirFechando>
    </div>
  );
}
