import { useState, useMemo } from 'react';
import {
  FolderKanban,
  Users,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  UserCheck,
  Palmtree,
  Eye,
  Layers,
  Sparkles,
  Sigma,
  Plus,
} from 'lucide-react';
import type { WeekSummary, PersonWeek, GroupStat } from '@generated/lib/engagementMetrics';
import type { StoredProjectItem, AbsenceDoc } from '@generated/models';
import type { UserSessionInfo } from '@generated/server/storage';
import { applyFilter, BRAND_NAVY_COLOR } from '@generated/lib/engagementMetrics';
import { GRANULARITIES, formatBR, parseDateFlexible, type TimeGranularity } from '@generated/lib/dates';
import { readableProjectName } from '@generated/lib/dashboardTheme';
import { SearchableSelect } from './SearchableSelect';
import { PersonProfileDrawer } from './PersonProfileDrawer';
import { MyProjectsInfoDialog } from './manager/MyProjectsInfoDialog';
import { PeriodInfoLine } from './dashboard/PeriodInfoLine';
import type { PeriodView } from '@generated/hooks/useStoredEngagement';
import { WeeklyTrendChart } from './charts/WeeklyTrendChart';
import { CollapsibleCard } from './charts/CollapsibleCard';
import { ApusSection } from './ApusSection';
import { useApus } from '@generated/hooks/useApus';
import type { ApusRow } from '../../../server/apus';
import { engagementSeries, projectCode } from '@generated/lib/weeklySeries';
import { communicationSeries, useCommunication } from '@generated/hooks/useCommunication';

interface Props {
  weeks: WeekSummary[];
  activeProjects: StoredProjectItem[];
  userSession: UserSessionInfo;
  granularity: TimeGranularity;
  onGranularityChange: (g: TimeGranularity) => void;
  period: PeriodView;
  onPeriodChange: (key: string) => void;
  absences: (AbsenceDoc & { id: string })[];
  onAbsenceChanged: () => void;
  viewAsManager?: string;
  onViewAsManagerChange?: (managerName: string) => void;
  managerOptions?: string[];
}

export function ManagerDashboard({
  weeks,
  activeProjects,
  userSession,
  granularity,
  onGranularityChange,
  period,
  onPeriodChange,
  absences,
  onAbsenceChanged,
  viewAsManager,
  onViewAsManagerChange,
  managerOptions,
}: Props) {
  const [selectedWeekKey, setSelectedWeekKey] = useState<string>('latest');
  const [projFilter, setProjFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<PersonWeek | null>(null);
  const [focusAbsence, setFocusAbsence] = useState(false);
  const comm = useCommunication(userSession);
  const apus = useApus(userSession);

  const canManage = Boolean(userSession.canManage);

  // Lista de todos os gerentes da base para o modo "Ver como gerente"
  const allManagersList = useMemo(() => {
    if (!canManage) return [];
    if (managerOptions) return managerOptions;
    const set = new Set<string>();
    activeProjects.forEach((p) => {
      (p.managers || []).forEach((m) => {
        if (m.trim()) set.add(m.trim());
      });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [canManage, activeProjects, managerOptions]);

  // Semana selecionada
  const isWeekly = granularity === 'weekly';
  // Semanal: a semana escolhida (padrão: a mais recente). Demais: o período escolhido.
  const currentWeek = useMemo(() => {
    if (!isWeekly) return period.summary;
    if (weeks.length === 0) return null;
    if (selectedWeekKey === 'latest') return weeks[weeks.length - 1];
    return weeks.find((w) => w.weekKey === selectedWeekKey) || weeks[weeks.length - 1];
  }, [isWeekly, period.summary, weeks, selectedWeekKey]);
  const weeksCount = currentWeek?.evaluatedPeriodInfo?.weeksCount ?? 0;
  const emptyPeriod = !isWeekly && weeksCount === 0;

  // Aplicação dos filtros do gerente
  const filteredWeek = useMemo(() => {
    if (!currentWeek) return null;
    return applyFilter(
      currentWeek,
      'all',
      projFilter,
      'all',
      true, // Foca sempre nas pessoas dos projetos geridos
      activeProjects
    );
  }, [currentWeek, projFilter, activeProjects]);

  const displayedPeople = useMemo(() => {
    if (!filteredWeek) return [];
    let list = filteredWeek.people;

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q) ||
          p.activeProjects.some((pr) => pr.toLowerCase().includes(q))
      );
    }

    return list;
  }, [filteredWeek, search]);

  // Consolidado de "Meus Projetos"
  const consolidatedStats = useMemo(() => {
    if (!currentWeek) return null;
    // Pessoas sob gestão do gerente
    const managedPeople = currentWeek.people.filter((p) => p.activeProjects.length > 0);
    const totalPeople = managedPeople.length;

    // Projetos do gerente
    const projs = currentWeek.projects;
    const validScores = projs.map((p) => p.averageScore).filter((s): s is number => s !== null && s !== undefined);
    const averageScore = emptyPeriod
      ? 0
      : validScores.length > 0
        ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
        : null;

    // Total de análises e presenças ativas somadas
    let totalAnalyses = 0;
    let activePresences = 0;
    projs.forEach((p) => {
      totalAnalyses += p.projectInfo?.totalAnalyses ?? 0;
      activePresences += p.projectInfo?.activePresences ?? 0;
    });

    return {
      totalProjects: projs.length,
      totalPeople,
      averageScore,
      totalAnalyses,
      activePresences,
    };
  }, [currentWeek, emptyPeriod]);

  const effectiveManagerName = viewAsManager || userSession.name;

  // Projetos no recorte (todos os do gerente ou o escolhido no filtro)
  const scopeProjects = useMemo(
    () => new Set(projFilter === 'all' ? activeProjects.map((p) => p.name) : [projFilter]),
    [projFilter, activeProjects]
  );
  const engagementTrend = useMemo(
    () => engagementSeries(weeks, (p) => p.activeProjects.some((pr) => scopeProjects.has(pr))),
    [weeks, scopeProjects]
  );
  const commTrend = useMemo(() => {
    const codes = new Set([...scopeProjects].map(projectCode).filter(Boolean));
    return communicationSeries(comm.view, codes);
  }, [comm.view, scopeProjects]);

  // Comunicação por projeto: projetos do recorte pelo código SGI (ou o gerente marcado no quadro)
  const apusFilter = useMemo(() => {
    const codes = new Set([...scopeProjects].map(projectCode).filter(Boolean));
    const me = effectiveManagerName.trim().toLowerCase();
    return (r: ApusRow) => (r.code ? codes.has(r.code) : projFilter === 'all' && r.managers.some((m) => m.toLowerCase() === me));
  }, [scopeProjects, effectiveManagerName, projFilter]);
  // Mensagens (updates + respostas) da última semana calculada na Comunicação
  const lastWeekMessages = useMemo(() => {
    const ws = comm.view?.weeks[0]?.weekStart;
    const m = new Map<string, number>();
    (comm.view?.rows ?? []).filter((r) => r.weekStart === ws).forEach((r) => m.set(r.code, (m.get(r.code) ?? 0) + r.total));
    return m;
  }, [comm.view]);

  if (!currentWeek || !filteredWeek) {
    return (
      <div className="p-8 text-center text-xs text-muted-foreground bg-card rounded-xl border border-border">
        Nenhum dado disponível para o gerente no momento.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Aviso do modo "Ver como gerente" (somente dono, admin e PMO) */}
      {canManage && onViewAsManagerChange && viewAsManager && (
        <div className="p-3 rounded-xl border border-primary/30 bg-primary/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <p className="text-xs text-foreground flex items-center gap-2">
            <Eye className="w-4 h-4 text-primary shrink-0" />
            Vendo como <strong>{viewAsManager}</strong>
          </p>
          <button
            type="button"
            onClick={() => onViewAsManagerChange('')}
            className="h-9 px-3 rounded-lg bg-card border border-border text-xs font-medium text-foreground hover:bg-muted self-start sm:self-auto"
          >
            Voltar à minha visão
          </button>
        </div>
      )}

      {/* Seletor "Ver como gerente" (Exclusivo para Dono, Admin e PMO) */}
      {canManage && onViewAsManagerChange && (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-card px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Eye className="h-4 w-4" /> Ver como gerente
          </p>
          <div className="w-full sm:w-72">
            <SearchableSelect
              value={viewAsManager || ''}
              onChange={(val) => onViewAsManagerChange(val === 'all' ? '' : val)}
              showAllOption={false}
              allLabel="Minha visão padrão"
              placeholder="Escolher gerente..."
              searchPlaceholder="Buscar gerente..."
              options={[
                { value: '', label: `Eu mesmo (${userSession.name})` },
                ...allManagersList.map((m) => ({ value: m, label: m })),
              ]}
              buttonClassName="w-full h-9"
              dropdownClassName="w-full sm:w-80"
            />
          </div>
        </div>
      )}

      {/* Controles do Painel do Gerente */}
      <div className="bg-card rounded-xl px-5 py-4 border border-border space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-lg bg-muted border border-border">
            {GRANULARITIES.map((g) => (
              <button
                key={g.id}
                onClick={() => onGranularityChange(g.id)}
                className={`h-8 px-3 text-xs rounded-md font-medium transition-colors ${
                  granularity === g.id
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {g.shortLabel}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {isWeekly ? (
              <>
                <span className="text-xs text-muted-foreground whitespace-nowrap">Data de Referência:</span>
                <SearchableSelect
                  value={selectedWeekKey}
                  onChange={setSelectedWeekKey}
                  showAllOption={false}
                  options={weeks.map((w) => ({
                    value: w.weekKey,
                    label: `Ref: ${formatBR(w.refDate)}`,
                    subtitle: w.periodName,
                  }))}
                  allLabel="Última disponível"
                  placeholder="Selecione a data..."
                  buttonClassName="h-9 min-w-[200px]"
                />
              </>
            ) : (
              <>
                <span className="text-xs text-muted-foreground whitespace-nowrap">Período:</span>
                <SearchableSelect
                  id="manager-period"
                  ariaLabel="Período avaliado"
                  value={period.selected?.key ?? ''}
                  onChange={onPeriodChange}
                  showAllOption={false}
                  options={period.options.map((o) => ({ value: o.key, label: o.label, subtitle: o.rangeText }))}
                  placeholder="Período"
                  searchPlaceholder="Buscar período..."
                  buttonClassName="h-9 min-w-[160px]"
                />
              </>
            )}
          </div>
        </div>

        {/* Intervalo do período avaliado, semanas analisadas e aviso de período vazio */}
        {!isWeekly && <PeriodInfoLine period={period.selected} weeksCount={weeksCount} />}

        {/* Filtro de Projeto Específico */}
        <div className="pt-2 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="w-full sm:w-80">
            <SearchableSelect
              value={projFilter}
              onChange={setProjFilter}
              allLabel="Todos os meus projetos (Consolidado)"
              options={activeProjects.map((p) => ({
                value: p.name,
                label: readableProjectName(p.name),
              }))}
              className="w-full"
              buttonClassName="w-full h-9"
              dropdownClassName="w-full sm:w-80"
            />
          </div>

          <span className="text-xs text-muted-foreground">
            Gerente analisado: <strong className="text-foreground">{effectiveManagerName}</strong>
          </span>
        </div>
      </div>

      {/* Resumo de "Meus Projetos" */}
      {consolidatedStats && (
        <section className="rounded-xl border border-border bg-card px-5 py-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium text-foreground">
                  Meus projetos · {consolidatedStats.totalProjects} {consolidatedStats.totalProjects === 1 ? 'ativo' : 'ativos'}
                </p>
                <MyProjectsInfoDialog />
              </div>
              <p className="text-xs text-muted-foreground">Gerente: {effectiveManagerName}</p>
            </div>
            <div className="flex flex-wrap gap-6 text-xs">
              {[
                ['Score médio', consolidatedStats.averageScore !== null ? `${consolidatedStats.averageScore}%` : '—'],
                ['Pessoas', consolidatedStats.totalPeople],
                ['Presenças ativas', consolidatedStats.activePresences],
                ['Análises', consolidatedStats.totalAnalyses],
              ].map(([k, v]) => (
                <div key={String(k)}>
                  <p className="text-[11px] text-muted-foreground">{k}</p>
                  <p className="text-xl font-light tabular-nums text-foreground">{v}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <ApusSection
        data={apus.data}
        loading={apus.loading}
        error={apus.error}
        filter={apusFilter}
        messagesByCode={lastWeekMessages}
        showGeneral={false}
        scopeText="dos seus projetos"
      />

      <CollapsibleCard title="Projetos sob sua gestão" subtitle="Score = presenças ativas ÷ total de análises">
        {filteredWeek.projects.length === 0 ? (
          <p className="p-6 text-center text-xs text-muted-foreground">
            {emptyPeriod ? 'Sem dados neste período.' : `Nenhum projeto ativo atribuído a ${effectiveManagerName}.`}
          </p>
        ) : (
          <div className="space-y-3 pt-1">
            {filteredWeek.projects.map((proj) => {
              const readableName = readableProjectName(proj.name);
              const score = proj.averageScore ?? 0;
              const opacity = proj.averageScore !== null ? Math.max(0.2, score / 100) : 0.1;

              return (
                <div key={proj.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs gap-3">
                    <div className="flex items-center gap-2 truncate flex-1" title={proj.name}>
                      <span className="font-medium text-foreground truncate">{readableName}</span>
                      {proj.projectInfo?.startDate && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground shrink-0">
                          Início: {formatBR(parseDateFlexible(proj.projectInfo.startDate))}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-muted-foreground text-[11px] tabular-nums">
                        {proj.totalPeople} {proj.totalPeople === 1 ? 'pessoa' : 'pessoas'}
                      </span>
                      <strong className="text-foreground tabular-nums text-xs">
                        {proj.averageScore !== null ? `${proj.averageScore}%` : 'Sem dados'}
                      </strong>
                    </div>
                  </div>

                  <div className="w-full h-3 rounded-full bg-muted/60 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${score}%`,
                        backgroundColor: BRAND_NAVY_COLOR,
                        opacity,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CollapsibleCard>

      <CollapsibleCard
        title="Equipe e colaboradores"
        subtitle="Clique no nome para abrir a ficha; use Inserir férias para registrar um afastamento"
        actions={
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar colaborador..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-48 text-xs pl-8 pr-2.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs divide-y divide-border/70">
            <thead className="text-[11px] font-medium text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Colaborador</th>
                <th className="px-3 py-2">Projetos Ativos</th>
                <th className="px-3 py-2">{isWeekly ? 'Semana da Análise' : 'Score do Período'}</th>
                <th className="px-3 py-2 text-right">Score Geral (Semanas)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {displayedPeople.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-xs text-muted-foreground">
                    {emptyPeriod ? 'Sem dados neste período.' : `Nenhum colaborador encontrado sob a gestão de ${effectiveManagerName}.`}
                  </td>
                </tr>
              ) : (
                displayedPeople.map((p) => {
                  return (
                    <tr
                      key={p.key}
                      onClick={() => { setFocusAbsence(false); setSelectedPerson(p); }}
                      className="hover:bg-muted/40 cursor-pointer transition-colors"
                    >
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-foreground flex items-center gap-2">
                          <span>{p.name}</span>
                          {p.activeAbsence && (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                p.activeAbsence.tipo === 'Férias'
                                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              {p.activeAbsence.tipo}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground">{p.email || '—'}</div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFocusAbsence(true);
                            setSelectedPerson(p);
                          }}
                          className="mt-1 inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <Plus className="h-3 w-3" /> Inserir férias
                        </button>
                      </td>

                      <td className="px-3 py-2.5">
                        <span className="font-medium text-foreground">
                          {p.activeProjects.map(readableProjectName).join(', ')}
                        </span>
                      </td>

                      <td className="px-3 py-2.5">
                        {isWeekly ? (
                          p.activeAbsence ? (
                            <span className="inline-flex items-center gap-1.5 text-muted-foreground font-medium">
                              <Palmtree className="w-3.5 h-3.5" /> Afastado
                            </span>
                          ) : p.engaged ? (
                            <span className="inline-flex items-center gap-1.5 text-primary font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Engajado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                              <XCircle className="w-3.5 h-3.5" /> {p.inactive ? 'Inativo' : 'Desengajado'}
                            </span>
                          )
                        ) : (
                          <span className="font-medium text-foreground tabular-nums">
                            {p.periodScore.scoreText}
                          </span>
                        )}
                      </td>

                      <td className="px-3 py-2.5 text-right">
                        <div className="font-medium text-foreground tabular-nums">
                          {p.overallScorePercent !== null ? `${p.overallScorePercent}%` : '—'}
                        </div>
                        <div className="text-[10px] text-muted-foreground tabular-nums">
                          {p.overallWeeksEngaged} de {p.overallWeeksEvaluated} sem. ativas
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </CollapsibleCard>

      {/* Ficha Técnica / Drawer */}
      <PersonProfileDrawer
        person={selectedPerson}
        onClose={() => setSelectedPerson(null)}
        canEditAbsence={true}
        focusAbsenceForm={focusAbsence}
        viewAsManager={viewAsManager}
        absences={absences}
        onAbsenceChanged={onAbsenceChanged}
      />
    </div>
  );
}
