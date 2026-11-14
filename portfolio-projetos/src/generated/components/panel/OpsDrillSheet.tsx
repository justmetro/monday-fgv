import { useMemo } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@components/ui/sheet';
import type { ProductDoc, RiskDoc, ScheduleItemDoc } from '@generated/models';
import type { OpsModel } from '@generated/lib/ops';
import { DataTable } from '../ops/DataTable';
import { productColumns, riskColumns, scheduleColumns, SubitemList } from '../ops/columns';

export type OpsDrill = { title: string; schedule?: ScheduleItemDoc[]; products?: ProductDoc[]; risks?: RiskDoc[] } | null;

/** Gaveta com os itens que compõem um KPI ou barra (mesmo padrão do detalhamento de indicadores). */
export function OpsDrillSheet({ m, drill, onClose }: { m: OpsModel; drill: OpsDrill; onClose: () => void }) {
  const sc = useMemo(() => scheduleColumns(m), [m]);
  const pc = useMemo(() => productColumns(m), [m]);
  const rc = useMemo(() => riskColumns(m), [m]);
  const n = drill ? (drill.schedule ?? drill.products ?? drill.risks ?? []).length : 0;
  const key = (r: { projectBoardId: string; itemId: string }) => `${r.projectBoardId}:${r.itemId}`;
  return (
    <Sheet open={!!drill} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-5xl">
        {drill && (
          <>
            <SheetHeader className="border-b border-border">
              <SheetTitle>{drill.title}</SheetTitle>
              <SheetDescription>{n} registro(s) que compõem esta contagem</SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-8 pt-2">
              {drill.schedule && <DataTable cols={sc} rows={drill.schedule} rowKey={key} fileName="cronograma-detalhe" empty="Nenhuma atividade."
                expand={(r) => { const s = m.subsOf.get(key(r)); return s?.length ? <SubitemList m={m} rows={s} /> : null; }} />}
              {drill.products && <DataTable cols={pc} rows={drill.products} rowKey={key} fileName="produtos-detalhe" empty="Nenhum produto." />}
              {drill.risks && <DataTable cols={rc} rows={drill.risks} rowKey={key} fileName="riscos-detalhe" empty="Nenhum risco." />}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
