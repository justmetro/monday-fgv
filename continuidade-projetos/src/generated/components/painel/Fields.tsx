import { useState, type ReactNode } from 'react';
import { CalendarDays, ChevronDown, X } from 'lucide-react';
import { ptBR } from 'react-day-picker/locale';
import { Calendar } from '@components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@components/ui/popover';
import { Input } from '@components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { cn } from '@lib/utils';
import { fmtDate, parseIso, toIso } from '@generated/lib/painel';

export function Field({ label, htmlFor, hint, error, children, className }: {
  label: string; htmlFor?: string; hint?: ReactNode; error?: string | null; children: ReactNode; className?: string;
}) {
  const errId = htmlFor ? `${htmlFor}-err` : undefined;
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
      {error ? (
        <p id={errId} className="text-xs text-[hsl(var(--danger-ink))]">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function DateField({ id, value, onChange, invalid, placeholder = 'dd/mm/aaaa' }: {
  id: string; value: string | null; onChange: (v: string | null) => void; invalid?: boolean; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = parseIso(value) ?? undefined;
  return (
    <div className="flex min-w-0 items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? `${id}-err` : undefined}
            className={cn(
              'tnum flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-input bg-card px-3 text-left text-sm hover:border-[hsl(var(--ring))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              !value && 'text-muted-foreground',
              invalid && 'border-destructive',
            )}
          >
            <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate">{value ? fmtDate(value) : placeholder}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            locale={ptBR}
            captionLayout="dropdown"
            startMonth={new Date(2018, 0)}
            endMonth={new Date(2035, 11)}
            selected={selected}
            defaultMonth={selected}
            onSelect={(d) => { onChange(d ? toIso(d) : null); setOpen(false); }}
          />
        </PopoverContent>
      </Popover>
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label="Limpar data"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export type Range = { from: string | null; to: string | null } | null;

export function RangeField({ id, label, value, onChange }: { id: string; label: string; value: Range; onChange: (v: Range) => void }) {
  const set = (k: 'from' | 'to', v: string | null) => {
    const next = { from: value?.from ?? null, to: value?.to ?? null, [k]: v };
    onChange(!next.from && !next.to ? null : next);
  };
  return (
    <fieldset className="flex min-w-0 flex-col gap-1.5 sm:col-span-2">
      <legend className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="w-10 shrink-0 text-xs text-muted-foreground">Início</span>
          <DateField id={`${id}-from`} value={value?.from ?? null} onChange={(v) => set('from', v)} />
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <span className="w-10 shrink-0 text-xs text-muted-foreground">Fim</span>
          <DateField id={`${id}-to`} value={value?.to ?? null} onChange={(v) => set('to', v)} />
        </div>
      </div>
    </fieldset>
  );
}

export function NumberField({ id, value, onChange, step = 1, min = 0, prefix }: {
  id: string; value: number | null; onChange: (v: number | null) => void; step?: number; min?: number; prefix?: string;
}) {
  return (
    <div className="relative min-w-0">
      {prefix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{prefix}</span>}
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        step={step}
        value={value ?? ''}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') return onChange(null);
          const n = Number(raw);
          if (!Number.isFinite(n)) return onChange(null);
          onChange(n < min ? min : n); // sem valores abaixo do mínimo (padrão 0)
        }}
        className={cn('tnum h-9 bg-card text-base sm:text-sm', prefix && 'pl-9')}
      />
    </div>
  );
}

const NONE = '__none';
export function SelectField({ id, value, onChange, options, placeholder = 'Selecionar', invalid }: {
  id: string; value: string | null; onChange: (v: string | null) => void; options: string[]; placeholder?: string; invalid?: boolean;
}) {
  return (
    <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : v)}>
      <SelectTrigger id={id} aria-invalid={invalid || undefined} className="h-9 w-full bg-card text-sm">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}><span className="text-muted-foreground">— Vazio —</span></SelectItem>
        {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

/** Seção do painel; pode ser recolhida/expandida pelo título. */
export function Section({ title, aside, children, id, defaultOpen = true }: { title: string; aside?: ReactNode; children: ReactNode; id?: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section aria-labelledby={id} className="border-t border-border px-5 py-5 sm:px-6">
      <div className={cn('flex flex-wrap items-center justify-between gap-2', open && 'mb-4')}>
        <h3 id={id} className="text-sm font-semibold tracking-[-0.01em] text-foreground">
          <button
            type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
            className="-ml-1.5 inline-flex min-h-8 items-center gap-1 rounded-md px-1.5 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform duration-150', !open && '-rotate-90')} aria-hidden />
            {title}
          </button>
        </h3>
        {aside}
      </div>
      {open && children}
    </section>
  );
}

/** Bloco recolhível genérico para listas (cabeçalho clicável + conteúdo). */
export function Recolhivel({ titulo, resumo, children, defaultOpen = true, className }: {
  titulo: ReactNode; resumo?: ReactNode; children: ReactNode; defaultOpen?: boolean; className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
          className="-ml-1.5 inline-flex min-h-8 min-w-0 items-center gap-1 rounded-md px-1.5 text-left text-sm font-semibold text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform duration-150', !open && '-rotate-90')} aria-hidden />
          {titulo}
        </button>
        {resumo}
      </div>
      {open && children}
    </div>
  );
}
