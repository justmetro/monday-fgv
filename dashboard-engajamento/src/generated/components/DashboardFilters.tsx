import { X, CheckSquare, Square } from 'lucide-react';
import type { GroupStat } from '@generated/lib/engagementMetrics';
import type { StoredProjectItem as ActiveProject } from '@generated/models';
import { SearchableSelect } from './SearchableSelect';

interface Props {
  departments: GroupStat[];
  projects: GroupStat[];
  managers: GroupStat[];
  activeProjectsList: ActiveProject[];
  dept: string;
  project: string;
  manager: string;
  onlyWithProjects: boolean;
  onDept: (v: string) => void;
  onProject: (v: string) => void;
  onManager: (v: string) => void;
  onToggleOnlyWithProjects: (v: boolean) => void;
  onReset: () => void;
}

export function DashboardFilters({
  departments,
  projects,
  managers,
  dept,
  project,
  manager,
  onlyWithProjects,
  onDept,
  onProject,
  onManager,
  onToggleOnlyWithProjects,
  onReset,
}: Props) {
  const filtered = dept !== 'all' || project !== 'all' || manager !== 'all' || onlyWithProjects;

  const managerOptions = managers.map((m) => ({
    value: m.name,
    label: m.name,
    count: m.total,
    rate: m.rate,
  }));

  const projectOptions = [
    {
      value: '__only_with_projects__',
      label: '⚡ Apenas com algum Projeto Ativo',
      subtitle: 'Exclui todas as pessoas sem projeto',
    },
    ...projects.map((p) => ({
      value: p.name,
      label: p.name,
      subtitle: p.projectInfo?.status ? `Status: ${p.projectInfo.status}` : undefined,
      count: p.total,
      rate: p.rate,
    })),
  ];

  const departmentOptions = departments.map((d) => ({
    value: d.name,
    label: d.name,
    count: d.total,
    rate: d.rate,
  }));

  const handleProjectChange = (val: string) => {
    if (val === '__only_with_projects__') {
      onToggleOnlyWithProjects(true);
      onProject('all');
    } else {
      onProject(val);
    }
  };

  const currentProjectValue = onlyWithProjects && project === 'all' ? '__only_with_projects__' : project;

  return (
    <div className="bg-card rounded-lg p-3 sm:p-4 soft-stack-card flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground whitespace-nowrap">
          Filtros com busca:
        </span>

        {/* Filtro por Gerente */}
        <SearchableSelect
          id="filter-manager"
          ariaLabel="Filtrar por gerente"
          value={manager}
          onChange={onManager}
          options={managerOptions}
          allLabel={`Todos os gerentes (${managers.length})`}
          searchPlaceholder="Escreva o nome do gerente..."
        />

        {/* Filtro por Projeto Ativo */}
        <SearchableSelect
          id="filter-project"
          ariaLabel="Filtrar por projeto ativo"
          value={currentProjectValue}
          onChange={handleProjectChange}
          options={projectOptions}
          allLabel={`Todos os projetos ativos (${projects.length})`}
          searchPlaceholder="Escreva o nome ou sigla do projeto..."
        />

        {/* Filtro por Departamento */}
        <SearchableSelect
          id="filter-dept"
          ariaLabel="Filtrar por departamento"
          value={dept}
          onChange={onDept}
          options={departmentOptions}
          allLabel={`Todos os departamentos (${departments.length})`}
          searchPlaceholder="Escreva o departamento..."
        />

        {/* Caixa seletora / Switch para restringir exclusivamente a pessoas em projetos ativos */}
        <button
          type="button"
          onClick={() => onToggleOnlyWithProjects(!onlyWithProjects)}
          className={`h-10 px-3 text-xs rounded border transition-colors inline-flex items-center gap-2 ${
            onlyWithProjects
              ? 'bg-primary/10 border-primary text-primary font-medium'
              : 'bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted/40'
          }`}
        >
          {onlyWithProjects ? (
            <CheckSquare className="w-4 h-4 text-primary shrink-0" />
          ) : (
            <Square className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
          <span>Apenas vinculados a projetos ativos</span>
        </button>
      </div>

      {filtered && (
        <button
          onClick={onReset}
          className="h-9 px-3 text-xs rounded border border-border bg-muted/60 hover:bg-muted text-foreground inline-flex items-center gap-1.5 transition-colors self-start sm:self-auto"
        >
          <X className="w-3.5 h-3.5" /> Limpar filtros
        </button>
      )}
    </div>
  );
}
