import { useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { RefreshCw, Search } from 'lucide-react';
import { useOpsDataset } from '@generated/hooks/useOpsDataset';
import { EMPTY_GLOBAL, scopeOps, type GlobalFilter } from '@generated/lib/ops';
import { GlobalFilters, ctl, fieldLbl } from '@generated/components/ops/GlobalFilters';
import { ProductData, RiskData, ScheduleData } from '@generated/components/ops/DataTabs';
import { ErrorBox, NoProjects, PageSkeleton } from '@generated/components/States';
import { fmtDateTime } from '@generated/lib/format';
import { cn } from '@lib/utils';

const TABS = [{ id: 'cronograma', label: 'Cronograma' }, { id: 'produtos', label: 'Produtos' }, { id: 'riscos', label: 'Riscos' }] as const;
type Tab = (typeof TABS)[number]['id'];

export const Route = createFileRoute('/_app/dados')({
  validateSearch: (s: Record<string, unknown>): { aba?: Tab } => ({ aba: TABS.find((t) => t.id === s.aba)?.id }),
  component: DataPage,
});

function DataPage() {
  const { aba = 'cronograma' } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { model, loading, refetching, error, reload } = useOpsDataset();
  const [f, setF] = useState<GlobalFilter>(EMPTY_GLOBAL);
  const [q, setQ] = useState('');
  const scope = useMemo(() => (model ? scopeOps(model, f) : null), [model, f]);

  if (loading) return <PageSkeleton />;
  if (error && !model) return <ErrorBox message={error} onRetry={reload} />;
  if (!model || !scope) return null;
  if (model.ds.projects.length === 0) return <NoProjects />;
  const counts: Record<Tab, number> = { cronograma: scope.schedule.length, produtos: scope.products.length, riscos: scope.risks.length };
  const failed = model.ds.projects.filter((p) => p.syncStatus === 'error');

  return (
    <div className={cn('space-y-5 transition-opacity', refetching && 'opacity-60')}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Dados tabulados</h1>
          <p className="mt-1 text-sm text-muted-foreground">Cronograma, produtos e riscos importados dos quadros · carregado em <span className="font-mono">{fmtDateTime(model.ds.loadedAt)}</span></p>
        </div>
        <button onClick={reload} aria-label="Recarregar dados salvos" className="flex min-h-10 min-w-10 items-center justify-center self-start rounded-md border border-border bg-card sm:self-auto"><RefreshCw className={cn('size-4', refetching && 'animate-spin')} aria-hidden /></button>
      </div>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {failed.length > 0 && <ErrorBox message={`Última tentativa falhou em ${failed.length} projeto(s) — exibindo a versão anterior: ${failed.map((p) => p.name).join('; ')}.`} />}
      <GlobalFilters projects={model.ds.projects} f={f} setF={setF} periodLabel="Período (data de referência)" dirty={!!q} onClear={() => setQ('')}>
        <label className="flex min-w-0 flex-col gap-1 sm:col-span-2">
          <span className={fieldLbl}>Busca</span>
          <span className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome, responsável, status…" className={`${ctl} w-full pl-9`} />
          </span>
        </label>
      </GlobalFilters>
      <div role="tablist" aria-label="Grupo" className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={aba === t.id} onClick={() => void navigate({ search: { aba: t.id } })}
            className={cn('-mb-px flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm', aba === t.id ? 'border-primary font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            {t.label}<span className="rounded-sm bg-muted px-1.5 font-mono text-[11px]">{counts[t.id]}</span>
          </button>
        ))}
      </div>
      {aba === 'cronograma' && <ScheduleData m={model} s={scope} q={q} />}
      {aba === 'produtos' && <ProductData m={model} s={scope} q={q} />}
      {aba === 'riscos' && <RiskData m={model} s={scope} q={q} />}
    </div>
  );
}
