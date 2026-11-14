import { useMemo, useState } from 'react';
import { CalendarClock, Wallet } from 'lucide-react';
import { cn } from '@lib/utils';
import { fmtBRL, type Row } from '@generated/lib/painel';
import { desmobilizadasPorQuinzena, proximasQuinzenas, quinzenaDe } from '@generated/lib/quinzenas';
import { ChartQuinzenas } from '@generated/components/painel/overview/ChartQuinzenas';
import { ListaFinalizando } from '@generated/components/painel/overview/ListaFinalizando';
import type { Extras, ResultadoExtras } from '@generated/hooks/useSalvarExtras';

const HORIZONTES = [30, 60, 90, 180] as const;
type Horizonte = (typeof HORIZONTES)[number];

/** Primeiras informações da visão geral: quem finaliza, quanto custa manter, desmobilização por quinzena e lista. */
export function FinalizandoTopo({ rows, loading, onOpen, onSalvar }: { rows: Row[]; loading: boolean; onOpen: (id: string) => void; onSalvar: (r: Row, x: Extras) => Promise<ResultadoExtras> }) {
  const [h, setH] = useState<Horizonte>(90);
  const [quinzena, setQuinzena] = useState<string | null>(null);

  const finalizando = useMemo(
    () => rows.filter((r) => r.diasFim !== null && r.diasFim >= 0 && r.diasFim <= h).sort((a, b) => (a.diasFim ?? 0) - (b.diasFim ?? 0)),
    [rows, h],
  );
  const quinzenas = useMemo(() => desmobilizadasPorQuinzena(rows), [rows]);
  const lista = useMemo(() => {
    if (!quinzena) return finalizando;
    return rows.filter((r) => quinzenaDe(r.dataFim) === quinzena).sort((a, b) => (a.diasFim ?? 0) - (b.diasFim ?? 0));
  }, [rows, finalizando, quinzena]);
  const qLabel = proximasQuinzenas().find((q) => q.key === quinzena)?.titulo;

  // Soma do custo mensal da equipe fixa dos projetos dentro do horizonte selecionado.
  const custoFixo = finalizando.reduce((s, r) => s + (r.custoMensal ?? 0), 0);
  const custoBase = finalizando.reduce((s, r) => s + (r.base.custoMensal ?? 0), 0);
  const comBase = finalizando.filter((r) => r.base.n > 0).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="soft-stack flex min-w-0 flex-col gap-3 rounded-xl bg-card p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">Próximos projetos com finalização prevista</span>
            <CalendarClock className="size-4 text-muted-foreground" aria-hidden />
          </div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            {loading ? <div className="h-10 w-16 animate-pulse rounded bg-muted" /> : (
              <span className="tnum text-4xl font-normal tracking-[-0.03em] text-foreground">{finalizando.length}</span>
            )}
            <div role="radiogroup" aria-label="Horizonte" className="inline-flex rounded-md border border-border bg-[hsl(var(--chrome))] p-0.5">
              {HORIZONTES.map((x) => (
                <button
                  key={x} type="button" role="radio" aria-checked={h === x} onClick={() => { setH(x); setQuinzena(null); }}
                  className={cn('tnum min-h-8 rounded px-2.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', h === x ? 'bg-card font-medium text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
                >
                  {x} dias
                </button>
              ))}
            </div>
          </div>
          <span className="text-xs text-muted-foreground">A partir do levantamento de último produto previsto · próximos {h} dias</span>
        </div>
        <div className="soft-stack flex min-w-0 flex-col gap-3 rounded-xl bg-card p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">Custos Equipes fixas de projetos próximos à finalizar</span>
            <Wallet className="size-4 text-muted-foreground" aria-hidden />
          </div>
          {loading ? <div className="h-10 w-32 animate-pulse rounded bg-muted" /> : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex min-w-0 flex-col">
                <span className="text-xs text-muted-foreground">Custo Total · equipe completa</span>
                <span className="tnum text-3xl font-normal tracking-[-0.03em] text-primary">{fmtBRL(custoFixo)}<span className="ml-1 text-sm text-muted-foreground">/mês</span></span>
              </div>
              <div className="flex min-w-0 flex-col sm:border-l sm:border-border sm:pl-3">
                <span className="text-xs text-muted-foreground">Custo Base · só a equipe base</span>
                <span className="tnum text-3xl font-normal tracking-[-0.03em] text-foreground">{fmtBRL(custoBase)}<span className="ml-1 text-sm text-muted-foreground">/mês</span></span>
                <span className="text-[11px] text-muted-foreground">{comBase} de {finalizando.length} projeto(s) com base definida</span>
              </div>
            </div>
          )}
          <span className="text-xs text-muted-foreground">
            base + fator de encargos · {finalizando.length} projeto(s) nos próximos {h} dias
          </span>
        </div>
      </div>

      <ChartQuinzenas data={quinzenas} loading={loading} selecionada={quinzena} onSelect={setQuinzena} />

      {!loading && (
        <ListaFinalizando
          rows={lista}
          titulo={quinzena ? `Finalizando na ${qLabel ?? 'quinzena selecionada'}` : `Último produto nos próximos ${h} dias`}
          onOpen={onOpen}
          onSalvar={onSalvar}
        />
      )}
    </div>
  );
}
