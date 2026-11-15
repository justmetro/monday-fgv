import { NumberTicker } from '@generated/components/fx/NumberTicker';
import { SpotlightCard } from '@generated/components/fx/SpotlightCard';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight } from 'lucide-react';
import { cn } from '@lib/utils';
import { DOT } from '@generated/components/alocacao/cores';
import { InfoDica } from '@generated/components/ui-bits';

export interface CardInfo { key: string; label: string; value: number; corVar?: string; foot?: ReactNode; /** Calculation rule shown in the "i" tooltip. */ regra?: string }

/** Strip of count cards; clickable when onClick is given (selection shown with a thick border). */
export function Cards({ cards, ativos, onClick, cols = 'sm:grid-cols-4 xl:grid-cols-7' }: {
  cards: CardInfo[]; ativos?: Set<string>; onClick?: (k: string) => void; cols?: string;
}) {
  return (
    <div className={cn('fx-stagger grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-lg)] border border-border bg-border', cols)}>
      {cards.map((c) => {
        const ativo = !!ativos?.has(c.key);
        const titulo = (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {c.corVar && <span className={cn('size-2 shrink-0 rounded-full', DOT[c.corVar])} aria-hidden />}
            <span className="truncate">{c.label}</span>
            <InfoDica texto={c.regra ?? `Quantidade de itens em “${c.label}” com a busca e os filtros atuais da aba.`} />
          </span>
        );
        const numero = <NumberTicker value={c.value} className="fx-num tnum text-3xl font-light leading-none tracking-[-0.02em] text-foreground" />;
        const foot = c.foot && <span className="text-[11px] text-[hsl(var(--fg-subtle))]">{c.foot}</span>;
        const base = 'flex min-w-0 flex-col gap-1.5 bg-card px-4 py-3 text-left';
        // Clickable card: the "i" stays a sibling of the (stretched) button — never a button inside a button.
        return onClick ? (
          <div key={c.key} className={cn(base, 'relative transition-colors duration-150 hover:bg-[hsl(var(--surface-2))]',
            ativo && 'bg-[hsl(var(--accent-soft))] shadow-[inset_0_0_0_3px_hsl(var(--primary))]')}>
            {titulo}
            <button type="button" aria-pressed={ativo} aria-label={`${c.label}: ${c.value}`} onClick={() => onClick(c.key)}
              className="flex flex-col items-start gap-1.5 rounded-[var(--radius-sm)] text-left after:absolute after:inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {numero}{foot}
            </button>
          </div>
        ) : (
          <SpotlightCard key={c.key} className={base}>{titulo}{numero}{foot}</SpotlightCard>
        );
      })}
    </div>
  );
}

/** Multi-select card filter: toggles keys; the "total" key clears the selection. */
export function useFiltroCards(totalKey = '__total') {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const clicar = (k: string) => setSel((s) => {
    if (k === totalKey) return new Set();
    const n = new Set(s);
    if (n.has(k)) n.delete(k); else n.add(k);
    return n;
  });
  return { sel, clicar, limpar: () => setSel(new Set()) };
}

export type Dir = 'asc' | 'desc';
export type Getter<T> = (r: T) => string | number | null | undefined;

/** Sorting for any table: every column gets a getter; strings use pt-BR collation, empty values last. */
export function useOrdenacao<T, K extends string>(rows: T[], getters: Record<K, Getter<T>>, inicial: { key: NoInfer<K>; dir: Dir }) {
  const [sort, setSort] = useState<{ key: K; dir: Dir }>(inicial);
  const ordenadas = useMemo(() => {
    const get = getters[sort.key];
    const m = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      const vaz = (v: unknown) => v === null || v === undefined || v === '';
      if (vaz(va) || vaz(vb)) return vaz(va) === vaz(vb) ? 0 : vaz(va) ? 1 : -1;
      const c = typeof va === 'string' && typeof vb === 'string' ? va.localeCompare(vb, 'pt-BR') : Number(va) - Number(vb);
      return c * m;
    });
  }, [rows, sort, getters]);
  return { ordenadas, sort, setSort };
}

export function Th<K extends string>({ k, label, sort, setSort, className }: {
  k: K; label: string; sort: { key: K; dir: Dir }; setSort: (s: { key: K; dir: Dir }) => void; className?: string;
}) {
  const ativo = sort.key === k;
  const Icon = !ativo ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th scope="col" aria-sort={ativo ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={cn('px-3 py-2 text-left font-medium', className)}>
      <button type="button" onClick={() => setSort({ key: k, dir: ativo && sort.dir === 'asc' ? 'desc' : 'asc' })}
        className="inline-flex items-center gap-1 whitespace-nowrap rounded-[var(--radius-sm)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {label} <Icon className={cn('size-3', !ativo && 'opacity-50')} aria-hidden />
      </button>
    </th>
  );
}

export const thCls = 'px-3 py-2 text-left font-medium';
export const tabelaCls = 'w-full min-w-[760px] border-collapse text-[13px]';
export const theadCls = 'border-b border-border bg-[hsl(var(--surface-2))] text-xs text-muted-foreground';
export const trCls = 'border-b border-border align-top last:border-b-0';
/** Neutral action button used across the tab. */
export const btnNeutro = 'inline-flex h-11 items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-input bg-[hsl(var(--surface-2))] px-2.5 text-[13px] text-foreground transition-colors duration-150 hover:bg-[hsl(var(--surface-3))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 md:h-8';

/** Stable key for a section title: the text without the "(n)" counter. */
function chaveDe(titulo: ReactNode, id?: string) {
  if (id) return id;
  const txt = typeof titulo === 'string' ? titulo : Array.isArray(titulo) ? titulo.filter((t) => typeof t === 'string').join('') : '';
  return txt.replace(/\(\s*\d+\s*\)/g, '').trim() || null;
}

const EVT_TODOS = 'aloc-secao-todos';
/** "Recolher todos / Expandir todos": opens/closes every Secao of the given group (and remembers it). */
export function definirTodos(grupo: string, aberto: boolean) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EVT_TODOS, { detail: { grupo, aberto } }));
}

/** Remembers open/closed per section in this browser (localStorage, failures ignored). */
function useAberto(chave: string | null, grupo?: string) {
  const k = chave ? `aloc-secao:${chave}` : null;
  const [aberto, setAberto] = useState(true);
  useEffect(() => {
    if (!k) return;
    try { const v = window.localStorage.getItem(k); if (v !== null) setAberto(v === '1'); } catch { /* storage unavailable */ }
  }, [k]);
  useEffect(() => {
    if (!grupo) return;
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ grupo: string; aberto: boolean }>).detail;
      if (d?.grupo !== grupo) return;
      setAberto(d.aberto);
      if (k) { try { window.localStorage.setItem(k, d.aberto ? '1' : '0'); } catch { /* storage unavailable */ } }
    };
    window.addEventListener(EVT_TODOS, on);
    return () => window.removeEventListener(EVT_TODOS, on);
  }, [grupo, k]);
  const alternar = () => setAberto((a) => {
    const n = !a;
    if (k) { try { window.localStorage.setItem(k, n ? '1' : '0'); } catch { /* storage unavailable */ } }
    return n;
  });
  return { aberto, alternar };
}

/** Collapsible block: chevron left of the title (counter stays in the title), state remembered. */
export function Secao({ titulo, aside, children, id, grupo }: { titulo: ReactNode; aside?: ReactNode; children: ReactNode; id?: string; grupo?: string }) {
  const { aberto, alternar } = useAberto(chaveDe(titulo, id), grupo);
  return (
    <section className="fx-grain min-w-0 overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card">
      <header className={cn('flex flex-wrap items-center justify-between gap-2 px-4 py-2.5', aberto && 'border-b border-border')}>
        <h3 className="min-w-0 text-sm font-semibold text-foreground">
          <button type="button" onClick={alternar} aria-expanded={aberto}
            className="-ml-1.5 inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-sm)] px-1.5 text-left hover:bg-[hsl(var(--surface-2))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-7">
            <ChevronRight className={cn('size-4 shrink-0 text-muted-foreground transition-transform duration-150', aberto && 'rotate-90')} aria-hidden />
            <span>{titulo}</span>
          </button>
        </h3>
        {aberto && aside}
      </header>
      {aberto && children}
    </section>
  );
}
