import { AlertTriangle } from 'lucide-react';
import { Cell } from '@generated/components/Pill';
import { VagaAge, AgeBadge, perfilAge } from '@generated/components/Age';
import { cn } from '@lib/utils';

export default function CardsView({ items, fields, subtitle, onOpen, tone, footer, action }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {items.map((it) => {
        const t = tone?.(it);
        return (
          <div key={it.id} role="button" tabIndex={0} onClick={() => onOpen(it)} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(it); }}
            className={cn('lift flex cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-w-0 flex-col gap-3 rounded-md border bg-card p-4 text-left hover:shadow-[var(--glow-stack)]',
              t === 'danger' ? 'border-destructive/50' : t === 'warn' ? 'border-[hsl(var(--warning)/0.5)]' : 'border-border')}>
            <div className="min-w-0">
              <div className={cn('flex items-start gap-1.5 font-medium leading-snug', t === 'danger' && 'text-destructive', t === 'warn' && 'text-[hsl(var(--warning))]')}>
                {t && <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}<span className="line-clamp-2 min-w-0 flex-1">{it.name}</span>{action?.(it)}
              </div>
              {subtitle && <div className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle(it) || '—'}</div>}
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
              {fields.map((f) => (
                <div key={f.key} className="min-w-0">
                  <dt className="text-[11px] text-muted-foreground">{f.label}</dt>
                  <dd className="mt-0.5 min-w-0 truncate text-xs"><Cell field={f} item={it} /></dd>
                </div>
              ))}
            </dl>
            {(it._matches && 'vagaEmAberto' in it) ? <VagaAge vaga={it} className="self-start" /> : perfilAge(it) ? <AgeBadge {...perfilAge(it)} className="self-start" /> : null}
            {footer?.(it)}
          </div>
        );
      })}
    </div>
  );
}
