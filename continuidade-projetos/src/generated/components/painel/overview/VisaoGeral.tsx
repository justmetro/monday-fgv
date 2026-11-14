import type { Row } from '@generated/lib/painel';
import type { Filtros, Sort } from '@generated/lib/filtros';
import { FinalizandoTopo } from '@generated/components/painel/overview/FinalizandoTopo';
import { Quantitativos } from '@generated/components/painel/overview/Quantitativos';
import type { Extras, ResultadoExtras } from '@generated/hooks/useSalvarExtras';

export type KpiAcao = { filtros?: Partial<Filtros>; sort?: Sort };

/** Visão geral: finalização prevista, custos (total e base), quinzenas, lista e quantitativos da simulação. */
export function VisaoGeral({ rows, loading, onOpen, onSalvar }: {
  rows: Row[]; loading: boolean; onOpen?: (id: string) => void; onSalvar: (r: Row, x: Extras) => Promise<ResultadoExtras>;
}) {
  return (
    <div className="flex flex-col gap-6">
      <FinalizandoTopo rows={rows} loading={loading} onOpen={(id) => onOpen?.(id)} onSalvar={onSalvar} />
      {!loading && <Quantitativos rows={rows} onOpen={(id) => onOpen?.(id)} />}
    </div>
  );
}
