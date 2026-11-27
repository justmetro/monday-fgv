import { Layers } from 'lucide-react';
import type { StoredProjectItem } from '@generated/models';
import type { WeekSummary } from '@generated/lib/engagementMetrics';
import { GRANULARITIES, formatBR, type TimeGranularity } from '@generated/lib/dates';
import { readableProjectName } from '@generated/lib/dashboardTheme';
import type { PeriodOption } from '@generated/lib/periods';
import { SearchableSelect } from '../SearchableSelect';

interface Props {
  projects: StoredProjectItem[];
  project: string;
  onProject: (v: string) => void;
  departments: string[];
  dept: string;
  onDept: (v: string) => void;
  projectsInScope: number;
  granularity: TimeGranularity;
  onGranularityChange: (g: TimeGranularity) => void;
  weeks: WeekSummary[];
  weekKey: string;
  onWeek: (k: string) => void;
  periodOptions: PeriodOption[];
  periodKey: string;
  onPeriod: (k: string) => void;
  hideProject?: boolean; // aba DGPE: só departamento
}

export function SegmentBar({
  projects,
  project,
  onProject,
  departments,
  dept,
  onDept,
  projectsInScope,
  granularity,
  onGranularityChange,
  weeks,
  weekKey,
  onWeek,
  periodOptions,
  periodKey,
  onPeriod,
  hideProject = false,
}: Props) {
  const projectText = project === 'all' ? `Todos os ${projectsInScope} projetos` : readableProjectName(project);
  const summary = hideProject ? (dept === 'all' ? 'Toda a DGPE' : dept) : dept === 'all' ? projectText : `${projectText} · ${dept}`;

  return (
    <section className="rounded-3xl bg-card soft-stack-card p-4 sm:p-5 flex flex-col xl:flex-row xl:items-center gap-4 justify-between">
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-10 h-10 rounded-2xl bg-[hsl(var(--brand-sky))] text-[hsl(var(--brand-navy))] grid place-items-center shrink-0">
          <Layers className="w-4 h-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{hideProject ? 'Segmentar por departamento' : 'Segmentar por projeto e departamento'}</p>
          <p className="text-sm font-medium text-[hsl(var(--brand-navy))] truncate" title={project === 'all' ? summary : `${project}${dept === 'all' ? '' : ` · ${dept}`}`}>
            {summary}
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3 min-w-0">
        <div className="flex items-center gap-1 p-1 rounded-full bg-[hsl(var(--brand-sky-2))] border border-border overflow-x-auto">
          {GRANULARITIES.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => onGranularityChange(g.id)}
              className={`h-9 px-3.5 text-xs rounded-full whitespace-nowrap transition-colors ${
                granularity === g.id
                  ? 'bg-[hsl(var(--brand-navy))] text-card font-medium shadow-sm'
                  : 'text-muted-foreground hover:text-[hsl(var(--brand-navy))]'
              }`}
            >
              {g.shortLabel}
            </button>
          ))}
        </div>

        {granularity === 'weekly' ? (
          <SearchableSelect
            id="segment-week"
            ariaLabel="Data de análise"
            value={weekKey}
            onChange={onWeek}
            showAllOption={false}
            options={weeks
              .slice()
              .reverse()
              .map((w) => ({ value: w.weekKey, label: `Análise: ${formatBR(w.refDate)}`, subtitle: w.periodName }))}
            placeholder="Data de análise"
            searchPlaceholder="Buscar data..."
            buttonClassName="h-10 min-w-[190px] rounded-full"
          />
        ) : (
          <SearchableSelect
            id="segment-period"
            ariaLabel="Período avaliado"
            value={periodKey}
            onChange={onPeriod}
            showAllOption={false}
            options={periodOptions.map((o) => ({ value: o.key, label: o.label, subtitle: o.rangeText }))}
            placeholder="Período"
            searchPlaceholder="Buscar período..."
            buttonClassName="h-10 min-w-[150px] rounded-full"
          />
        )}

        {!hideProject && <SearchableSelect
          id="segment-project"
          ariaLabel="Segmentar por projeto"
          value={project}
          onChange={onProject}
          allLabel="Todos os projetos"
          options={projects.map((p) => ({ value: p.name, label: readableProjectName(p.name), subtitle: p.name }))}
          searchPlaceholder="Buscar projeto ou SGI..."
          buttonClassName="h-10 w-full sm:w-64 rounded-full"
          dropdownClassName="w-full sm:w-96"
        />}

        <SearchableSelect
          id="segment-dept"
          ariaLabel="Segmentar por departamento"
          value={dept}
          onChange={onDept}
          allLabel="Todos os departamentos"
          options={departments}
          searchPlaceholder="Buscar departamento..."
          buttonClassName="h-10 w-full sm:w-56 rounded-full"
          dropdownClassName="w-full sm:w-80"
        />
      </div>
    </section>
  );
}
