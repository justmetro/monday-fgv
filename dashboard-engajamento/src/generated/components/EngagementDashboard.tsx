import { useEffect, useMemo, useState } from 'react';
import type { WeekSummary, PersonWeek } from '@generated/lib/engagementMetrics';
import type { StoredProjectItem, AbsenceDoc } from '@generated/models';
import { applyFilter } from '@generated/lib/engagementMetrics';
import { formatBR, type TimeGranularity } from '@generated/lib/dates';
import { BAND_LABELS, countBands, personBand, readableProjectName, type ScoreBand } from '@generated/lib/dashboardTheme';
import { PersonProfileDrawer } from './PersonProfileDrawer';
import { SegmentBar } from './dashboard/SegmentBar';
import { HeroScoreCard } from './dashboard/HeroScoreCard';
import { ClassificationCard } from './dashboard/ClassificationCard';
import { ProjectBarsCard } from './dashboard/ProjectBarsCard';
import { PeopleScoreTable } from './dashboard/PeopleScoreTable';
import { AbsenceListCard } from './dashboard/AbsenceListCard';
import { PeriodInfoLine } from './dashboard/PeriodInfoLine';
import type { PeriodView } from '@generated/hooks/useStoredEngagement';
import { WeeklyTrendChart } from './charts/WeeklyTrendChart';
import { CollapsibleCard } from './charts/CollapsibleCard';
import { StatusBarChart } from './charts/StatusCharts';
import { engagementSeries } from '@generated/lib/weeklySeries';

interface Props {
  weeks: WeekSummary[];
  activeProjects: StoredProjectItem[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  granularity: TimeGranularity;
  onGranularityChange: (g: TimeGranularity) => void;
  period: PeriodView;
  onPeriodChange: (key: string) => void;
  absences: (AbsenceDoc & { id: string })[];
  onAbsenceChanged: () => void;
  userName?: string;
  weekGroupNames?: Record<string, string>;
  canManage?: boolean; // dono, admin ou PMO: gerencia afastamentos de qualquer pessoa
}

const DEFAULT_DEPT = 'Projeto';

/** Frase do período nas visões não semanais: "em setembro de 2026", "no 1º trimestre de 2026", "no ano de 2026". */
function periodWords(week: WeekSummary): string {
  return `${week.granularity === 'monthly' ? 'em' : 'no'} ${week.periodName}`;
}

/** Período do título do card: "na Semana 2" ou a frase do período escolhido. */
function headlinePeriod(week: WeekSummary, groupName: string | undefined): string {
  if (week.granularity !== 'weekly') return periodWords(week);
  return groupName ? `na ${groupName}` : `na semana de ${formatBR(week.refDate)}`;
}

function periodPhrase(week: WeekSummary, weekly: boolean): string {
  if (weekly) return `na semana de ${formatBR(week.refDate)}`;
  return periodWords(week);
}

function scopePhrase(project: string, dept: string): string | undefined {
  const parts: string[] = [];
  if (project !== 'all') parts.push(`do projeto ${readableProjectName(project)}`);
  if (dept !== 'all') parts.push(project !== 'all' ? `em ${dept}` : `de ${dept}`);
  return parts.length ? parts.join(' ') : undefined;
}

export function EngagementDashboard({
  weeks,
  activeProjects,
  loading,
  refreshing,
  error,
  granularity,
  onGranularityChange,
  period,
  onPeriodChange,
  absences,
  onAbsenceChanged,
  weekGroupNames,
  canManage = false,
}: Props) {
  const [focusAbsence, setFocusAbsence] = useState(false);
  const [weekKey, setWeekKey] = useState<string>('latest');
  const [project, setProject] = useState('all');
  // Padrão do Painel Geral: departamento "Projeto" (o usuário pode trocar)
  const [dept, setDept] = useState(DEFAULT_DEPT);
  const [band, setBand] = useState<ScoreBand | null>(null);
  const [manager, setManager] = useState('all');
  const [selectedPerson, setSelectedPerson] = useState<PersonWeek | null>(null);

  const weekly = granularity === 'weekly';

  // As faixas mudam entre Semanal e os demais períodos
  const selectedPeriodKey = period.selected?.key ?? '';
  useEffect(() => setBand(null), [granularity, selectedPeriodKey]);

  // Semanal: a semana escolhida (padrão: a mais recente). Demais: o período escolhido.
  const currentWeek = useMemo(() => {
    if (!weekly) return period.summary;
    if (weeks.length === 0) return null;
    return weeks.find((w) => w.weekKey === weekKey) ?? weeks[weeks.length - 1] ?? null;
  }, [weekly, period.summary, weeks, weekKey]);
  const weeksCount = currentWeek?.evaluatedPeriodInfo?.weeksCount ?? 0;
  const emptyPeriod = !weekly && weeksCount === 0;

  // Departamentos disponíveis: só os das pessoas do projeto escolhido (todos em "Todos os projetos")
  const departmentOptions = useMemo(() => {
    if (!currentWeek) return [];
    const ppl = currentWeek.people.filter((p) => (project === 'all' ? p.activeProjects.length > 0 : p.activeProjects.includes(project)));
    return Array.from(new Set(ppl.flatMap((p) => (p.departments.length ? p.departments : ['Sem departamento'])))).sort((a: string, b: string) =>
      a.localeCompare(b)
    );
  }, [currentWeek, project]);

  // Se o departamento escolhido não existe no projeto novo, volta para "Todos"
  useEffect(() => {
    // Só depois de os dados chegarem (senão o padrão "Projeto" seria descartado durante o carregamento)
    if (!currentWeek || departmentOptions.length === 0) return;
    if (dept !== 'all' && !departmentOptions.includes(dept)) setDept('all');
  }, [departmentOptions, dept, currentWeek]);

  /**
   * Só quem está em equipe de projeto entra nesta aba (o engajamento de todos fica na aba DGPE).
   * LISTA ÚNICA de pessoas filtradas (projeto E departamento), calculada só aqui.
   * Anel, números do topo, classificação, gráfico por projeto, tabela e Score do usuário leem dela.
   */
  const unmanaged = useMemo(
    () => (currentWeek ? applyFilter(currentWeek, dept, project, 'all', true, activeProjects) : null),
    [currentWeek, dept, project, activeProjects]
  );
  const segmented = useMemo(
    () => (currentWeek && manager !== 'all' ? applyFilter(currentWeek, dept, project, manager, true, activeProjects) : unmanaged),
    [currentWeek, dept, project, manager, activeProjects, unmanaged]
  );
  // Gerente escolhido que saiu do recorte volta para "Todos"
  useEffect(() => {
    if (manager !== 'all' && unmanaged && !unmanaged.managers.some((m) => m.name === manager)) setManager('all');
  }, [unmanaged, manager]);
  const filteredPeople = useMemo(() => segmented?.people ?? [], [segmented]);

  // Afastamentos: só os das pessoas do recorte (projeto escolhido ou equipes de projeto), em qualquer semana
  const scopeEmails = useMemo(() => {
    const set = new Set<string>();
    weeks.forEach((w) => w.people.forEach((p) => {
      const inScope = (project === 'all' ? p.activeProjects.length > 0 : p.activeProjects.includes(project)) && (manager === 'all' || p.managers.includes(manager));
      if (inScope && p.email) set.add(p.email.toLowerCase().trim());
    }));
    return set;
  }, [weeks, project, manager]);

  const counts = useMemo(() => countBands(filteredPeople, weekly), [filteredPeople, weekly]);

  // Faixa clicada afeta só a tabela / Score do usuário
  const tablePeople = useMemo(
    () => (band ? filteredPeople.filter((p) => personBand(p, weekly) === band) : filteredPeople),
    [filteredPeople, band, weekly]
  );

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-20 rounded-3xl bg-muted animate-pulse" />
        <div className="h-64 rounded-3xl bg-muted animate-pulse" />
        <div className="grid lg:grid-cols-2 gap-5">
          <div className="h-72 rounded-3xl bg-muted animate-pulse" />
          <div className="h-72 rounded-3xl bg-muted animate-pulse" />
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="bg-destructive/10 text-destructive p-4 rounded-2xl border border-destructive/20 text-xs">{error}</div>;
  }

  if (!currentWeek || !segmented) return null;


  return (
    <div className={`space-y-5 transition-opacity ${refreshing ? 'opacity-70' : ''}`}>
      <SegmentBar
        projects={activeProjects}
        project={project}
        onProject={setProject}
        departments={departmentOptions}
        dept={dept}
        onDept={setDept}
        projectsInScope={dept === 'all' ? activeProjects.length : segmented.projects.length}
        granularity={granularity}
        onGranularityChange={onGranularityChange}
        weeks={weeks}
        weekKey={currentWeek.weekKey}
        onWeek={setWeekKey}
        periodOptions={period.options}
        periodKey={selectedPeriodKey}
        onPeriod={onPeriodChange}
      />

      {!weekly && <PeriodInfoLine period={period.selected} weeksCount={weeksCount} />}

      <CollapsibleCard title="Evolução semanal do engajamento" subtitle="% da equipe engajada em cada semana e média acumulada">
        <WeeklyTrendChart
          data={engagementSeries(
            weeks,
            (p) => (project === 'all' ? p.activeProjects.length > 0 : p.activeProjects.includes(project)) && (dept === 'all' || p.departments.includes(dept)) && (manager === 'all' || p.managers.includes(manager))
          )}
          barName="% engajada na semana"
          lineName="Média acumulada"
          percent
        />
      </CollapsibleCard>

      <CollapsibleCard
        title={project === 'all' ? 'Status dos usuários · Projetos' : `Status dos usuários · ${readableProjectName(project)}`}
        subtitle={weekly ? 'Pessoas em equipe de projeto · use o filtro de projeto acima para segmentar' : 'Situação na última semana do período'}
      >
        <StatusBarChart people={filteredPeople} />
      </CollapsibleCard>

      <HeroScoreCard
        weekly={weekly}
        headlinePeriod={headlinePeriod(segmented, segmented.groupName || weekGroupNames?.[segmented.weekKey])}
        periodPhrase={periodPhrase(segmented, weekly)}
        scopePhrase={scopePhrase(project, dept)}
        counts={counts}
        averageProjectsScore={segmented.averageProjectsScore}
        empty={emptyPeriod}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ClassificationCard weekly={weekly} counts={counts} selected={band} onSelect={setBand} />
        <ProjectBarsCard projects={segmented.projects} selected={project} onSelect={setProject} />
      </div>

      <ProjectBarsCard
        projects={unmanaged?.managers ?? []}
        selected={manager}
        onSelect={setManager}
        kicker="Por gerente"
        title="Engajamento consolidado por gerente"
        hint="Média das pessoas dos projetos de cada gerente · clique para segmentar"
        unit="gerentes"
        rawNames
      />

      <PeopleScoreTable
        people={tablePeople}
        weekly={weekly}
        periodGroups={weekly ? null : period.groups}
        bandLabel={band ? BAND_LABELS[band] : null}
        onClearBand={() => setBand(null)}
        onSelectPerson={(p) => { setFocusAbsence(false); setSelectedPerson(p); }}
        onRegisterAbsence={canManage ? (p) => { setFocusAbsence(true); setSelectedPerson(p); } : undefined}
      />

      <AbsenceListCard weeks={weeks} absences={absences} canManage={canManage} onChanged={onAbsenceChanged}
        emails={scopeEmails} scopeText={project === 'all' ? 'pessoas em equipe de projeto' : `equipe de ${readableProjectName(project)}`} />

      <PersonProfileDrawer
        person={selectedPerson}
        onClose={() => setSelectedPerson(null)}
        canEditAbsence={canManage}
        origem="geral"
        focusAbsenceForm={focusAbsence}
        absences={absences}
        onAbsenceChanged={onAbsenceChanged}
      />
    </div>
  );
}
