import { NumberTicker } from '@generated/components/fx/NumberTicker';
import { useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@lib/utils';
import type { Projeto } from '@generated/lib/format';
import type { Changes } from '@generated/server/projetos';
import { TONE_DOT, toneOf } from '@generated/lib/status';
import { SEM_STATUS_SGI, chaveSgi, ordemSgi, ordenarAtivosPorCodigo, rotuloSgi } from '@generated/lib/sgi';
import { Panel, EmptyState, InfoDica } from '@generated/components/ui-bits';
import { StatusSgiRow } from '@generated/components/StatusSgiRow';

interface Props {
  items: Projeto[];
  /** Status SGI labels from the board settings (dynamic options). */
  opcoes: string[];
  onOpen: (p: Projeto) => void;
  salvar: (p: Projeto, c: Changes) => Promise<boolean>;
}

const Dot = ({ k }: { k: string }) => (
  <span className={cn('size-2 shrink-0 rounded-full', TONE_DOT[toneOf(k === SEM_STATUS_SGI ? null : k)])} aria-hidden />
);

export function StatusSgiTab({ items, opcoes, onOpen, salvar }: Props) {
  // Multi-selection of Status SGI cards; empty = everything (the "Total" card).
  const [sel, setSel] = useState<string[]>([]);
  const toggle = (k: string) => setSel((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));

  // Counts over the whole scope — never affected by the card selection.
  const { ordem, contagem } = useMemo(() => {
    const contagem = new Map<string, number>();
    for (const p of items) contagem.set(chaveSgi(p), (contagem.get(chaveSgi(p)) ?? 0) + 1);
    return { ordem: ordemSgi(items, opcoes), contagem };
  }, [items, opcoes]);

  const grupos = useMemo(() => {
    const map = new Map<string, Projeto[]>();
    for (const p of items) {
      const k = chaveSgi(p);
      if (sel.length && !sel.includes(k)) continue;
      map.set(k, [...(map.get(k) ?? []), p]);
    }
    return ordem.filter((k) => map.has(k)).map((k) => ({ k, linhas: [...(map.get(k) ?? [])].sort(ordenarAtivosPorCodigo) }));
  }, [items, sel, ordem]);

  if (!items.length) {
    return <EmptyState title="Nenhum projeto no escopo atual" hint="Ajuste os filtros no topo ou ative “Finalizados” para ampliar o escopo." />;
  }

  const exibidos = grupos.reduce((a, g) => a + g.linhas.length, 0);
  const selOrdenada = ordem.filter((k) => sel.includes(k));

  const card = (key: string | null, label: string, n: number) => {
    const on = key === null ? sel.length === 0 : sel.includes(key);
    const regra = key === null
      ? 'Todos os projetos no escopo dos filtros (Novo Cadastro só com “Incluir:”). Clique para limpar a seleção.'
      : key === SEM_STATUS_SGI
        ? 'Projetos com a coluna Status SGI vazia no 02.01. Clique para filtrar (pode combinar vários cards).'
        : `Projetos com Status SGI = “${label}” no 02.01, no escopo dos filtros. Clique para filtrar (pode combinar vários cards).`;
    return (
      <div key={key ?? 'total'}
        className={cn('relative flex min-w-0 flex-col items-start gap-1 bg-card px-4 py-3 transition-colors duration-150 hover:bg-[hsl(var(--surface-2))]',
          on && 'z-[1] bg-[hsl(var(--accent-soft))] shadow-[inset_0_0_0_2px_hsl(var(--primary))] hover:bg-[hsl(var(--accent-soft))]',
          key !== null && n === 0 && !on && 'opacity-50')}>
        <span className="flex w-full min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          {key !== null && <Dot k={key} />}
          <span className={cn('truncate', on && 'text-foreground')} title={label}>{label}</span>
          <InfoDica texto={regra} />
          {on && key !== null && <Check className="ml-auto size-3.5 shrink-0 text-primary" aria-hidden />}
        </span>
        <button type="button" aria-pressed={on} aria-label={`${label}: ${n} projeto(s)`} onClick={() => (key === null ? setSel([]) : toggle(key))}
          className="rounded-[var(--radius-sm)] text-left after:absolute after:inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <NumberTicker value={n} className="fx-num tnum text-3xl font-light text-foreground" />
        </button>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className=" relative grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-lg)] border border-border bg-border sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {card(null, 'Total', items.length)}
        {ordem.map((k) => card(k, rotuloSgi(k), contagem.get(k) ?? 0))}
      </div>

      {sel.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground" aria-live="polite">
          <span className="min-w-0">
            Exibindo <span className="tnum font-medium text-foreground">{exibidos}</span> projeto{exibidos === 1 ? '' : 's'} em{' '}
            <span className="text-foreground">{selOrdenada.map(rotuloSgi).join(', ')}</span>
          </span>
          <button type="button" onClick={() => setSel([])}
            className="inline-flex h-11 shrink-0 items-center gap-1 rounded-[var(--radius-md)] border border-input bg-[hsl(var(--surface-2))] px-2.5 text-foreground hover:bg-[hsl(var(--surface-3))] md:h-8">
            <X className="size-3.5" aria-hidden /> Limpar seleção
          </button>
        </div>
      )}

      {grupos.length === 0 ? (
        <Panel><EmptyState title="Nenhum projeto nos status selecionados" hint="Marque outros cards ou limpe a seleção." /></Panel>
      ) : (
        grupos.map(({ k, linhas }) => (
          <Panel key={k} title={rotuloSgi(k)} recolhivel={`sgi:${k}`} aside={<span className="tnum text-xs text-muted-foreground">{linhas.length} projeto{linhas.length === 1 ? '' : 's'}</span>}>
            <ul className="divide-y divide-border">
              {linhas.map((p) => <StatusSgiRow key={p.id} p={p} opcoes={opcoes} onOpen={onOpen} salvar={salvar} />)}
            </ul>
          </Panel>
        ))
      )}
    </div>
  );
}
