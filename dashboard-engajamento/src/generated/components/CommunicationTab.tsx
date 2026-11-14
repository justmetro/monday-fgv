import { useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, Search, ExternalLink } from 'lucide-react';
import { getCommunicationJob, runCommunicationWeek } from '@generated/server/communication';
import type { UserSessionInfo } from '@generated/server/storage';
import type { WeekSummary } from '@generated/lib/engagementMetrics';
import { errorText } from '@generated/lib/errorText';
import type { JobState } from '../../../server/jobs';
import { brFromIso, projectCode } from '@generated/lib/weeklySeries';
import { communicationSeries, useCommunication } from '@generated/hooks/useCommunication';
import { WeeklyTrendChart } from './charts/WeeklyTrendChart';
import { CollapsibleCard } from './charts/CollapsibleCard';
import { SearchableSelect } from './SearchableSelect';

const brDateTime = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
const num = (v: number) => v.toLocaleString('pt-BR');

interface Props {
  session: UserSessionInfo;
  weeks: WeekSummary[]; // semanas do engajamento, para cruzar equipe e % da mesma semana
}

export function CommunicationTab({ session, weeks }: Props) {
  const { view, error, loading, reload, claim } = useCommunication(session, 12);
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { if (!weekStart && view?.weeks[0]) setWeekStart(view.weeks[0].weekStart); }, [view, weekStart]);
  useEffect(() => () => { if (poll.current) clearInterval(poll.current); }, []);

  const selWeek = view?.weeks.find((w) => w.weekStart === weekStart) ?? null;
  const prevWeek = useMemo(() => {
    const i = view?.weeks.findIndex((w) => w.weekStart === weekStart) ?? -1;
    return i >= 0 ? view?.weeks[i + 1] ?? null : null;
  }, [view, weekStart]);

  // Engajamento da mesma semana (mesmo "Semana N"), por código do projeto
  const engByCode = useMemo(() => {
    const w = weeks.find((x) => x.groupName === selWeek?.week);
    const m = new Map<string, { people: number; rate: number | null }>();
    w?.projects.forEach((p) => { const c = projectCode(p.name); if (c) m.set(c, { people: p.totalPeople, rate: p.averageScore }); });
    return { found: Boolean(w), map: m };
  }, [weeks, selWeek]);

  const rows = useMemo(() => {
    const prev = new Map((view?.rows ?? []).filter((r) => r.weekStart === prevWeek?.weekStart).map((r) => [r.workspaceId, r.total]));
    const q = query.trim().toLowerCase();
    return (view?.rows ?? [])
      .filter((r) => r.weekStart === weekStart && (!q || r.project.toLowerCase().includes(q)))
      .map((r) => ({ ...r, prev: prev.get(r.workspaceId) ?? null, eng: engByCode.map.get(r.code) ?? null }))
      .sort((a, b) => b.total - a.total || a.project.localeCompare(b.project));
  }, [view, weekStart, prevWeek, query, engByCode]);

  const totals = useMemo(() => {
    const all = (view?.rows ?? []).filter((r) => r.weekStart === weekStart);
    return {
      updates: all.reduce((s, r) => s + r.updates, 0),
      replies: all.reduce((s, r) => s + r.replies, 0),
      silent: all.filter((r) => r.total === 0).length,
      projects: all.length,
    };
  }, [view, weekStart]);

  const run = async () => {
    setBusy(true); setMsg(null);
    try {
      const started = (await runCommunicationWeek({ data: { clientClaim: claim, ...(weekStart ? { weekStart } : {}) } })) as JobState;
      setMsg({ kind: 'ok', text: 'Calculando a semana. Leva alguns minutos; pode continuar usando o app.' });
      if (poll.current) clearInterval(poll.current);
      poll.current = setInterval(async () => {
        try {
          const j = (await getCommunicationJob({ data: { clientClaim: claim } })) as JobState | null;
          if (!j || j.startedAt !== started.startedAt || j.status === 'rodando') return;
          if (poll.current) clearInterval(poll.current);
          setBusy(false);
          if (j.status === 'erro') setMsg({ kind: 'err', text: j.error ?? 'Erro ao calcular.' });
          else {
            const r = (j.result ?? {}) as { week?: string; projects?: number; updates?: number; replies?: number };
            setMsg({ kind: 'ok', text: `${r.week}: ${r.projects} projetos, ${num(r.updates ?? 0)} updates e ${num(r.replies ?? 0)} respostas.` });
            await reload();
          }
        } catch { /* tenta de novo no próximo ciclo */ }
      }, 5000);
    } catch (e) {
      setBusy(false);
      setMsg({ kind: 'err', text: errorText(e) });
    }
  };

  if (loading) return <div className="h-64 rounded-xl bg-muted animate-pulse" />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Semana</span>
          <SearchableSelect
            value={weekStart ?? ''}
            onChange={setWeekStart}
            showAllOption={false}
            options={(view?.weeks ?? []).map((w) => ({ value: w.weekStart, label: w.week, subtitle: `${brFromIso(w.weekStart)} a ${brFromIso(w.weekEnd)}` }))}
            placeholder="Escolha a semana"
            buttonClassName="h-9 min-w-[220px]"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          {view?.lastRun && <span>Último cálculo: {brDateTime(view.lastRun.at)} ({view.lastRun.week})</span>}
          {session.canManage && (
            <button type="button" onClick={() => void run()} disabled={busy}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs text-foreground hover:bg-muted disabled:opacity-50">
              <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
              {busy ? 'Calculando...' : weekStart ? 'Recalcular semana' : `Calcular semana de ${brFromIso(view?.nextWeekStart ?? '')}`}
            </button>
          )}
        </div>
      </div>

      {msg && <p className={`rounded-lg px-3 py-2 text-xs ${msg.kind === 'err' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-foreground'}`}>{msg.text}</p>}
      {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}

      {!view?.weeks.length ? (
        <p className="rounded-xl border border-border bg-card p-8 text-center text-xs text-muted-foreground">
          Nenhuma semana calculada ainda. A consolidação roda toda segunda às 6h10 para a semana anterior (domingo a sábado).
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Mensagens', num(totals.updates + totals.replies)],
              ['Updates', num(totals.updates)],
              ['Respostas', num(totals.replies)],
              ['Projetos sem mensagem', `${totals.silent} de ${totals.projects}`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-border bg-card px-4 py-3">
                <p className="text-[11px] text-muted-foreground">{k}</p>
                <p className="mt-0.5 text-xl font-light tabular-nums text-foreground">{v}</p>
              </div>
            ))}
          </div>

          <CollapsibleCard title="Evolução semanal das comunicações" subtitle="Updates e respostas somados por semana, com média acumulada">
            <WeeklyTrendChart data={communicationSeries(view)} barName="Mensagens na semana" lineName="Média acumulada" />
          </CollapsibleCard>

          <CollapsibleCard
            title={`Projetos · ${selWeek?.week ?? ''}`}
            subtitle={selWeek ? `${brFromIso(selWeek.weekStart)} a ${brFromIso(selWeek.weekEnd)}${engByCode.found ? '' : ' · sem engajamento cadastrado para esta semana'}` : undefined}
            actions={
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar projeto..."
                  className="h-8 w-48 rounded-lg border border-border bg-background pl-8 pr-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring" />
              </div>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[11px] text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-2 pr-3 font-medium">Projeto</th>
                    <th className="px-3 py-2 text-right font-medium">Updates</th>
                    <th className="px-3 py-2 text-right font-medium">Respostas</th>
                    <th className="px-3 py-2 text-right font-medium">Total</th>
                    <th className="px-3 py-2 text-right font-medium">Semana anterior</th>
                    <th className="px-3 py-2 text-right font-medium">Quem escreveu</th>
                    <th className="px-3 py-2 text-right font-medium">Equipe</th>
                    <th className="py-2 pl-3 text-right font-medium">% que entrou</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const diff = r.prev === null ? null : r.total - r.prev;
                    return (
                      <tr key={r.workspaceId} className="border-b border-border/60 last:border-0">
                        <td className="max-w-[360px] py-2 pr-3">
                          <a href={`https://fgvdgpe-projetos.monday.com/workspaces/${r.workspaceId}`} target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-1 text-foreground hover:underline" title={r.project}>
                            <span className="truncate">{r.project}</span><ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                          </a>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{num(r.updates)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{num(r.replies)}</td>
                        <td className="px-3 py-2 text-right font-medium tabular-nums">{num(r.total)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                          {diff === null ? '—' : `${num(r.prev!)} (${diff > 0 ? '+' : ''}${num(diff)})`}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{num(r.authors)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.eng ? num(r.eng.people) : '—'}</td>
                        <td className="py-2 pl-3 text-right tabular-nums">{r.eng?.rate !== null && r.eng?.rate !== undefined ? `${r.eng.rate}%` : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Semana de domingo a sábado, com o mesmo número usado no engajamento. Equipe e % que entrou vêm do engajamento da mesma semana.
            </p>
          </CollapsibleCard>
        </>
      )}
    </div>
  );
}
