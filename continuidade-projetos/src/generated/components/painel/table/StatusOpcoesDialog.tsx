import { useState } from 'react';
import { ArrowDown, ArrowUp, Loader2, Plus, Settings2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@components/ui/dialog';
import { Input } from '@components/ui/input';
import { salvarStatusOpcoes } from '@generated/server/negocio';

type Item = { id: number; v: string };
let seq = 0;
const paraItens = (l: string[]): Item[] => l.map((v) => ({ id: ++seq, v }));

/** Edita a lista de opções do campo "Status" (guardada no app; o valor de cada projeto vai para Decisões do Vibe). */
export function StatusOpcoesDialog({ opcoes, onSalvo }: { opcoes: string[]; onSalvo: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [lista, setLista] = useState<Item[]>(() => paraItens(opcoes));
  const [nova, setNova] = useState('');
  const [saving, setSaving] = useState(false);

  const abrir = (o: boolean) => { if (o) { setLista(paraItens(opcoes)); setNova(''); } setOpen(o); };
  const mover = (i: number, d: -1 | 1) => setLista((l) => {
    const n = [...l]; const j = i + d;
    if (j < 0 || j >= n.length) return l;
    [n[i], n[j]] = [n[j] as Item, n[i] as Item];
    return n;
  });
  const adicionar = () => {
    const v = nova.trim();
    if (!v || lista.some((x) => x.v.toLowerCase() === v.toLowerCase())) return;
    setLista((l) => [...l, { id: ++seq, v }]); setNova('');
  };
  const limpa = lista.map((x) => x.v.trim()).filter(Boolean);
  const salvar = async () => {
    if (!limpa.length) { toast.error('Mantenha ao menos uma opção.'); return; }
    setSaving(true);
    try {
      const r = await salvarStatusOpcoes({ data: { opcoes: limpa } });
      onSalvo(r?.opcoes ?? limpa);
      toast.success('Opções de status atualizadas.');
      setOpen(false);
    } catch (e) {
      console.error('salvarStatusOpcoes', e);
      toast.error('Não foi possível salvar as opções. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={abrir}>
      <DialogTrigger asChild>
        <button type="button" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Settings2 className="size-4 text-muted-foreground" aria-hidden /> Opções de status
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Opções de status</DialogTitle>
          <DialogDescription>A ordem define a ordem dos grupos. Renomear ou remover uma opção não altera projetos que já a usam.</DialogDescription>
        </DialogHeader>
        <ul className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
          {lista.map((o, i) => (
            <li key={o.id} className="flex items-center gap-1">
              <Input
                value={o.v}
                maxLength={60}
                onChange={(e) => { const v = e.target.value; setLista((l) => l.map((x) => (x.id === o.id ? { ...x, v } : x))); }}
                aria-label={`Opção ${i + 1}`}
                className="h-9 flex-1 text-base sm:text-sm"
              />
              <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Mover para cima" className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent disabled:opacity-40"><ArrowUp className="size-4" /></button>
              <button type="button" onClick={() => mover(i, 1)} disabled={i === lista.length - 1} aria-label="Mover para baixo" className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent disabled:opacity-40"><ArrowDown className="size-4" /></button>
              <button type="button" onClick={() => setLista((l) => l.filter((x) => x.id !== o.id))} aria-label={`Remover ${o.v}`} className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-destructive"><Trash2 className="size-4" /></button>
            </li>
          ))}
        </ul>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); adicionar(); }}>
          <Input value={nova} onChange={(e) => setNova(e.target.value)} maxLength={60} placeholder="Nova opção" aria-label="Nova opção" className="h-9 flex-1 text-base sm:text-sm" />
          <button type="submit" disabled={!nova.trim()} className="inline-flex h-9 items-center gap-1 rounded-md border border-border px-3 text-sm text-foreground hover:bg-accent disabled:opacity-50"><Plus className="size-4" aria-hidden /> Adicionar</button>
        </form>
        <DialogFooter>
          <button type="button" onClick={() => setOpen(false)} disabled={saving} className="min-h-10 rounded-md border border-border px-4 text-sm text-foreground hover:bg-accent disabled:opacity-50">Cancelar</button>
          <button type="button" onClick={() => void salvar()} disabled={saving} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {saving && <Loader2 className="size-4 animate-spin" aria-hidden />} Salvar opções
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
