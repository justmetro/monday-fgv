import type { Section } from '@generated/lib/intel';
import { evalOf } from '@generated/lib/intel-stats';
import { AlertList, fp, GroupTable, InsightList, RankList } from './report-parts';

export function Kpis({ s }: { s: Section }) {
  const c = s.total.counts;
  const items: [string, string][] = [
    ['Projetos', String(s.projects.length)], ['Sem indicadores', String(s.projectsNoInd.length)], ['Indicadores', String(s.indicators.length)],
    ['Medições', String(s.total.meds)], ['Avaliáveis (B+C+D)', String(evalOf(c))], ['Taxa c/ atrasos', fp(s.total.rate)],
    ['Entre concluídas', fp(s.total.rateConcl)], ['Atrasadas', String(c.D)], ['Média p/ projeto', fp(s.total.projMean)],
  ];
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-3 lg:grid-cols-9">
      {items.map(([l, v]) => <div key={l} className="bg-card p-3"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">{l}</p><p className="mt-1 font-mono text-lg">{v}</p></div>)}
    </div>
  );
}

/** Mesmo bloco para a análise geral e para cada eixo (mesmas regras). */
export function SectionView({ s, axis }: { s: Section; axis: boolean }) {
  const pl = axis ? `% dos ${s.projects.length} projetos do eixo` : `% dos ${s.projects.length} projetos`;
  const delayShare = evalOf(s.total.counts) ? (s.total.counts.D / evalOf(s.total.counts)) * 100 : null;
  return (
    <div className="space-y-4">
      <Kpis s={s} />
      {axis && <p className="text-xs text-muted-foreground">Denominador da presença: {s.projects.length} projeto(s) selecionado(s) do eixo, incluindo {s.projectsNoInd.length} sem indicadores. Atrasos representam {fp(delayShare)} das medições avaliáveis.</p>}
      <div><h3 className="mb-2 font-medium">Temas</h3><GroupTable rows={s.temas} presenceLabel={pl} limit={8} /></div>
      <div><h3 className="mb-2 font-medium">Famílias de indicadores</h3><GroupTable rows={s.familias} presenceLabel={pl} showParent /></div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <RankList title="Famílias — maiores taxas" rows={s.rk.familias.best} tone="ok" />
        <RankList title="Famílias — menores taxas" rows={s.rk.familias.worst} tone="bad" />
        <RankList title="Temas — menores taxas" rows={s.rk.temas.worst} tone="bad" />
        <RankList title="Indicadores — melhores resultados" rows={s.rk.inds.best} tone="ok" />
        <RankList title="Indicadores — piores resultados" rows={s.rk.inds.worst} tone="bad" />
        <div className="rounded-md border border-border p-3 text-sm">
          <h4 className="font-medium">Lacunas de informação</h4>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            <li>Medições sem vínculo resolvido: <b className="font-mono text-foreground">{s.gaps.semVinculo}</b></li>
            <li>Indicadores não classificados: <b className="font-mono text-foreground">{s.gaps.naoClassificados}</b></li>
            <li>Indicadores sem medições: <b className="font-mono text-foreground">{s.gaps.semMedicoes}</b></li>
            <li>Concluídas sem meta válida (F): <b className="font-mono text-foreground">{s.gaps.concluidasSemMeta}</b></li>
            <li>Concluídas sem base de dados: <b className="font-mono text-foreground">{s.gaps.semBaseDados}</b></li>
            <li>Base reduzida (famílias): <b className="font-mono text-foreground">{s.rk.familias.reduced.length}</b></li>
          </ul>
        </div>
      </div>
      <div><h3 className="mb-2 font-medium">Insights</h3><InsightList items={s.insights} /></div>
      <div><h3 className="mb-2 font-medium">Alertas</h3><AlertList items={s.alerts} /></div>
    </div>
  );
}
