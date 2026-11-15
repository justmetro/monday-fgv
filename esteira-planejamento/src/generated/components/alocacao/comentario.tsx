import { useState } from 'react';
import { MessageSquare, MessageSquarePlus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@components/ui/popover';
import { Textarea } from '@components/ui/textarea';
import { cn } from '@lib/utils';
import type { Doc } from '@generated/lib/alocacao';
import type { AlocComentario } from '@generated/models';
import { quando } from '@generated/components/alocacao/bits';

/** Inline comment: preview + popover editor; empty text removes it. Shows author and date. */
export function Comentario({ doc, rotulo, onSave }: { doc: Doc<AlocComentario> | null; rotulo: string; onSave: (texto: string) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [texto, setTexto] = useState('');
  const [salvando, setSalvando] = useState(false);
  const abrir = (o: boolean) => {
    if (o) setTexto(doc?.data.texto ?? '');
    setOpen(o);
  };
  const salvar = async () => {
    setSalvando(true);
    const ok = await onSave(texto);
    setSalvando(false);
    if (ok) setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={abrir}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={doc ? `Editar comentário: ${rotulo}` : `Adicionar comentário: ${rotulo}`}
          className={cn('flex min-h-11 w-full min-w-0 items-start gap-1.5 rounded-[var(--radius-sm)] px-1 py-1 text-left text-xs transition-colors duration-150 hover:bg-[hsl(var(--surface-2))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-0',
            doc ? 'text-foreground' : 'text-[hsl(var(--fg-subtle))]')}>
          {doc ? <MessageSquare className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden /> : <MessageSquarePlus className="mt-0.5 size-3.5 shrink-0" aria-hidden />}
          <span className="line-clamp-2 min-w-0">{doc ? doc.data.texto : 'Comentar'}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" collisionPadding={12} className="w-80 max-w-[calc(100vw-24px)] rounded-[var(--radius-lg)] border-border p-3 shadow-none">
        <label htmlFor="aloc-coment" className="text-xs font-medium text-foreground">Comentário · {rotulo}</label>
        <Textarea id="aloc-coment" value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} maxLength={2000}
          className="mt-1.5 text-[13px]" placeholder="Escreva um comentário compartilhado com a equipe…" />
        {doc && <p className="mt-1 text-[11px] text-[hsl(var(--fg-subtle))]">Última edição: {doc.data.autor} · {quando(doc.data.em)}</p>}
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={() => setOpen(false)} className="h-11 rounded-[var(--radius-md)] px-3 text-[13px] text-muted-foreground hover:bg-accent md:h-8">Cancelar</button>
          <button type="button" onClick={() => void salvar()} disabled={salvando}
            className="h-11 rounded-[var(--radius-md)] bg-primary px-3 text-[13px] font-medium text-primary-foreground hover:bg-[hsl(var(--primary)/0.88)] disabled:opacity-60 md:h-8">
            {texto.trim() ? 'Salvar' : doc ? 'Remover' : 'Salvar'}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
