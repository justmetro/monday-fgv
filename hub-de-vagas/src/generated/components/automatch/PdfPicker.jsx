import { useState } from 'react';
import { FileText, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@components/ui/popover';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@components/ui/command';
import { downloadPerfilPdf } from '@generated/lib/perfilPdf';
import { canon, clean } from '@generated/lib/normalize';
import { cn } from '@lib/utils';

// Header action: pick one or many perfis (any status) and download one PDF each, in sequence.
export default function PdfPicker({ perfis, loading }) {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(() => new Set());
  const [prog, setProg] = useState(null);
  const toggle = (id) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const list = [...perfis].sort((a, b) => a.name.localeCompare(b.name, 'pt'));

  const run = async () => {
    const ids = list.filter((p) => sel.has(p.id));
    setOpen(false);
    let ok = 0; const fails = [];
    for (let i = 0; i < ids.length; i += 1) {
      setProg({ done: i + 1, total: ids.length });
      try { await downloadPerfilPdf(ids[i].id); ok += 1; } catch (e) { console.error('[pdf] falha', ids[i].name, e); fails.push(ids[i].name); }
    }
    setProg(null); setSel(new Set());
    if (fails.length) toast.error(`${ok} PDF(s) gerado(s); falhou: ${fails.join(', ')}`); else toast.success(`${ok} PDF(s) gerado(s)`);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button disabled={!!prog} className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-sm hover:border-primary/50 disabled:opacity-70">
          {prog ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          {prog ? `Gerando ${prog.done} de ${prog.total}…` : 'Gerar PDF de perfil'}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,380px)] p-0">
        <Command>
          <CommandInput placeholder="Buscar perfil…" />
          <CommandList className="max-h-72">
            <CommandEmpty>{loading ? 'Carregando perfis…' : 'Nenhum perfil encontrado.'}</CommandEmpty>
            {list.map((p) => {
              const on = sel.has(p.id);
              return (
                <CommandItem key={p.id} value={`${p.name} ${p.papelDeOrigem ?? ''} ${p.id}`} onSelect={() => toggle(p.id)} className="items-start gap-2">
                  <span className={cn('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border', on ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}>{on && <Check className="h-3 w-3" />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{p.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{[clean(p.papelDeOrigem), canon(p.statusDoPerfil)].filter(Boolean).join(' · ') || '—'}</span>
                  </span>
                </CommandItem>
              );
            })}
          </CommandList>
          <div className="flex items-center justify-between gap-2 border-t border-border p-2">
            <span className="text-xs text-muted-foreground">{sel.size} selecionado(s){loading ? ' · carregando…' : ''}</span>
            <button onClick={run} disabled={!sel.size} className="inline-flex h-8 items-center rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50">
              Gerar {sel.size > 1 ? `${sel.size} PDFs` : 'PDF'}
            </button>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
