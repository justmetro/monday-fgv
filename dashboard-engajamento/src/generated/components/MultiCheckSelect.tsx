import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';

export interface MultiOption { value: string; label: string; subtitle?: string }

interface Props {
  options: MultiOption[];
  selected: string[];
  onChange: (v: string[]) => void;
  noun: [string, string]; // ["semana", "semanas"]
  searchable?: boolean;
  buttonClassName?: string;
}

/** Lista com caixas de seleção, com "Marcar todas" e "Desmarcar todas". */
export function MultiCheckSelect({ options, selected, onChange, noun, searchable = false, buttonClassName = '' }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const sel = useMemo(() => new Set(selected), [selected]);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? options.filter((o) => `${o.label} ${o.subtitle ?? ''}`.toLowerCase().includes(t)) : options;
  }, [options, q]);
  const all = options.length > 0 && options.every((o) => sel.has(o.value));
  const text = all ? `Todos (${options.length} ${noun[1]})` : selected.length === 1
    ? options.find((o) => o.value === selected[0])?.label ?? `1 ${noun[0]}`
    : `${selected.length} ${selected.length === 1 ? noun[0] : noun[1]}`;
  const toggle = (v: string) => onChange(sel.has(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  const box = (on: boolean) => (
    <span className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${on ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background'}`}>
      {on && <Check className="h-3 w-3" />}
    </span>
  );

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className={`inline-flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground hover:bg-muted ${buttonClassName}`}>
        <span className="truncate">{text}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-1 w-80 max-w-[90vw] rounded-lg border border-border bg-card p-1.5 shadow-lg">
          {searchable && (
            <div className="relative mb-1">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar..."
                className="h-8 w-full rounded-md border border-input bg-background pl-7 pr-2 text-xs" />
            </div>
          )}
          <div className="flex gap-1 border-b border-border pb-1.5">
            <button type="button" onClick={() => onChange([...new Set([...selected, ...list.map((o) => o.value)])])}
              className="flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted">{box(all)} Marcar todas</button>
            <button type="button" onClick={() => onChange(q ? selected.filter((v) => !list.some((o) => o.value === v)) : [])}
              className="flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted">{box(selected.length === 0)} Desmarcar todas</button>
          </div>
          <div className="mt-1 max-h-72 overflow-y-auto">
            {list.map((o) => (
              <button key={o.value} type="button" onClick={() => toggle(o.value)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted">
                {box(sel.has(o.value))}
                <span className="min-w-0">
                  <span className="block truncate text-foreground">{o.label}</span>
                  {o.subtitle && <span className="block truncate text-[10px] text-muted-foreground">{o.subtitle}</span>}
                </span>
              </button>
            ))}
            {list.length === 0 && <p className="px-2 py-3 text-center text-xs text-muted-foreground">Nada encontrado.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
