import { useMemo, useState } from 'react';
import { ChevronDown, Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@components/ui/popover';
import { Checkbox } from '@components/ui/checkbox';
import type { ProjectDoc } from '@generated/models';
import { axesOf, NO_AXIS, type IntelConfig } from '@generated/lib/intel';
import { norm } from '@generated/lib/fields';
import { cn } from '@lib/utils';

function Multi({ label, all, value, onChange, opts }: { label: string; all: string; value: string[]; onChange: (v: string[]) => void; opts: { v: string; l: string }[] }) {
  const [q, setQ] = useState('');
  const shown = q ? opts.filter((o) => norm(o.l).includes(norm(q))) : opts;
  const txt = value.length === 0 ? all : value.length === 1 ? opts.find((o) => o.v === value[0])?.l ?? '1' : `${value.length} selecionados`;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <Popover>
        <PopoverTrigger asChild>
          <button className="flex h-10 min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-card px-2 text-left text-sm"><span className="truncate">{txt}</span><ChevronDown className="size-4 opacity-60" aria-hidden /></button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 p-1">
          <button onClick={() => onChange([])} className="flex w-full items-center gap-2 rounded px-2 py-2 text-sm hover:bg-muted"><Checkbox checked={value.length === 0} />{all}</button>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar" aria-label={`Pesquisar ${label}`} className="my-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm" />
          <div className="max-h-72 overflow-y-auto">
            {shown.map((o) => (
              <button key={o.v} onClick={() => onChange(value.includes(o.v) ? value.filter((x) => x !== o.v) : [...value, o.v])} className="flex w-full items-start gap-2 rounded px-2 py-2 text-left text-sm hover:bg-muted">
                <Checkbox checked={value.includes(o.v)} className="mt-0.5" /><span className="min-w-0 break-words">{o.l}</span>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function ConfigStep({ projects, cfg, setCfg, onNext }: { projects: ProjectDoc[]; cfg: IntelConfig; setCfg: (c: IntelConfig) => void; onNext: () => void }) {
  const axes = useMemo(() => [...new Set(projects.flatMap(axesOf))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [projects]);
  const num = (v: string) => Math.max(1, Math.min(999, Number(v) || 1));
  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Multi label="Projetos" all="Todos os projetos habilitados" value={cfg.projects} onChange={(v) => setCfg({ ...cfg, projects: v })} opts={projects.map((p) => ({ v: p.boardId, l: p.name }))} />
        <Multi label="Eixos de atuação" all="Todos os eixos" value={cfg.axes} onChange={(v) => setCfg({ ...cfg, axes: v })} opts={[...axes.map((a) => ({ v: a, l: a })), { v: NO_AXIS, l: 'Sem eixo informado' }]} />
        <div className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Tipo de indicador</span>
          <div className="flex h-10 rounded-md border border-border p-0.5" role="group" aria-label="Tipo de indicador">
            {(['all', 'KR', 'KPI'] as const).map((t) => (
              <button key={t} onClick={() => setCfg({ ...cfg, tipo: t })} aria-pressed={cfg.tipo === t} className={cn('flex-1 rounded text-sm', cfg.tipo === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}>{t === 'all' ? 'Todos' : t}</button>
            ))}
          </div>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Prazo de Medição — de (opcional)</span>
          <input type="date" value={cfg.from} onChange={(e) => setCfg({ ...cfg, from: e.target.value })} className="h-10 rounded-md border border-input bg-background px-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">até (opcional)</span>
          <input type="date" value={cfg.to} onChange={(e) => setCfg({ ...cfg, to: e.target.value })} className="h-10 rounded-md border border-input bg-background px-2 text-sm" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Mín. medições avaliáveis</span>
            <input type="number" min={1} value={cfg.minMeds} onChange={(e) => setCfg({ ...cfg, minMeds: num(e.target.value) })} className="h-10 rounded-md border border-input bg-background px-2 text-sm" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Mín. projetos</span>
            <input type="number" min={1} value={cfg.minProj} onChange={(e) => setCfg({ ...cfg, minProj: num(e.target.value) })} className="h-10 rounded-md border border-input bg-background px-2 text-sm" />
          </label>
        </div>
      </div>
      <ul className="space-y-1.5 rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">
        <li className="flex gap-2"><Info className="mt-0.5 size-3.5 shrink-0" aria-hidden /><span><b className="text-foreground">Medições atrasadas contam como metas não alcançadas</b> na taxa principal B/(B+C+D), e aparecem também separadas.</span></li>
        <li className="flex gap-2"><Info className="mt-0.5 size-3.5 shrink-0" aria-hidden /><span>O relatório inclui a análise geral e o detalhamento por eixo. Os mínimos destacam grupos nos rankings e não garantem significância estatística.</span></li>
        {cfg.axes.length > 0 && <li className="flex gap-2 text-[hsl(var(--warn))]"><Info className="mt-0.5 size-3.5 shrink-0" aria-hidden /><span>Com filtro de eixo, a análise geral corresponde à <b>carteira selecionada</b>, não necessariamente à carteira completa.</span></li>}
      </ul>
      <div className="flex justify-end"><button onClick={onNext} className="min-h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">Continuar para classificação</button></div>
    </section>
  );
}
