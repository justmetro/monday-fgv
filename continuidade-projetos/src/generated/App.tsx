import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { AlertTriangle, FolderSearch } from 'lucide-react';
import { Toaster } from '@components/ui/sonner';
import { Skeleton } from '@components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/tabs';
import { TooltipProvider } from '@components/ui/tooltip';
import { usePainelData } from '@generated/hooks/usePainelData';
import { useSalvarExtras } from '@generated/hooks/useSalvarExtras';
import { PageHeader } from '@generated/components/painel/PageHeader';
import { FiltersBar } from '@generated/components/painel/FiltersBar';
import { ProjectsTable } from '@generated/components/painel/table/ProjectsTable';
import { VisaoGeral } from '@generated/components/painel/overview/VisaoGeral';
import { LinhaDoTempo } from '@generated/components/painel/timeline/LinhaDoTempo';
import { ProjectDrawer } from '@generated/components/painel/drawer/ProjectDrawer';
import { aplicarEdicoes, buildRow, perspAtual, type Decisao } from '@generated/lib/painel';
import { codigoProjeto, ehPausado, sempreNoUniverso } from '@generated/lib/equipe';
import { FILTROS_INICIAIS, VENCIDOS, aplicarFiltros, opcoes, ordenar, type Filtros, type Sort, type SortKey } from '@generated/lib/filtros';
import { exportarCsv } from '@generated/lib/csv';
import { FatoresDialog } from '@generated/components/painel/FatoresDialog';

type Aba = 'visao' | 'projetos' | 'linha';
const ABAS: { id: Aba; label: string }[] = [
  { id: 'visao', label: 'Visão geral' },
  { id: 'projetos', label: 'Projetos' },
  { id: 'linha', label: 'Linha do tempo' },
];

export default function App() {
  const data = usePainelData();
  const salvarExtras = useSalvarExtras(data);
  const { aba = 'visao' } = useSearch({ from: '/_app/' });
  const navigate = useNavigate({ from: '/' });
  const setAba = (v: Aba) => void navigate({ search: (prev) => ({ ...prev, aba: v }) });
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIAIS);
  const [sort, setSort] = useState<Sort>({ key: 'termino', dir: 'asc' });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.lang = 'pt-BR';
  }, []);

  const decisaoPorProjeto = useMemo(() => {
    const m = new Map<string, Decisao>();
    for (const d of data.decisoes) {
      if (!d.projetoId) continue;
      const cur = m.get(d.projetoId);
      if (!cur || (d.updatedAt ?? '') > (cur.updatedAt ?? '')) m.set(d.projetoId, d);
    }
    return m;
  }, [data.decisoes]);

  const allRows = useMemo(
    () => data.projetos.map((p) => {
      const cod = codigoProjeto(p.codigo, p.name);
      const aloc = data.alocacao === undefined ? undefined : (cod ? data.alocacao[cod] : undefined) ?? null;
      const ult = perspAtual(decisaoPorProjeto.get(p.id), data.perspectivas[p.id]?.[0]);
      return buildRow(p, decisaoPorProjeto.get(p.id), aplicarEdicoes(data.produtos[p.id], data.edicoes), aloc, data.ajustes[p.id], data.fatores, {
        persp: { nivel: ult?.nivel ?? null, temperatura: ult?.temperatura ?? null },
        rasc: data.rascunhos[p.id],
      });
    }),
    [data.projetos, data.produtos, data.edicoes, data.alocacao, data.ajustes, data.fatores, data.perspectivas, data.rascunhos, decisaoPorProjeto],
  );
  // Universo: equipe alocada, sem pausados; restrito aos projetos presentes em Equipes Revisadas quando houver vínculo.
  const universo = useMemo(() => {
    const base = allRows.filter((r) => r.projeto.alocacao === 'Equipe alocada' && !ehPausado(r.projeto.status));
    const cods = data.alocacao ? Object.keys(data.alocacao) : [];
    if (!cods.length) return base;
    return base.filter((r) => !!r.equipe || sempreNoUniverso(codigoProjeto(r.projeto.codigo, r.projeto.name)));
  }, [allRows, data.alocacao]);
  const opts = useMemo(() => opcoes(universo), [universo]);
  // Com "Vencidos" ativo: do mais atrasado ao menos atrasado.
  const soVencidos = filtros.termino.includes(VENCIDOS);
  const filtradas = useMemo(
    () => ordenar(aplicarFiltros(universo, filtros), soVencidos ? { key: 'termino', dir: 'asc' } : sort),
    [universo, filtros, sort, soVencidos],
  );
  const selected = allRows.find((r) => r.projeto.id === selectedId) ?? null;
  const carregandoProdutos = data.produtosPendentes > 0;

  const onSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  const vazio = !data.loading && (universo.length === 0 || filtradas.length === 0);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-screen bg-background text-foreground">
        <main className="mx-auto flex max-w-[1600px] flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <PageHeader
            savedAt={data.savedAt}
            refreshing={data.refreshing}
            produtosPendentes={data.produtosPendentes}
            onRefresh={() => void data.refresh()}
            onExport={() => exportarCsv(filtradas)}
            exportDisabled={data.loading || filtradas.length === 0}
            total={filtradas.length}
            fatores={<FatoresDialog data={data} />}
          />

          {data.error ? (
            <div role="alert" className="soft-stack flex flex-col items-start gap-3 rounded-xl bg-card p-6 sm:flex-row sm:items-center">
              <AlertTriangle className="size-5 shrink-0 text-destructive" aria-hidden />
              <p className="flex-1 text-sm text-foreground">{data.error}</p>
              <button type="button" onClick={() => void data.refresh()} className="min-h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                Tentar novamente
              </button>
            </div>
          ) : (
            <>
              {data.alocErro && (
                <div role="status" className="flex flex-wrap items-center gap-3 rounded-lg bg-[hsl(var(--warning-soft))] px-4 py-2.5 text-sm text-[hsl(var(--warning-ink))]">
                  <AlertTriangle className="size-4 shrink-0" aria-hidden />
                  Equipes Revisadas indisponível — equipe e custo podem estar desatualizados.
                  <button type="button" onClick={data.retryAlocacao} className="min-h-9 font-medium underline underline-offset-2">Tentar de novo</button>
                </div>
              )}
              <FiltersBar filtros={filtros} setFiltros={setFiltros} opts={opts} />
              {data.produtosErro && !carregandoProdutos && (
                <div role="status" className="flex flex-wrap items-center gap-3 rounded-lg bg-[hsl(var(--warning-soft))] px-4 py-2.5 text-sm text-[hsl(var(--warning-ink))]">
                  Alguns produtos não puderam ser carregados; as contagens podem estar incompletas.
                  <button type="button" onClick={data.retryProdutos} className="min-h-9 font-medium underline underline-offset-2">Carregar novamente</button>
                </div>
              )}

              <Tabs value={aba} onValueChange={(v) => setAba(v as Aba)} className="gap-5">
                <TabsList variant="line" className="h-auto w-full justify-start gap-6 overflow-x-auto rounded-none border-b border-border p-0">
                  {ABAS.map((t) => (
                    <TabsTrigger
                      key={t.id}
                      value={t.id}
                      className="h-10 flex-none rounded-none px-0.5 font-normal text-muted-foreground after:bg-primary group-data-[orientation=horizontal]/tabs:after:bottom-[-1px] group-data-[orientation=horizontal]/tabs:after:h-0.5 data-[state=active]:font-semibold data-[state=active]:text-foreground"
                    >
                      {t.label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {vazio ? (
                  universo.length === 0 ? (
                    <EmptyState title="Nenhum projeto com equipe alocada" text={'Projetos aparecem aqui quando a coluna "Alocação de Equipe" do Histórico de Projetos está como "Equipe alocada".'} />
                  ) : (
                    <EmptyState title="Nenhum projeto corresponde aos filtros" text="Ajuste a busca ou use “Limpar filtros” para ver todos os projetos." />
                  )
                ) : (
                  <>
                    <TabsContent value="visao">
                      <VisaoGeral rows={filtradas} loading={data.loading} onOpen={setSelectedId} onSalvar={salvarExtras} />
                    </TabsContent>
                    <TabsContent value="projetos">
                      {data.loading ? (
                        <div className="soft-stack rounded-xl bg-card p-5" aria-busy="true" aria-label="Carregando projetos">
                          {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="mb-3 h-10 w-full" />)}
                        </div>
                      ) : (
                        <ProjectsTable rows={filtradas} sort={sort} onSort={onSort} onOpen={setSelectedId} carregando={carregandoProdutos} dimmed={data.refreshing} statusOpcoes={data.statusOpcoes} setStatusOpcoes={data.setStatusOpcoes} onSalvar={salvarExtras} />
                      )}
                    </TabsContent>
                    <TabsContent value="linha">
                      <LinhaDoTempo rows={filtradas} loading={data.loading} onOpen={setSelectedId} />
                    </TabsContent>
                  </>
                )}
              </Tabs>
            </>
          )}
        </main>
        <ProjectDrawer row={selected} onClose={() => setSelectedId(null)} data={data} />
        <Toaster position="bottom-right" richColors closeButton />
      </div>
    </TooltipProvider>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="soft-stack flex flex-col items-center gap-3 rounded-xl bg-card px-6 py-14 text-center">
      <FolderSearch className="size-8 text-muted-foreground" aria-hidden />
      <h2 className="text-lg font-medium text-foreground">{title}</h2>
      <p className="max-w-md text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
