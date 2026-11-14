import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface Props {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

/** Bloco com título e botão de minimizar. */
export function CollapsibleCard({ title, subtitle, actions, defaultOpen = true, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 px-5 py-3.5">
        <button type="button" onClick={() => setOpen((v) => !v)} className="flex min-w-0 items-center gap-2 text-left" aria-expanded={open}>
          <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? '' : '-rotate-90'}`} />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-foreground">{title}</span>
            {subtitle && open ? <span className="block text-xs text-muted-foreground">{subtitle}</span> : null}
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {open && actions}
          <button type="button" onClick={() => setOpen((v) => !v)} className="h-7 rounded-md px-2 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground">
            {open ? 'Minimizar' : 'Expandir'}
          </button>
        </div>
      </div>
      {open && <div className="border-t border-border px-5 py-4">{children}</div>}
    </section>
  );
}
