import type { ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@lib/utils';

/** Link para um quadro/item do monday com aparência de botão (borda arredondada, ícone ↗, efeito ao passar o mouse). */
export function LinkBotao({ href, children, className, size = 'md', title }: {
  href: string; children: ReactNode; className?: string; size?: 'sm' | 'md'; title?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={title}
      className={cn(
        'group inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-card text-foreground transition-colors hover:border-primary/60 hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        size === 'sm' ? 'min-h-8 px-2.5 text-xs' : 'min-h-9 px-3 text-sm',
        className,
      )}
    >
      <span className="min-w-0 truncate">{children}</span>
      <ArrowUpRight className="size-3.5 shrink-0 opacity-70 transition-transform group-hover:-translate-y-px group-hover:translate-x-px group-hover:opacity-100" aria-hidden />
      <span className="sr-only">(abre em nova aba)</span>
    </a>
  );
}
