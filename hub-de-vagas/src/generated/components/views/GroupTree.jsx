import { ChevronRight } from 'lucide-react';
import { cn } from '@lib/utils';

export function GroupHeader({ label, color, count, countLabel, open, onToggle, depth = 0, extra }) {
  return (
    <button onClick={onToggle} className={cn('group flex w-full items-center gap-2 py-2 text-left', depth > 0 && 'pl-4')}>
      <ChevronRight className={cn('h-4 w-4 shrink-0 transition-transform', open && 'rotate-90')} style={{ color }} />
      <span className="h-4 w-1 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className={cn('truncate font-medium', depth === 0 ? 'text-base' : 'text-sm')} style={{ color }}>{label}</span>
      <span className="shrink-0 rounded-full border border-border px-2 text-xs tabular-nums text-muted-foreground">{count} {countLabel}</span>
      {extra}
    </button>
  );
}

export default function GroupTree({ nodes, collapsed, toggle, renderLeaf, countOf, countLabel, depth = 0 }) {
  return (
    <div className={cn(depth === 0 ? 'space-y-4' : 'space-y-2 border-l border-border pl-2')}>
      {nodes.map((n) => {
        const open = !collapsed.has(n.id);
        return (
          <section key={n.id}>
            <GroupHeader label={n.label} color={n.empty ? 'hsl(var(--muted-foreground))' : n.color} count={countOf ? countOf(n.items) : n.items.length} countLabel={countLabel} open={open} onToggle={() => toggle(n.id)} depth={depth} />
            {open && (
              <div className={cn('mt-1', depth > 0 && 'pl-4')}>
                {n.children
                  ? <GroupTree nodes={n.children} collapsed={collapsed} toggle={toggle} renderLeaf={renderLeaf} countOf={countOf} countLabel={countLabel} depth={depth + 1} />
                  : renderLeaf(n.items, n)}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
