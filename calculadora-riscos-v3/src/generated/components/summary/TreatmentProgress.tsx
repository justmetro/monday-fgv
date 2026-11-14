import { Eyebrow } from '@generated/components/kit';
import type { Count } from '@generated/components/summary/Bars';
import { STATUS_TRATAMENTO } from '@generated/lib/config';
import { cn } from '@lib/utils';

const COLOR: Record<string, string> = {
  'Não iniciado': 'bg-[hsl(var(--chart-5))]',
  'Em tratamento': 'bg-[hsl(var(--warning))]',
  'Em monitoramento': 'bg-[hsl(var(--cobalt))]',
  Encerrado: 'bg-[hsl(var(--success))]',
  'Sem status': 'bg-[hsl(var(--border))]',
};

export function TreatmentProgress({
  rows,
  pendencias,
  aplicaveis,
}: {
  rows: Count[];
  pendencias: { semEstrategia: number; semResponsavel: number; semPrazo: number; semPlano: number };
  aplicaveis: number;
}) {
  const map = new Map(rows.map((r) => [r.label, r.total]));
  const order = [...STATUS_TRATAMENTO, 'Sem status'];
  const total = Math.max(1, rows.reduce((a, r) => a + r.total, 0));

  return (
    <section className="glass p-5">
      <Eyebrow>Andamento do tratamento</Eyebrow>
      {aplicaveis === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">O andamento aparece quando houver riscos marcados como aplicáveis.</p>
      ) : (
        <>
          <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-[hsl(var(--border)/0.5)]" role="img" aria-label="Distribuição por status do tratamento">
            {order.map((k) => ((map.get(k) ?? 0) > 0 ? <span key={k} className={COLOR[k]} style={{ width: `${((map.get(k) ?? 0) / total) * 100}%` }} /> : null))}
          </div>
          <ul className="mt-4 space-y-2">
            {order.map((k) =>
              k === 'Sem status' && !(map.get(k) ?? 0) ? null : (
                <li key={k} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span className={cn('size-2 rounded-full', COLOR[k])} /> {k}
                  </span>
                  <span className="mono tabular-nums text-foreground">{map.get(k) ?? 0}</span>
                </li>
              ),
            )}
          </ul>
          <div className="mt-5 border-t border-[hsl(var(--border))] pt-4">
            <p className="mono-label text-[hsl(var(--text-dim))]">Pendências entre aplicáveis</p>
            <dl className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
              {[
                ['Sem estratégia', pendencias.semEstrategia],
                ['Sem responsável', pendencias.semResponsavel],
                ['Sem prazo', pendencias.semPrazo],
                ['Sem plano de ação', pendencias.semPlano],
              ].map(([l, n]) => (
                <div key={l as string}>
                  <dt className="text-[11px] text-muted-foreground">{l}</dt>
                  <dd className={cn('mono mt-0.5 text-xl tabular-nums', (n as number) > 0 ? 'text-[hsl(var(--warning))]' : 'text-foreground')}>{n}</dd>
                </div>
              ))}
            </dl>
          </div>
        </>
      )}
    </section>
  );
}
