import { useState, type ReactNode } from 'react';
import { Check, ChevronDown, Info, RotateCcw } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@components/ui/command';
import { cn } from '@lib/utils';
import { CHIP, DOT } from '@generated/components/alocacao/cores';
import { normNome } from '@generated/lib/nomes';

/** Search by any part of the text, accent and case insensitive. */
const filtroContem = (value: string, search: string) => (normNome(value).includes(normNome(search)) ? 1 : 0);

export const quando = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
};

/** Short help line at the top of a sub-tab ("Clique em um projeto para ver detalhes e editar."). */
export function AjudaLinha({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-xs text-[hsl(var(--fg-subtle))]">
      <Info className="size-3.5 shrink-0" aria-hidden /> {children}
    </p>
  );
}

export function Chip({ corVar, children, className }: { corVar: string; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex h-6 max-w-full items-center gap-1.5 whitespace-nowrap rounded-[var(--radius-sm)] border px-1.5 text-xs font-medium', CHIP[corVar], className)}>
      <span className={cn('size-1.5 shrink-0 rounded-full', DOT[corVar])} aria-hidden />
      <span className="truncate">{children}</span>
    </span>
  );
}

interface ChipSelectProps {
  label: string;
  valor: string | null;
  calc: string | null;
  ajuste: { data: { autor: string; em: string } } | null;
  opcoes: readonly string[];
  corDe: (v: string | null) => string;
  onChange: (v: string) => void;
  onReset: () => void;
  vazio?: string;
  nota?: string;
}

/** Colored chip that opens a radio menu; shows "revisado" + "voltar ao calculado" when overridden. */
export function ChipSelect({ label, valor, calc, ajuste, opcoes, corDe, onChange, onReset, vazio = '—', nota }: ChipSelectProps) {
  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label={`${label}: ${valor ?? vazio}. Alterar`}
            className="inline-flex min-h-11 max-w-full items-center gap-1 rounded-[var(--radius-sm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-0">
            <Chip corVar={corDe(valor)}>{valor ?? vazio}</Chip>
            <ChevronDown className="size-3 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" collisionPadding={12} className="max-h-[var(--radix-dropdown-menu-content-available-height)] min-w-52 overflow-y-auto rounded-[var(--radius-lg)] border-border">
          <DropdownMenuLabel className="text-xs text-muted-foreground">{label} · calculado: {calc ?? vazio}</DropdownMenuLabel>
          {nota && <p className="max-w-64 px-2 pb-1.5 text-[11px] leading-snug text-[hsl(var(--fg-subtle))]">{nota}</p>}
          <DropdownMenuRadioGroup value={valor ?? ''} onValueChange={(v) => v !== valor && onChange(v)}>
            {opcoes.map((o) => (
              <DropdownMenuRadioItem key={o} value={o} className="text-[13px]">
                <span className={cn('mr-1.5 size-2 rounded-full', DOT[corDe(o)])} aria-hidden /> {o}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          {ajuste && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onReset} className="text-[13px]">
                <RotateCcw className="size-3.5" aria-hidden /> Voltar ao calculado ({calc ?? vazio})
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}


export interface ComboItem { id: string; label: string; sub?: string; /** Extra full-width line (e.g. manager experience). */ detalhe?: string; grupo?: string; /** Dimmed tag (e.g. "já atribuído"); still selectable. */ marca?: string; desabilitado?: boolean }

/** Searchable picker (Popover + Command). */
export function BuscaCombo({ itens, onPick, gatilho, placeholder, vazio = 'Nada encontrado.' }: {
  itens: ComboItem[]; onPick: (i: ComboItem) => void; gatilho: ReactNode; placeholder: string; vazio?: string;
}) {
  const [open, setOpen] = useState(false);
  const grupos = [...new Set(itens.map((i) => i.grupo ?? ''))];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{gatilho}</PopoverTrigger>
      <PopoverContent align="start" collisionPadding={12} className="w-80 max-w-[calc(100vw-24px)] rounded-[var(--radius-lg)] border-border p-0 shadow-none">
        <Command filter={filtroContem}>
          <CommandInput placeholder={placeholder} className="text-[13px]" />
          <CommandList className="max-h-[min(18rem,var(--radix-popover-content-available-height,18rem))]">
            <CommandEmpty>{vazio}</CommandEmpty>
            {grupos.map((gr) => (
              <CommandGroup key={gr || '_'} heading={gr || undefined}>
                {itens.filter((i) => (i.grupo ?? '') === gr).map((i) => (
                  <CommandItem key={i.id} value={`${i.label} ${i.sub ?? ''} ${i.id}`} disabled={i.desabilitado}
                    onSelect={() => { if (i.desabilitado) return; setOpen(false); onPick(i); }}
                    className={cn((i.marca || i.desabilitado) && 'opacity-55')}>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[13px]">{i.label}</span>
                      {i.sub && <span className="truncate text-[11px] text-muted-foreground">{i.sub}</span>}
                      {i.detalhe && <span className="text-[11px] leading-snug text-[hsl(var(--fg-subtle))]">{i.detalhe}</span>}
                    </span>
                    {i.marca && <span className="shrink-0 rounded-[var(--radius-sm)] border border-border px-1 text-[10px] text-muted-foreground">{i.marca}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export const btnAdd =
  'inline-flex h-11 items-center gap-1 rounded-[var(--radius-sm)] border border-dashed border-input px-2 text-xs text-muted-foreground transition-colors duration-150 hover:border-[hsl(var(--primary)/0.6)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-7';

/** Multi-select of Eixos (chips + checklist) with "voltar ao calculado". */
export function EixosEdit({ valor, calc, ajuste, opcoes, onChange, onReset }: {
  valor: string[]; calc: string[]; ajuste: { data: { autor: string; em: string } } | null; opcoes: string[];
  onChange: (v: string[]) => void; onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const todos = [...new Set([...opcoes, ...valor])];
  const toggle = (o: string) => onChange(valor.includes(o) ? valor.filter((x) => x !== o) : [...valor, o]);
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1">
      {valor.map((e) => (
        <span key={e} className="max-w-[180px] truncate rounded-[var(--radius-sm)] border border-border bg-[hsl(var(--surface-2))] px-1.5 py-0.5 text-[11px] text-foreground" title={e}>{e}</span>
      ))}
      {!valor.length && <span className="text-xs text-[hsl(var(--fg-subtle))]">Sem eixos</span>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" className={btnAdd} aria-label="Editar eixos">Editar</button>
        </PopoverTrigger>
        <PopoverContent align="start" collisionPadding={12} className="max-h-[var(--radix-popover-content-available-height)] w-72 overflow-y-auto rounded-[var(--radius-lg)] border-border p-1 shadow-none">
          <p className="px-2 py-1.5 text-[11px] text-muted-foreground">Padrão: eixos dos projetos ativos ({calc.length ? calc.join(', ') : 'nenhum'})</p>
          <ul>
            {todos.map((o) => (
              <li key={o}>
                <button type="button" onClick={() => toggle(o)} aria-pressed={valor.includes(o)}
                  className="flex min-h-11 w-full items-center gap-2 rounded-[var(--radius-sm)] px-2 text-left text-[13px] hover:bg-accent md:min-h-8">
                  <span className={cn('flex size-4 items-center justify-center rounded-[3px] border', valor.includes(o) ? 'border-primary bg-primary text-primary-foreground' : 'border-input')}>
                    {valor.includes(o) && <Check className="size-3" aria-hidden />}
                  </span>
                  {o}
                </button>
              </li>
            ))}
          </ul>
          {ajuste && (
            <button type="button" onClick={() => { onReset(); setOpen(false); }}
              className="mt-1 flex min-h-11 w-full items-center gap-2 border-t border-border px-2 text-left text-[13px] text-muted-foreground hover:text-foreground md:min-h-8">
              <RotateCcw className="size-3.5" aria-hidden /> Voltar ao calculado
            </button>
          )}
        </PopoverContent>
      </Popover>
    </span>
  );
}
