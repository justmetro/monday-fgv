import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import type { ApusData, ApusRow } from '../../../server/apus';
import { CollapsibleCard } from './charts/CollapsibleCard';
import { ProjectBarChart, type ProjectBar } from './charts/ProjectBarChart';
import { WeeklyTrendChart, type TrendPoint } from './charts/WeeklyTrendChart';
import { SearchableSelect } from './SearchableSelect';

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
}

const num = (v: number, d = 0) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const perUser = (r: ApusRow) => (r.users ? Math.round((r.updates / r.users) * 100) / 100 : 0);
const bars = (rows: ApusRow[], value: (r: ApusRow) => number, detail?: (r: ApusRow) => string): ProjectBar[] =>
  rows.map((r) => ({ label: r.team, full: r.project || r.team, value: value(r), detail: detail?.(r) })).sort((a, b) => a.value - b.value);

/** Gráficos de atualizações dos projetos, com os mesmos cálculos do quadro Relatórios dos projetos. */
export function ApusSection({ data, loading, error, onReload, filter, messagesByCode, showTable = false, scopeText = 'dos projetos' }: Props) {
  const [week, setWeek] = useState<number | null>(null);
  useEffect(() => { if (week === null && data?.weeks[0]) setWeek(data.weeks[0].weekNumber); }, [data, week]);

  const scoped = useMemo(() => (data?.rows ?? []).filter((r) => !filter || filter(r)), [data, filter]);
  const weekRows = useMemo(() => scoped.filter((r) => r.weekNumber === week), [scoped, week]);
  const weekLabel = data?.weeks.find((w) => w.weekNumber === week)?.weekLabel ?? '';

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

  const belowMin = weekRows.filter((r) => r.apus !== null && r.apus < APUS_MIN).length;

  if (loading && !data) return <div className="h-48 rounded-xl bg-muted animate-pulse" />;
  if (error && !data) return <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">Não foi possível ler as atualizações dos projetos: {error}</p>;
  if (!data) return null;

  const header = (
    <div className="flex flex-wrap items-center gap-2">
      <SearchableSelect
        value={week === null ? '' : String(week)}
        onChange={(v) => setWeek(Number(v))}
        showAllOption={false}
        options={data.weeks.map((w) => ({ value: String(w.weekNumber), label: `Semana ${w.weekNumber}`, subtitle: w.weekLabel }))}
        placeholder="Semana"
        buttonClassName="h-8 min-w-[150px]"
      />
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

  return (
    <div className="space-y-5">
      <CollapsibleCard
        title="Nº de atualizações por usuário por semana (APUS)"
        subtitle={`${weekLabel} · (atualizações ÷ usuários) ÷ semanas na plataforma · ${belowMin} de ${weekRows.length} projetos abaixo do mínimo`}
        actions={header}
      >
        <ProjectBarChart
          data={bars(weekRows.filter((r) => r.apus !== null), (r) => r.apus ?? 0, (r) => `${num(r.updates)} atualizações · ${r.users} usuários · ${r.weeksOnPlatform ?? '—'} semanas`)}
          decimals={2}
          refLines={[
            { y: APUS_MAX, label: 'Máximo esperado', color: 'hsl(var(--foreground))' },
            { y: APUS_MIN, label: 'Mínimo esperado', color: 'hsl(var(--destructive))' },
          ]}
        />
      </CollapsibleCard>

      <div className="grid gap-5 lg:grid-cols-2">
        <CollapsibleCard title="Comunicação geral · semana a semana" subtitle={`Total de atualizações ${scopeText} em cada semana; a linha mostra o aumento sobre a semana anterior`}>
          <WeeklyTrendChart data={general} barName="Atualizações (acumulado)" lineName="Novas na semana" height={260} />
        </CollapsibleCard>
        <CollapsibleCard title="Nº de atualizações por usuário" subtitle={`${weekLabel} · atualizações ÷ usuários`}>
          <ProjectBarChart data={bars(weekRows, perUser)} decimals={2} height={300} />
        </CollapsibleCard>
      </div>

      <CollapsibleCard title="Total de atualizações do projeto" subtitle={`${weekLabel} · acumulado desde a entrada na plataforma`}>
        <ProjectBarChart data={bars(weekRows, (r) => r.updates, (r) => `${r.users} usuários`)} />
      </CollapsibleCard>

      {showTable && (
        <CollapsibleCard title="Comunicação por projeto" subtitle={`${weekLabel} · APUS entre ${APUS_MIN} e ${APUS_MAX} é o esperado`}>
          {weekRows.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Nenhum projeto nesta semana.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[11px] text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-2 pr-3 font-medium">Projeto</th>
                    <th className="px-3 py-2 text-right font-medium">APUS</th>
                    <th className="px-3 py-2 text-right font-medium">Atualizações (acumulado)</th>
                    <th className="px-3 py-2 text-right font-medium">Por usuário</th>
                    <th className="px-3 py-2 text-right font-medium">Usuários</th>
                    {messagesByCode && <th className="py-2 pl-3 text-right font-medium">Mensagens na semana</th>}
                  </tr>
                </thead>
                <tbody>
                  {[...weekRows].sort((a, b) => (a.apus ?? 0) - (b.apus ?? 0)).map((r) => {
                    const low = r.apus !== null && r.apus < APUS_MIN;
                    return (
                      <tr key={`${r.team}|${r.code}`} className="border-b border-border/60 last:border-0">
                        <td className="max-w-[360px] py-2 pr-3"><span className="block truncate text-foreground" title={r.project || r.team}>{r.team}</span></td>
                        <td className={`px-3 py-2 text-right font-medium tabular-nums ${low ? 'text-destructive' : 'text-foreground'}`}>{r.apus === null ? '—' : num(r.apus, 2)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{num(r.updates)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{num(perUser(r), 2)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.users}</td>
                        {messagesByCode && <td className="py-2 pl-3 text-right tabular-nums">{messagesByCode.has(r.code) ? num(messagesByCode.get(r.code)!) : '—'}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CollapsibleCard>
      )}
    </div>
  );
}
