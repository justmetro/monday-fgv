import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@components/ui/sheet';
import type { IndicatorDoc, MeasurementDoc, ProjectDoc } from '@generated/models';
import type { Model } from '@generated/lib/metrics';
import { fmtDateTime } from '@generated/lib/format';
import { MeasurementTable } from '../MeasurementTable';
import { TypeBadge } from '../ui-bits';

export type SplitRow = { p: ProjectDoc; reason: string };
export type Drill = { title: string; meds?: MeasurementDoc[]; inds?: IndicatorDoc[]; projs?: ProjectDoc[]; split?: { rule: string; in: SplitRow[]; out: SplitRow[] } } | null;

function SplitList({ title, rows, tone }: { title: string; rows: SplitRow[]; tone: 'ok' | 'bad' }) {
  return (
    <section className="mt-4">
      <h3 className={tone === 'ok' ? 'text-sm font-semibold text-[hsl(var(--ok))]' : 'text-sm font-semibold text-destructive'}>{title} · {rows.length}</h3>
      {rows.length === 0 ? <p className="py-2 text-sm text-muted-foreground">Nenhum projeto.</p> : (
        <ul className="divide-y divide-border">
          {rows.map(({ p, reason }) => (
            <li key={p.boardId} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
              <span className="min-w-0 font-medium">{p.name}</span>
              <span className="text-xs text-muted-foreground">{reason}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function DrillSheet({ model, drill, onClose, onIndicator }: { model: Model; drill: Drill; onClose: () => void; onIndicator: (i: IndicatorDoc) => void }) {
  const count = drill ? (drill.split ? drill.split.in.length + drill.split.out.length : (drill.meds ?? drill.inds ?? drill.projs ?? []).length) : 0;
  return (
    <Sheet open={!!drill} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-5xl">
        {drill && (
          <>
            <SheetHeader className="border-b border-border">
              <SheetTitle>{drill.title}</SheetTitle>
              <SheetDescription>{count} registro(s) que compõem esta contagem</SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-8">
              {drill.split && (
                <>
                  <p className="mt-2 rounded-md bg-muted p-3 text-xs text-muted-foreground">{drill.split.rule}</p>
                  <SplitList title="Contabilizam para o card" rows={drill.split.in} tone="ok" />
                  <SplitList title="Não contabilizam para o card" rows={drill.split.out} tone="bad" />
                </>
              )}
              {drill.meds && <MeasurementTable model={model} rows={drill.meds} showProject showIndicator />}
              {drill.inds && (
                <ul className="divide-y divide-border">
                  {drill.inds.map((i) => (
                    <li key={`${i.projectBoardId}:${i.itemId}`}>
                      <button onClick={() => onIndicator(i)} className="flex min-h-11 w-full items-center gap-3 py-2 text-left hover:bg-muted/50">
                        <TypeBadge tipo={i.tipo} />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{i.name}</span>
                        <span className="hidden truncate text-xs text-muted-foreground sm:block sm:max-w-64">{model.projectBy.get(i.projectBoardId)?.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {drill.projs && (
                <ul className="divide-y divide-border">
                  {drill.projs.map((p) => (
                    <li key={p.boardId} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                      <span className="font-medium">{p.name}</span>
                      <span className="text-xs text-muted-foreground">{p.workspaceName} · atualizado {fmtDateTime(p.lastSuccessAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
