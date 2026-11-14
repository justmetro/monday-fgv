import { useMemo, useState, type ReactNode } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { RefreshCw } from 'lucide-react';
import { useDataset } from '@generated/hooks/useDataset';
import { useOpsDataset } from '@generated/hooks/useOpsDataset';
import { EMPTY_GLOBAL, projectFilter, scopeOps, type GlobalFilter } from '@generated/lib/ops';
import { overviewRows } from '@generated/lib/overview';
import { fmtDate, fmtDateTime } from '@generated/lib/format';
import { GlobalFilters } from '@generated/components/ops/GlobalFilters';
import { IndicatorsTab } from '@generated/components/panel/IndicatorsTab';
import { OverviewTab } from '@generated/components/panel/OverviewTab';
import { ScheduleTab } from '@generated/components/panel/ScheduleTab';
import { AllocationTab } from '@generated/components/panel/AllocationTab';
import { ProductsTab } from '@generated/components/panel/ProductsTab';
import { RisksTab } from '@generated/components/panel/RisksTab';
import { ChecklistTab } from '@generated/components/panel/ChecklistTab';
import { OpsDrillSheet, type OpsDrill } from '@generated/components/panel/OpsDrillSheet';
import { ErrorBox, NoProjects, PageSkeleton } from '@generated/components/States';
import { Skeleton } from '@components/ui/skeleton';
import { cn } from '@lib/utils';

const TABS = [
  { id: 'geral', label: 'Visão geral' }, { id: 'indicadores', label: 'Indicadores' }, { id: 'cronograma', label: 'Cronograma' },
  { id: 'produtos', label: 'Produtos' }, { id: 'riscos', label: 'Riscos' }, { id: 'alocacao', label: 'Alocação' }, { id: 'checklist', label: 'Checklist' },
] as const;
type Tab = (typeof TABS)[number]['id'];

export const Route = createFileRoute('/_app/')({
  validateSearch: (s: Record<string, unknown>): { aba?: Tab } => ({ aba: TABS.find((t) => t.id === s.aba)?.id }),
  component: Dashboard,
});

function Dashboard() {
  const { aba = 'geral' } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { model, loading, refetching, error, reload } = useDataset();
  // Grupos novos só são carregados quando uma aba que os usa é aberta.
  const ops = useOpsDataset(aba !== 'indicadores');
  const [g, setG] = useState<GlobalFilter>(EMPTY_GLOBAL);
  const [drill, setDrill] = useState<OpsDrill>(null);
  const scope = useMemo(() => (ops.model ? scopeOps(ops.model, g) : null), [ops.model, g]);
  const rows = useMemo(() => {
    if (!model) return [];
    const ok = projectFilter(model.ds.projects, g);
    return overviewRows(model.ds.projects.filter((p) => ok(p.boardId)), model, ops.model, scope, g);
  }, [model, ops.model, scope, g]);
  const allow = useMemo(() => (model ? projectFilter(model.ds.projects, g) : () => false), [model, g]);

  if (loading) return <PageSkeleton />;
  if (error && !model) return <ErrorBox message={error} onRetry={reload} />;
  if (!model) return null;
  if (model.ds.projects.length === 0) return <NoProjects />;

  const times = model.ds.projects.map((p) => p.lastSuccessAt).filter((x): x is string => !!x).sort();
  const oldest = times[0];
  const newest = times[times.length - 1];
  const reloadAll = () => { reload(); if (ops.model || ops.error) void ops.reload(); };
  const opsBody = (fn: () => ReactNode) => (ops.loading || (!ops.model && !ops.error) ? <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-64" /></div> : ops.error && !ops.model ? <ErrorBox message={ops.error} onRetry={() => void ops.reload()} /> : fn());

  return (
    <div className={cn('space-y-5 transition-opacity', (refetching || ops.refetching) && 'opacity-60')}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Painel de Projetos DGPE</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Data de referência <span className="font-mono">{fmtDate(model.today)}</span> · dados atualizados{' '}
            {oldest === newest ? <span className="font-mono">{fmtDateTime(newest)}</span> : <>entre <span className="font-mono">{fmtDateTime(oldest)}</span> e <span className="font-mono">{fmtDateTime(newest)}</span></>}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={reloadAll} aria-label="Recarregar dados salvos" className="flex min-h-10 min-w-10 items-center justify-center rounded-md border border-border bg-card">
            <RefreshCw className={cn('size-4', (refetching || ops.refetching) && 'animate-spin')} aria-hidden />
          </button>
        </div>
      </div>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {model.ds.projects.some((p) => p.syncStatus === 'error') && (
        <ErrorBox message="Um ou mais projetos tiveram falha na última atualização. Os dados exibidos são da última versão válida. Consulte a tela Importação e atualização." />
      )}
      {(() => {
        const ok = projectFilter(model.ds.projects, g);
        const list = model.ds.projects.filter((p) => ok(p.boardId));
        const n = (s: string | null | undefined) => (s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const act = list.filter((p) => /execu|planejamento|encerramento/.test(n(p.hStatus))).length;
        return (
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:max-w-md">
            <div className="bg-card p-4"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Projetos</p><p className="mt-1 font-mono text-3xl tabular-nums">{list.length}</p></div>
            <div className="bg-card p-4"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Projetos ativos</p><p className="mt-1 font-mono text-3xl tabular-nums text-[hsl(var(--ok))]">{act}</p><p className="text-[11px] text-muted-foreground">em execução, planejamento ou encerramento</p></div>
          </div>
        );
      })()}
      <GlobalFilters projects={model.ds.projects} f={g} setF={setG} hideWorkspace hidePeriod />
      <div role="tablist" aria-label="Áreas do painel" className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={aba === t.id} onClick={() => void navigate({ search: { aba: t.id } })}
            className={cn('-mb-px min-h-11 shrink-0 border-b-2 px-3 text-sm', aba === t.id ? 'border-primary font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            {t.label}
          </button>
        ))}
      </div>
      {aba === 'geral' && <OverviewTab rows={rows} onOpenArea={(id, tab) => { setG({ ...g, projects: [id] }); void navigate({ search: { aba: tab } }); }} />}
      {aba === 'indicadores' && <IndicatorsTab model={model} global={g} />}
      {aba === 'cronograma' && opsBody(() => (ops.model && scope ? <ScheduleTab m={ops.model} s={scope} onDrill={setDrill} /> : null))}
      {aba === 'produtos' && opsBody(() => (ops.model && scope ? <ProductsTab m={ops.model} s={scope} onDrill={setDrill} /> : null))}
      {aba === 'riscos' && opsBody(() => (ops.model && scope ? <RisksTab m={ops.model} s={scope} onDrill={setDrill} /> : null))}
      {aba === 'alocacao' && opsBody(() => (ops.model && scope ? <AllocationTab m={ops.model} s={scope} onDrill={setDrill} /> : null))}
      {aba === 'checklist' && opsBody(() => <ChecklistTab model={model} ops={ops.model} allow={allow} />)}
      {ops.model && <OpsDrillSheet m={ops.model} drill={drill} onClose={() => setDrill(null)} />}
    </div>
  );
}
