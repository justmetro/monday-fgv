import { useMemo, useState } from 'react';
import { EMPTY_META, metaActive, metaAllowedIds, type MetaFilter } from '@generated/lib/history';
import { MetaFilters } from '@generated/components/MetaFilters';
import { createFileRoute } from '@tanstack/react-router';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useDataset } from '@generated/hooks/useDataset';
import { NoProjects, ErrorBox, PageSkeleton } from '@generated/components/States';
import { DrillSheet, type Drill } from '@generated/components/dashboard/DrillSheet';
import { IndicatorSheet } from '@generated/components/IndicatorSheet';
import { buildPanorama, LEVELS, type Level } from '@generated/lib/panorama';
import { fmtDate, fmtPct } from '@generated/lib/format';
import type { IndicatorDoc, MeasurementDoc } from '@generated/models';
import { cn } from '@lib/utils';

export const Route = createFileRoute('/_app/panorama')({ component: Panorama });

function LevelTag({ level }: { level: Level | null }) {
  if (!level) return <span className="rounded px-2 py-0.5 text-xs text-muted-foreground ring-1 ring-border">Sem avaliação</span>;
  return <span className={cn('whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium', level.cls)}>{level.label}</span>;
}

function Panorama() {
  const { model, loading, refetching, error, reload } = useDataset();
  const [kind, setKind] = useState<'KR' | 'KPI'>('KR');
  const [limit, setLimit] = useState(() => new Date().toISOString().slice(0, 10));
  const [level, setLevel] = useState<string>('');
  const [drill, setDrill] = useState<Drill>(null);
  const [ind, setInd] = useState<IndicatorDoc | null>(null);

  const [start, setStart] = useState('');
  const [meta, setMeta] = useState<MetaFilter>(EMPTY_META);
  const rows = useMemo(() => (model && limit ? buildPanorama(model, kind, limit, metaAllowedIds(model.ds.projects, meta), start) : []), [model, kind, limit, start, meta]);
  const rangeTxt = start ? `de ${fmtDate(start)} até ${fmtDate(limit)}` : `até ${fmtDate(limit)}`;
  const shown = level ? rows.filter((r) => (r.level?.key ?? 'sem') === level) : rows;

  if (loading) return <PageSkeleton />;
  if (error && !model) return <ErrorBox message={error} onRetry={reload} />;
  if (!model) return null;
  if (model.ds.projects.length === 0) return <NoProjects />;

  const open = (title: string, meds: MeasurementDoc[]) => setDrill({ title, meds });
  const counts = [...LEVELS.map((l) => ({ key: l.key as string, label: l.label, rule: l.rule, n: rows.filter((r) => r.level?.key === l.key).length, cls: l.cls })),
    { key: 'sem', label: 'Sem avaliação', rule: 'nenhuma meta avaliada', n: rows.filter((r) => !r.level).length, cls: 'text-muted-foreground' }];

  return (
    <div className={cn('space-y-5', refetching && 'opacity-70')}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Panorama dos projetos</h1>
          <p className="mt-1 text-sm text-muted-foreground">Medições de {kind} com Prazo de Medição {rangeTxt}. Despriorizadas e canceladas são desconsideradas.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex rounded-md border border-border bg-card p-0.5" role="group" aria-label="Tipo de indicador">
            {(['KR', 'KPI'] as const).map((k) => (
              <button key={k} onClick={() => setKind(k)} aria-pressed={kind === k}
                className={cn('h-9 min-w-16 rounded px-4 text-sm font-medium transition-colors', kind === k ? (k === 'KR' ? 'bg-[hsl(var(--kr))] text-primary-foreground' : 'bg-[hsl(var(--kpi))] text-primary-foreground') : 'text-muted-foreground hover:bg-muted')}>
                {k}
              </button>
            ))}
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Prazo de medição — início</span>
            <span className="flex items-center gap-1">
              <input type="date" value={start} max={limit || undefined} onChange={(e) => setStart(e.target.value)} className="h-10 rounded-md border border-input bg-card px-2 text-sm" />
              {start && <button onClick={() => setStart('')} aria-label="Limpar data de início" className="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted">×</button>}
            </span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Prazo de medição — fim</span>
            <input type="date" value={limit} min={start || undefined} onChange={(e) => setLimit(e.target.value)} className="h-10 rounded-md border border-input bg-card px-2 text-sm" />
          </label>
          {refetching && <Loader2 className="mb-3 size-4 animate-spin text-muted-foreground" />}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-card p-3 sm:grid-cols-3 lg:grid-cols-[repeat(3,minmax(0,16rem))_auto]">
        <MetaFilters projects={model.ds.projects} value={meta} onChange={setMeta} />
        {metaActive(meta) && <button onClick={() => setMeta(EMPTY_META)} className="h-10 self-end rounded-md px-3 text-sm text-primary hover:bg-muted">Limpar</button>}
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3 lg:grid-cols-6">
        {counts.map((c) => (
          <button key={c.key} onClick={() => setLevel(level === c.key ? '' : c.key)} aria-pressed={level === c.key}
            className={cn('min-w-0 bg-card p-4 text-left transition-colors hover:bg-muted/60', level === c.key && 'bg-muted ring-2 ring-inset ring-primary')}>
            <span className={cn('inline-block rounded px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide', c.cls)}>{c.label}</span>
            <span className="mt-2 block font-mono text-4xl font-light tabular-nums">{c.n}</span>
            <span className="mt-1 block text-[11px] text-muted-foreground">{c.rule}</span>
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">{shown.length} projeto(s) com {kind} previsto {rangeTxt}</h2>
          {level && <button onClick={() => setLevel('')} className="text-xs text-primary hover:underline">Limpar filtro de nível</button>}
        </div>
        {shown.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">Nenhum projeto com medições de {kind} previstas até esta data.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Projeto</th>
                  <th className="px-3 py-2 text-right font-medium">{kind}s previstos</th>
                  <th className="px-3 py-2 text-right font-medium">Realizados</th>
                  <th className="px-3 py-2 text-right font-medium">Atrasados</th>
                  <th className="px-3 py-2 text-right font-medium">% metas atingidas</th>
                  <th className="px-3 py-2 font-medium">Situação</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const nm = r.project.name;
                  const num = (n: MeasurementDoc[], t: string, extra?: string) => (
                    <button onClick={() => open(`${t} · ${nm}`, n)} className={cn('font-mono tabular-nums hover:underline', extra)}>{n.length}</button>
                  );
                  return (
                    <tr key={r.project.boardId} className="border-b border-border/60 last:border-0 hover:bg-muted/40">
                      <td className="max-w-sm px-4 py-2.5 font-medium"><span className="line-clamp-2" title={nm}>{nm}</span></td>
                      <td className="px-3 py-2.5 text-right">{num(r.previstas, `${kind}s previstos`)}</td>
                      <td className="px-3 py-2.5 text-right">{num(r.realizadas, `${kind}s realizados`)}</td>
                      <td className="px-3 py-2.5 text-right">{num(r.atrasadas, `${kind}s atrasados`, r.atrasadas.length ? 'text-destructive' : '')}</td>
                      <td className="px-3 py-2.5 text-right">
                        {r.pct === null ? <span className="text-xs text-muted-foreground">Sem avaliações</span> : (
                          <button onClick={() => open(`Metas avaliadas · ${nm}`, r.avaliadas)} className="font-mono tabular-nums hover:underline" title={`${r.atingidas.length} de ${r.avaliadas.length} avaliadas`}>
                            {fmtPct(r.pct)} <span className="text-xs text-muted-foreground">({r.atingidas.length}/{r.avaliadas.length})</span>
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-1.5">
                          <LevelTag level={r.level} />
                          {r.atrasadas.length > 0 && (
                            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded bg-destructive/12 px-2 py-0.5 text-xs font-medium text-destructive">
                              <AlertTriangle className="size-3" /> {kind} atrasado
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">% metas atingidas = medições realizadas com meta alcançada ÷ medições realizadas com Status da Meta avaliável. Atrasado = prazo anterior a hoje e não concluída.</p>

      <DrillSheet model={model} drill={drill} onClose={() => setDrill(null)} onIndicator={(i) => { setDrill(null); setInd(i); }} />
      <IndicatorSheet model={model} ind={ind} onClose={() => setInd(null)} onOpen={setInd} />
    </div>
  );
}
