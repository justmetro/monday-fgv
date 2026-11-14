import { useMemo, useState } from 'react';
import { applyFilters, EMPTY_FILTERS, type Filters, type Model } from '@generated/lib/metrics';
import { allowedIds, type GlobalFilter } from '@generated/lib/ops';
import type { IndicatorDoc } from '@generated/models';
import { FiltersBar } from '@generated/components/dashboard/FiltersBar';
import { FlagStrip, KpiStrip, ProjectRateStrip } from '@generated/components/dashboard/KpiStrip';
import { Charts } from '@generated/components/dashboard/Charts';
import { AttentionList } from '@generated/components/dashboard/AttentionList';
import { DrillSheet, type Drill } from '@generated/components/dashboard/DrillSheet';
import { IndicatorSheet } from '@generated/components/IndicatorSheet';

/**
 * Aba Indicadores: o painel de indicadores original, sem mudança de regras.
 * Projeto, área de trabalho, Histórico e período vêm dos filtros globais.
 */
export function IndicatorsTab({ model, global }: { model: Model; global: GlobalFilter }) {
  const [f, setF] = useState<Filters>(EMPTY_FILTERS);
  const [drill, setDrill] = useState<Drill>(null);
  const [ind, setInd] = useState<IndicatorDoc | null>(null);
  const eff = useMemo<Filters>(() => ({ ...f, projects: allowedIds(model.ds.projects, global), meta: global.meta, from: global.from, to: global.to }), [f, global, model]);
  const slice = useMemo(() => applyFilters(model, eff), [model, eff]);
  return (
    <div className="space-y-5">
      <FiltersBar model={model} f={f} setF={setF} scoped />
      <KpiStrip s={slice} onDrill={setDrill} />
      <ProjectRateStrip model={model} s={slice} onDrill={setDrill} />
      <FlagStrip s={slice} onDrill={setDrill} />
      <Charts model={model} s={slice} onDrill={setDrill} />
      <AttentionList model={model} s={slice} onIndicator={setInd} />
      <DrillSheet model={model} drill={drill} onClose={() => setDrill(null)} onIndicator={(i) => { setDrill(null); setInd(i); }} />
      <IndicatorSheet model={model} ind={ind} onClose={() => setInd(null)} onOpen={setInd} />
    </div>
  );
}
