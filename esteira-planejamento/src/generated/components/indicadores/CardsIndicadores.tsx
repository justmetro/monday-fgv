import { cn } from '@lib/utils';
import { InfoDica } from '@generated/components/ui-bits';
import { type CardInd, fmtDelta } from '@generated/lib/indicadoresCards';

function Card({ c, rotAnt, comDica, onAbrir }: { c: CardInd; rotAnt: string | null; comDica: boolean; onAbrir?: (k: string) => void }) {
  const d = fmtDelta(c);
  const valor = <span className={cn('tnum block truncate text-2xl font-light tracking-[-0.02em]', c.negativo ? 'text-[hsl(var(--danger))]' : 'text-foreground')} title={c.valor}>{c.valor}</span>;
  return (
    <div className={cn('relative flex min-w-0 flex-col gap-1 bg-card px-4 py-3', c.k === 'n' && 'sm:col-span-2 lg:col-span-3', onAbrir && 'transition-colors duration-150 hover:bg-[hsl(var(--surface-2))]')}>
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        {c.label}
        {comDica && <InfoDica texto={c.regra} />}
      </p>
      {onAbrir ? (
        // Stretched button over the whole card: the "i" stays above it (never a button inside a button).
        <button type="button" onClick={() => onAbrir(c.k)} aria-label={`${c.label}: ${c.valor}. Ver projetos`}
          className="min-w-0 rounded-[var(--radius-sm)] text-left after:absolute after:inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {valor}
        </button>
      ) : valor}
      {c.sub && <p className="tnum text-xs text-muted-foreground">{c.sub}</p>}
      {c.meta && (
        <p className={cn('text-xs font-medium', c.meta.ok === null ? 'text-muted-foreground' : c.meta.ok ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--danger))]')}>
          {c.meta.texto}{c.meta.ok === null ? '' : c.meta.ok ? ' · atingida' : ' · não atingida'}
        </p>
      )}
      {c.linhas && c.linhas.length > 0 && (
        <ul className={cn('tnum mt-0.5 grid gap-x-6 text-xs', c.k === 'n' && 'sm:grid-cols-2 lg:grid-cols-3')}>
          {c.linhas.map((l) => (
            <li key={l.label} className="flex min-w-0 items-baseline justify-between gap-3 border-t border-border py-1 first:border-t-0">
              <span className="min-w-0 truncate text-muted-foreground" title={l.label}>{l.label}</span>
              <span className="shrink-0 text-foreground">{l.valor}</span>
            </li>
          ))}
        </ul>
      )}
      {rotAnt && <p className="tnum text-[11px] text-[hsl(var(--fg-subtle))]">{d ? `${d} vs. ${rotAnt}` : 'sem base para comparar'}</p>}
    </div>
  );
}

/** Indicator cards grouped (Projetos / Prazos / Financeiro Total · Equipe · Insumos / Saldo negativo). */
export function CardsIndicadores({ cards, rotAnt, comDica = true, onAbrir }: { cards: CardInd[]; rotAnt: string | null; comDica?: boolean; onAbrir?: (k: string) => void }) {
  const grupos = [...new Set(cards.map((c) => c.grupo))];
  return (
    <div className="flex flex-col gap-3">
      {grupos.map((g) => {
        const doGrupo = cards.filter((c) => c.grupo === g);
        return (
          <section key={g} className="min-w-0">
            <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{g}</h3>
            <div className={cn('grid grid-cols-1 gap-px overflow-hidden rounded-[var(--radius-lg)] border border-border bg-border sm:grid-cols-2', doGrupo.length !== 2 && 'lg:grid-cols-3')}>
              {doGrupo.map((c) => <Card key={c.k} c={c} rotAnt={rotAnt} comDica={comDica} onAbrir={onAbrir} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}
