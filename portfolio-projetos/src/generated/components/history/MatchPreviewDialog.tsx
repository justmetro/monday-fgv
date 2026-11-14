import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@components/ui/dialog';
import { Checkbox } from '@components/ui/checkbox';
import { confirmLinks, getHistoryMatches } from '@generated/server/history';
import { CASE_LABEL, type MatchCase } from '@generated/lib/history';
import { cn } from '@lib/utils';

type Res = Awaited<ReturnType<typeof getHistoryMatches>>;
const ORDER: MatchCase[] = ['unique', 'duplicate', 'conflict', 'multiHistory', 'multiProject', 'multiCode', 'notFound', 'noCode', 'confirmed'];

/** Prévia de correspondência por código. Só "correspondência única" pode ser confirmada em lote. */
export function MatchPreviewDialog({ open, onOpenChange, onDone, onManual }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void; onManual: (boardId: string) => void }) {
  const [res, setRes] = useState<Res | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true); setErr(null); setRes(null);
    getHistoryMatches({ data: {} })
      .then((r) => { setRes(r); setSel(new Set(r.matches.filter((m) => m.kase === 'unique').map((m) => m.boardId))); })
      .catch((e) => { console.error(e); setErr(e instanceof Error ? e.message : 'Não foi possível ler o Histórico.'); })
      .finally(() => setLoading(false));
  }, [open]);

  const itemBy = new Map((res?.items ?? []).map((h) => [h.id, h]));
  const save = async () => {
    if (!res) return;
    setSaving(true);
    try {
      const links = res.matches.filter((m) => m.kase === 'unique' && sel.has(m.boardId)).map((m) => ({ boardId: m.boardId, itemId: m.candidateIds[0]! }));
      const pending = res.matches.filter((m) => m.kase !== 'confirmed' && !links.some((l) => l.boardId === m.boardId)).map((m) => ({ boardId: m.boardId, reason: m.kase }));
      const r = await confirmLinks({ data: { links, pending } });
      toast.success(`${r.linked} vínculo(s) confirmados · ${r.pending} pendente(s)`, { description: r.metaErrors ? `${r.metaErrors} cadastro(s) não puderam ser lidos agora.` : undefined });
      onDone(); onOpenChange(false);
    } catch (e) { console.error(e); toast.error('Não foi possível gravar os vínculos.'); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Correspondências com o Histórico</DialogTitle>
          <DialogDescription>Confirme os vínculos únicos por código. Casos ambíguos nunca são escolhidos automaticamente — use "Vincular manualmente".</DialogDescription>
        </DialogHeader>
        {loading && <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Lendo todos os elementos do Histórico…</p>}
        {err && <p className="rounded-md bg-[hsl(var(--bad-soft))] p-3 text-sm text-destructive">{err}</p>}
        {res && ORDER.map((c) => {
          const rows = res.matches.filter((m) => m.kase === c);
          if (!rows.length) return null;
          return (
            <section key={c} className="space-y-1">
              <h3 className={cn('text-xs font-semibold uppercase tracking-wide', c === 'unique' ? 'text-[hsl(var(--ok))]' : c === 'confirmed' ? 'text-muted-foreground' : 'text-[hsl(var(--warn))]')}>{CASE_LABEL[c]} · {rows.length}</h3>
              <ul className="divide-y divide-border rounded-md border border-border">
                {rows.map((m) => {
                  const cands = m.candidateIds.map((id) => itemBy.get(id)).filter((x) => !!x);
                  const near = m.nearIds.map((id) => itemBy.get(id)).filter((x) => !!x);
                  return (
                    <li key={m.boardId} className="grid gap-2 p-2 text-sm sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center">
                      {c === 'unique' ? <Checkbox checked={sel.has(m.boardId)} aria-label="Confirmar vínculo" onCheckedChange={(v) => setSel((s) => { const n = new Set(s); if (v) n.add(m.boardId); else n.delete(m.boardId); return n; })} /> : <span className="hidden w-4 sm:block" />}
                      <div className="min-w-0"><p className="break-words">{m.name}</p><p className="font-mono text-xs text-muted-foreground">{m.codes.join(', ') || 'sem código'}</p></div>
                      <div className="min-w-0 text-xs text-muted-foreground">
                        {cands.map((h) => <p key={h.id} className="break-words">→ {h.name}{h.codeConflict && <span className="text-[hsl(var(--warn))]"> · {h.codeConflict}</span>}</p>)}
                        {near.length > 0 && <p className="text-[hsl(var(--warn))]">Possível correspondência: {near.map((h) => h.codes.join(', ')).join('; ')}</p>}
                      </div>
                      {c !== 'unique' && c !== 'confirmed' && <button onClick={() => onManual(m.boardId)} className="min-h-9 rounded-md border border-border px-2 text-xs">Vincular manualmente</button>}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
        <DialogFooter>
          <button onClick={() => onOpenChange(false)} className="min-h-10 rounded-md border border-border px-4 text-sm">Cancelar</button>
          <button onClick={() => void save()} disabled={!res || saving} className="flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {saving && <Loader2 className="size-4 animate-spin" />}Gravar {sel.size} vínculo(s)
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
