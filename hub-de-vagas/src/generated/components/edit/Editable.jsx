import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Lock, CalendarDays, Pencil, Check, Loader2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@components/ui/popover';
import { Calendar } from '@components/ui/calendar';
import { Pill } from '@generated/components/Pill';
import { useEdit } from '@generated/components/edit/EditProvider';
import { EDITABLE, kindOf, optionsFor } from '@generated/lib/editing';
import { colorFor } from '@generated/lib/colors';
import { canon, normKey, clean } from '@generated/lib/normalize';
import { fmtDate, toDate } from '@generated/lib/data';
import { cn } from '@lib/utils';

const stop = (e) => e.stopPropagation();
// Subtle affordance shown on every editable field while "Modo edição" is on.
const AFFORD = 'group/ed inline-flex max-w-full items-center gap-1 rounded-md outline-dashed outline-1 outline-offset-2 outline-primary/30 transition-[outline-color] hover:outline-primary/80 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-ring';
const PencilHint = () => <Pencil className="h-3 w-3 shrink-0 text-primary opacity-0 transition-opacity group-hover/ed:opacity-100" aria-hidden="true" />;

// Resolves whether this field on this item can be edited right now.
export function useEditable(fieldKey, item) {
  const { editMode, canFor, edit, isPending, lockReason, checking } = useEdit();
  const kind = kindOf(fieldKey, item);
  const type = kind ? EDITABLE[kind][fieldKey] : null;
  const allowed = !!kind && canFor(kind);
  const pending = !!kind && isPending(item?.id, fieldKey);
  return { kind, type, pending, lockReason, active: allowed && editMode && !pending, locked: !!kind && !allowed && !checking, save: (v) => edit(kind, item, fieldKey, v) };
}

function Locked({ reason, children }) {
  return <span title={reason} className="inline-flex items-center gap-1">{children}<Lock className="h-3 w-3 shrink-0 text-muted-foreground" aria-label={reason} /></span>;
}
function Saving({ children }) {
  return <span aria-busy="true" title="salvando…" className="inline-flex items-center gap-1 opacity-70">{children}<Loader2 className="h-3 w-3 shrink-0 animate-spin text-primary" /><span className="sr-only">salvando…</span></span>;
}

export function EditableStatus({ item, fieldKey, className }) {
  const e = useEditable(fieldKey, item);
  const pill = <Pill fieldKey={fieldKey} label={item?.[fieldKey]} className={className} />;
  if (e.pending) return <Saving>{pill}</Saving>;
  if (e.locked) return <Locked reason={e.lockReason}>{pill}</Locked>;
  if (!e.active) return pill;
  const current = normKey(item?.[fieldKey]);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={stop}>
        <button className={cn(AFFORD, 'rounded-full')} title="Clique para alterar">
          {item?.[fieldKey] ? pill : <span className="rounded-full border border-dashed border-border px-2.5 py-0.5 text-xs text-muted-foreground" title="Vazio — clique para definir">—</span>}
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
          <PencilHint />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 w-64 overflow-y-auto" onClick={stop}>
        <DropdownMenuItem onSelect={() => e.save(null)} disabled={!item?.[fieldKey]} className="flex items-center gap-2 text-muted-foreground">
          <span className="h-3 w-3 shrink-0 rounded-full border border-dashed border-muted-foreground/60" />
          <span className="min-w-0 flex-1 truncate text-sm">— Vazio —</span>
          {!item?.[fieldKey] && <Check className="h-3.5 w-3.5 text-primary" />}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {optionsFor(fieldKey).map((opt) => (
          <DropdownMenuItem key={opt} onSelect={() => e.save(opt)} className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-full ring-1 ring-inset ring-foreground/15" style={{ backgroundColor: colorFor(fieldKey, opt) }} />
            <span className="min-w-0 flex-1 truncate text-sm" title={opt}>{canon(opt)}</span>
            {normKey(opt) === current && <Check className="h-3.5 w-3.5 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function EditableDate({ item, fieldKey, children }) {
  const e = useEditable(fieldKey, item);
  const [open, setOpen] = useState(false);
  const d = toDate(item?.[fieldKey]);
  const label = children ?? <span className="tabular-nums">{fmtDate(d)}</span>;
  if (e.pending) return <Saving>{label}</Saving>;
  if (e.locked) return <Locked reason={e.lockReason}>{label}</Locked>;
  if (!e.active) return label;
  const pick = (day) => { setOpen(false); e.save(day ? new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate())) : null); };
  const selected = d ? new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) : undefined;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild onClick={stop}>
        <button className={cn(AFFORD, 'px-1 py-0.5 text-left')} title="Alterar data">
          {label}<CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /><PencilHint />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2" onClick={stop}>
        <Calendar mode="single" selected={selected} defaultMonth={selected} onSelect={pick} />
        {d && <button onClick={() => pick(null)} className="mt-1 w-full rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">Limpar data</button>}
      </PopoverContent>
    </Popover>
  );
}

export function EditableText({ item, fieldKey, className }) {
  const e = useEditable(fieldKey, item);
  const [draft, setDraft] = useState(null);
  const inputRef = useRef(null);
  const editing = draft != null;
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);
  const value = clean(item?.[fieldKey]);
  const text = <span className={cn('line-clamp-2', className)} title={value ?? ''}>{value ?? '—'}</span>;
  if (e.pending) return <Saving>{text}</Saving>;
  if (e.locked) return <Locked reason={e.lockReason}>{text}</Locked>;
  if (!e.active) return text;
  if (editing) {
    return (
      <input ref={inputRef} value={draft} onClick={stop} onChange={(ev) => setDraft(ev.target.value)}
        onKeyDown={(ev) => {
          ev.stopPropagation();
          if (ev.key === 'Enter') { const v = draft.trim(); setDraft(null); e.save(v || null); }
          if (ev.key === 'Escape') setDraft(null);
        }}
        onBlur={() => setDraft(null)}
        className="h-8 w-full min-w-[160px] rounded-md border border-ring bg-background px-2 text-sm focus:outline-none" aria-label="Editar texto (Enter salva, Esc cancela)" />
    );
  }
  return (
    <button onClick={(ev) => { stop(ev); setDraft(value ?? ''); }} className={cn(AFFORD, 'w-full min-w-0 items-start px-1 py-0.5 text-left')} title="Clique para editar (Enter salva, Esc cancela)">
      {text}<PencilHint />
    </button>
  );
}

// Generic switch used by table/card/panel cells.
export function EditableField({ fieldKey, item, type }) {
  if (type === 'status') return <EditableStatus fieldKey={fieldKey} item={item} />;
  if (type === 'date') return <EditableDate fieldKey={fieldKey} item={item} />;
  return <EditableText fieldKey={fieldKey} item={item} />;
}
