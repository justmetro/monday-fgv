import { useMemo, useState } from 'react';
import { FileBarChart } from 'lucide-react';
import type { Projeto } from '@generated/lib/format';
import { type PeriodoGlobal, mesesDoAno } from '@generated/lib/periodo';
import { calcularIndicadores, porMes } from '@generated/lib/indicadores';
import { type ResAcumulado, baseResAcumulado, regraResAcumulado } from '@generated/lib/resAcumulado';
import { montarCards } from '@generated/lib/indicadoresCards';
import { EmptyState, InfoDica } from '@generated/components/ui-bits';
import { CardsIndicadores } from '@generated/components/indicadores/CardsIndicadores';
import { OrcPlanMes, PALETA_TELA, Quadro, SaldoMes, StatusBarras } from '@generated/components/indicadores/Graficos';
import { RelatorioMensal } from '@generated/components/indicadores/RelatorioMensal';
import { ListaContaSheet } from '@generated/components/indicadores/ListaContaSheet';

const ANT = 'ano anterior';

/**
 * "Indicadores": only indicators (no project tables) over the base "Res. Acumulado" of the selected cycle
 * (`items` = top filters applied, Finalizados included); comparison with the previous year.
 */
export function IndicadoresTab({ items, res, periodo }: { items: Projeto[]; res: ResAcumulado; periodo: PeriodoGlobal | null }) {
  const [relatorio, setRelatorio] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);
  const base = res.items;
  const ind = useMemo(() => calcularIndicadores(base), [base]);
  const indAnt = useMemo(() => calcularIndicadores(baseResAcumulado(items, res.ano - 1).items), [items, res.ano]);
  const cards = useMemo(() => montarCards(ind, indAnt), [ind, indAnt]);
  const meses = useMemo(() => mesesDoAno(res.ano), [res.ano]);
  const serie = useMemo(() => porMes(base, meses), [base, meses]);
  const card = cards.find((c) => c.k === aberto) ?? null;
  const titulo = `Res. Acumulado do Ciclo ${res.ano}`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-[-0.01em] text-foreground">Indicadores · {titulo}</h2>
          <ul className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
            <li className="inline-flex items-center gap-1"><span className="tnum">{base.length} projeto{base.length === 1 ? '' : 's'} na base</span><InfoDica texto={regraResAcumulado(res)} /></li>
            <li>Comparativo com o ano anterior</li>
            <li>Clique em um número para ver os projetos</li>
          </ul>
        </div>
        <button type="button" onClick={() => setRelatorio(true)}
          className="inline-flex h-11 items-center gap-1.5 rounded-[var(--radius-md)] bg-primary px-3 text-[13px] font-medium text-primary-foreground hover:bg-[hsl(var(--primary)/0.88)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-8">
          <FileBarChart className="size-4" aria-hidden /> Relatório do mês
        </button>
      </div>

      {base.length === 0 ? (
        <EmptyState title="Nenhum projeto na base do ciclo" hint="Nenhum projeto atende à regra Res. Acumulado com os filtros atuais. Troque o ano no topo ou ajuste os filtros." />
      ) : (
        <>
          <CardsIndicadores cards={cards} rotAnt={ANT} onAbrir={setAberto} />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Quadro titulo="Orçado × Planejado por mês" nota="Recorte Total, pelo mês da Conclusão do Planejamento; mesma regra de soma dos cards.">
              <OrcPlanMes dados={serie} p={PALETA_TELA} />
            </Quadro>
            <Quadro titulo="Saldo por mês" nota="% de saldo = Saldo ÷ Orçado × 100 (recorte Total), pelo mês da Conclusão do Planejamento; valor em R$ ao passar o mouse.">
              <SaldoMes dados={serie} p={PALETA_TELA} />
            </Quadro>
          </div>
          <Quadro titulo="Distribuição por status" nota="Status Planejamento dos projetos da base.">
            <StatusBarras dados={ind.porStatus} p={PALETA_TELA} />
          </Quadro>
        </>
      )}
      <ListaContaSheet titulo={card ? `${card.label} · ${card.valor}` : null} subtitulo={titulo}
        itens={aberto ? ind.listas[aberto] ?? [] : []} onClose={() => setAberto(null)} />
      {relatorio && <RelatorioMensal items={items} periodo={periodo} onClose={() => setRelatorio(false)} />}
    </div>
  );
}
