import { useState, type ReactNode } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@components/ui/popover';
import { Checkbox } from '@components/ui/checkbox';
import { MetaFilters } from '@generated/components/MetaFilters';
import { norm } from '@generated/lib/fields';
import { EMPTY_GLOBAL, uniq, type GlobalFilter } from '@generated/lib/ops';
import type { ProjectDoc } from '@generated/models';

export const fieldLbl = 'text-[11px] uppercase tracking-wide text-muted-foreground';
export const ctl = 'h-10 min-w-0 rounded-md border border-input bg-card px-2 text-sm';

export function Sel({ label, value, options, onChange, all = 'Todos' }: { label: string; value: string; options: string[]; onChange: (v: string) => void; all?: string }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className={fieldLbl}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={ctl}>
        <option value="">{all}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function ProjectPicker({ projects, value, onChange }: { projects: ProjectDoc[]; value: string[]; onChange: (v: string[]) => void }) {
  const [q, setQ] = useState('');
  const list = q ? projects.filter((p) => norm(p.name).includes(norm(q))) : projects;
  const txt = value.length === 0 ? 'Todos os projetos' : value.length === 1 ? projects.find((p) => p.boardId === value[0])?.name ?? '1 projeto' : `${value.length} projetos`;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className={fieldLbl}>Projeto</span>
      <Popover>
        <PopoverTrigger asChild>
          <button className="flex h-10 min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-card px-2 text-left text-sm"><span className="truncate">{txt}</span><ChevronDown className="size-4 shrink-0 opacity-60" aria-hidden /></button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 p-1">
          <button onClick={() => onChange([])} className="flex w-full items-center gap-2 rounded px-2 py-2 text-sm hover:bg-muted"><Checkbox checked={value.length === 0} /> Todos os projetos</button>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar projeto" aria-label="Pesquisar projeto" className="my-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm" />
          <div className="max-h-72 overflow-y-auto">
            {list.length === 0 && <p className="px-2 py-3 text-sm text-muted-foreground">Nenhum projeto encontrado.</p>}
            {list.map((p) => (
              <button key={p.boardId} onClick={() => onChange(value.includes(p.boardId) ? value.filter((x) => x !== p.boardId) : [...value, p.boardId])} className="flex w-full items-start gap-2 rounded px-2 py-2 text-left text-sm hover:bg-muted">
                <Checkbox checked={value.includes(p.boardId)} className="mt-0.5" /><span className="min-w-0 break-words">{p.name}</span>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** Filtros comuns ao Painel gerencial e aos Dados tabulados. `children` = filtros específicos da aba. */
export function GlobalFilters({ projects, f, setF, periodLabel = 'Período', children, onClear, dirty, hideWorkspace, hidePeriod }: {
  projects: ProjectDoc[]; f: GlobalFilter; setF: (f: GlobalFilter) => void; periodLabel?: string; children?: ReactNode; onClear?: () => void; dirty?: boolean; hideWorkspace?: boolean; hidePeriod?: boolean;
}) {
  const active = dirty || JSON.stringify(f) !== JSON.stringify(EMPTY_GLOBAL);
  return (
    <div className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-card p-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
      <ProjectPicker projects={projects} value={f.projects} onChange={(v) => setF({ ...f, projects: v })} />
      {!hideWorkspace && <Sel label="Área de trabalho" value={f.workspace} options={uniq(projects.map((p) => p.workspaceName))} onChange={(v) => setF({ ...f, workspace: v })} all="Todas" />}
      <MetaFilters projects={projects} value={f.meta} onChange={(meta) => setF({ ...f, meta })} />
      {!hidePeriod && <div className="flex min-w-0 flex-col gap-1">
        <span className={fieldLbl}>{periodLabel}</span>
        <div className="flex min-w-0 items-center gap-1">
          <input type="date" aria-label="Data inicial" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} className={`${ctl} flex-1`} />
          <span className="text-muted-foreground">–</span>
          <input type="date" aria-label="Data final" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} className={`${ctl} flex-1`} />
        </div>
      </div>}
      {children}
      <div className="flex items-end">
        <button disabled={!active} onClick={() => { setF(EMPTY_GLOBAL); onClear?.(); }} className="flex h-10 items-center gap-1 rounded-md px-3 text-sm text-muted-foreground hover:bg-muted disabled:opacity-40"><X className="size-4" aria-hidden /> Limpar</button>
      </div>
    </div>
  );
}
