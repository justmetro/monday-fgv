import { useEffect, useState } from 'react';
import { Copy, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@components/ui/dialog';
import { generatePauta } from '@generated/server/pauta';
import type { Check } from '@generated/lib/checklist';
import type { Model } from '@generated/lib/metrics';
import type { OpsModel } from '@generated/lib/ops';
import { buildPautaContext, faseOf } from '@generated/lib/pauta-context';

export function PautaDialog({ open, onOpenChange, project, boardId, model, ops, checks }: { open: boolean; onOpenChange: (o: boolean) => void; project: string; boardId: string; model: Model | null; ops: OpsModel | null; checks: Check[] }) {
  const fase = faseOf(model?.projectBy.get(boardId) ?? ops?.projectBy.get(boardId));
  const [text, setText] = useState('');
  const [gen, setGen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (open) { setText(''); setError(null); } }, [open, project]);

  const generate = async () => {
    setGen(true); setError(null);
    try {
      const context = buildPautaContext(boardId, model, ops);
      const payload = checks.filter((c) => c.cases.length > 0).map((c) => ({ area: c.area, label: c.label, total: c.total, count: c.cases.length, cases: c.cases.slice(0, 15).map((x) => ({ name: x.name.slice(0, 200), detail: x.detail.slice(0, 200) })) }));
      const r = await generatePauta({ data: { project, checks: payload.slice(0, 40), context } });
      setText(r?.text ?? '');
    } catch (e) { console.error(e); setError('Não foi possível gerar a pauta agora. Tente novamente.'); }
    finally { setGen(false); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); toast.success('Pauta copiada.'); }
    catch (e) { console.error(e); setError('Não foi possível copiar. Selecione o texto e copie manualmente.'); }
  };
  const n = checks.reduce((a, c) => a + c.cases.length, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Pauta da reunião de monitoramento</DialogTitle>
          <DialogDescription>{project} · {fase} · pauta estratégica + {n} inconsistência(s) no Checklist</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <button type="button" onClick={() => void generate()} disabled={gen} className="flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm text-primary-foreground disabled:opacity-60">
            {gen ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}{text ? 'Gerar novamente' : 'Gerar pauta'}
          </button>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={16} aria-label="Texto da pauta" placeholder="A pauta gerada aparece aqui e pode ser editada."
            className="w-full rounded-md border border-input bg-card p-3 font-mono text-xs leading-relaxed" />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end">
            <button type="button" onClick={() => void copy()} disabled={!text.trim()} className="flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm text-primary-foreground disabled:opacity-50">
              <Copy className="size-4" aria-hidden />Copiar pauta
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
