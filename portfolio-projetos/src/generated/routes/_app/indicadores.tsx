import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { EMPTY_META, metaActive, metaOk, type MetaFilter } from '@generated/lib/history';
import { MetaFilters } from '@generated/components/MetaFilters';
import { createFileRoute } from '@tanstack/react-router';
import { ChevronRight, Minus, Search, TrendingDown, TrendingUp } from 'lucide-react';
import { useDataset } from '@generated/hooks/useDataset';
import { isDiscarded, k } from '@generated/lib/metrics';
import { averageResult, fmtAvg, trendOf, type Trend } from '@generated/lib/trend';
import type { MeasurementDoc } from '@generated/models';
import { fmtDateTime, typeKind } from '@generated/lib/format';
import { norm } from '@generated/lib/fields';
import type { IndicatorDoc } from '@generated/models';
import { IndicatorSheet } from '@generated/components/IndicatorSheet';
import { MeasurementTable } from '@generated/components/MeasurementTable';
import { TypeBadge, Truncate, Val } from '@generated/components/ui-bits';
import { ErrorBox, NoProjects, PageSkeleton } from '@generated/components/States';
import { cn } from '@lib/utils';

export const Route = createFileRoute('/_app/indicadores')({ component: IndicatorsPage });

function TrendTag({ trend, polaridade }: { trend: Trend | null; polaridade: string | null }) {
  if (!trend) return <span className="text-xs text-muted-foreground" title="Requer 2 ou mais medições concluídas com Valor Apurado numérico e prazo">—</span>;
  const p = norm(polaridade ?? '');
  const good = p.includes('menos') ? 'down' : p.includes('mais') ? 'up' : null;
  const tone = trend.dir === 'stable' || !good ? 'text-muted-foreground bg-muted' : trend.dir === good ? 'text-[hsl(var(--ok))] bg-[hsl(var(--ok)/0.12)]' : 'text-destructive bg-destructive/10';
  const Icon = trend.dir === 'up' ? TrendingUp : trend.dir === 'down' ? TrendingDown : Minus;
  const label = trend.dir === 'up' ? 'Crescimento' : trend.dir === 'down' ? 'Queda' : 'Estabilidade';
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium', tone)}
      title={`Valor Apurado em ${trend.n} medições concluídas · de ${fmtAvg(trend.first, false)} para ${fmtAvg(trend.last, false)}`}>
      <Icon className="size-3.5" aria-hidden /> {label}
    </span>
  );
}

function IndicatorsPage() {
  const { model, loading, error, reload } = useDataset();
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [sel, setSel] = useState<IndicatorDoc | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const collapsed = { has: (id: string) => !expanded.has(id) };
  useEffect(() => { const t = setTimeout(() => setTerm(norm(q)), 250); return () => clearTimeout(t); }, [q]);

  const [proj, setProj] = useState('');
  const [meta, setMeta] = useState<MetaFilter>(EMPTY_META);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const periodOn = !!(from || to);
  const inPeriod = useCallback((m: MeasurementDoc) => {
    if (!periodOn) return true;
    const d = m.prazo?.slice(0, 10);
    if (!d) return false;
    return (!from || d >= from) && (!to || d <= to);
  }, [periodOn, from, to]);
  const medsOf = useCallback((i: IndicatorDoc) => (model?.medsOfInd.get(k(i.projectBoardId, i.itemId)) ?? []).filter(inPeriod), [model, inPeriod]);

  const groups = useMemo(() => {
    if (!model) return [];
    return model.ds.projects.filter((p) => (!proj || p.boardId === proj) && metaOk(p, meta)).map((p) => {
      const pHit = !term || norm(p.name).includes(term);
      const inds = model.ds.indicators.filter((i) => i.projectBoardId === p.boardId).filter((i) => {
        const meds = medsOf(i);
        if (periodOn && meds.length === 0) return false;
        if (pHit || norm(i.name).includes(term)) return true;
        return meds.some((m) => norm(m.name).includes(term));
      });
      // KRs primeiro, depois KPIs, depois os demais; mantém a ordem original dentro de cada tipo.
      const rank = (t: string | null) => { const k = typeKind(t); return k === 'KR' ? 0 : k === 'KPI' ? 1 : 2; };
      inds.sort((a, b) => rank(a.tipo) - rank(b.tipo));
      return { p, inds };
    }).filter((g) => g.inds.length > 0 || (!term && !periodOn));
  }, [model, term, proj, periodOn, medsOf, meta]);

  if (loading) return <PageSkeleton />;
  if (error && !model) return <ErrorBox message={error} onRetry={reload} />;
  if (!model) return null;
  if (model.ds.projects.length === 0) return <NoProjects />;
  const toggleProj = (id: string) => setExpanded((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allCollapsed = groups.length > 0 && groups.every((g) => collapsed.has(g.p.boardId));
  const toggle = (key: string) => setOpen((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Indicadores e medições</h1>
          <p className="mt-1 text-sm text-muted-foreground">Projeto → Indicador → Medições. Clique no nome do indicador para ver o cadastro completo.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        <button
          onClick={() => setExpanded(allCollapsed ? new Set(groups.map((g) => g.p.boardId)) : new Set())}
          className="min-h-10 shrink-0 rounded-md border border-border bg-card px-3 text-sm"
        >
          {allCollapsed ? 'Expandir todos os projetos' : 'Recolher todos os projetos'}
        </button>
        <label className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar projeto, indicador ou medição" className="h-10 w-full rounded-md border border-input bg-card pl-9 pr-3 text-sm" />
        </label>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-3">
        <label className="flex min-w-0 flex-1 flex-col gap-1 sm:max-w-sm">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Projeto</span>
          <select value={proj} onChange={(e) => setProj(e.target.value)} className="h-10 min-w-0 rounded-md border border-input bg-background px-2 text-sm">
            <option value="">Todos os projetos</option>
            {model.ds.projects.map((p) => <option key={p.boardId} value={p.boardId}>{p.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Prazo de medição — de</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 rounded-md border border-input bg-background px-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">até</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10 rounded-md border border-input bg-background px-2 text-sm" />
        </label>
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3 lg:w-auto lg:grid-cols-[repeat(3,minmax(0,14rem))]">
          <MetaFilters projects={model.ds.projects} value={meta} onChange={setMeta} />
        </div>
        {(proj || periodOn || metaActive(meta)) && (
          <button onClick={() => { setProj(''); setFrom(''); setTo(''); setMeta(EMPTY_META); }} className="h-10 rounded-md px-3 text-sm text-primary hover:bg-muted">Limpar filtros</button>
        )}
        {periodOn && <p className="w-full text-xs text-muted-foreground">Com período ativo, aparecem só indicadores com medições no intervalo; média e tendência consideram apenas essas medições.</p>}
      </div>
      {groups.length === 0 && <p className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">Nenhum resultado para a busca.</p>}
      {groups.map(({ p, inds }) => (
        <section key={p.boardId} className="min-w-0 overflow-hidden rounded-lg border border-border bg-card">
          <button
            onClick={() => toggleProj(p.boardId)}
            aria-expanded={!collapsed.has(p.boardId)}
            className={cn('flex w-full flex-wrap items-center justify-between gap-2 bg-muted/50 px-4 py-3 text-left hover:bg-muted', !collapsed.has(p.boardId) && 'border-b border-border')}
          >
            <span className="flex min-w-0 items-center gap-2">
              <ChevronRight className={cn('size-4 shrink-0 transition-transform', !collapsed.has(p.boardId) && 'rotate-90')} aria-hidden />
              <h2 className="text-base font-semibold">{p.name}</h2>
            </span>
            <span className="text-xs text-muted-foreground">{inds.length} indicador(es) · atualizado {fmtDateTime(p.lastSuccessAt)}</span>
          </button>
          {!collapsed.has(p.boardId) && <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="w-8" />
                  {['Indicador', 'Tipo', 'Objetivo', 'Temporalidade', 'Meta geral', 'Unidade', 'Polaridade', 'Qtd. origem', 'Vinculadas', 'Resultado Consolidado (média)', 'Tendência', 'Atualização'].map((h) => <th key={h} className="px-2 py-2 font-medium">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {inds.length === 0 && <tr><td colSpan={13} className="p-4 text-center text-muted-foreground">Sem indicadores neste projeto.</td></tr>}
                {inds.map((i) => {
                  const key = k(i.projectBoardId, i.itemId);
                  const meds = medsOf(i);
                  const valid = meds.filter((m) => !isDiscarded(m.statusMedicao));
                  const avg = averageResult(valid);
                  const trend = trendOf(valid.filter((m) => model.isConcluded(m)));
                  const isOpen = open.has(key);
                  const mismatch = i.qtdMedicoes != null && Number(i.qtdMedicoes) !== meds.length;
                  return (
                    <Fragment key={key}>
                      <tr className="border-b border-border/60 align-top hover:bg-muted/30">
                        <td className="px-1 py-1.5">
                          <button aria-label={isOpen ? 'Recolher medições' : 'Expandir medições'} onClick={() => toggle(key)} className="flex size-9 items-center justify-center rounded hover:bg-muted">
                            <ChevronRight className={cn('size-4 transition-transform', isOpen && 'rotate-90')} aria-hidden />
                          </button>
                        </td>
                        <td className="max-w-64 px-2 py-2.5"><button onClick={() => setSel(i)} className="block max-w-full text-left font-medium text-primary hover:underline"><Truncate text={i.name} /></button></td>
                        <td className="px-2 py-2.5"><TypeBadge tipo={i.tipo} /></td>
                        <td className="max-w-40 px-2 py-2.5"><Truncate text={i.objetivo} /></td>
                        <td className="px-2 py-2.5"><Val rec={i} field="temporalidade" v={i.temporalidade} /></td>
                        <td className="px-2 py-2.5"><Val rec={i} field="meta" v={i.meta} mono /></td>
                        <td className="px-2 py-2.5"><Val rec={i} field="unidade" v={i.unidade} /></td>
                        <td className="max-w-32 px-2 py-2.5"><Truncate text={i.polaridade} /></td>
                        <td className="px-2 py-2.5 text-right"><Val rec={i} field="qtdMedicoes" v={i.qtdMedicoes} mono /></td>
                        <td className={cn('px-2 py-2.5 text-right font-mono tabular-nums', mismatch && 'text-[hsl(var(--warn))]')} title={mismatch ? 'Difere da quantidade informada na origem' : undefined}>{meds.length}</td>
                        <td className="px-2 py-2.5" title={`Média de ${avg?.n ?? 0} medição(ões) com Resultado numérico. Valor na origem: ${i.resultadoConsolidado ?? '—'}`}>
                          {avg ? <span className="font-mono tabular-nums">{fmtAvg(avg.avg, avg.pct)}</span> : <span className="text-xs text-muted-foreground">Sem resultados</span>}
                          {avg && <span className="block text-[11px] text-muted-foreground">média de {avg.n}</span>}
                        </td>
                        <td className="px-2 py-2.5"><TrendTag trend={trend} polaridade={i.polaridade} /></td>
                        <td className="whitespace-nowrap px-2 py-2.5 font-mono text-xs text-muted-foreground">{fmtDateTime(i.syncedAt)}</td>
                      </tr>
                      {isOpen && (
                        <tr className="border-b border-border bg-muted/20">
                          <td />
                          <td colSpan={12} className="px-2 py-3">
                            <p className="mb-2 text-xs text-muted-foreground">
                              Tipo, polaridade, unidade e descrição vêm do cadastro deste indicador: {i.tipo ?? '—'} · {i.polaridade ?? '—'} · {i.unidade ?? '—'}
                            </p>
                            <MeasurementTable model={model} rows={[...meds].sort((a, b) => {
                              if (!a.prazo) return b.prazo ? 1 : 0;
                              if (!b.prazo) return -1;
                              return b.prazo.localeCompare(a.prazo);
                            })} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>}
        </section>
      ))}
      <IndicatorSheet model={model} ind={sel} onClose={() => setSel(null)} onOpen={setSel} />
    </div>
  );
}
