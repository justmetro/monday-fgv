import { useMemo, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from '@components/ui/dropdown-menu';
import { Checkbox } from '@components/ui/checkbox';
import { cn } from '@lib/utils';
import { COMPLEXIDADES, COMPLEX_COR, TEMPS, TEMP_COR, type Destino } from '@generated/lib/alocacao';
import { DOT } from '@generated/components/alocacao/cores';
import { btnNeutro } from '@generated/components/alocacao/cards';
import type { AlocCtx } from '@generated/components/alocacao/ctx';

/** Selection of projects (ids) limited to the rows currently visible (current filter). */
export function useSelecao(visiveis: Destino[]) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const ids = useMemo(() => new Set(visiveis.map((d) => d.p.id)), [visiveis]);
  const selecionados = visiveis.filter((d) => sel.has(d.p.id));
  const todos = visiveis.length > 0 && selecionados.length === visiveis.length;
  return {
    sel,
    selecionados,
    toggle: (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }),
    /** "Selecionar todos" of the current filter (or clear when all are selected). */
    toggleTodos: () => setSel(todos ? new Set() : new Set(ids)),
    estadoTodos: todos ? (true as const) : selecionados.length ? ('indeterminate' as const) : (false as const),
    limpar: () => setSel(new Set()),
  };
}
export type Selecao = ReturnType<typeof useSelecao>;

export function CheckTodos({ s, n }: { s: Selecao; n: number }) {
  return <Checkbox checked={s.estadoTodos} onCheckedChange={s.toggleTodos} aria-label={`Selecionar todos os ${n} projetos do filtro atual`} />;
}
export function CheckLinha({ s, d }: { s: Selecao; d: Destino }) {
  return <Checkbox checked={s.sel.has(d.p.id)} onCheckedChange={() => s.toggle(d.p.id)} aria-label={`Selecionar ${d.p.name}`} />;
}

/** Bulk action bar: temperature, complexity, back to calculated, deactivate / reactivate — one optimistic mutation. */
export function BarraMassa({ ctx, s }: { ctx: AlocCtx; s: Selecao }) {
  const lista = s.selecionados;
  if (!lista.length) return null;
  const ids = lista.map((d) => d.p.id);
  const aplicar = async (fn: () => Promise<boolean>) => { if (await fn()) s.limpar(); };
  const definir = (tipo: 'temperatura' | 'complexidade', valor: string) =>
    aplicar(() => ctx.api.emMassa(ids.map((alvoId) => ({ tipo, alvoId, valor })), []));
  const nDesat = lista.filter((d) => d.desativado).length;
  const item = 'text-[13px]';

  return (
    <div role="toolbar" aria-label="Ações em massa"
      className="sticky bottom-2 z-20 flex flex-wrap items-center gap-2 rounded-[var(--radius-lg)] border border-[hsl(var(--primary)/0.45)] bg-[hsl(var(--surface-2))] px-3 py-2 text-[13px]">
      <span className="tnum font-medium text-foreground">{lista.length} selecionado(s)</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><button type="button" className={btnNeutro}>Definir temperatura <ChevronDown className="size-3" aria-hidden /></button></DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="rounded-[var(--radius-lg)] border-border">
          <DropdownMenuLabel className="text-xs text-muted-foreground">Temperatura de assinatura</DropdownMenuLabel>
          {TEMPS.map((t) => (
            <DropdownMenuItem key={t} className={item} onSelect={() => void definir('temperatura', t)}>
              <span className={cn('size-2 rounded-full', DOT[TEMP_COR[t]])} aria-hidden /> {t}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><button type="button" className={btnNeutro}>Definir complexidade <ChevronDown className="size-3" aria-hidden /></button></DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="rounded-[var(--radius-lg)] border-border">
          {COMPLEXIDADES.map((c) => (
            <DropdownMenuItem key={c} className={item} onSelect={() => void definir('complexidade', c)}>
              <span className={cn('size-2 rounded-full', DOT[COMPLEX_COR[c]])} aria-hidden /> {c}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <button type="button" className={btnNeutro} title="Remove as revisões de temperatura e complexidade dos selecionados"
        onClick={() => void aplicar(() => ctx.api.emMassa([], ids.flatMap((alvoId) => [{ tipo: 'temperatura' as const, alvoId }, { tipo: 'complexidade' as const, alvoId }])))}>
        Voltar ao calculado
      </button>
      {nDesat < lista.length && (
        <button type="button" className={btnNeutro}
          onClick={() => void aplicar(() => ctx.api.emMassa(lista.filter((d) => !d.desativado).map((d) => ({ tipo: 'desativado' as const, alvoId: d.p.id, valor: '1' })), []))}>
          Desativar ({lista.length - nDesat})
        </button>
      )}
      {nDesat > 0 && (
        <button type="button" className={btnNeutro}
          onClick={() => void aplicar(() => ctx.api.emMassa([], lista.filter((d) => d.desativado).map((d) => ({ tipo: 'desativado' as const, alvoId: d.p.id }))))}>
          Reativar ({nDesat})
        </button>
      )}
      <button type="button" onClick={s.limpar} aria-label="Limpar seleção"
        className="ml-auto flex size-11 items-center justify-center rounded-[var(--radius-sm)] text-muted-foreground hover:bg-accent hover:text-foreground md:size-8">
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}

/** Per-project "Desativar" / "Reativar" (app only; hidden by default, see "Mostrar projetos desativados"). */
export function DesativarProjeto({ ctx, d }: { ctx: AlocCtx; d: Destino }) {
  const on = !!d.desativado;
  return (
    <button type="button" onClick={() => void (on ? ctx.api.voltarCalculado('desativado', d.p.id) : ctx.api.ajustar('desativado', d.p.id, '1'))}
      title={on ? `Desativado por ${d.desativado?.data.autor ?? ''}` : 'Oculta o projeto desta aba (somente no app)'}
      className="inline-flex h-11 items-center rounded-[var(--radius-sm)] px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground md:h-7">
      {on ? 'Reativar' : 'Desativar'}
    </button>
  );
}
