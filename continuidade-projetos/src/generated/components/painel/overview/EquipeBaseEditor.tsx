import { useState } from 'react';
import { Loader2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@components/ui/popover';
import { Checkbox } from '@components/ui/checkbox';
import { EquipeChips } from '@generated/components/painel/EquipeChips';
import { RascunhoTag } from '@generated/components/painel/Chips';
import { MODALIDADES } from '@generated/lib/negocio';
import { nomePessoa } from '@generated/lib/equipe';
import { fmtBRL2, type Row } from '@generated/lib/painel';
import type { Extras, ResultadoExtras } from '@generated/hooks/useSalvarExtras';

/** Célula "Equipe Base": mostra a composição e permite marcar as pessoas (grava em Decisões do Vibe). */
export function EquipeBaseEditor({ r, onSalvar }: { r: Row; onSalvar: (r: Row, x: Extras) => Promise<ResultadoExtras> }) {
  const pessoas = r.equipe?.atual ?? [];
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  if (!pessoas.length) return <span className="text-xs text-muted-foreground">—</span>;

  const abrir = (o: boolean) => { if (o) setSel(new Set(r.baseIds)); setOpen(o); };
  const alternar = (id: string, v: boolean) => setSel((s) => { const n = new Set(s); if (v) n.add(id); else n.delete(id); return n; });
  const custoSel = pessoas.filter((x) => sel.has(x.id)).reduce((s, x) => s + (x.custo ?? 0), 0);

  const salvar = async () => {
    setSaving(true);
    try {
      const res = await onSalvar(r, { base: [...sel] });
      if (res.ok) { toast.success('Equipe base salva em Decisões do Vibe.'); setOpen(false); }
      else toast.error('Não foi possível salvar a equipe base. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={abrir}>
      <PopoverTrigger asChild>
        <button type="button" className="group flex min-h-8 max-w-full items-center gap-1.5 rounded-md px-1 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Editar equipe base de ${r.projeto.name}`}>
          {r.base.n ? <EquipeChips cont={r.base.porModalidade} /> : <span className="text-xs text-muted-foreground">Definir</span>}
          <Pencil className="size-3.5 shrink-0 text-muted-foreground opacity-60 group-hover:opacity-100" aria-hidden />
          {r.rascunho.base && <RascunhoTag />}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(92vw,360px)] p-0">
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Equipe Base</p>
          <p className="tnum text-xs text-muted-foreground">{sel.size} de {pessoas.length} pessoa(s) · {fmtBRL2(custoSel)}/mês</p>
        </div>
        <div className="max-h-72 overflow-y-auto px-4 py-2">
          {MODALIDADES.map((m) => {
            const lista = pessoas.filter((x) => x.modalidade === m);
            if (!lista.length) return null;
            return (
              <div key={m} className="py-1.5">
                <p className="mb-1 text-xs font-medium text-muted-foreground">{m}</p>
                <ul className="flex flex-col">
                  {lista.map((x) => (
                    <li key={x.id}>
                      <label className="flex min-h-9 cursor-pointer items-center gap-2 rounded px-1 text-sm hover:bg-accent">
                        <Checkbox checked={sel.has(x.id)} onCheckedChange={(v) => alternar(x.id, v === true)} />
                        <span className={x.nome ? 'min-w-0 flex-1 break-words text-foreground' : 'min-w-0 flex-1 italic text-muted-foreground'}>{nomePessoa(x)}</span>
                        <span className="tnum text-xs text-muted-foreground">{fmtBRL2(x.custo)}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <button type="button" onClick={() => setOpen(false)} disabled={saving} className="min-h-9 rounded-md border border-border px-3 text-sm text-foreground hover:bg-accent disabled:opacity-50">Cancelar</button>
          <button type="button" onClick={() => void salvar()} disabled={saving} className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {saving && <Loader2 className="size-3.5 animate-spin" aria-hidden />} Salvar
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
