import { toast } from 'sonner';
import { Copy, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@components/ui/dialog';
import { btnNeutro } from '@generated/components/alocacao/cards';

/** Shows the deterministic validation report with "Copiar" and "Baixar .txt". */
export function RelatorioDialog({ texto, n, onClose }: { texto: string | null; n: number; onClose: () => void }) {
  const copiar = async () => {
    if (!texto) return;
    try {
      await navigator.clipboard.writeText(texto);
      toast.success('Relatório copiado');
    } catch (e) {
      console.error('Falha ao copiar o relatório', e);
      toast.error('Não foi possível copiar', { description: 'Selecione o texto e copie manualmente.' });
    }
  };
  const baixar = () => {
    if (!texto) return;
    const d = new Date();
    const nome = `relatorio-alocacao-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.txt`;
    const url = URL.createObjectURL(new Blob([texto], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Dialog open={texto !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl rounded-[var(--radius-lg)] border-border bg-popover shadow-none">
        <DialogHeader>
          <DialogTitle className="text-base">Relatório de alocação</DialogTitle>
          <DialogDescription className="text-[13px]">{n} linha(s) · texto gerado pelas regras do app (mesmos dados, mesmo texto). Registrado no Registro de ações.</DialogDescription>
        </DialogHeader>
        <label htmlFor="relatorio-texto" className="sr-only">Texto do relatório</label>
        <textarea id="relatorio-texto" readOnly value={texto ?? ''}
          className="h-80 w-full resize-y rounded-[var(--radius-md)] border border-input bg-[hsl(var(--surface-2))] p-3 text-[13px] leading-relaxed text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => void copiar()} className={btnNeutro}><Copy className="size-3.5" aria-hidden /> Copiar</button>
          <button type="button" onClick={baixar} className={btnNeutro}><Download className="size-3.5" aria-hidden /> Baixar .txt</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
