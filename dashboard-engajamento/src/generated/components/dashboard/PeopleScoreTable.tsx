import { useEffect, useMemo, useState } from 'react';
import { Search, X, CheckCircle2, XCircle, Palmtree } from 'lucide-react';
import type { PersonWeek } from '@generated/lib/engagementMetrics';
import { readableProjectName, personBand } from '@generated/lib/dashboardTheme';
import { SearchableSelect } from '../SearchableSelect';
import { useDailyScoreIndex } from '@generated/hooks/dailyScoreContext';
import { userScoreInGroups } from '@generated/lib/dailyScore';
import { normText } from '@generated/lib/weekdays';

interface Props {
  people: PersonWeek[];
  weekly: boolean;
  periodGroups: string[] | null; // Semanas do período escolhido (null = todas as semanas da Base)
  bandLabel: string | null;
  onClearBand: () => void;
  onSelectPerson: (p: PersonWeek) => void;
  onRegisterAbsence?: (p: PersonWeek) => void; // só para quem tem acesso de gestão
}

const PAGE = 25;
type View = 'table' | 'user';

export function PeopleScoreTable({ people, weekly, periodGroups, bandLabel, onClearBand, onSelectPerson, onRegisterAbsence }: Props) {
  const [view, setView] = useState<View>('table');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [manager, setManager] = useState('all');
  const [visible, setVisible] = useState(PAGE);
  const dailyIndex = useDailyScoreIndex();
  const groupSet = useMemo(() => (periodGroups ? new Set(periodGroups.map(normText)) : null), [periodGroups]);

  // Mudou o período, o projeto ou o departamento (a lista de pessoas): volta ao início da lista
  useEffect(() => setVisible(PAGE), [people, periodGroups]);

  // As opções de status mudam entre Semanal e os demais períodos
  useEffect(() => setStatus('all'), [weekly]);

  const managerOptions = useMemo(() => Array.from(new Set(people.flatMap((p) => p.managers))).sort(), [people]);

  // Um gerente escolhido antes pode não existir no novo período/projeto: volta para "Todos"
  useEffect(() => {
    if (manager !== 'all' && !managerOptions.includes(manager)) setManager('all');
  }, [managerOptions, manager]);

  const statusOptions = weekly
    ? [
        { value: 'engaged', label: 'Engajados' },
        { value: 'not_engaged', label: 'Desengajados (+7 dias)' },
        { value: 'inactive', label: 'Inativos (+30 dias)' },
        { value: 'away', label: 'Afastados' },
      ]
    : [
        { value: 'evaluated', label: 'Avaliados (com score)' },
        { value: 'away', label: 'Afastados no período' },
        { value: 'no_data', label: 'Sem dados no período' },
      ];

  const list = useMemo(() => {
    const matchesStatus = (p: PersonWeek) => {
      if (status === 'all') return true;
      const b = personBand(p, weekly);
      if (status === 'no_data') return b === null;
      if (status === 'away') return b === 'away';
      if (status === 'evaluated') return b !== null && b !== 'away';
      return b === status;
    };
    const q = search.toLowerCase().trim();
    const out = people.filter(
      (p) =>
        matchesStatus(p) &&
        (manager === 'all' || p.managers.includes(manager)) &&
        (!q || p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q))
    );
    if (view === 'user') {
      // Score do usuário: dias com check ÷ datas analisadas
      return out
        .slice()
        .sort((a, b) => (userScoreInGroups(dailyIndex, b.key, groupSet).percent ?? -1) - (userScoreInGroups(dailyIndex, a.key, groupSet).percent ?? -1));
    }
    return out;
  }, [people, search, status, manager, view, weekly, dailyIndex, groupSet]);

  const tabBtn = (id: View, label: string) => (
    <button
      type="button"
      onClick={() => setView(id)}
      className={`h-9 px-4 text-xs rounded-full transition-colors ${
        view === id ? 'bg-[hsl(var(--brand-navy))] text-card font-medium' : 'text-muted-foreground hover:text-[hsl(var(--brand-navy))]'
      }`}
    >
      {label}
    </button>
  );

  return (
    <section className="rounded-3xl bg-card soft-stack-card p-5 sm:p-6 space-y-4 min-w-0">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Pessoas</p>
          <h3 className="mt-1 text-lg font-medium tracking-[-0.015em] text-[hsl(var(--brand-navy))]">
            {view === 'table' ? 'Colaboradores analisados' : 'Score do usuário'}
          </h3>
          <p className="text-xs text-muted-foreground">
            {list.length} pessoa(s) · clique para abrir a ficha técnica
          </p>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-full bg-[hsl(var(--brand-sky-2))] border border-border self-start">
          {tabBtn('table', 'Colaboradores analisados')}
          {tabBtn('user', 'Score do usuário')}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-auto">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar pessoa ou e-mail..."
            aria-label="Buscar pessoa ou e-mail"
            className="h-10 w-full sm:w-60 text-xs pl-8 pr-3 rounded-full border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <SearchableSelect id="tbl-status" ariaLabel="Filtrar por status" value={status} onChange={setStatus} options={statusOptions} allLabel="Todos os status" buttonClassName="h-10 rounded-full" />
        <SearchableSelect id="tbl-manager" ariaLabel="Filtrar por gerente" value={manager} onChange={setManager} options={managerOptions} allLabel="Todos os gerentes" buttonClassName="h-10 rounded-full" />
        {bandLabel && (
          <button type="button" onClick={onClearBand} className="h-10 px-3 rounded-full text-xs bg-[hsl(var(--brand-sky))] text-[hsl(var(--brand-navy))] inline-flex items-center gap-1.5">
            Faixa: {bandLabel} <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="border border-border rounded-2xl overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[hsl(var(--brand-sky-2))] text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {view === 'table' ? (
              <tr>
                <th className="px-4 py-3">Colaborador</th>
                <th className="px-4 py-3">Projetos ativos</th>
                <th className="px-4 py-3">{weekly ? 'Semana da análise' : 'Score do período'}</th>
                <th className="px-4 py-3 text-right">{weekly ? 'Nota da semana' : 'Score na base'}</th>
              </tr>
            ) : (
              <tr>
                <th className="px-4 py-3">Colaborador</th>
                <th className="px-4 py-3 w-1/2">Score do usuário (semanas com acesso ÷ semanas da Base)</th>
                <th className="px-4 py-3 text-right">Semanas</th>
              </tr>
            )}
          </thead>
          <tbody className="divide-y divide-border">
            {list.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">Nenhum colaborador encontrado com esses filtros.</td>
              </tr>
            )}
            {list.slice(0, visible).map((p) => (
              <tr key={p.key} onClick={() => onSelectPerson(p)} className="hover:bg-[hsl(var(--brand-sky-2))] cursor-pointer align-top">
                <td className="px-4 py-3">
                  <div className="font-medium text-[hsl(var(--brand-navy))] flex items-center gap-2">
                    {p.name}
                    {p.activeAbsence && <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-muted text-muted-foreground">{p.activeAbsence.tipo}</span>}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{p.email || '—'}</div>
                  {onRegisterAbsence && p.email && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); onRegisterAbsence(p); }}
                      className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline">
                      <Palmtree className="w-3 h-3" /> Registrar férias/licença
                    </button>
                  )}
                </td>
                {view === 'table' ? (
                  <>
                    <td className="px-4 py-3 max-w-[280px] text-foreground">
                      {p.activeProjects.length > 0 ? p.activeProjects.map(readableProjectName).join(', ') : <span className="italic text-muted-foreground">Sem projeto</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {weekly ? (
                        p.activeAbsence ? (
                          <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Palmtree className="w-3.5 h-3.5" /> Afastado</span>
                        ) : p.engaged ? (
                          <span className="inline-flex items-center gap-1.5 text-[hsl(var(--brand-navy))] font-medium"><CheckCircle2 className="w-3.5 h-3.5" /> Engajado</span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-muted-foreground"><XCircle className="w-3.5 h-3.5" /> {p.inactive ? 'Inativo' : 'Desengajado'}</span>
                        )
                      ) : (
                        <span className="font-medium tabular-nums text-[hsl(var(--brand-navy))]">{p.periodScore.scoreText}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {weekly ? (
                        p.activeAbsence ? (
                          <div className="text-muted-foreground">—</div>
                        ) : (
                          <>
                            <div className="font-medium text-[hsl(var(--brand-navy))]">{p.engaged ? '100%' : '0%'}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {p.engaged ? 'Acessou durante a semana analisada' : p.daysWithoutAccess === null ? 'Nunca acessou' : `${p.daysWithoutAccess} dias sem acesso no fim da semana`}
                            </div>
                          </>
                        )
                      ) : (
                        <>
                          <div className="font-medium text-[hsl(var(--brand-navy))]">{p.overallScorePercent !== null ? `${p.overallScorePercent}%` : '—'}</div>
                          <div className="text-[10px] text-muted-foreground">{p.overallWeeksEngaged} de {p.overallWeeksEvaluated} sem.</div>
                        </>
                      )}
                    </td>
                  </>
                ) : (
                  (() => {
                    const ds = userScoreInGroups(dailyIndex, p.key, groupSet);
                    if (ds.allAway || ds.weeksTotal === 0 || ds.percent === null) {
                      return (
                        <td colSpan={2} className="px-4 py-3 text-muted-foreground">{ds.allAway ? 'Afastado no período' : 'Sem semanas analisadas'}</td>
                      );
                    }
                    return (
                      <>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden" aria-hidden="true">
                              <div className="h-full rounded-full bg-gradient-to-r from-[hsl(var(--brand-navy)/0.3)] to-[hsl(var(--brand-navy))]" style={{ width: `${ds.percent}%` }} />
                            </div>
                            <span className="w-10 text-right font-medium tabular-nums text-[hsl(var(--brand-navy))]">{ds.percent}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground whitespace-nowrap">{ds.weeksAccessed} de {ds.weeksTotal} semanas</td>
                      </>
                    );
                  })()
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {visible < list.length && (
        <div className="text-center">
          <button type="button" onClick={() => setVisible((v) => v + PAGE)} className="h-10 px-5 text-xs rounded-full border border-border hover:bg-[hsl(var(--brand-sky-2))] text-[hsl(var(--brand-navy))]">
            Mostrar mais ({list.length - visible} restantes)
          </button>
        </div>
      )}
    </section>
  );
}
