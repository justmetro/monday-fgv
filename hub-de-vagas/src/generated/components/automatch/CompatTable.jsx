import { useState } from 'react';
import { Grid3x3 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@components/ui/dialog';
import { FAMILIAS, AREAS_PERFIL, EIXOS_VAGA, PALAVRAS, levelOf } from '@generated/lib/compatibilidadeArea';
import { cn } from '@lib/utils';

const KEYS = Object.keys(FAMILIAS);
const CELL = { 2: 'bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))]', 1: 'bg-[hsl(var(--warning)/0.15)] text-[hsl(var(--warning))]', 0: 'bg-destructive/10 text-destructive' };
const fam = (l) => l.map((f) => FAMILIAS[f]).join(', ');

// Read-only view of the current (provisional) area-compatibility table.
export default function CompatTable() {
  const [open, setOpen] = useState(false);
  const byFam = KEYS.map((k) => [k, PALAVRAS.filter(([, f]) => f === k).map(([w]) => w.trim())]);
  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-sm hover:border-primary/50">
        <Grid3x3 className="h-4 w-4" />Compatibilidade de áreas
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Compatibilidade de áreas</DialogTitle>
            <DialogDescription>A coluna “Família de área” do quadro tem precedência; as tabelas abaixo (áreas/eixo e palavras-chave) servem só para sugerir a família quando ela está vazia. Versão provisória — revisar com a gestão. 2 = compatível · 1 = parcial · 0 = incompatível. Pares não listados = 1.</DialogDescription>
          </DialogHeader>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-xs">
              <thead><tr><th className="p-1.5 text-left font-medium text-muted-foreground">Perfil ↓ / Vaga →</th>{KEYS.map((k) => <th key={k} className="p-1.5 text-left font-medium" title={FAMILIAS[k]}>{FAMILIAS[k].split(' / ')[0]}</th>)}</tr></thead>
              <tbody>
                {KEYS.map((a) => (
                  <tr key={a} className="border-t border-border">
                    <th className="p-1.5 text-left font-medium" title={FAMILIAS[a]}>{FAMILIAS[a].split(' / ')[0]}</th>
                    {KEYS.map((b) => { const l = levelOf(a, b); return <td key={b} className={cn('p-1.5 text-center tabular-nums', CELL[l])}>{l}</td>; })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-4 text-xs sm:grid-cols-2">
            <section>
              <p className="mb-1 font-medium">Famílias</p>
              <ul className="grid gap-0.5">{KEYS.map((k) => <li key={k}><span className="font-medium">{FAMILIAS[k]}</span> <span className="text-muted-foreground">· palavras: {byFam.find(([f]) => f === k)[1].join(', ') || '—'}</span></li>)}</ul>
            </section>
            <section>
              <p className="mb-1 font-medium">Eixo da vaga → família</p>
              <ul className="grid gap-0.5">{Object.entries(EIXOS_VAGA).map(([e, f]) => <li key={e}>{e} <span className="text-muted-foreground">→ {fam(f)}</span></li>)}</ul>
              <p className="mb-1 mt-3 font-medium">Área de atuação do perfil → família</p>
              <ul className="grid gap-0.5">{Object.entries(AREAS_PERFIL).map(([e, f]) => <li key={e}>{e} <span className="text-muted-foreground">→ {fam(f)}</span></li>)}</ul>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
