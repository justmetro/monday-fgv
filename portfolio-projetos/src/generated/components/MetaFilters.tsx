import { useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@components/ui/popover';
import { Checkbox } from '@components/ui/checkbox';
import type { ProjectDoc } from '@generated/models';
import { metaOptions, NO_LINK, NONE, type MetaFilter } from '@generated/lib/history';

function Multi({ label, value, options, onChange }: { label: string; value: string[]; options: string[]; onChange: (v: string[]) => void }) {
  const all = [...options.map((o) => ({ v: o, l: o })), { v: NONE, l: 'Não informado' }, { v: NO_LINK, l: 'Sem vínculo com o Histórico' }];
  const txt = value.length === 0 ? 'Todos' : value.length === 1 ? all.find((o) => o.v === value[0])?.l ?? '1 selecionado' : `${value.length} selecionados`;
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <Popover>
        <PopoverTrigger asChild>
          <button className="flex h-10 min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-card px-2 text-left text-sm">
            <span className="truncate">{txt}</span><ChevronDown className="size-4 shrink-0 opacity-60" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-1">
          <button onClick={() => onChange([])} className="flex w-full items-center gap-2 rounded px-2 py-2 text-sm hover:bg-muted"><Checkbox checked={value.length === 0} />Todos</button>
          <div className="my-1 h-px bg-border" />
          <div className="max-h-72 overflow-y-auto">
            {all.map((o) => (
              <button key={o.v} onClick={() => toggle(o.v)} className="flex w-full items-start gap-2 rounded px-2 py-2 text-left text-sm hover:bg-muted">
                <Checkbox checked={value.includes(o.v)} className="mt-0.5" /><span className={o.v.startsWith('__') ? 'italic text-muted-foreground' : ''}>{o.l}</span>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** Filtros por Status do Projeto, Gerente e Eixo (cadastro do Histórico). */
export function MetaFilters({ projects, value, onChange }: { projects: ProjectDoc[]; value: MetaFilter; onChange: (v: MetaFilter) => void }) {
  const opts = useMemo(() => metaOptions(projects), [projects]);
  return (
    <>
      <Multi label="Status do Projeto" value={value.status} options={opts.status} onChange={(v) => onChange({ ...value, status: v })} />
      <Multi label="Gerente" value={value.manager} options={opts.manager} onChange={(v) => onChange({ ...value, manager: v })} />
      <Multi label="Eixo de atuação" value={value.axis} options={opts.axis} onChange={(v) => onChange({ ...value, axis: v })} />
    </>
  );
}
