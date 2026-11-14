import { useState } from 'react';
import { Loader2, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@components/ui/dialog';
import { NumberField } from '@generated/components/painel/Fields';
import { salvarFatores } from '@generated/server/negocio';
import { MODALIDADES, chaveFator, type Fatores } from '@generated/lib/negocio';
import type { PainelData } from '@generated/hooks/usePainelData';

/** Engrenagem "Fatores de custo": custo mensal = Valor Base Plan. × fator da modalidade. Salvo só no app. */
export function FatoresDialog({ data }: { data: PainelData }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<Record<keyof Fatores, number | null>>(data.fatores);
  const [busy, setBusy] = useState(false);

  const abrir = (o: boolean) => { if (o) setV(data.fatores); setOpen(o); };

  const salvar = async () => {
    const f: Fatores = { clt: v.clt ?? 1, bolsa: v.bolsa ?? 1, estagio: v.estagio ?? 1, rpaFixo: v.rpaFixo ?? 1 };
    if (Object.values(f).some((x) => x > 10)) { toast.error('Use fatores entre 0 e 10.'); return; }
    const prev = data.fatores;
    data.setFatores(f);
    setBusy(true);
    try {
      await salvarFatores({ data: f });
      toast.success('Fatores de custo salvos no app.');
      setOpen(false);
    } catch (e) {
      console.error('salvarFatores', e);
      data.setFatores(prev);
      toast.error('Não foi possível salvar os fatores. Tente novamente.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={abrir}>
      <DialogTrigger asChild>
        <button type="button" aria-label="Fatores de custo" title="Fatores de custo" className="inline-flex size-10 items-center justify-center rounded-md border border-border bg-card text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Settings2 className="size-4" aria-hidden />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Fatores de custo</DialogTitle>
          <DialogDescription>Custo mensal por pessoa = Valor Base Plan. × fator de encargos da modalidade. Padrão 1,0. Fica guardado só no app.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {MODALIDADES.map((m) => {
            const k = chaveFator(m);
            return (
              <label key={m} htmlFor={`fator-${k}`} className="flex flex-col gap-1 text-xs text-muted-foreground">
                {m}
                <NumberField id={`fator-${k}`} value={v[k]} onChange={(n) => setV({ ...v, [k]: n })} step={0.01} />
              </label>
            );
          })}
        </div>
        <DialogFooter>
          <button type="button" onClick={() => setOpen(false)} disabled={busy} className="min-h-10 rounded-md border border-border bg-card px-4 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Cancelar</button>
          <button type="button" onClick={() => void salvar()} disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden />} Salvar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
