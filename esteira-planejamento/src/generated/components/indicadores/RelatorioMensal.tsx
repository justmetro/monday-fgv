import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Download, Presentation, X } from 'lucide-react';
import { Spinner } from '@components/ui/spinner';
import type { Projeto } from '@generated/lib/format';
import { type PeriodoGlobal, mesKey, mesesDoAno, rotuloMesLongo } from '@generated/lib/periodo';
import { calcularIndicadores, porMes } from '@generated/lib/indicadores';
import { baseResAcumulado } from '@generated/lib/resAcumulado';
import { montarCards } from '@generated/lib/indicadoresCards';
import { linhasRelatorio, resumoMes } from '@generated/lib/relatorioMensal';
import { type DadosExport, type Grafico, baixarPdf, baixarPpt, capturar } from '@generated/lib/relatorioExport';
import { CardsIndicadores } from '@generated/components/indicadores/CardsIndicadores';
import { OrcPlanMes, PALETA_IMPRESSAO, Quadro, SaldoMes, StatusBarras } from '@generated/components/indicadores/Graficos';
import { TabelaRelatorio } from '@generated/components/indicadores/TabelaRelatorio';

const TITULO = 'Relatório mensal · Esteira de Planejamento';
const btn = 'inline-flex h-11 items-center gap-1.5 rounded-[var(--radius-md)] border border-input bg-card px-3 text-[13px] text-foreground hover:bg-[hsl(var(--surface-2))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 md:h-8';
const quadro = 'w-[1000px] rounded-[var(--radius-lg)] border border-border bg-background p-4';
const somaMes = (m: string, n: number) => mesKey(new Date(Number(m.slice(0, 4)), Number(m.slice(5)) - 1 + n, 1));

/** Monthly report page: summary (sentence template), cards, charts and the sortable table; PDF (A4 landscape) and PPT. */
export function RelatorioMensal({ items, periodo, onClose }: { items: Projeto[]; periodo: PeriodoGlobal | null; onClose: () => void }) {
  const hoje = new Date();
  const opcoes = useMemo(() => Array.from({ length: 24 }, (_, i) => somaMes(mesKey(hoje), -i)), [hoje.getMonth()]); // eslint-disable-line react-hooks/exhaustive-deps
  const inicial = periodo?.tipo === 'meses' && periodo.meses.length === 1 && periodo.meses[0] ? periodo.meses[0] : somaMes(mesKey(hoje), -1);
  const [mes, setMes] = useState(inicial);
  const [exportando, setExportando] = useState<'pdf' | 'ppt' | null>(null);
  const refs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  const mesAnt = somaMes(mes, -1);
  // Base "Res. Acumulado" of the month's year, accumulated up to the last day of the month (previous month for the comparison).
  const fimDe = (m: string) => new Date(Number(m.slice(0, 4)), Number(m.slice(5)), 0);
  const base = useMemo(() => baseResAcumulado(items, Number(mes.slice(0, 4)), fimDe(mes)).items, [items, mes]);
  const ind = useMemo(() => calcularIndicadores(base), [base]);
  const ant = useMemo(() => calcularIndicadores(baseResAcumulado(items, Number(mesAnt.slice(0, 4)), fimDe(mesAnt)).items), [items, mesAnt]);
  const cards = useMemo(() => montarCards(ind, ant), [ind, ant]);
  const resumo = useMemo(() => resumoMes(mes, ind, ant, mesAnt), [mes, ind, ant, mesAnt]);
  // Monthly charts: January → the chosen month of its year (context for the month).
  const ano = Number(mes.slice(0, 4));
  const meses = useMemo(() => mesesDoAno(ano).filter((m) => m <= mes), [ano, mes]);
  const serie = useMemo(() => porMes(base, meses), [base, meses]);
  const linhas = useMemo(() => linhasRelatorio(base), [base]);
  const titulos = [`Orçado × Planejado por mês (jan–${rotuloMesLongo(mes)})`, `Saldo por mês (jan–${rotuloMesLongo(mes)})`, `Distribuição por status · ${rotuloMesLongo(mes)}`];

  const exportar = async (tipo: 'pdf' | 'ppt') => {
    setExportando(tipo);
    try {
      const graficos: Grafico[] = [];
      for (const [i, r] of refs.entries()) if (r.current) graficos.push(await capturar(r.current, titulos[i] ?? ''));
      const d: DadosExport = {
        titulo: TITULO, mes: rotuloMesLongo(mes), resumo, cards, graficos, linhas,
        geradoEm: new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      };
      const nome = `relatorio-esteira-${mes}`;
      if (tipo === 'pdf') await baixarPdf(d, `${nome}.pdf`);
      else await baixarPpt(d, `${nome}.pptx`);
    } catch (e) {
      console.error('Erro ao exportar relatório', e);
      toast.error('Não foi possível gerar o arquivo', { description: 'Tente novamente em alguns segundos.' });
    } finally {
      setExportando(null);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={`${TITULO} · ${rotuloMesLongo(mes)}`} className="relatorio-claro fixed inset-0 z-50 overflow-y-auto bg-background text-foreground">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-border bg-background/95 px-4 py-2 md:px-8">
        <label htmlFor="rel-mes" className="text-xs text-muted-foreground">Mês</label>
        <select id="rel-mes" value={mes} onChange={(e) => setMes(e.target.value)}
          className="h-11 rounded-[var(--radius-md)] border border-input bg-card px-2 text-[13px] text-foreground md:h-8">
          {opcoes.map((m) => <option key={m} value={m}>{rotuloMesLongo(m)}</option>)}
        </select>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" className={btn} disabled={!!exportando} onClick={() => void exportar('pdf')}>
            {exportando === 'pdf' ? <Spinner className="size-3.5" /> : <Download className="size-3.5" aria-hidden />} Baixar PDF
          </button>
          <button type="button" className={btn} disabled={!!exportando} onClick={() => void exportar('ppt')}>
            {exportando === 'ppt' ? <Spinner className="size-3.5" /> : <Presentation className="size-3.5" aria-hidden />} Baixar PPT
          </button>
          <button type="button" className={btn} onClick={onClose} aria-label="Fechar relatório"><X className="size-3.5" aria-hidden /> Fechar</button>
        </div>
      </div>

      <article className="mx-auto flex max-w-[1080px] flex-col gap-6 px-4 py-6 md:px-8">
        <header className="border-b border-border pb-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{TITULO}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-[-0.02em] text-foreground first-letter:uppercase">{rotuloMesLongo(mes)}</h1>
          <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-foreground">{resumo}</p>
        </header>

        <CardsIndicadores cards={cards} rotAnt={rotuloMesLongo(mesAnt)} />

        <div className="flex flex-col gap-4 overflow-x-auto">
          <Quadro ref={refs[0]} titulo={titulos[0] ?? ''} className={quadro}><OrcPlanMes dados={serie} p={PALETA_IMPRESSAO} altura={320} animar={false} /></Quadro>
          <Quadro ref={refs[1]} titulo={titulos[1] ?? ''} className={quadro}><SaldoMes dados={serie} p={PALETA_IMPRESSAO} altura={280} animar={false} /></Quadro>
          <Quadro ref={refs[2]} titulo={titulos[2] ?? ''} className={quadro}><StatusBarras dados={ind.porStatus} p={PALETA_IMPRESSAO} animar={false} /></Quadro>
        </div>

        <section>
          <h2 className="mb-2 text-xl font-semibold text-foreground">Projetos do mês <span className="tnum text-sm font-normal text-muted-foreground">({linhas.length})</span></h2>
          <TabelaRelatorio linhas={linhas} />
        </section>
      </article>
    </div>
  );
}
