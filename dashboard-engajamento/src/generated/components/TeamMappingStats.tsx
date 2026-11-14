import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { StoredProjectItem } from '@generated/models';
import type { ProjectsInfo } from '@generated/server/storage';

interface Props {
  activeProjects: StoredProjectItem[];
  withTeamCount: number;
  withoutTeam: StoredProjectItem[];
  outsideCount: number;
  info: ProjectsInfo | undefined;
  outsideFilter: boolean;
  onToggleOutside: () => void;
  onAddTeam: (project: string, team: string) => Promise<boolean>;
  busyKey: string | null;
}

const fmtDateTime = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};

function Big({ value, label, onClick, active }: { value: number; label: string; onClick?: () => void; active?: boolean }) {
  const body = (
    <>
      <span className="block text-3xl sm:text-4xl font-light tracking-[-0.03em] tabular-nums text-[hsl(var(--brand-navy))]">{value}</span>
      <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-[hsl(var(--brand-navy)/0.65)]">{label}</span>
    </>
  );
  const base = 'rounded-2xl border p-4 text-left min-w-0';
  if (!onClick) return <div className={`${base} border-border bg-card`}>{body}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`${base} transition-colors ${active ? 'border-[hsl(var(--brand-navy)/0.5)] bg-[hsl(var(--brand-sky))]' : 'border-border bg-card hover:bg-[hsl(var(--brand-sky-2))]'}`}
    >
      {body}
    </button>
  );
}

export function TeamMappingStats({ activeProjects, withTeamCount, withoutTeam, outsideCount, info, outsideFilter, onToggleOutside, onAddTeam, busyKey }: Props) {
  const [showWithout, setShowWithout] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const noProjects = (info?.savedCount ?? activeProjects.length) === 0;

  if (noProjects) {
    return (
      <section className="rounded-3xl bg-card border border-border p-5 text-sm text-muted-foreground">Sem projetos importados</section>
    );
  }

  return (
    <section className="rounded-3xl bg-gradient-to-br from-[hsl(var(--brand-sky))] to-[hsl(var(--brand-sky-2))] border border-border p-5 space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Big value={activeProjects.length} label="Projetos ativos" />
        <Big value={withTeamCount} label="Com equipe mapeada" />
        <Big value={withoutTeam.length} label="Sem equipe mapeada" onClick={() => setShowWithout((v) => !v)} active={showWithout} />
        <Big value={outsideCount} label="Mapeamentos para projeto fora dos ativos" onClick={onToggleOutside} active={outsideFilter} />
      </div>
      <p className="text-xs text-[hsl(var(--brand-navy)/0.75)]">
        Última importação dos projetos: <strong>{info?.importedAt ? fmtDateTime(info.importedAt) : 'data não registrada (importação antiga)'}</strong>
      </p>

      {showWithout && (
        <div className="rounded-2xl bg-card border border-border">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h4 className="text-sm font-medium text-foreground">Projetos ativos sem equipe mapeada ({withoutTeam.length})</h4>
            <button type="button" aria-label="Fechar lista" onClick={() => setShowWithout(false)} className="p-1.5 rounded hover:bg-muted text-muted-foreground"><X className="w-4 h-4" /></button>
          </div>
          {withoutTeam.length === 0 ? (
            <p className="p-4 text-xs text-muted-foreground">Todos os projetos ativos têm equipe mapeada.</p>
          ) : (
            <ul className="divide-y divide-border max-h-96 overflow-y-auto">
              {withoutTeam.map((p) => {
                const draft = drafts[p.name] ?? '';
                return (
                  <li key={p.id || p.name} className="px-4 py-3 grid grid-cols-1 md:grid-cols-12 gap-2 md:items-center text-xs">
                    <div className="md:col-span-5 min-w-0">
                      <p className="font-medium text-foreground break-words">{p.name}</p>
                      <p className="text-muted-foreground">{p.status || 'Sem status'}</p>
                    </div>
                    <input
                      value={draft}
                      onChange={(e) => setDrafts((d) => ({ ...d, [p.name]: e.target.value }))}
                      placeholder="Nome completo da equipe (ex: [MA] SEMAG)"
                      aria-label={`Equipe do projeto ${p.name}`}
                      className="md:col-span-5 h-9 px-3 rounded border border-border bg-background text-foreground"
                    />
                    <button
                      type="button"
                      disabled={!draft.trim() || busyKey === `proj:${p.name}`}
                      onClick={async () => {
                        const ok = await onAddTeam(p.name, draft.trim());
                        if (ok) setDrafts((d) => ({ ...d, [p.name]: '' }));
                      }}
                      className="md:col-span-2 h-9 px-3 rounded bg-primary text-primary-foreground font-medium disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" /> Adicionar
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
