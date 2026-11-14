import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@components/ui/dialog';
import { Checkbox } from '@components/ui/checkbox';
import { getHistoryMatches, linkManual } from '@generated/server/history';
import type { listProjects } from '@generated/server/importer';
import { extractCodes, type HItem } from '@generated/lib/history';
import { norm } from '@generated/lib/fields';
import { cn } from '@lib/utils';
import { StatusPill } from './ProjectHistoryMeta';

type Project = Awaited<ReturnType<typeof listProjects>>[number];

function Side({ title, name, code, children }: { title: string; name: string; code: string; children?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-md border border-border p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="mt-1 break-words text-sm font-medium">{name}</p>
      <p className="font-mono text-xs text-muted-foreground">{code || 'sem código'}</p>
      {children}
    </div>
  );
}

export function ManualLinkDialog({ project, all, onClose, onDone }: { project: Project | null; all: Project[]; onClose: () => void; onDone: () => void }) {
  const [items, setItems] = useState<HItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [pick, setPick] = useState<HItem | null>(null);
  const [shareOk, setShareOk] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!project) return;
    setItems(null); setErr(null); setPick(null); setShareOk(false);
    setQ(extractCodes(project.name)[0] ?? '');
    getHistoryMatches({ data: {} }).then((r) => setItems(r.items)).catch((e) => { console.error(e); setErr(e instanceof Error ? e.message : 'Não foi possível ler o Histórico.'); });
  }, [project]);

  const shown = useMemo(() => {
    const t = norm(q).replace(/\s*\/\s*/g, '/');
    const l = items ?? [];
    return (t ? l.filter((h) => norm(h.name).includes(t) || h.codes.some((c) => c.includes(t))) : l).slice(0, 60);
  }, [items, q]);
  const sharedWith = pick ? all.filter((p) => p.boardId !== project?.boardId && p.hLink === 'confirmed' && p.hItemId === pick.id) : [];

  const save = async () => {
    if (!project || !pick) return;
    setSaving(true);
    try {
      const r = await linkManual({ data: { boardId: project.boardId, itemId: pick.id, allowShared: shareOk } });
      if (!r.ok) { toast.error('Elemento já associado a outro projeto', { description: r.sharedWith.join('; ') }); return; }
      toast.success('Vínculo confirmado manualmente', { description: r.meta?.summary });
      onDone(); onClose();
    } catch (e) { console.error(e); toast.error('Não foi possível gravar o vínculo.'); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={!!project} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Vincular ao Histórico de Projetos</DialogTitle>
          <DialogDescription>Pesquise por código ou nome. A escolha é registrada como seleção manual.</DialogDescription>
        </DialogHeader>
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Código (ex.: 2026/027) ou nome" aria-label="Pesquisar no Histórico" className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm" />
        </label>
        {err && <p className="rounded-md bg-[hsl(var(--bad-soft))] p-3 text-sm text-destructive">{err}</p>}
        {!items && !err && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Lendo o Histórico…</p>}
        {items && (
          <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-md border border-border">
            {shown.length === 0 && <li className="p-3 text-sm text-muted-foreground">Nenhum elemento encontrado.</li>}
            {shown.map((h) => (
              <li key={h.id}>
                <button onClick={() => { setPick(h); setShareOk(false); }} className={cn('flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-muted', pick?.id === h.id && 'bg-accent')}>
                  <span className="break-words">{h.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{h.codes.join(', ') || 'sem código'}{h.duplicate && ' · possível duplicata'}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {project && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Side title="Projeto no aplicativo" name={project.name} code={extractCodes(project.name).join(', ')} />
            {pick ? (
              <Side title="Elemento no Histórico" name={pick.name} code={pick.codes.join(', ')}>
                <div className="mt-2 space-y-1 text-xs">
                  <div className="flex items-center gap-1">Status: {pick.status ? <StatusPill label={pick.status} color={pick.statusColor} /> : '—'}</div>
                  <p>Gerente: {pick.managers.join(', ') || '—'}</p>
                  <p>Eixos: {pick.axes.join(', ') || '—'}</p>
                  {pick.codeConflict && <p className="text-[hsl(var(--warn))]">{pick.codeConflict}</p>}
                </div>
              </Side>
            ) : <div className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">Selecione um elemento acima.</div>}
          </div>
        )}
        {sharedWith.length > 0 && (
          <div className="rounded-md bg-[hsl(var(--warn-soft))] p-3 text-sm">
            <p className="flex items-center gap-2 font-medium text-[hsl(var(--warn))]"><AlertTriangle className="size-4" />Já associado a: {sharedWith.map((p) => p.name).join('; ')}</p>
            <label className="mt-2 flex items-center gap-2"><Checkbox checked={shareOk} onCheckedChange={(v) => setShareOk(!!v)} />Confirmo a associação compartilhada</label>
          </div>
        )}
        <DialogFooter>
          <button onClick={onClose} className="min-h-10 rounded-md border border-border px-4 text-sm">Cancelar</button>
          <button onClick={() => void save()} disabled={!pick || saving || (sharedWith.length > 0 && !shareOk)} className="flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {saving && <Loader2 className="size-4 animate-spin" />}Confirmar vínculo
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
