import { ExternalLink } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@components/ui/sheet';
import type { IndicatorDoc } from '@generated/models';
import { k, type Model } from '@generated/lib/metrics';
import { fmtDateTime } from '@generated/lib/format';
import { TypeBadge, Val } from './ui-bits';
import { MeasurementTable } from './MeasurementTable';

const FIELDS: [keyof IndicatorDoc, string][] = [
  ['objetivo', 'Objetivo'], ['tipo', 'Tipo de indicador'], ['formaColeta', 'Forma de Coleta'],
  ['temporalidade', 'Temporalidade'], ['meta', 'Meta geral'], ['polaridade', 'Polaridade'],
  ['unidade', 'Unidade'], ['qtdMedicoes', 'Quantidade de Medições (origem)'], ['resultadoConsolidado', 'Resultado Consolidado'],
];

export function IndicatorSheet({ model, ind, onClose, onOpen }: { model: Model; ind: IndicatorDoc | null; onClose: () => void; onOpen: (i: IndicatorDoc) => void }) {
  const project = ind ? model.projectBy.get(ind.projectBoardId) : undefined;
  const meds = ind ? model.medsOfInd.get(k(ind.projectBoardId, ind.itemId)) ?? [] : [];
  const krs = ind ? ind.krVinculadoIds.map((id) => ({ id, ind: model.indBy.get(k(ind.projectBoardId, id)) })) : [];
  const issues = ind ? model.issues.filter((i) => i.projectBoardId === ind.projectBoardId && (i.itemId === ind.itemId || meds.some((m) => m.itemId === i.itemId))) : [];
  const itemUrl = project && ind ? `${project.boardUrl}/pulses/${ind.itemId}` : '';
  return (
    <Sheet open={!!ind} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        {ind && (
          <>
            <SheetHeader className="border-b border-border pb-4">
              <div className="flex items-center gap-2"><TypeBadge tipo={ind.tipo} /><span className="text-xs text-muted-foreground">{project?.name}</span></div>
              <SheetTitle className="text-xl leading-snug">{ind.name}</SheetTitle>
              <SheetDescription className="whitespace-pre-wrap text-sm">
                <Val rec={ind} field="descricao" v={ind.descricao} />
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-6 px-4 pb-8">
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                {FIELDS.map(([f, label]) => (
                  <div key={f} className="min-w-0 border-b border-border/60 pb-2">
                    <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
                    <dd className="mt-0.5 break-words text-sm"><Val rec={ind} field={f} v={ind[f] as string | null} mono={f === 'meta' || f === 'resultadoConsolidado'} /></dd>
                  </div>
                ))}
                <div className="min-w-0 border-b border-border/60 pb-2">
                  <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">KR vinculado</dt>
                  <dd className="mt-0.5 flex flex-wrap gap-1 text-sm">
                    {krs.length === 0 ? <Val rec={ind} field="krVinculado" v={null} /> : krs.map((r) => r.ind
                      ? <button key={r.id} onClick={() => r.ind && onOpen(r.ind)} className="text-left text-primary hover:underline">{r.ind.name}</button>
                      : <span key={r.id} className="text-xs italic text-[hsl(var(--warn))]">Item {r.id} não importado como indicador</span>)}
                  </dd>
                </div>
                <div className="min-w-0 border-b border-border/60 pb-2">
                  <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Última sincronização</dt>
                  <dd className="mt-0.5 font-mono text-xs">{fmtDateTime(ind.syncedAt)}</dd>
                </div>
              </dl>
              <div>
                <h3 className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Fórmula de cálculo (documentação)</h3>
                <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 font-mono text-xs"><Val rec={ind} field="formula" v={ind.formula} /></pre>
              </div>
              {issues.length > 0 && (
                <div className="rounded-md border border-[hsl(var(--warn))]/40 bg-[hsl(var(--warn-soft))] p-3 text-sm">
                  <p className="mb-1 font-medium">Inconsistências de vínculo</p>
                  <ul className="list-disc space-y-0.5 pl-5 text-xs">{issues.map((i, n) => <li key={n}><b>{i.name}:</b> {i.detail}</li>)}</ul>
                </div>
              )}
              <div>
                <h3 className="mb-2 text-sm font-semibold">Medições vinculadas ({meds.length})</h3>
                <MeasurementTable model={model} rows={meds} />
              </div>
              {itemUrl && (
                <a href={itemUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                  <ExternalLink className="size-4" aria-hidden /> Abrir item no quadro de origem
                </a>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
