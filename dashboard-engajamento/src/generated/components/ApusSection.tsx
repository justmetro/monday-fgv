import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import type { ApusData, ApusRow } from '../../../server/apus';
import { CollapsibleCard } from './charts/CollapsibleCard';
import { ProjectBarChart, type ProjectBar } from './charts/ProjectBarChart';
import { WeeklyTrendChart, type TrendPoint } from './charts/WeeklyTrendChart';
import { MultiCheckSelect } from './MultiCheckSelect';

export const APUS_MIN = 1;
export const APUS_MAX = 2;

interface Props {
  data: ApusData | null;
  loading: boolean;
  error: string | null;
  onReload?: () => void; // só para quem gerencia: relê o quadro na hora
  filter?: (r: ApusRow) => boolean; // recorte (ex.: projetos do gerente)
  messagesByCode?: Map<string, number>; // mensagens da semana na Comunicação, por código do projeto
  showTable?: boolean;
  scopeText?: string; // ex.: "dos seus projetos"
  projectPicker?: boolean; // caixa de seleção de projetos
  showGeneral?: boolean; // gráfico "Comunicação geral semana a semana"
}

const num = (v: number, d = 0) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const brDate = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '—');

/** Uma linha por projeto com uma coluna por semana escolhida (w39, w38...), ordenada pela semana mais recente. */
function weekBars(rows: ApusRow[], weeks: number[], value: (r: ApusRow) => number | null, detail?: (r: ApusRow) => string) {
  const sorted = [...weeks].sort((a, b) => a - b);
  const latest = sorted[sorted.length - 1];
  const map = new Map<string, ProjectBar>();
  rows.filter((r) => weeks.includes(r.weekNumber)).forEach((r) => {
    const v = value(r);
    if (v === null) return;
    const b = map.get(r.team) ?? { label: r.team, full: r.project || r.team, value: 0 };
    b[`w${r.weekNumber}`] = v;
    if (r.weekNumber === latest) { b.value = v; b.detail = detail?.(r); }
    map.set(r.team, b);
  });
  const data = [...map.values()].sort((a, b) => Number(a[`w${latest}`] ?? -1) - Number(b[`w${latest}`] ?? -1));
  if (sorted.length === 1) data.forEach((d) => { d.value = Number(d[`w${latest}`] ?? 0); });
  return { data, series: sorted.length > 1 ? sorted.map((n) => ({ key: `w${n}`, name: `Semana ${n}` })) : undefined };
}

function useWeekPick(data: ApusData | null) {
  const [weeks, setWeeks] = useState<string[] | null>(null);
  useEffect(() => { if (weeks === null && data?.weeks[0]) setWeeks([String(data.weeks[0].weekNumber)]); }, [data, weeks]);
  const nums = (weeks ?? []).map(Number);
  const picker = (
    <MultiCheckSelect
      options={(data?.weeks ?? []).map((w) => ({ value: String(w.weekNumber), label: `Semana ${w.weekNumber}`, subtitle: w.weekLabel }))}
      selected={weeks ?? []}
      onChange={setWeeks}
      noun={['semana', 'semanas']}
      buttonClassName="h-8 min-w-[150px]"
    />
  );
  const text = nums.length === 0 ? 'nenhuma semana marcada' : nums.length === 1 ? data?.weeks.find((w) => w.weekNumber === nums[0])?.weekLabel ?? '' : `${nums.length} semanas`;
  return { nums, picker, text };
}

/** Gráficos de atualizações dos projetos, com os mesmos cálculos do quadro Relatórios dos projetos. */
export function ApusSection({ data, loading, error, onReload, filter, messagesByCode, showTable = true, scopeText = 'dos projetos', projectPicker = false, showGeneral = true }: Props) {
  const apusPick = useWeekPick(data);

  // Projetos do recorte e, com a caixa de projetos, os marcados nela
  const baseRows = useMemo(() => (data?.rows ?? []).filter((r) => !filter || filter(r)), [data, filter]);
  const projectOptions = useMemo(() => {
    const m = new Map<string, string>();
    baseRows.forEach((r) => m.set(r.team, r.project));
    return [...m].sort((a, b) => a[0].localeCompare(b[0])).map(([value, subtitle]) => ({ value, label: value, subtitle }));
  }, [baseRows]);
  const [projects, setProjects] = useState<string[] | null>(null);
  useEffect(() => { if (projects === null && projectOptions.length) setProjects(projectOptions.map((o) => o.value)); }, [projectOptions, projects]);
  const scoped = useMemo(() => {
    if (!projectPicker || projects === null) return baseRows;
    const set = new Set(projects);
    return baseRows.filter((r) => set.has(r.team));
  }, [baseRows, projectPicker, projects]);

  const tableWeek = apusPick.nums.length ? Math.max(...apusPick.nums) : null;
  const weekRows = useMemo(() => scoped.filter((r) => r.weekNumber === tableWeek), [scoped, tableWeek]);
  const tableLabel = data?.weeks.find((w) => w.weekNumber === tableWeek)?.weekLabel ?? '';

  // Soma das atualizações acumuladas de cada semana (igual ao gráfico "Comunicação Geral - Semana a semana")
  const general: TrendPoint[] = useMemo(() => {
    const byWeek = new Map<number, number>();
    scoped.forEach((r) => byWeek.set(r.weekNumber, (byWeek.get(r.weekNumber) ?? 0) + r.updates));
    const labels = new Map((data?.weeks ?? []).map((w) => [w.weekNumber, w.weekLabel]));
    const list = [...byWeek.entries()].sort((a, b) => a[0] - b[0]).slice(-12);
    return list.map(([n, total], i) => ({
      label: `Semana ${n}`, range: (labels.get(n) ?? '').replace(/^\d+\s*Sem\s*-?\s*/, ''),
      bar: total, line: i ? total - list[i - 1][1] : null,
    }));
  }, [scoped, data]);

  const apusChart = useMemo(() => weekBars(scoped, apusPick.nums, (r) => r.apus, (r) => `${num(r.updates)} atualizações · ${r.users} usuários · ${r.weeksOnPlatform ?? '—'} semanas`), [scoped, apusPick.nums]);
  // APUS semana a semana: média do APUS dos projetos marcados em cada semana
  const apusWeekly: ProjectBar[] = useMemo(() => {
    const by = new Map<number, number[]>();
    scoped.forEach((r) => { if (r.apus !== null) by.set(r.weekNumber, [...(by.get(r.weekNumber) ?? []), r.apus]); });
    const labels = new Map((data?.weeks ?? []).map((w) => [w.weekNumber, w.weekLabel]));
    return [...by.entries()].sort((a, b) => a[0] - b[0]).slice(-16).map(([n, v]) => ({
      label: `Semana ${n}`, full: labels.get(n) ?? `Semana ${n}`,
      value: Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 100) / 100,
      detail: `Média de ${v.length} ${v.length === 1 ? 'projeto' : 'projetos'}`,
    }));
  }, [scoped, data]);
  const belowMin = weekRows.filter((r) => r.apus !== null && r.apus < APUS_MIN).length;

  if (loading && !data) return <div className="h-48 rounded-xl bg-muted animate-pulse" />;
  if (error && !data) return <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">Não foi possível ler as atualizações dos projetos: {error}</p>;
  if (!data) return null;

  const toolbar = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {projectPicker && (
        <MultiCheckSelect options={projectOptions} selected={projects ?? []} onChange={setProjects} noun={['projeto', 'projetos']} searchable buttonClassName="h-8 min-w-[200px]" />
      )}
      <a href={`https://fgvdgpe-projetos.monday.com/boards/${data.boardId}`} target="_blank" rel="noreferrer"
        className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-[11px] text-muted-foreground hover:bg-muted">
        Quadro <ExternalLink className="h-3 w-3" />
      </a>
      {onReload && (
        <button type="button" onClick={onReload} disabled={loading} title="Ler o quadro de novo"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      )}
    </div>
  );

  const refLines = [
    { y: APUS_MAX, label: 'Máximo esperado', color: 'hsl(var(--foreground))' },
    { y: APUS_MIN, label: 'Mínimo esperado', color: 'hsl(var(--destructive))' },
  ];

  return (
    <div className="space-y-5">
      {toolbar}

      {scoped.length > 0 && scoped.every((r) => r.updates === 0) && (
        <p className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-foreground">
          {projects?.length === 1 ? projects[0] : 'Os projetos marcados'} não {projects?.length === 1 ? 'tem' : 'têm'} nenhuma atualização registrada no quadro Relatórios dos projetos em nenhuma semana{projects?.length === 1 ? ` (${scoped[0].users} usuários)` : ''}. Por isso os gráficos aparecem zerados.
        </p>
      )}

      <CollapsibleCard
        title="Nº de atualizações por usuário por semana (APUS)"
        subtitle={`${apusPick.text} · (atualizações ÷ usuários) ÷ semanas na plataforma · ${belowMin} de ${weekRows.length} projetos abaixo do mínimo em ${tableLabel}`}
        actions={apusPick.picker}
      >
        <ProjectBarChart data={apusChart.data} series={apusChart.series} decimals={2} refLines={refLines} />
      </CollapsibleCard>

      <CollapsibleCard title="APUS semana a semana" subtitle={`Média do APUS ${scopeText} em cada semana (últimas 16)`}>
        <ProjectBarChart data={apusWeekly} decimals={2} refLines={refLines} height={260} emptyText="Sem semanas com APUS." />
      </CollapsibleCard>

      {showTable && (
        <CollapsibleCard title="Comunicação por projeto" subtitle={`${tableLabel} (semana mais recente marcada no APUS) · APUS entre ${APUS_MIN} e ${APUS_MAX} é o esperado`}>
          {weekRows.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Nenhum projeto nesta semana.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[11px] text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-2 pr-3 font-medium">Projeto</th>
                    <th className="px-3 py-2 text-right font-medium">APUS</th>
                    {messagesByCode && <th className="px-3 py-2 text-right font-medium">Mensagens na semana</th>}
                    <th className="px-3 py-2 text-right font-medium">Total consolidado</th>
                    <th className="px-3 py-2 text-right font-medium">Usuários</th>
                    <th className="px-3 py-2 text-right font-medium">Início na plataforma</th>
                    <th className="py-2 pl-3 text-right font-medium">Semanas</th>
                  </tr>
                </thead>
                <tbody>
                  {[...weekRows].sort((a, b) => (a.apus ?? 0) - (b.apus ?? 0)).map((r) => {
                    const low = r.apus !== null && r.apus < APUS_MIN;
                    return (
                      <tr key={`${r.team}|${r.code}`} className="border-b border-border/60 last:border-0">
                        <td className="max-w-[360px] py-2 pr-3"><span className="block truncate text-foreground" title={r.project || r.team}>{r.team}</span></td>
                        <td className={`px-3 py-2 text-right font-medium tabular-nums ${low ? 'text-destructive' : 'text-foreground'}`}>{r.apus === null ? '—' : num(r.apus, 2)}</td>
                        {messagesByCode && <td className="px-3 py-2 text-right tabular-nums">{messagesByCode.has(r.code) ? num(messagesByCode.get(r.code)!) : '—'}</td>}
                        <td className="px-3 py-2 text-right tabular-nums">{num(r.updates)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.users}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{brDate(r.startDate)}</td>
                        <td className="py-2 pl-3 text-right tabular-nums">{r.weeksOnPlatform ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CollapsibleCard>
      )}

      {showGeneral && (
        <CollapsibleCard title="Comunicação geral · semana a semana" subtitle={`Total acumulado de atualizações ${scopeText} em cada semana`}>
          <WeeklyTrendChart data={general} barName="Atualizações (acumulado)" lineName="" height={260} hideLine />
        </CollapsibleCard>
      )}
    </div>
  );
}
