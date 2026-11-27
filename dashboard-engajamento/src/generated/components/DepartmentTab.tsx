import { useEffect, useMemo, useState } from 'react';
import type { WeekSummary, PersonWeek } from '@generated/lib/engagementMetrics';
import type { StoredProjectItem, AbsenceDoc } from '@generated/models';
import { applyFilter } from '@generated/lib/engagementMetrics';
import { formatBR, type TimeGranularity } from '@generated/lib/dates';
import { BAND_LABELS, countBands, personBand, type ScoreBand } from '@generated/lib/dashboardTheme';
import type { PeriodView } from '@generated/hooks/useStoredEngagement';
import { engagementSeries } from '@generated/lib/weeklySeries';
import { SegmentBar } from './dashboard/SegmentBar';
import { HeroScoreCard } from './dashboard/HeroScoreCard';
import { ClassificationCard } from './dashboard/ClassificationCard';
import { ProjectBarsCard } from './dashboard/ProjectBarsCard';
import { PeopleScoreTable } from './dashboard/PeopleScoreTable';
import { AbsenceListCard } from './dashboard/AbsenceListCard';
import { PeriodInfoLine } from './dashboard/PeriodInfoLine';
import { PersonProfileDrawer } from './PersonProfileDrawer';
import { WeeklyTrendChart } from './charts/WeeklyTrendChart';
import { CollapsibleCard } from './charts/CollapsibleCard';

interface Props {
  weeks: WeekSummary[];
  activeProjects: StoredProjectItem[];
  loading: boolean;
  granularity: TimeGranularity;
  onGranularityChange: (g: TimeGranularity) => void;
  period: PeriodView;
  onPeriodChange: (key: string) => void;
  absences: (AbsenceDoc & { id: string })[];
  onAbsenceChanged: () => void;
  canManage: boolean;
}

const deptsOf = (p: PersonWeek) => (p.departments.length ? p.departments : ['Sem departamento']);

/** Engajamento de toda a DGPE (com ou sem projeto), por departamento. */
export function DepartmentTab({ weeks, activeProjects, loading, granularity, onGranularityChange, period, onPeriodChange, absences, onAbsenceChanged, canManage }: Props) {
  const [weekKey, setWeekKey] = useState('latest');
  const [dept, setDept] = useState('all');
  const [band, setBand] = useState<ScoreBand | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<PersonWeek | null>(null);
  const [focusAbsence, setFocusAbsence] = useState(false);
  const weekly = granularity === 'weekly';
  const selectedPeriodKey = period.selected?.key ?? '';
  useEffect(() => setBand(null), [granularity, selectedPeriodKey]);

  const currentWeek = useMemo(() => {
    if (!weekly) return period.summary;
    return weeks.find((w) => w.weekKey === weekKey) ?? weeks[weeks.length - 1] ?? null;
  }, [weekly, period.summary, weeks, weekKey]);
  const weeksCount = currentWeek?.evaluatedPeriodInfo?.weeksCount ?? 0;

  const departments = useMemo(
    () => Array.from(new Set((currentWeek?.people ?? []).flatMap(deptsOf))).sort((a, b) => a.localeCompare(b)),
    [currentWeek]
  );
  const all = useMemo(() => (currentWeek ? applyFilter(currentWeek, 'all', 'all', 'all', false, activeProjects) : null), [currentWeek, activeProjects]);
  const segmented = useMemo(
    () => (currentWeek ? (dept === 'all' ? all : applyFilter(currentWeek, dept, 'all', 'all', false, activeProjects)) : null),
    [currentWeek, dept, all, activeProjects]
  );
  const people = useMemo(() => segmented?.people ?? [], [segmented]);
  const counts = useMemo(() => countBands(people, weekly), [people, weekly]);
  const tablePeople = useMemo(() => (band ? people.filter((p) => personBand(p, weekly) === band) : people), [people, band, weekly]);

  // Quadro-resumo: situação das pessoas em cada departamento
  const deptRows = useMemo(() => {
    const map = new Map<string, PersonWeek[]>();
    (all?.people ?? []).forEach((p) => deptsOf(p).forEach((d) => map.set(d, [...(map.get(d) ?? []), p])));
    return [...map.entries()]
      .map(([name, ppl]) => ({ name, c: countBands(ppl, weekly), total: ppl.length }))
      .sort((a, b) => (b.c.ringValue ?? -1) - (a.c.ringValue ?? -1) || a.name.localeCompare(b.name));
  }, [all, weekly]);

  const emails = useMemo(() => {
    const set = new Set<string>();
    weeks.forEach((w) => w.people.forEach((p) => { if (p.email && (dept === 'all' || deptsOf(p).includes(dept))) set.add(p.email.toLowerCase().trim()); }));
    return set;
  }, [weeks, dept]);

  if (loading) return <div className="h-64 rounded-3xl bg-muted animate-pulse" />;
  if (!currentWeek || !segmented) return null;

  const headline = weekly ? (segmented.groupName ? `na ${segmented.groupName}` : `na semana de ${formatBR(segmented.refDate)}`) : `${segmented.granularity === 'monthly' ? 'em' : 'no'} ${segmented.periodName}`;

  return (
    <div className="space-y-5">
      <SegmentBar
        projects={[]} project="all" onProject={() => undefined} projectsInScope={0} hideProject
        departments={departments} dept={dept} onDept={(d) => { setDept(d); setBand(null); }}
        granularity={granularity} onGranularityChange={onGranularityChange}
        weeks={weeks} weekKey={currentWeek.weekKey} onWeek={setWeekKey}
        periodOptions={period.options} periodKey={selectedPeriodKey} onPeriod={onPeriodChange}
      />

      {!weekly && <PeriodInfoLine period={period.selected} weeksCount={weeksCount} />}

      <CollapsibleCard title="Evolução semanal do engajamento da DGPE" subtitle="% das pessoas engajadas em cada semana e média acumulada">
        <WeeklyTrendChart
          data={engagementSeries(weeks, dept === 'all' ? undefined : (p) => deptsOf(p).includes(dept))}
          barName="% engajada na semana" lineName="Média acumulada" percent
        />
      </CollapsibleCard>

      <HeroScoreCard
        weekly={weekly}
        headlinePeriod={headline}
        periodPhrase={weekly ? `na semana de ${formatBR(segmented.refDate)}` : headline}
        scopePhrase={dept === 'all' ? 'da DGPE' : `de ${dept}`}
        counts={counts}
        averageProjectsScore={null}
        empty={!weekly && weeksCount === 0}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ClassificationCard weekly={weekly} counts={counts} selected={band} onSelect={setBand} />
        <ProjectBarsCard
          projects={all?.departments ?? []} selected={dept} onSelect={setDept}
          kicker="Por departamento" title="Engajamento por departamento" hint="Média das pessoas de cada departamento · clique para segmentar"
          unit="departamentos" rawNames
        />
      </div>

      <CollapsibleCard title="Situação por departamento" subtitle={weekly ? 'Desengajado: mais de 7 dias sem acesso · Inativo: mais de 30 dias' : 'Faixas de score no período'}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 pr-3 font-medium">Departamento</th>
                <th className="px-3 py-2 text-right font-medium">Pessoas</th>
                {(weekly ? ['engaged', 'not_engaged', 'inactive'] : ['high', 'medium', 'low']).map((b) => (
                  <th key={b} className="px-3 py-2 text-right font-medium">{BAND_LABELS[b as ScoreBand]}</th>
                ))}
                <th className="px-3 py-2 text-right font-medium">Afastados</th>
                <th className="py-2 pl-3 text-right font-medium">{weekly ? '% engajada' : 'Score médio'}</th>
              </tr>
            </thead>
            <tbody>
              {deptRows.map((r) => (
                <tr key={r.name} onClick={() => setDept(dept === r.name ? 'all' : r.name)}
                  className={`cursor-pointer border-b border-border/60 last:border-0 hover:bg-muted/50 ${dept === r.name ? 'bg-[hsl(var(--brand-sky))]' : ''}`}>
                  <td className="py-2 pr-3 text-foreground">{r.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.total}</td>
                  {(weekly ? [r.c.engaged, r.c.notEngaged, r.c.inactive] : [r.c.high, r.c.medium, r.c.low]).map((v, i) => (
                    <td key={i} className="px-3 py-2 text-right tabular-nums">{v}</td>
                  ))}
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{r.c.away}</td>
                  <td className="py-2 pl-3 text-right font-medium tabular-nums">{r.c.ringValue === null ? '—' : `${r.c.ringValue}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CollapsibleCard>

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
        emails={emails} scopeText={dept === 'all' ? 'toda a DGPE' : dept} />

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
