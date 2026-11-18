import { useCallback, useEffect, useMemo, useState } from 'react';
import { filtrarPorFimAtuacao } from '@generated/lib/carga';
import { Toaster } from '@components/ui/sonner';
import { DotBackground } from '@generated/components/fx/DotBackground';
import { comTransicao, piscar, useTabIndicator } from '@generated/components/fx/motion';
import { TooltipProvider } from '@components/ui/tooltip';
import { useSalvarProjeto } from '@generated/hooks/useSalvarProjeto';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { AlertTriangle, ArrowRightLeft, BarChart3, LayoutGrid, CalendarClock, Wallet, ListTodo, RotateCw, UserX } from 'lucide-react';
import { IndicadoresTab } from '@generated/components/indicadores/IndicadoresTab';
import { baseResAcumulado } from '@generated/lib/resAcumulado';
import { AlocacaoTab, type Sub } from '@generated/components/alocacao/AlocacaoTab';
import { useMeusProjetos } from '@generated/hooks/useMeusProjetos';
import { useOpcoesEdicao } from '@generated/hooks/useOpcoesEdicao';
import { useMapaGerentes } from '@generated/hooks/useMapaGerentes';
import { cn } from '@lib/utils';
import { Skeleton } from '@components/ui/skeleton';
import { Spinner } from '@components/ui/spinner';
import { Switch } from '@components/ui/switch';
import { FILTROS_INICIAIS, type FiltrosState, useProjetos } from '@generated/hooks/useProjetos';
import { type Projeto, toDate } from '@generated/lib/format';
import type { Changes } from '@generated/server/projetos';
import { FilterBar } from '@generated/components/FilterBar';
import { OverviewTab } from '@generated/components/OverviewTab';
import { PrazosTab } from '@generated/components/PrazosTab';
import { FinanceiroTab } from '@generated/components/FinanceiroTab';
import { StatusSgiTab } from '@generated/components/StatusSgiTab';
import { OPT } from '@generated/lib/board-options';
import { ProjectSheet } from '@generated/components/ProjectSheet';
import { PeriodoGlobalControle } from '@generated/components/PeriodoGlobalControle';
import { type PeriodoGlobal, gravarPeriodo, periodoDaUrl, noPeriodo, noPeriodoOuNaoAssinado, anoDoPeriodo } from '@generated/lib/periodo';
import { etapasDe } from '@generated/lib/farol';
import { GROUP_ESTEIRA } from '@generated/lib/grupos';
import { cancelado } from '@generated/lib/filtros';
import { AbrirProjetoCtx } from '@generated/components/AbrirProjeto';

type Aba = 'geral' | 'prazos' | 'financeiro' | 'sgi' | 'indicadores' | 'alocacao';
const ABAS: { key: Aba; label: string; icon: typeof LayoutGrid }[] = [
  { key: 'geral', label: 'Visão geral', icon: LayoutGrid },
  { key: 'prazos', label: 'Projetos', icon: CalendarClock },
  { key: 'financeiro', label: 'Financeiro', icon: Wallet },
  { key: 'sgi', label: 'Status SGI', icon: ListTodo },
  { key: 'indicadores', label: 'Indicadores', icon: BarChart3 },
  { key: 'alocacao', label: 'Gestão Alocação de Gerentes', icon: ArrowRightLeft },
];

/** Date each tab filters by in the global period filter (tabs without an entry don't show it). */
const REF_PERIODO: Partial<Record<Aba, string>> = {
  geral: 'ano da base Res. Acumulado (tempo e IT) e Conclusão do Planejamento (“Planejados”)',
  prazos: 'data prevista das etapas (prazos); projetos sem prazo sempre aparecem',
  financeiro: 'Data de Assinatura (tabela) e ano da base Res. Acumulado (resumo)',
  sgi: 'Data de Assinatura',
  indicadores: 'ano da base Res. Acumulado',
  alocacao: 'data do Último Produto Previsto',
};

/** One-line rule shown right under the period control, so the filter logic of the current tab is always visible. */
const REGRA_ABA: Partial<Record<Aba, string>> = {
  geral: 'Visão geral: tempo de planejamento e IT pela base Res. Acumulado do ano; “Planejados” pela Conclusão do Planejamento no período.',
  prazos: 'Projetos: projetos com alguma etapa com prazo no período, mais os projetos sem prazo calculado (farol “Sem data”).',
  financeiro: 'Financeiro: tabela pela Data de Assinatura (não assinados no ano corrente); resumo do ano pela base Res. Acumulado.',
  sgi: 'Status SGI: só o grupo Esteira do 02.01, sem “Despriorizado”; ano da Data de Assinatura; não assinados aparecem no ano corrente.',
  indicadores: 'Indicadores: base Res. Acumulado do ano (Início Planejamento 01/01–15/12, Conclusão até 31/12), comparada ao ano anterior.',
  alocacao: 'Gestão Alocação de Gerentes: ano do Último Produto Previsto (a Esteira de Projetos não é filtrada).',
};

const horaDe = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Carregando projetos">
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[var(--radius-lg)] border border-border bg-border sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-2 bg-card px-5 py-4">
            <Skeleton className="fx-shimmer h-3 w-32 bg-[hsl(var(--surface-3))]" />
            <Skeleton className="fx-shimmer h-9 w-24 bg-[hsl(var(--surface-3))]" />
            <Skeleton className="fx-shimmer h-3 w-40 bg-[hsl(var(--surface-2))]" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="flex flex-col gap-2.5 rounded-[var(--radius-lg)] border border-border bg-card p-4">
            {[0, 1, 2, 3, 4, 5].map((j) => <Skeleton key={j} className="fx-shimmer h-5 bg-[hsl(var(--surface-2))]" />)}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const search = useSearch({ from: '/_app/' });
  const navigate = useNavigate({ from: '/' });
  const aba: Aba = search.aba ?? 'geral';
  const sub: Sub = search.sub ?? 'disponibilidade';
  // Default = current year: re-evaluated every minute so the default follows the calendar on 1 January.
  const [anoHoje, setAnoHoje] = useState(() => new Date().getFullYear());
  useEffect(() => {
    const t = setInterval(() => setAnoHoje((a) => (a === new Date().getFullYear() ? a : new Date().getFullYear())), 60_000);
    return () => clearInterval(t);
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const periodo = useMemo(() => periodoDaUrl(search.per), [search.per, anoHoje]);
  const setPeriodo = useCallback((p: PeriodoGlobal | null) => navigate({ search: (prev) => ({ ...prev, per: gravarPeriodo(p) }) }), [navigate]);
  const [filtros, setFiltros] = useState<FiltrosState>(FILTROS_INICIAIS);
  const [aberto, setAberto] = useState<Projeto | null>(null);
  /** Projects visible in Alocação de Gerentes (reported by the tab; null until it loads). */
  const [contagemAloc, setContagemAloc] = useState<number | null>(null);
  const meus = useMeusProjetos();
  // getMe and the base load run in parallel; the remembered "Meus projetos" choice is applied
  // when the user id arrives (filtering is local, so this costs no request).
  useEffect(() => {
    if (meus.ready && meus.inicial) setFiltros((f) => ({ ...f, meus: true }));
  }, [meus.ready, meus.inicial]);
  const { items: itemsBase, comFinalizados, baseBruta, meusCount, opcoes, loading, refetching, error, atualizadoEm, atualizar, atualizarSilencioso, replaceItem } = useProjetos(filtros, meus.meId);
  const opcoesLoading = loading;
  // Board options (Status SGI labels etc.) load when the edit panel or the Status SGI tab is used.
  const edicao = useOpcoesEdicao(!!aberto || aba === 'sgi' || aba === 'geral' || aba === 'alocacao');
  const mapaGerentes = useMapaGerentes(aba === 'alocacao' || filtros.fimAtuacao > 0);
  // Quick filter "Fim de atuação" needs the Mapa; until it loads, the list stays unfiltered (button shows a spinner).
  const items = useMemo(
    () => (filtros.fimAtuacao && mapaGerentes.mapa ? filtrarPorFimAtuacao(itemsBase, mapaGerentes.mapa.gerentes, filtros.fimAtuacao) : itemsBase),
    [itemsBase, filtros.fimAtuacao, mapaGerentes.mapa],
  );
  const concluidos = useMemo(
    () => (filtros.fimAtuacao && mapaGerentes.mapa ? filtrarPorFimAtuacao(comFinalizados, mapaGerentes.mapa.gerentes, filtros.fimAtuacao) : comFinalizados),
    [comFinalizados, filtros.fimAtuacao, mapaGerentes.mapa],
  );
  // Prazos / Financeiro / Status SGI: "Novo Cadastro" hidden unless switched on in "Incluir:".
  const itemsFuturo = useMemo(
    () => items.filter((p) =>
      !(p.statusPlanejamento === 'Novo Cadastro - 30 a 45 dias' && !filtros.includeNovo30) &&
      !(p.statusPlanejamento === 'Novo Cadastro - 45 a 60 dias' && !filtros.includeNovo45)),
    [items, filtros.includeNovo30, filtros.includeNovo45],
  );
  // "Evolução" weekly snapshot: the whole esteira (no filters, no cancelled).
  const baseSnapshot = useMemo(() => baseBruta.filter((p) => p.group?.id === GROUP_ESTEIRA && !cancelado(p)), [baseBruta]);
  // Global period filter: Prazos = any stage deadline (data prevista) in the period; projects without any calculated
  // deadline always stay (farol "Sem data"), so nobody of the esteira disappears for lack of a date.
  const itemsPrazos = useMemo(() => (periodo ? itemsFuturo.filter((p) => { const et = etapasDe(p); return et.every((e) => !e.prazo) || et.some((e) => noPeriodo(e.prazo, periodo)); }) : itemsFuturo), [itemsFuturo, periodo]);
  // Base "Res. Acumulado" (monday dashboard filter) of the selected year: top filters applied, Finalizados always in.
  const anoRes = anoDoPeriodo(periodo) ?? anoHoje;
  const resAcum = useMemo(() => baseResAcumulado(concluidos, anoRes), [concluidos, anoRes]);
  // Current year of the period (ano / trimestre / meses / intervalo of a single year) = projects not yet
  // signed stay in the default view (chip "Não assinado"); a toggle next to the period control can hide them.
  const anoAtualDoPeriodo = !!periodo && anoDoPeriodo(periodo) === new Date().getFullYear();
  const [mostrarNaoAssinados, setMostrarNaoAssinados] = useState(true);
  const itemsFinBase = useMemo(
    () => (periodo ? itemsFuturo.filter((p) => noPeriodoOuNaoAssinado(toDate(p.dataDeAssinatura), periodo)) : itemsFuturo),
    [itemsFuturo, periodo],
  );
  const itemsFin = useMemo(
    () => (anoAtualDoPeriodo && !mostrarNaoAssinados ? itemsFinBase.filter((p) => !!p.dataDeAssinatura) : itemsFinBase),
    [itemsFinBase, anoAtualDoPeriodo, mostrarNaoAssinados],
  );
  const naoAssinadosNoPeriodo = useMemo(
    () => (anoAtualDoPeriodo ? itemsFinBase.filter((p) => !p.dataDeAssinatura && p.statusPlanejamento !== 'Pausado').length : 0),
    [itemsFinBase, anoAtualDoPeriodo],
  );
  // Status SGI = Data de Assinatura; only the 02.01 esteira group (already) and never Status SGI "Despriorizado".
  const itemsSgi = useMemo(() => itemsFin.filter((p) => p.statusSgi !== 'Despriorizado'), [itemsFin]);
  // "Sem data": projects of the tab without its reference date (only visible in "Todos os anos" — Financeiro /
  // Status SGI / Indicadores show unsigned projects inline in the current year instead, via the chip above).
  const semData = useMemo(() => {
    if ((aba === 'financeiro' || aba === 'sgi') && anoAtualDoPeriodo) return null;
    if (aba === 'financeiro') return itemsFuturo.filter((p) => !toDate(p.dataDeAssinatura)).length;
    if (aba === 'sgi') return itemsFuturo.filter((p) => !toDate(p.dataDeAssinatura) && p.statusSgi !== 'Despriorizado').length;
    return null;
  }, [aba, itemsFuturo, anoAtualDoPeriodo]);
  // Header counter: same base as the current tab (Visão geral respects the Novo Cadastro / Pausado toggles).
  const contagemAba = useMemo(() => {
    const st = (p: Projeto) => p.statusPlanejamento;
    if (aba === 'geral') return items.filter((p) =>
      !(st(p) === 'Novo Cadastro - 30 a 45 dias' && !filtros.includeNovo30) &&
      !(st(p) === 'Novo Cadastro - 45 a 60 dias' && !filtros.includeNovo45) &&
      !(st(p) === 'Pausado' && !filtros.includePausado)).length;
    if (aba === 'prazos') return itemsPrazos.length;
    if (aba === 'sgi') return itemsSgi.length;
    if (aba === 'indicadores') return resAcum.items.length;
    if (aba === 'financeiro') return itemsFin.filter((p) => st(p) !== 'Pausado').length;
    // Alocação works on its own base (every 02.01 item, minus cancelled — see montarAlocacao).
    if (aba === 'alocacao') return contagemAloc ?? baseBruta.length;
    return items.length;
  }, [aba, items, itemsPrazos, itemsFin, itemsSgi, resAcum, baseBruta, contagemAloc, filtros.includeNovo30, filtros.includeNovo45, filtros.includePausado]);
  // When the base reloads (60 s refresh, focus, "Recarregar do monday"), the open panel gets the fresh version.
  useEffect(() => {
    setAberto((cur) => {
      if (!cur) return cur;
      const novo = baseBruta.find((p) => p.id === cur.id);
      return novo && novo !== cur ? novo : cur;
    });
  }, [baseBruta]);
  const toggleMeus = (on: boolean) => {
    setFiltros((f) => ({ ...f, meus: on }));
    meus.lembrar(on);
  };

  // Keep list and open panel in sync with optimistic / re-read items.
  const onItem = useCallback(
    (item: Projeto) => {
      replaceItem(item);
      setAberto((cur) => (cur && cur.id === item.id ? item : cur));
      piscar(item.id);
    },
    [replaceItem],
  );
  const { salvar: salvarItem, salvando } = useSalvarProjeto(onItem);
  // After any save, the base is re-read in the background (fresh formulas/other users' changes).
  const salvar = useCallback(async (p: Projeto, c: Changes) => {
    const ok = await salvarItem(p, c);
    if (ok) atualizarSilencioso();
    return ok;
  }, [salvarItem, atualizarSilencioso]);
  const tabs = useTabIndicator(aba);

  return (
    <TooltipProvider delayDuration={150}>
    <AbrirProjetoCtx.Provider value={setAberto}>
    <div className="dark relative isolate flex min-h-dvh flex-col bg-background text-foreground">
      <DotBackground />
      <header className="fx-glass sticky top-0 z-40">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 pt-3 md:px-6">
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-semibold tracking-[-0.01em] text-foreground">Painel da Esteira de Planejamento</h1>
            <p className="truncate text-[11px] text-muted-foreground">Coordenação de Planejamento de Projetos · FGV DGPE</p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <button type="button" onClick={atualizar} disabled={loading || refetching}
              title="As alterações no app já são salvas automaticamente"
              className="inline-flex h-11 items-center gap-1.5 rounded-[var(--radius-md)] px-2 text-xs text-muted-foreground transition-colors duration-150 hover:bg-[hsl(var(--surface-2))] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 md:h-7">
              {refetching ? <Spinner className="size-3.5" /> : <RotateCw className="size-3.5" aria-hidden />}
              <span>Recarregar do monday</span>
              {atualizadoEm && <span className="tnum text-[hsl(var(--fg-subtle))]">· Atualizado às {horaDe(atualizadoEm)}</span>}
            </button>
            {!loading && !error && (
              <span className="tnum">
                {filtros.meus ? (
                  <span className="text-foreground">Meus projetos · {contagemAba}</span>
                ) : (
                  <>{contagemAba} projeto{contagemAba === 1 ? '' : 's'}</>
                )}
                {' '}· {aba === 'alocacao' ? 'alocação' : 'esteira'}
              </span>
            )}
          </div>
        </div>
        {REF_PERIODO[aba] && (
          <div className="flex flex-col gap-1.5 px-4 pt-2 md:px-6">
            <div className="flex flex-wrap items-center gap-2">
              <PeriodoGlobalControle valor={periodo} onChange={setPeriodo} referencia={REF_PERIODO[aba] ?? ''} semData={semData} />
              {(aba === 'financeiro' || aba === 'sgi') && anoAtualDoPeriodo && naoAssinadosNoPeriodo > 0 && (
                <label htmlFor="toggle-nao-assinados" className="flex h-11 items-center gap-2 rounded-[var(--radius-md)] border border-input bg-[hsl(var(--surface-2))] px-2.5 text-xs text-muted-foreground md:h-7">
                  <Switch id="toggle-nao-assinados" checked={mostrarNaoAssinados} onCheckedChange={setMostrarNaoAssinados} />
                  <span className="cursor-pointer">Não assinados <span className="tnum text-foreground">({naoAssinadosNoPeriodo})</span></span>
                </label>
              )}
            </div>
            {REGRA_ABA[aba] && <p className="text-[11px] text-[hsl(var(--fg-subtle))]">{REGRA_ABA[aba]}</p>}
          </div>
        )}
        <nav ref={tabs.navRef} aria-label="Seções" className="relative -mb-px mt-1 flex gap-1 overflow-x-auto px-2 md:px-4">
          <span ref={tabs.indRef} className="fx-tab-ind" aria-hidden />
          {ABAS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              aria-current={aba === key ? 'page' : undefined}
              onClick={() => comTransicao(() => navigate({ search: (prev) => ({ aba: key, per: prev.per }) }))}
              className={cn(
                'relative inline-flex h-11 shrink-0 items-center gap-1.5 px-3 text-[13px] transition-colors duration-150 md:h-10',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                aba === key ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="size-4" aria-hidden /> {label}
            </button>
          ))}
        </nav>
      </header>

      {/* "Alocação de Gerentes" has its own search and always works on the whole esteira. */}
      <div className={cn('fx-glass px-4 py-2 md:px-6', aba === 'alocacao' && 'hidden')}>
        <FilterBar visaoGeral={aba === 'geral'} novoCadastro={aba === 'prazos' || aba === 'financeiro' || aba === 'sgi'} filtros={filtros} setFiltros={setFiltros} opcoes={opcoes} opcoesLoading={opcoesLoading}
          meusCount={meusCount} onToggleMeus={toggleMeus} meusDisponivel={!meus.ready || !!meus.meId}
          fimCarregando={filtros.fimAtuacao > 0 && !mapaGerentes.mapa && !mapaGerentes.error} fimErro={filtros.fimAtuacao > 0 && !!mapaGerentes.error} />
      </div>

      <main className="min-w-0 flex-1 px-4 py-4 md:px-6 md:py-5">
        {loading ? (
          <LoadingSkeleton />
        ) : error && !items.length ? (
          <div role="alert" className="flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-[hsl(var(--danger)/0.4)] bg-[hsl(var(--danger-soft))] px-6 py-10 text-center">
            <AlertTriangle className="size-5 text-[hsl(var(--danger))]" aria-hidden />
            <p className="text-sm text-foreground">{error}</p>
            <button type="button" onClick={atualizar} className="inline-flex h-11 items-center gap-1.5 rounded-[var(--radius-md)] border border-input bg-card px-3 text-[13px] hover:bg-[hsl(var(--surface-3))] md:h-8">
              <RotateCw className="size-3.5" aria-hidden /> Tentar novamente
            </button>
          </div>
        ) : aba !== 'alocacao' && filtros.meus && !items.length && !error ? (
          <div className="flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-border bg-card px-6 py-14 text-center">
            <UserX className="size-5 text-muted-foreground" aria-hidden />
            <p className="text-base font-medium text-foreground">Você não é ponto focal de nenhum projeto no escopo atual</p>
            <p className="max-w-md text-sm text-muted-foreground">
              “Meus projetos” mostra só os projetos em que você aparece na coluna Ponto Focal, respeitando os demais filtros e o escopo de grupos.
            </p>
            <button type="button" onClick={() => toggleMeus(false)}
              className="inline-flex h-11 items-center rounded-[var(--radius-md)] bg-primary px-3 text-[13px] font-medium text-primary-foreground hover:bg-[hsl(var(--primary)/0.88)] md:h-8">
              Ver todos
            </button>
          </div>
        ) : (
          <div key={aba} className="fx-fade">
            {error && (
              <div role="alert" className="mb-3 flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] border border-[hsl(var(--danger)/0.4)] bg-[hsl(var(--danger-soft))] px-3 py-2 text-[13px]">
                <AlertTriangle className="size-4 text-[hsl(var(--danger))]" aria-hidden />
                <span className="flex-1">{error} Exibindo os últimos dados carregados.</span>
                <button type="button" onClick={atualizar} className="underline underline-offset-2">Tentar novamente</button>
              </div>
            )}
            {aba === 'geral' && <OverviewTab items={items} concluidos={concluidos} mostrar={{ 'Novo Cadastro - 30 a 45 dias': filtros.includeNovo30, 'Novo Cadastro - 45 a 60 dias': filtros.includeNovo45, Pausado: filtros.includePausado }} opcoesStatus={edicao.res?.opts.statusPlanejamento ?? OPT.statusPlanejamento} salvar={salvar} baseSnapshot={baseSnapshot} periodo={periodo} resAcum={resAcum} />}
            {aba === 'prazos' && <PrazosTab items={itemsPrazos} onOpen={setAberto} />}
            {aba === 'financeiro' && <FinanceiroTab items={itemsFin} resAcum={resAcum} onOpen={setAberto} />}
            {aba === 'indicadores' && <IndicadoresTab items={concluidos} res={resAcum} periodo={periodo} />}
            {aba === 'sgi' && <StatusSgiTab items={itemsSgi} opcoes={(edicao.res?.opts.statusSgi ?? OPT.statusSgi).filter((o) => o !== 'Despriorizado')} onOpen={setAberto} salvar={salvar} />}
            {aba === 'alocacao' && (
              <AlocacaoTab base={baseBruta} mapaState={mapaGerentes} sub={sub} setSub={(s: Sub) => comTransicao(() => navigate({ search: (prev) => ({ aba: 'alocacao', sub: s, per: prev.per }) }))}
                onItem={onItem} recarregarBase={atualizar} onContagem={setContagemAloc} periodo={periodo} eixoOpts={edicao.res?.opts.eixo ?? OPT.eixo} ddGerenteOpts={edicao.res?.opts.gerente1 ?? OPT.gerente1} />
            )}
          </div>
        )}
      </main>

      <ProjectSheet projeto={aberto} onClose={() => setAberto(null)} edicao={edicao} salvar={salvar} salvando={salvando} />
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{ classNames: { toast: '!bg-popover !text-popover-foreground !border-border !rounded-[var(--radius-lg)]', description: '!text-muted-foreground' } }}
      />
    </div>
    </AbrirProjetoCtx.Provider>
    </TooltipProvider>
  );
}
