import { useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { downloadPerfilPdf } from '@generated/lib/perfilPdf';
import { cn } from '@lib/utils';

// "Gerar PDF" for a perfil: fetches the fresh item and downloads an A4 profile.
export default function PdfButton({ id, size = 'md', className }) {
  const [busy, setBusy] = useState(false);
  const run = async (e) => {
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try { await downloadPerfilPdf(id); } catch (err) { console.error('[pdf] falha ao gerar', err); toast.error('Não foi possível gerar o PDF do perfil.'); } finally { setBusy(false); }
  };
  const sm = size === 'sm';
  return (
    <button onClick={run} onKeyDown={(e) => e.stopPropagation()} disabled={busy} title="Gerar PDF" aria-label="Gerar PDF do perfil"
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full border disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        sm ? 'h-7 w-7 border-border hover:border-primary/50' : 'h-9 w-9 border-primary/50 shadow-[var(--glow-stack)] hover:border-primary', className)}>
      {busy ? <Loader2 className={cn('animate-spin', sm ? 'h-3.5 w-3.5' : 'h-4 w-4')} /> : <FileText className={sm ? 'h-3.5 w-3.5' : 'h-4 w-4'} />}
    </button>
  );
}
