import type { MeasurementDoc } from '@generated/models';
import { isNotStarted, type Model } from '@generated/lib/metrics';
import { fmtDate } from '@generated/lib/format';
import { BaseDados, StatusPill, Truncate, Val } from './ui-bits';

export function medTone(m: Model, x: MeasurementDoc) {
  return m.isConcluded(x) ? 'ok' : m.isLate(x) ? 'bad' : m.isExcluded(x) || isNotStarted(x.statusMedicao) ? 'neutral' : 'warn';
}
export function metaTone(m: Model, x: MeasurementDoc) {
  const c = m.metaClass(x);
  return c === 'reached' ? 'ok' : c === 'notReached' ? 'bad' : 'neutral';
}

export function MeasurementTable({ model, rows, showProject, showIndicator }: { model: Model; rows: MeasurementDoc[]; showProject?: boolean; showIndicator?: boolean }) {
  if (rows.length === 0) return <p className="py-4 text-sm text-muted-foreground">Nenhuma medição vinculada.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[960px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            {showProject && <th className="px-2 py-2 font-medium">Projeto</th>}
            <th className="px-2 py-2 font-medium">Medição</th>
            {showIndicator && <th className="px-2 py-2 font-medium">Indicador</th>}
            <th className="px-2 py-2 font-medium">Prazo</th>
            <th className="px-2 py-2 font-medium">Responsável</th>
            <th className="px-2 py-2 font-medium">Status Medição</th>
            <th className="px-2 py-2 text-right font-medium">Meta</th>
            <th className="px-2 py-2 text-right font-medium">Valor Apurado</th>
            <th className="px-2 py-2 text-right font-medium">Resultado</th>
            <th className="px-2 py-2 font-medium">Status da Meta</th>
            <th className="px-2 py-2 font-medium">Base de dados</th>
            <th className="px-2 py-2 font-medium">Sinalizações</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((x) => {
            const inds = model.indicatorsOf(x);
            return (
              <tr key={`${x.projectBoardId}:${x.itemId}`} className="border-b border-border/60 align-top last:border-0">
                {showProject && <td className="max-w-40 px-2 py-2"><Truncate text={model.projectBy.get(x.projectBoardId)?.name ?? x.projectBoardId} /></td>}
                <td className="max-w-56 px-2 py-2 font-medium"><Truncate text={x.name} /></td>
                {showIndicator && <td className="max-w-48 px-2 py-2"><Truncate text={inds.map((i) => i.name).join(' · ') || 'Sem vínculo resolvido'} /></td>}
                <td className="whitespace-nowrap px-2 py-2 font-mono text-xs tabular-nums">{fmtDate(x.prazo)}</td>
                <td className="max-w-36 px-2 py-2"><Truncate text={x.responsaveis.join(', ') || null} /></td>
                <td className="px-2 py-2"><StatusPill label={x.statusMedicao} tone={medTone(model, x)} /></td>
                <td className="px-2 py-2 text-right"><Val rec={x} field="meta" v={x.meta} mono /></td>
                <td className="px-2 py-2 text-right"><Val rec={x} field="valorApurado" v={x.valorApurado} mono /></td>
                <td className="px-2 py-2 text-right"><Val rec={x} field="resultado" v={x.resultado} mono /></td>
                <td className="px-2 py-2">
                  {x.unavailable.includes('statusMeta') ? <Val rec={x} field="statusMeta" v={null} /> : <StatusPill label={x.statusMeta} tone={metaTone(model, x)} />}
                </td>
                <td className="max-w-44 px-2 py-2"><BaseDados urls={x.baseDadosUrls} labels={x.baseDadosLabels} text={x.baseDadosText} /></td>
                <td className="px-2 py-2">
                  <div className="flex flex-wrap gap-1">
                    {[
                      [model.isLate(x), 'Prazo vencido'],
                      [model.isConcluded(x) && x.baseDadosUrls.length === 0 && !x.baseDadosText && !x.unmapped.includes('baseDados'), 'Sem base'],
                      [!x.prazo, 'Sem prazo'],
                    ].filter(([on]) => on).map(([, l]) => (
                      <span key={String(l)} className="whitespace-nowrap rounded-sm bg-[hsl(var(--warn-soft))] px-1.5 py-0.5 text-[11px] text-[hsl(var(--warn))]">{l}</span>
                    ))}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
