import type { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { cn } from '@lib/utils';

export const inputCls =
  'h-11 w-full min-w-0 rounded-[var(--radius-md)] border border-input bg-[hsl(var(--surface-2))] px-2.5 text-base text-foreground ' +
  'placeholder:text-[hsl(var(--fg-subtle))] focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20 ' +
  'aria-invalid:border-[hsl(var(--danger))] md:h-8 md:text-[13px]';

export function Campo({ id, label, children, alterado }: { id: string; label: string; children: ReactNode; alterado?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {label}
        {alterado && <span className="size-1.5 rounded-full bg-primary" title="Alterado" aria-label="alterado" />}
      </label>
      {children}
    </div>
  );
}

export function SelectCampo({ id, value, options, onChange }: { id: string; value: string; options: string[]; onChange: (v: string) => void }) {
  const opts = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={cn(inputCls, 'appearance-auto pr-1')}>
      <option value="">— vazio —</option>
      {opts.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

/** Read-only value (formula, mirror, relation) shown with a lock icon. */
export function Bloqueado({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 text-[11px] text-[hsl(var(--fg-subtle))]">
        <Lock className="size-3" aria-hidden /> {label}
      </dt>
      <dd className="mt-0.5 break-words text-[13px] text-muted-foreground">{value}</dd>
    </div>
  );
}
