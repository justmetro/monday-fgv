import { useMemo, useState } from 'react';
import { norm } from '@generated/lib/fields';
import { ChevronDown, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@components/ui/popover';
import { Checkbox } from '@components/ui/checkbox';
import { MetaFilters } from '@generated/components/MetaFilters';
import { EMPTY_META } from '@generated/lib/history';
import { EMPTY_FILTERS, objetivosOf, type Filters, type Model } from '@generated/lib/metrics';

const uniq = (a: string[]) => [...new Set(a)].sort((x, y) => x.localeCompare(y, 'pt-BR'));

function Sel({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-10 min-w-0 rounded-md border border-input bg-card px-2 text-sm">
        <option value="">Todos</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

/** `scoped`: projeto, período e Histórico vêm dos filtros globais do Painel gerencial (campos ocultos aqui). */
export function FiltersBar({ model, f, setF, scoped }: { model: Model; f: Filters; setF: (f: Filters) => void; scoped?: boolean }) {
  const { ds } = model;
  const [pq, setPq] = useState('');
  const opts = useMemo(() => ({
    tipo: uniq(ds.indicators.map((i) => i.tipo ?? 'Sem tipo')),
    objetivo: uniq(ds.indicators.flatMap(objetivosOf)),
    statusMedicao: uniq(ds.measurements.map((m) => m.statusMedicao ?? 'Sem status')),
    statusMeta: uniq(ds.measurements.map((m) => m.statusMeta ?? 'Sem status')),
  }), [ds]);
  const projLabel = f.projects.length === 0 ? 'Todos os projetos' : f.projects.length === 1 ? model.projectBy.get(f.projects[0] ?? '')?.name ?? '1 projeto' : `${f.projects.length} projetos`;
  const toggle = (id: string) => setF({ ...f, projects: f.projects.includes(id) ? f.projects.filter((p) => p !== id) : [...f.projects, id] });
  const active = JSON.stringify(f) !== JSON.stringify(EMPTY_FILTERS);
  const pn = norm(pq);
  const projOpts = pn ? ds.projects.filter((p) => norm(p.name).includes(pn)) : ds.projects;

  return (
    <div className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-card p-3 sm:grid-cols-2 lg:grid-cols-5">
      <div className={scoped ? 'hidden' : 'flex min-w-0 flex-col gap-1'}>
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Projeto</span>
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex h-10 min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-card px-2 text-left text-sm">
              <span className="truncate">{projLabel}</span><ChevronDown className="size-4 shrink-0 opacity-60" aria-hidden />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-1">
            <button onClick={() => setF({ ...f, projects: [] })} className="flex w-full items-center gap-2 rounded px-2 py-2 text-sm hover:bg-muted">
              <Checkbox checked={f.projects.length === 0} /> Todos os projetos
            </button>
            <div className="my-1 h-px bg-border" />
            <input value={pq} onChange={(e) => setPq(e.target.value)} placeholder="Pesquisar projeto" aria-label="Pesquisar projeto" className="mb-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm" />
            <div className="max-h-72 overflow-y-auto">
              {projOpts.length === 0 && <p className="px-2 py-3 text-sm text-muted-foreground">Nenhum projeto encontrado.</p>}
              {projOpts.map((p) => (
                <button key={p.boardId} onClick={() => toggle(p.boardId)} className="flex w-full items-start gap-2 rounded px-2 py-2 text-left text-sm hover:bg-muted">
                  <Checkbox checked={f.projects.includes(p.boardId)} className="mt-0.5" /><span className="min-w-0 break-words">{p.name}</span>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <Sel label="Tipo de indicador" value={f.tipo} options={opts.tipo} onChange={(v) => setF({ ...f, tipo: v })} />
      <Sel label="Objetivo" value={f.objetivo} options={opts.objetivo} onChange={(v) => setF({ ...f, objetivo: v })} />
      <Sel label="Status Medição" value={f.statusMedicao} options={opts.statusMedicao} onChange={(v) => setF({ ...f, statusMedicao: v })} />
      <Sel label="Status da Meta" value={f.statusMeta} options={opts.statusMeta} onChange={(v) => setF({ ...f, statusMeta: v })} />
      <div className={scoped ? 'hidden' : 'flex min-w-0 flex-col gap-1'}>
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Período (Prazo de Medição)</span>
        <div className="flex min-w-0 items-center gap-1">
          <input type="date" aria-label="Data inicial" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} className="h-10 min-w-0 flex-1 rounded-md border border-input bg-card px-2 text-sm" />
          <span className="text-muted-foreground">–</span>
          <input type="date" aria-label="Data final" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} className="h-10 min-w-0 flex-1 rounded-md border border-input bg-card px-2 text-sm" />
        </div>
      </div>
      {!scoped && <MetaFilters projects={ds.projects} value={f.meta ?? EMPTY_META} onChange={(meta) => setF({ ...f, meta })} />}
      <div className="flex items-end">
        <button disabled={!active} onClick={() => setF(EMPTY_FILTERS)} className="flex h-10 items-center gap-1 rounded-md px-3 text-sm text-muted-foreground hover:bg-muted disabled:opacity-40">
          <X className="size-4" aria-hidden /> Limpar
        </button>
      </div>
    </div>
  );
}
