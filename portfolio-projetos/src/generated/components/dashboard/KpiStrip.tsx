import { projectGoalRate, type Model, type Slice } from '@generated/lib/metrics';
import type { MeasurementDoc } from '@generated/models';
import { fmtPct, typeKind } from '@generated/lib/format';
import { cn } from '@lib/utils';
import type { Drill } from './DrillSheet';

export function ProjectRateStrip({ model, s, onDrill }: { model: Model; s: Slice; onDrill: (d: Drill) => void }) {
  const kindOf = (m: MeasurementDoc) => typeKind(model.indicatorsOf(m)[0]?.tipo ?? null);
  const projsOf = (ids: string[]) => [...s.projs, ...s.inserted].filter((p, i, a) => ids.includes(p.boardId) && a.findIndex((x) => x.boardId === p.boardId) === i);
  const kr = projectGoalRate(model, s, 'KR', kindOf);
  const kpi = projectGoalRate(model, s, 'KPI', kindOf);
  const universe = [...s.inserted, ...s.projs].filter((p, i, a) => a.findIndex((x) => x.boardId === p.boardId) === i);
  const pctTxt = (ok: number, ev: number) => `${ok} de ${ev} avaliadas com meta alcançada, atrasadas inclusas (${fmtPct((ok / ev) * 100)})`;
  const noIndTxt = (p: (typeof universe)[number], fallback: string) => (p.noIndicators ? 'Sem indicador elaborado' : fallback);
  const splits: Record<string, NonNullable<NonNullable<Drill>['split']>> = {
    'Projetos com medições no prazo': {
      rule: 'Contabiliza: projetos com medições de prazo vencido (até hoje) e nenhuma delas pendente. Fora do cálculo: projetos sem medições vencidas no recorte.',
      in: universe.filter((p) => s.onTime.ids.includes(p.boardId)).map((p) => ({ p, reason: `${s.onTime.by.get(p.boardId)?.due ?? 0} medição(ões) vencida(s), todas concluídas` })),
      out: universe.filter((p) => !s.onTime.ids.includes(p.boardId)).map((p) => {
        const r = s.onTime.by.get(p.boardId);
        return { p, reason: r ? `${r.late} de ${r.due} medição(ões) vencida(s) sem conclusão` : noIndTxt(p, 'Sem medições vencidas no recorte (fora do cálculo)') };
      }),
    },
  };
  for (const [kind, rate] of [['KR', kr], ['KPI', kpi]] as const) {
    const hitIds = rate.hit.map((r) => r.id);
    splits[`Projetos com alcance de metas ${kind}`] = {
      rule: `Contabiliza: projetos com 70% ou mais das medições ${kind} avaliadas com meta alcançada (atrasadas contam como meta não batida). Fora do cálculo: projetos sem medições ${kind} avaliadas nem atrasadas.`,
      in: universe.filter((p) => hitIds.includes(p.boardId)).map((p) => { const r = rate.rows.find((x) => x.id === p.boardId); return { p, reason: r ? pctTxt(r.ok, r.ev) : '' }; }),
      out: universe.filter((p) => !hitIds.includes(p.boardId)).map((p) => {
        const r = rate.rows.find((x) => x.id === p.boardId);
        return { p, reason: r ? `${pctTxt(r.ok, r.ev)} · abaixo de 70%` : noIndTxt(p, `Sem medições ${kind} avaliadas (fora do cálculo)`) };
      }),
    };
  }
  const tiles = [
    { label: 'Projetos com indicador', hint: 'dos projetos inseridos (ativos)', hit: s.inserted.filter((p) => !p.noIndicators).map((p) => p.boardId), total: s.inserted.length, empty: 'Nenhum projeto inserido', tone: 'neutral' },
    { label: 'Projetos com medições no prazo', hint: 'sem medições vencidas e não concluídas', hit: s.onTime.ids, total: s.onTime.total, empty: 'Sem medições vencidas', tone: 'ok' },
    { label: 'Projetos com alcance de metas KR', hint: '≥ 70% das medições KR avaliadas com meta alcançada', hit: kr.hit.map((r) => r.id), total: kr.total, empty: 'Sem avaliações KR', tone: 'kr' },
    { label: 'Projetos com alcance de metas KPI', hint: '≥ 70% das medições KPI avaliadas com meta alcançada', hit: kpi.hit.map((r) => r.id), total: kpi.total, empty: 'Sem avaliações KPI', tone: 'kpi' },
  ];
  return (
    <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((t) => (
        <button key={t.label} onClick={() => onDrill(splits[t.label] ? { title: `${t.label} (${t.hit.length} de ${t.total})`, split: splits[t.label] } : { title: `${t.label} (${t.hit.length} de ${t.total})`, projs: projsOf(t.hit) })} className="min-w-0 bg-card p-4 text-left hover:bg-muted/60">
          <span className={cn('block text-[11px] uppercase tracking-wide', t.tone === 'kr' ? 'text-[hsl(var(--kr))]' : t.tone === 'kpi' ? 'text-[hsl(var(--kpi))]' : 'text-muted-foreground')}>{t.label}</span>
          <span className="mt-2 block font-mono text-3xl font-light tabular-nums">{t.total ? fmtPct((t.hit.length / t.total) * 100) : t.empty}</span>
          <span className="mt-1 block text-[11px] text-muted-foreground">{t.total ? `${t.hit.length} de ${t.total} projetos · ` : ''}{t.hint}</span>
        </button>
      ))}
    </div>
  );
}

export function FlagStrip({ s, onDrill }: { s: Slice; onDrill: (d: Drill) => void }) {
  const tiles = [
    { label: 'Prazo vencido e não concluída', meds: s.late },
    { label: 'Concluída sem base de dados', meds: s.semBase },
    { label: 'Sem prazo de medição', meds: s.semPrazo },
  ];
  return (
    <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
      {tiles.map((t) => {
        const pct = s.meds.length ? (t.meds.length / s.meds.length) * 100 : null;
        return (
          <button key={t.label} onClick={() => onDrill({ title: t.label, meds: t.meds })} className="flex min-w-0 items-center justify-between gap-3 bg-card p-4 text-left hover:bg-muted/60">
            <span className="min-w-0">
              <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">Sinalização</span>
              <span className="block text-sm font-medium">{t.label}</span>
              <span className="block text-[11px] text-muted-foreground">{pct === null ? 'Sem medições' : `${fmtPct(pct)} das medições do recorte`}</span>
            </span>
            <span className={cn('font-mono text-3xl font-light tabular-nums', t.meds.length ? 'text-[hsl(var(--warn))]' : 'text-muted-foreground')}>{t.meds.length}</span>
          </button>
        );
      })}
    </div>
  );
}

export function KpiStrip({ s, onDrill }: { s: Slice; onDrill: (d: Drill) => void }) {
  const pct = s.evaluated.length ? (s.reached.length / s.evaluated.length) * 100 : null;
  const tiles = [
    { label: 'Projetos no recorte', value: String(s.projs.length), d: { title: 'Projetos no recorte', projs: s.projs } },
    { label: 'Indicadores no recorte', value: String(s.inds.length), d: { title: 'Indicadores no recorte', inds: s.inds } },
    { label: 'Medições previstas', value: String(s.meds.length), d: { title: 'Medições previstas', meds: s.meds } },
    { label: 'Medições concluídas', value: String(s.concluded.length), d: { title: 'Medições concluídas', meds: s.concluded }, tone: 'ok' },
    { label: 'Medições atrasadas', value: String(s.late.length), d: { title: 'Medições atrasadas', meds: s.late }, tone: s.late.length ? 'bad' : undefined },
  ];
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-border bg-card sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map((t) => (
        <button key={t.label} onClick={() => onDrill(t.d)} className="group min-w-0 border-b border-r border-border p-4 text-left transition-colors hover:bg-muted/60 lg:border-b-0">
          <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">{t.label}</span>
          <span className={cn('mt-2 block font-mono text-3xl font-light tabular-nums', t.tone === 'ok' && 'text-[hsl(var(--ok))]', t.tone === 'bad' && 'text-destructive')}>{t.value}</span>
          <span className="mt-1 block text-[11px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">Ver registros →</span>
        </button>
      ))}
      <button
        onClick={() => onDrill({ title: 'Medições avaliadas: concluídas com Status da Meta + atrasadas (denominador do percentual)', meds: s.evaluated })}
        className="col-span-2 min-w-0 bg-primary p-4 text-left text-primary-foreground transition-opacity hover:opacity-95 sm:col-span-3 lg:col-span-1"
      >
        <span className="block text-[11px] uppercase tracking-wide opacity-80">Meta alcançada</span>
        <span className="mt-2 block font-mono text-3xl font-light tabular-nums">{pct === null ? 'Sem avaliações' : fmtPct(pct)}</span>
        <span className="mt-1 block text-[11px] opacity-80">{s.reached.length} de {s.evaluated.length} avaliadas (atrasadas contam como não alcançada)</span>
      </button>
    </div>
  );
}
