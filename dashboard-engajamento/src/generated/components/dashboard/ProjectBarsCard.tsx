import { FolderKanban } from 'lucide-react';
import type { GroupStat } from '@generated/lib/engagementMetrics';
import { readableProjectName } from '@generated/lib/dashboardTheme';

interface Props {
  projects: GroupStat[];
  selected: string;
  onSelect: (name: string) => void;
  kicker?: string;
  title?: string;
  hint?: string;
  unit?: string; // "projetos", "gerentes", "departamentos"
  rawNames?: boolean; // não tira o código SGI do nome
}

export function ProjectBarsCard({ projects, selected, onSelect, kicker = 'Por projeto', title = 'Score por projeto ativo', hint = 'Do maior para o menor score · clique para segmentar', unit = 'projetos', rawNames = false }: Props) {
  // Já vem ordenado do maior para o menor score
  return (
    <section className="rounded-3xl bg-card soft-stack-card p-6 min-w-0 flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{kicker}</p>
          <h3 className="mt-1 text-lg font-medium tracking-[-0.015em] text-[hsl(var(--brand-navy))]">{title}</h3>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">{projects.length} {unit}</span>
      </div>

      {projects.length === 0 ? (
        <div className="flex-1 grid place-items-center py-10 text-center">
          <div className="space-y-2">
            <FolderKanban className="w-8 h-8 mx-auto text-muted-foreground/60" strokeWidth={1.5} />
            <p className="text-xs text-muted-foreground">Sem pessoas classificadas neste período</p>
          </div>
        </div>
      ) : (
        <div className="mt-5 space-y-3 max-h-[420px] overflow-y-auto pr-1">
          {projects.map((proj) => {
            const score = proj.averageScore ?? 0;
            const active = selected === proj.name;
            const tooltip = [
              proj.name,
              proj.projectInfo?.status ? `Status: ${proj.projectInfo.status}` : '',
              proj.projectInfo?.managers?.length ? `Gerente: ${proj.projectInfo.managers.join(', ')}` : '',
              proj.scoreText,
            ]
              .filter(Boolean)
              .join('\n');
            return (
              <button
                key={proj.name}
                type="button"
                title={tooltip}
                aria-label={`${proj.name}: ${proj.averageScore === null ? 'sem dados' : `${proj.averageScore}%`}, ${proj.totalPeople} pessoas`}
                aria-pressed={active}
                onClick={() => onSelect(active ? 'all' : proj.name)}
                className={`w-full text-left rounded-xl px-2 py-1.5 transition-colors ${active ? 'bg-[hsl(var(--brand-sky))]' : 'hover:bg-[hsl(var(--brand-sky-2))]'}`}
              >
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="truncate text-[hsl(var(--brand-navy))] font-medium">{rawNames ? proj.name : readableProjectName(proj.name)}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                    {proj.totalPeople} {proj.totalPeople === 1 ? 'pessoa' : 'pessoas'}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[hsl(var(--brand-navy)/0.3)] to-[hsl(var(--brand-navy))] transition-[width] duration-500"
                      style={{ width: `${score}%` }}
                    />
                  </div>
                  <span className="w-10 text-right text-xs font-medium tabular-nums text-[hsl(var(--brand-navy))]">
                    {proj.averageScore === null ? '—' : `${proj.averageScore}%`}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
