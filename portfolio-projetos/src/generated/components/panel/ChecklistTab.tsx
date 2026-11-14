import { useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, AlertTriangle, Download, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { buildDiagnosticCsv } from '@generated/lib/diagnostic-csv';
import { PautaDialog } from './PautaDialog';
import type { Model } from '@generated/lib/metrics';
import type { OpsModel } from '@generated/lib/ops';
import { AREAS, buildChecklist, type Check } from '@generated/lib/checklist';
import { SearchSelect } from '../SearchSelect';
import { Panel } from '../ui-bits';
import { cn } from '@lib/utils';

function CheckRow({ c, name, open, toggle }: { c: Check; name: (id: string) => string; open: boolean; toggle: () => void }) {
  const n = c.cases.length;
  const [shut, setShut] = useState<Set<string>>(new Set());
  const byProject = useMemo(() => {
    const g = new Map<string, typeof c.cases>();
    c.cases.forEach((x) => g.set(x.projectBoardId, [...(g.get(x.projectBoardId) ?? []), x]));
    return [...g.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [c]);
  return (
    <li className="border-t first:border-t-0">
      <button type="button" onClick={toggle} disabled={n === 0} aria-expanded={open} className="flex min-h-[52px] w-full items-center gap-3 px-3 py-2 text-left disabled:cursor-default">
        {n === 0 ? <CheckCircle2 className="h-5 w-5 shrink-0 text-[hsl(var(--pal-2))]" /> : open ? <ChevronDown className="h-5 w-5 shrink-0" /> : <ChevronRight className="h-5 w-5 shrink-0" />}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{c.label}</span>
          <span className="block text-xs text-muted-foreground">{c.hint} {c.total} verificado(s){c.unmappedProjects ? ` · ${c.unmappedProjects} projeto(s) sem a coluna mapeada` : ''}</span>
        </span>
        <span className={cn('min-w-[44px] rounded-full px-2.5 py-1 text-center font-mono text-sm tabular-nums', n ? 'bg-[hsl(var(--pal-5))] text-white' : 'bg-muted text-muted-foreground')}>{n}</span>
      </button>
      {open && n > 0 && (
        <div className="space-y-3 bg-muted/40 px-3 py-3">
          {byProject.map(([pid, list]) => (
            <div key={pid}>
              <button type="button" onClick={() => setShut((s) => { const n = new Set(s); if (n.has(pid)) n.delete(pid); else n.add(pid); return n; })} aria-expanded={!shut.has(pid)}
                className="mb-1 flex min-h-8 w-full items-center gap-1.5 rounded text-left text-xs font-medium hover:bg-muted">
                {shut.has(pid) ? <ChevronRight className="size-4 shrink-0" aria-hidden /> : <ChevronDown className="size-4 shrink-0" aria-hidden />}
                <span>{name(pid)} <span className="text-muted-foreground">· {list.length}</span></span>
              </button>
              {!shut.has(pid) && <ul className="grid gap-1 sm:grid-cols-2">
                {list.map((x) => (
                  <li key={x.itemId} className="flex items-center justify-between gap-2 rounded border bg-card px-2 py-1 text-sm">
                    <span className="min-w-0 truncate" title={x.name}>{x.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{x.detail}</span>
                  </li>
                ))}
              </ul>}
            </div>
          ))}
        </div>
      )}
    </li>
  );
}

/** Aba Checklist: inconsistências de preenchimento por tipo de verificação. */
export function ChecklistTab({ model, ops, allow }: { model: Model | null; ops: OpsModel | null; allow: (id: string) => boolean }) {
  const [project, setProject] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [pauta, setPauta] = useState(false);
  const projects = (model?.ds.projects ?? []).filter((p) => p.enabled !== false && allow(p.boardId));
  const name = (id: string) => model?.projectBy.get(id)?.name ?? id;
  const checks = useMemo(() => buildChecklist(model, ops, (id) => allow(id) && (!project || id === project)), [model, ops, allow, project]);
  const total = checks.reduce((a, c) => a + c.cases.length, 0);
  const toggle = (id: string) => setOpen((o) => { const n = new Set(o); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const [csvBusy, setCsvBusy] = useState(false);
  /** Gera o CSV no navegador com os dados já carregados (sem chamadas ao servidor ou à Monday). */
  const downloadCsv = () => {
    const p = model?.projectBy.get(project) ?? ops?.projectBy.get(project);
    if (!p || !ops || !model || !p.lastSuccessAt) { toast.warning('Atualize o projeto antes de baixar.'); return; }
    setCsvBusy(true);
    setTimeout(() => {
      try {
        const { filename, csv } = buildDiagnosticCsv(project, model, ops);
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        const a = document.createElement('a');
        a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      } catch (e) { console.error('[diagnóstico CSV]', e); toast.error('Não foi possível gerar o diagnóstico. Tente novamente.'); }
      finally { setCsvBusy(false); }
    }, 30);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full sm:max-w-md">
          <p className="mb-1 text-xs text-muted-foreground">Projeto</p>
          <SearchSelect value={project} onChange={setProject} emptyLabel="Todos os projetos" placeholder="Todos os projetos" ariaLabel="Filtrar por projeto"
            options={projects.map((p) => ({ value: p.boardId, label: p.name }))} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm"><span className="font-mono text-2xl tabular-nums">{total}</span> <span className="text-muted-foreground">inconsistência(s) no total</span></p>
          <button type="button" disabled={!project} onClick={() => setPauta(true)} title={project ? undefined : 'Escolha um projeto'}
            className="flex min-h-10 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm disabled:opacity-50">
            <Sparkles className="size-4" aria-hidden />Gerar pauta da reunião
          </button>
          <button type="button" disabled={!project || csvBusy} onClick={downloadCsv} title={project ? undefined : 'Escolha um projeto'}
            className="flex min-h-10 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm disabled:opacity-50">
            {csvBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}{csvBusy ? 'Gerando…' : 'Baixar diagnóstico (CSV)'}
          </button>
        </div>
      </div>
      {project && <PautaDialog open={pauta} onOpenChange={setPauta} project={name(project)} boardId={project} model={model} ops={ops} checks={checks} />}
      {AREAS.map((area) => {
        const list = checks.filter((c) => c.area === area);
        if (list.length === 0) return null;
        const n = list.reduce((a, c) => a + c.cases.length, 0);
        const id = `area:${area}`;
        const isOpen = !open.has(id);
        return (
          <Panel key={area} className="p-0">
            <button type="button" onClick={() => toggle(id)} aria-expanded={isOpen} className="flex min-h-[56px] w-full items-center gap-3 px-4 text-left">
              {isOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              <span className="flex-1 text-base font-semibold">{area}</span>
              <span className="text-xs text-muted-foreground">{list.filter((c) => c.cases.length).length} de {list.length} verificações com pendência</span>
              <span className={cn('inline-flex min-w-[52px] items-center justify-center gap-1 rounded-full px-3 py-1 font-mono text-sm tabular-nums', n ? 'bg-[hsl(var(--pal-1))] text-white' : 'bg-muted text-muted-foreground')}>
                {n > 0 && <AlertTriangle className="h-3.5 w-3.5" />}{n}
              </span>
            </button>
            {isOpen && <ul className="border-t">{list.map((c) => <CheckRow key={c.id} c={c} name={name} open={open.has(c.id)} toggle={() => toggle(c.id)} />)}</ul>}
          </Panel>
        );
      })}
    </div>
  );
}
