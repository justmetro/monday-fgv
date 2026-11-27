import { useMemo, useState } from 'react';
import { Search, X, CheckSquare, Square } from 'lucide-react';
import type { WeekSummary } from '@generated/lib/engagementMetrics';
import { formatBR } from '@generated/lib/dates';
import { SearchableSelect } from './SearchableSelect';

interface Props {
  week: WeekSummary;
  dept: string;
  project: string;
  manager: string;
  onlyWithProjects?: boolean;
  onDept: (v: string) => void;
  onProject: (v: string) => void;
  onManager: (v: string) => void;
  onToggleOnlyWithProjects?: (v: boolean) => void;
}

const PAGE = 50;

export function PeopleTable({
  week,
  dept,
  project,
  manager,
  onlyWithProjects = false,
  onDept,
  onProject,
  onManager,
  onToggleOnlyWithProjects,
}: Props) {
  const [term, setTerm] = useState('');
  const [status, setStatus] = useState<'all' | 'yes' | 'no'>('all');
  const [visible, setVisible] = useState(PAGE);

  const list = useMemo(() => {
    const t = term.trim().toLowerCase();
    return week.people.filter((p) => {
      if (status === 'yes' && !p.engaged) return false;
      if (status === 'no' && p.engaged) return false;
      if (onlyWithProjects && p.activeProjects.length === 0) return false;
      if (dept !== 'all' && !p.departments.includes(dept)) return false;
      if (project !== 'all' && !p.activeProjects.includes(project)) return false;
      if (manager !== 'all' && !p.managers.includes(manager)) return false;
      if (
        t &&
        !`${p.name} ${p.email} ${p.teams.join(' ')} ${p.activeProjects.join(' ')} ${p.managers.join(' ')}`
          .toLowerCase()
          .includes(t)
      ) {
        return false;
      }
      return true;
    });
  }, [week, term, status, dept, project, manager, onlyWithProjects]);

  const filtered =
    dept !== 'all' ||
    project !== 'all' ||
    manager !== 'all' ||
    status !== 'all' ||
    term !== '' ||
    onlyWithProjects;

  const managerOptions = week.managers.map((m) => ({
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
    ...week.projects.map((p) => ({
      value: p.name,
      label: p.name,
      count: p.total,
      rate: p.rate,
    })),
  ];

  const deptOptions = week.departments.map((d) => ({
    value: d.name,
    label: d.name,
    count: d.total,
    rate: d.rate,
  }));

  const statusOptions = [
    { value: 'yes', label: 'Engajados na semana' },
    { value: 'no', label: 'Desengajados e inativos' },
  ];

  const handleProjectChange = (val: string) => {
    if (val === '__only_with_projects__') {
      if (onToggleOnlyWithProjects) onToggleOnlyWithProjects(true);
      onProject('all');
    } else {
      onProject(val);
    }
  };

  const currentProjectValue = onlyWithProjects && project === 'all' ? '__only_with_projects__' : project;

  return (
    <section className="bg-card rounded-lg soft-stack-card overflow-hidden">
      <div className="p-4 border-b border-border flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
        <div>
          <h3 className="text-lg font-normal tracking-[-0.025em] text-foreground">
            Colaboradores analisados
          </h3>
          <p className="text-xs text-muted-foreground">
            {list.length} pessoa(s) única(s) · zero dupla contagem
            {onlyWithProjects && <span> · exibindo apenas pessoas vinculadas a projetos ativos</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Busca textual livre por qualquer termo */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Buscar por pessoa, e-mail..."
              aria-label="Buscar pessoa, e-mail"
              className="h-10 w-48 sm:w-56 text-xs pl-8 pr-2 rounded border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Filtro de Status com escrita/busca */}
          <SearchableSelect
            ariaLabel="Filtro de engajamento"
            value={status}
            onChange={(v) => setStatus(v as 'all' | 'yes' | 'no')}
            options={statusOptions}
            allLabel="Todos os status"
            searchPlaceholder="Filtrar status..."
            className="w-auto"
          />

          {/* Filtro de Gerente com escrita/busca */}
          <SearchableSelect
            ariaLabel="Filtro por gerente"
            value={manager}
            onChange={onManager}
            options={managerOptions}
            allLabel="Todos os gerentes"
            searchPlaceholder="Escrever gerente..."
            className="w-auto"
          />

          {/* Filtro de Projeto com escrita/busca */}
          <SearchableSelect
            ariaLabel="Filtro por projeto ativo"
            value={currentProjectValue}
            onChange={handleProjectChange}
            options={projectOptions}
            allLabel="Todos os projetos ativos"
            searchPlaceholder="Escrever projeto..."
            className="w-auto"
          />

          {/* Filtro de Departamento com escrita/busca */}
          <SearchableSelect
            ariaLabel="Filtro por departamento"
            value={dept}
            onChange={onDept}
            options={deptOptions}
            allLabel="Todos os departamentos"
            searchPlaceholder="Escrever departamento..."
            className="w-auto"
          />

          {/* Caixa seletora rápida na tabela */}
          {onToggleOnlyWithProjects && (
            <button
              type="button"
              onClick={() => onToggleOnlyWithProjects(!onlyWithProjects)}
              className={`h-10 px-2.5 text-xs rounded border inline-flex items-center gap-1.5 transition-colors ${
                onlyWithProjects
                  ? 'bg-primary/10 border-primary text-primary font-medium'
                  : 'bg-card border-border text-muted-foreground hover:text-foreground'
              }`}
              title="Exibir apenas colaboradores vinculados a algum projeto ativo"
            >
              {onlyWithProjects ? (
                <CheckSquare className="w-3.5 h-3.5 text-primary" />
              ) : (
                <Square className="w-3.5 h-3.5 text-muted-foreground" />
              )}
              <span>Com projeto</span>
            </button>
          )}

          {filtered && (
            <button
              onClick={() => {
                setTerm('');
                setStatus('all');
                onDept('all');
                onProject('all');
                onManager('all');
                if (onToggleOnlyWithProjects) onToggleOnlyWithProjects(false);
              }}
              className="h-10 px-3 text-xs rounded text-muted-foreground hover:text-foreground inline-flex items-center gap-1 border border-border hover:bg-muted"
            >
              <X className="w-3.5 h-3.5" /> Limpar
            </button>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted text-muted-foreground uppercase tracking-wider text-[10px]">
            <tr>
              {[
                'Pessoa',
                'Projetos Ativos',
                'Gerente(s)',
                'Departamentos',
                'Último acesso',
                'Engajamento',
              ].map((h) => (
                <th key={h} className="py-2.5 px-3 font-normal whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {list.slice(0, visible).map((p) => (
              <tr key={p.key} className="hover:bg-muted/40 align-top">
                <td className="py-2.5 px-3">
                  <div className="text-foreground font-normal">{p.name}</div>
                  <div className="text-muted-foreground text-[11px]">{p.email}</div>
                </td>
                <td className="py-2.5 px-3 text-foreground max-w-[280px]">
                  {p.activeProjects.length > 0 ? (
                    <div className="space-y-1">
                      {p.activeProjects.map((proj) => (
                        <div key={proj} className="truncate text-[11px]" title={proj}>
                          • {proj}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="py-2.5 px-3 text-foreground whitespace-nowrap">
                  {p.managers.length > 0 ? p.managers.join(', ') : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="py-2.5 px-3 text-muted-foreground max-w-[180px]">
                  {p.departments.join(', ') || '—'}
                </td>
                <td className="py-2.5 px-3 tabular-nums text-foreground whitespace-nowrap">
                  {formatBR(p.lastAccess)}
                </td>
                <td className="py-2.5 px-3">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-[11px] whitespace-nowrap ${
                      p.engaged
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground'
                    }`}
                  >
                    {p.engaged ? 'Engajado' : p.inactive ? 'Inativo' : 'Desengajado'}
                  </span>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-muted-foreground">
                  Nenhum colaborador encontrado com esses filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {visible < list.length && (
        <div className="p-3 border-t border-border text-center">
          <button
            onClick={() => setVisible((v) => v + PAGE)}
            className="h-10 px-4 text-xs rounded border border-border hover:bg-muted text-foreground"
          >
            Mostrar mais
          </button>
        </div>
      )}
    </section>
  );
}
