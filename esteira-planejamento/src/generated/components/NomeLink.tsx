import { ExternalLink, PanelRight } from 'lucide-react';
import { cn } from '@lib/utils';
import { type Projeto, tituloDe } from '@generated/lib/format';
import { urlItem } from '@generated/lib/links';
import { useAbrirProjeto } from '@generated/components/AbrirProjeto';

/**
 * Project name: opens the side panel (the "Abrir no quadro ↗" button lives inside it). Stops row click
 * handlers. Falls back to a link to the 02.01 item only when no panel is available.
 */
export function NomeLink({ p, className }: { p: Projeto; className?: string }) {
  const abrir = useAbrirProjeto();
  const cls = cn('group inline-flex min-w-0 max-w-full items-baseline gap-1 rounded-[var(--radius-sm)] text-left font-medium text-foreground hover:underline hover:underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', className);
  if (abrir) {
    return (
      <button type="button" title={`${p.name} — ver detalhes`} onClick={(ev) => { ev.stopPropagation(); abrir(p); }} className={cls}>
        <span className="min-w-0 truncate">{tituloDe(p)}</span>
        <PanelRight className="size-3 shrink-0 self-center text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
        <span className="sr-only">(abre o painel de detalhes)</span>
      </button>
    );
  }
  return (
    <a href={urlItem(p.id)} target="_blank" rel="noopener noreferrer" title={`${p.name} — abrir no quadro 02.01 (nova aba)`}
      onClick={(ev) => ev.stopPropagation()} className={cls}>
      <span className="min-w-0 truncate">{tituloDe(p)}</span>
      <ExternalLink className="size-3 shrink-0 self-center text-muted-foreground group-hover:text-primary" aria-hidden />
    </a>
  );
}
