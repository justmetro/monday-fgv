import { addMonths, format, startOfMonth } from 'date-fns';
import { Skeleton } from '@components/ui/skeleton';
import { Timeline, type TimelineItem } from '@generated/components/ui-ext/Timeline';
import { fmtDate, type Grupo, type Row } from '@generated/lib/painel';

const MESES_ANTES = 2;
const MESES = 12;

const BAR: Record<Grupo, string> = {
  'Em execução': 'bg-primary/80',
  'Em planejamento': 'bg-[hsl(var(--chart-5))]/70',
  'Em encerramento': 'bg-[hsl(var(--warning))]/80',
  'Outros status (verificar)': 'bg-destructive/60',
};

/**
 * Fim = maior data de entrega entre os produtos ativos do projeto; sem produtos ativos com data,
 * usa o término por datas do projeto. Início = primeira data de início disponível do projeto.
 */
function periodo(r: Row): { start: string | null; end: string | null } {
  const p = r.projeto;
  const end = r.fimProdutos ?? r.termino.date;
  const inicios = [p.execucao?.from, p.execucaoPrevista?.from, p.contratual?.from].filter((x): x is string => !!x);
  const start = inicios.find((s) => !end || s <= end) ?? end;
  return { start, end };
}

export function LinhaDoTempo({ rows, loading, onOpen }: { rows: Row[]; loading: boolean; onOpen: (id: string) => void }) {
  if (loading) return <Skeleton className="h-[420px] w-full rounded-xl" />;

  const fim = (r: Row) => r.fimProdutos ?? r.termino.date ?? '9999';
  const ordenadas = [...rows].sort((a, b) => fim(a).localeCompare(fim(b)));
  const items: TimelineItem[] = ordenadas.map((r) => ({
    id: r.projeto.id,
    label: r.projeto.name,
    sub: [r.projeto.sigla, r.naoInformada ? 'equipe não informada' : `${r.pessoas} na equipe fixa`, r.fimProdutos ? `entregas até ${fmtDate(r.fimProdutos)}` : null].filter(Boolean).join(' · '),
    ...periodo(r),
    barClass: BAR[r.grupo],
    marks: [
      { kind: 'termino' as const, date: r.termino.date, label: 'Último produto previsto' },
      { kind: 'manter' as const, date: r.manterAte, label: 'Manter até' },
    ],
  }));

  const ini = startOfMonth(addMonths(new Date(), -MESES_ANTES));
  const meses = Array.from({ length: MESES }, (_, i) => addMonths(ini, i));
  const liberadas = meses.map((m) => {
    const key = format(m, 'yyyy-MM');
    return rows.filter((r) => r.dataSaida?.slice(0, 7) === key).reduce((s, r) => s + r.liberadasN, 0);
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground" aria-label="Legenda">
        <span className="inline-flex flex-wrap items-center gap-2">
          <span title="Fim da barra = maior data de entrega entre os produtos restantes; sem produtos com data, usa o último produto previsto do projeto">Período (fim = última entrega restante)</span>
          {(Object.keys(BAR) as Grupo[]).map((g) => (
            <span key={g} className="inline-flex items-center gap-1"><span className={`h-2 w-4 rounded-full ${BAR[g]}`} aria-hidden />{g === 'Outros status (verificar)' ? 'Outros' : g}</span>
          ))}
        </span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2 rotate-45 bg-foreground" aria-hidden />Último produto</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-[hsl(var(--success))]" aria-hidden />Manter até</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-0.5 bg-primary" aria-hidden />Hoje</span>
      </div>

      <Timeline items={items} onOpen={onOpen} monthsBefore={MESES_ANTES} months={MESES} />

      <div className="soft-stack overflow-x-auto rounded-xl bg-card">
        <div className="grid min-w-[900px] grid-cols-[240px_minmax(0,1fr)] text-xs">
          <div className="sticky left-0 bg-card px-4 py-2.5">
            <span className="block font-medium text-foreground">Pessoas liberadas</span>
            <span className="block text-muted-foreground">saída = menor entre último produto e Manter até</span>
          </div>
          <div className="grid" style={{ gridTemplateColumns: `repeat(${MESES}, minmax(0, 1fr))` }}>
            {liberadas.map((n, i) => (
              <div key={meses[i]?.toISOString() ?? i} className="flex items-center border-l border-border px-2 py-2.5">
                <span className={n > 0 ? 'tnum text-sm font-medium text-foreground' : 'tnum text-sm text-muted-foreground'}>{n}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
