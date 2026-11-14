import { ExternalLink, AppWindow } from 'lucide-react';
import { openInMonday, openItemPage } from '@generated/lib/data';
import { cn } from '@lib/utils';
import PdfButton from '@generated/components/PdfButton';

const BTN = 'inline-flex h-9 w-9 items-center justify-center rounded-full border border-primary/50 shadow-[var(--glow-stack)] hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

// Two icon buttons: go to the item in its board view · open the item card as a window.
export default function OpenInMonday({ type, itemId, className }) {
  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      {type === 'perfil' && <PdfButton id={itemId} />}
      <button onClick={() => openItemPage(type, itemId)} title="Ir para o item no quadro" aria-label="Ir para o item no quadro" className={BTN}>
        <ExternalLink className="h-4 w-4" />
      </button>
      <button onClick={() => openInMonday(itemId)} title="Abrir em janela" aria-label="Abrir em janela" className={BTN}>
        <AppWindow className="h-4 w-4" />
      </button>
    </div>
  );
}
