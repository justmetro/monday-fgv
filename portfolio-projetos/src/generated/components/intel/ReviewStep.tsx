import { useMemo, useState } from 'react';
import { CheckCheck, Pencil, Search } from 'lucide-react';
import { toast } from 'sonner';
import type { IndicatorClassDoc, IndicatorDoc, ProjectDoc } from '@generated/models';
import { markReviewed } from '@generated/server/intel';
import { ikey } from '@generated/lib/intel-sig';
import { norm } from '@generated/lib/fields';
import { classStatus } from './ClassifyStep';
import { EditClassDialog } from './EditClassDialog';
import { CategoryManager } from './CategoryManager';
import { cn } from '@lib/utils';

const ST: Record<string, { l: string; c: string }> = {
  none: { l: 'Não classificado', c: 'bg-muted text-muted-foreground' },
  ok: { l: 'Sugestão da IA', c: 'bg-[hsl(var(--warn-soft))] text-[hsl(var(--warn))]' },
  reviewed: { l: 'Revisado', c: 'bg-[hsl(var(--ok-soft))] text-[hsl(var(--ok))]' },
  changed: { l: 'Texto alterado', c: 'bg-[hsl(var(--bad-soft))] text-destructive' },
  changedReviewed: { l: 'Revisado · texto alterado', c: 'bg-[hsl(var(--bad-soft))] text-destructive' },
};
const FILTERS = [['all', 'Todos'], ['none', 'Não classificados'], ['ok', 'A revisar'], ['changed', 'Texto alterado'], ['reviewed', 'Revisados']] as const;

export function ReviewStep({ scope, projects, classes, onChanged, onNext }: { scope: IndicatorDoc[]; projects: ProjectDoc[]; classes: IndicatorClassDoc[]; onChanged: () => Promise<void>; onNext: () => void }) {
  const by = useMemo(() => new Map(classes.map((c) => [c.key, c])), [classes]);
  const pName = useMemo(() => new Map(projects.map((p) => [p.boardId, p.name])), [projects]);
  const [f, setF] = useState<(typeof FILTERS)[number][0]>('all');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<IndicatorDoc | null>(null);
  const [busy, setBusy] = useState(false);
  const rows = scope.map((i) => { const c = by.get(ikey(i.projectBoardId, i.itemId)); return { i, c, s: classStatus(i, c) }; })
    .filter((r) => f === 'all' || r.s === f || (f === 'changed' && r.s === 'changedReviewed') || (f === 'ok' && r.c?.precisaRevisao && r.s !== 'reviewed'))
    .filter((r) => !q || [r.i.name, r.c?.tema, r.c?.subtema, r.c?.familia, pName.get(r.i.projectBoardId)].some((x) => x && norm(x).includes(norm(q))));
  const reviewable = rows.filter((r) => r.c && r.s === 'ok').map((r) => r.c!.key);

  const review = async (keys: string[]) => {
    setBusy(true);
    try { await markReviewed({ data: { keys: keys.slice(0, 500) } }); toast.success(`${Math.min(keys.length, 500)} classificação(ões) marcada(s) como revisada(s)`); await onChanged(); }
    catch (e) { console.error(e); toast.error('Não foi possível marcar como revisadas.'); }
    finally { setBusy(false); }
  };

  return (
    <section className="space-y-4">
      <CategoryManager classes={classes.filter((c) => scope.some((i) => ikey(i.projectBoardId, i.itemId) === c.key))} onChanged={onChanged} />
      <div className="space-y-3 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1" role="group" aria-label="Filtrar classificações">
            {FILTERS.map(([v, l]) => <button key={v} onClick={() => setF(v)} aria-pressed={f === v} className={cn('min-h-9 rounded-md px-3 text-sm', f === v ? 'bg-primary text-primary-foreground' : 'border border-border')}>{l}</button>)}
          </div>
          <label className="relative ml-auto w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar indicador, categoria ou projeto" aria-label="Buscar" className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm" />
          </label>
        </div>
        <div className="max-h-[60vh] overflow-auto rounded-md border border-border">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="sticky top-0 bg-muted text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr><th className="p-2">Indicador</th><th className="p-2">Tema › Subtema</th><th className="p-2">Família</th><th className="p-2">Situação</th><th className="p-2" /></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Nenhum indicador neste filtro.</td></tr>}
              {rows.map(({ i, c, s }) => (
                <tr key={ikey(i.projectBoardId, i.itemId)} className="align-top">
                  <td className="p-2"><p className="font-medium">{i.name}</p><p className="text-xs text-muted-foreground">{pName.get(i.projectBoardId)} · {i.tipo ?? 'Sem tipo'}</p></td>
                  <td className="p-2">{c ? <>{c.tema}<span className="text-muted-foreground"> › {c.subtema}</span></> : '—'}</td>
                  <td className="p-2">{c?.familia ?? '—'}{c && <p className="text-xs text-muted-foreground">Confiança {c.confianca}{c.publico ? ` · ${c.publico}` : ''}</p>}</td>
                  <td className="p-2"><span className={cn('rounded-sm px-1.5 py-0.5 text-[11px]', ST[s]?.c)}>{ST[s]?.l}</span>{c?.precisaRevisao && s !== 'reviewed' && <p className="mt-1 text-[11px] text-[hsl(var(--warn))]">IA sugere revisão</p>}</td>
                  <td className="p-2 text-right"><button onClick={() => setEdit(i)} aria-label={`Revisar ${i.name}`} className="inline-flex size-10 items-center justify-center rounded-md hover:bg-muted"><Pencil className="size-4" aria-hidden /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button onClick={() => void review(reviewable)} disabled={busy || reviewable.length === 0} className="flex min-h-10 items-center gap-2 rounded-md border border-border px-3 text-sm disabled:opacity-50"><CheckCheck className="size-4" aria-hidden />Marcar {reviewable.length} exibido(s) como revisado(s)</button>
          <button onClick={onNext} className="min-h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">Gerar relatório</button>
        </div>
      </div>
      <EditClassDialog ind={edit} cls={edit ? by.get(ikey(edit.projectBoardId, edit.itemId)) ?? null : null} classes={classes} projName={edit ? pName.get(edit.projectBoardId) ?? '' : ''} onClose={() => setEdit(null)} onSaved={onChanged} />
    </section>
  );
}
