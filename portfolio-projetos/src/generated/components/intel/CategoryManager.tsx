import { useMemo, useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { toast } from 'sonner';
import type { IndicatorClassDoc } from '@generated/models';
import { renameCategory } from '@generated/server/intel';
import { cn } from '@lib/utils';

type Level = 'tema' | 'subtema' | 'familia';
const LBL: Record<Level, string> = { tema: 'Temas', subtema: 'Subtemas', familia: 'Famílias' };

/** Renomear para um nome já existente une as categorias. */
export function CategoryManager({ classes, onChanged }: { classes: IndicatorClassDoc[]; onChanged: () => Promise<void> }) {
  const [lvl, setLvl] = useState<Level>('familia');
  const [edit, setEdit] = useState<{ from: string; to: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const cats = useMemo(() => {
    const m = new Map<string, number>();
    classes.forEach((c) => m.set(c[lvl], (m.get(c[lvl]) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'));
  }, [classes, lvl]);
  const apply = async () => {
    if (!edit || !edit.to.trim() || edit.to.trim() === edit.from) return setEdit(null);
    setBusy(true);
    const merge = cats.some(([n]) => n === edit.to.trim());
    try {
      const r = await renameCategory({ data: { level: lvl, from: edit.from, to: edit.to.trim() } });
      toast.success(merge ? 'Categorias unidas' : 'Categoria renomeada', { description: `${r.n} classificação(ões) atualizada(s).` });
      setEdit(null); await onChanged();
    } catch (e) { console.error(e); toast.error('Não foi possível renomear a categoria.'); }
    finally { setBusy(false); }
  };
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="font-medium">Taxonomia compartilhada</h2><p className="text-xs text-muted-foreground">A mesma classificação vale em todos os projetos e eixos. Renomeie para um nome existente para unir categorias.</p></div>
        <div className="flex gap-1" role="group" aria-label="Nível">
          {(Object.keys(LBL) as Level[]).map((l) => <button key={l} onClick={() => setLvl(l)} aria-pressed={lvl === l} className={cn('min-h-9 rounded-md px-3 text-sm', lvl === l ? 'bg-primary text-primary-foreground' : 'border border-border')}>{LBL[l]}</button>)}
        </div>
      </div>
      <ul className="mt-3 flex max-h-56 flex-wrap gap-2 overflow-y-auto">
        {cats.length === 0 && <li className="text-sm text-muted-foreground">Sem classificações no recorte.</li>}
        {cats.map(([n, c]) => edit?.from === n ? (
          <li key={n} className="flex items-center gap-1">
            <input autoFocus list="cat-dl" value={edit.to} onChange={(e) => setEdit({ ...edit, to: e.target.value })} aria-label="Novo nome" className="h-9 w-56 rounded-md border border-input bg-background px-2 text-sm" />
            <button onClick={() => void apply()} disabled={busy} aria-label="Aplicar" className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground"><Check className="size-4" aria-hidden /></button>
            <button onClick={() => setEdit(null)} aria-label="Cancelar" className="flex size-9 items-center justify-center rounded-md border border-border"><X className="size-4" aria-hidden /></button>
          </li>
        ) : (
          <li key={n}><button onClick={() => setEdit({ from: n, to: n })} className="flex min-h-9 items-center gap-1.5 rounded-md border border-border px-2 text-sm hover:bg-muted">{n}<span className="font-mono text-xs text-muted-foreground">{c}</span><Pencil className="size-3 opacity-50" aria-hidden /></button></li>
        ))}
      </ul>
      <datalist id="cat-dl">{cats.map(([n]) => <option key={n} value={n} />)}</datalist>
    </div>
  );
}
