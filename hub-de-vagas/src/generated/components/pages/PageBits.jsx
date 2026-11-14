import { ArrowLeft, ChevronRight } from 'lucide-react';
import OpenInMonday from '@generated/components/OpenInMonday';
import { clean, canon } from '@generated/lib/normalize';
import { cn } from '@lib/utils';

export function PageHeader({ crumbs, onBack, itemId, itemType, eyebrow, title, children }) {
  return (
    <header className="flex flex-col gap-4 border-b border-border pb-5">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={onBack} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-sm hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <nav aria-label="Trilha" className="flex min-w-0 flex-wrap items-center gap-1 text-xs text-muted-foreground">
          {crumbs.map((c, i) => (
            <span key={c.key ?? c.label} className="flex min-w-0 items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3 shrink-0" />}
              {c.onClick ? <button onClick={c.onClick} className="max-w-[220px] truncate hover:text-foreground">{c.label}</button>
                : <span className="max-w-[260px] truncate text-foreground">{c.label}</span>}
            </span>
          ))}
        </nav>
        <OpenInMonday type={itemType} itemId={itemId} className="ml-auto" />
      </div>
      <div>
        <p className="text-xs text-primary">{eyebrow}</p>
        <h1 className="mt-1 text-2xl font-medium leading-tight tracking-tight sm:text-3xl">{title}</h1>
      </div>
      {children}
    </header>
  );
}

export function Facts({ items }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((f) => (
        <div key={f.label} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{f.label}</dt>
          <dd className={cn('mt-0.5 min-w-0 truncate text-sm', f.tone === 'danger' && 'text-destructive', f.tone === 'warn' && 'text-[hsl(var(--warning))]')}>{f.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-border">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={active === t.id} onClick={() => onChange(t.id)}
          className={cn('-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors', active === t.id ? 'border-primary font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
          {t.label}{t.count != null && <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function TextBlock({ title, value }) {
  const v = clean(value);
  return (
    <section className="rounded-md border border-border bg-card p-4">
      <h3 className="text-sm font-medium">{title}</h3>
      {v ? <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{String(v)}</p>
        : <p className="mt-2 text-sm text-muted-foreground">Sem informação.</p>}
    </section>
  );
}

export function TagBlock({ title, values }) {
  const list = (clean(values) ?? []).map(canon);
  return (
    <section className="rounded-md border border-border bg-card p-4">
      <h3 className="text-sm font-medium">{title}</h3>
      {list.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">{[...new Set(list)].map((x) => <span key={x} className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs">{x}</span>)}</div>
      ) : <p className="mt-2 text-sm text-muted-foreground">Sem informação.</p>}
    </section>
  );
}

export function BlockSkeleton({ n = 3 }) {
  return <div className="grid gap-3 md:grid-cols-2">{Array.from({ length: n }, (_, i) => `sk${i}`).map((k) => <div key={k} className="h-28 animate-pulse rounded-md bg-muted" />)}</div>;
}
