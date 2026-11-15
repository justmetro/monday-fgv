import { Switch } from '@components/ui/switch';
import type { GerenteAloc } from '@generated/lib/alocacao';
import { quando } from '@generated/components/alocacao/bits';
import { Secao } from '@generated/components/alocacao/cards';
import type { AlocCtx } from '@generated/components/alocacao/ctx';

/** "Desativar": hides the manager from every view, picker and total (app only; the Mapa is never written). */
export function BotaoDesativar({ ctx, ga }: { ctx: AlocCtx; ga: GerenteAloc }) {
  const desativar = async () => {
    const pend = ga.projecoes.length;
    const ok = await ctx.perguntar({
      titulo: `Desativar ${ga.g.nome}?`,
      texto: `O gerente deixa de aparecer em todas as visões e listas de seleção (exceto no Histórico) e não conta nos totais.${pend ? ` Ele tem ${pend} projeção(ões) pendente(s), que continuam salvas.` : ''} É possível reativar em “Mostrar desativados”. Nada é gravado no Mapa de Gerentes.`,
      ok: 'Desativar',
    });
    if (ok) await ctx.api.desativar(ga.g.id, true);
  };
  return (
    <button type="button" onClick={() => void desativar()}
      className="inline-flex h-11 items-center rounded-[var(--radius-sm)] px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground md:h-7">
      Desativar
    </button>
  );
}

export function ToggleDesativados({ ctx, on, setOn }: { ctx: AlocCtx; on: boolean; setOn: (v: boolean) => void }) {
  const n = ctx.modelo.desativados.length;
  return (
    <span className="flex h-11 items-center gap-2 rounded-[var(--radius-md)] border border-border px-2.5 text-xs text-muted-foreground md:h-8">
      <label htmlFor="toggle-desativados" className="cursor-pointer whitespace-nowrap">Mostrar desativados ({n})</label>
      <Switch id="toggle-desativados" checked={on} onCheckedChange={setOn} />
    </span>
  );
}

/** List of deactivated managers with "Reativar" (shown when "Mostrar desativados" is on). */
export function ListaDesativados({ ctx }: { ctx: AlocCtx }) {
  const lista: GerenteAloc[] = ctx.modelo.desativados;
  return (
    <Secao titulo={`Gerentes desativados (${lista.length})`}>
      {lista.length === 0 ? (
        <p className="px-4 py-4 text-[13px] text-muted-foreground">Nenhum gerente desativado.</p>
      ) : (
        <ul className="divide-y divide-border">
          {lista.map((g) => (
            <li key={g.g.id} className="flex flex-wrap items-center gap-2 px-4 py-2 text-[13px]">
              <span className="min-w-0 flex-1 text-foreground">{g.g.nome}</span>
              {g.desativado && <span className="text-xs text-[hsl(var(--fg-subtle))]">por {g.desativado.data.autor} · {quando(g.desativado.data.em)}</span>}
              <button type="button" onClick={() => void ctx.api.desativar(g.g.id, false)}
                className="h-11 rounded-[var(--radius-md)] border border-input bg-[hsl(var(--surface-2))] px-2.5 text-xs text-foreground hover:bg-[hsl(var(--surface-3))] md:h-7">
                Reativar
              </button>
            </li>
          ))}
        </ul>
      )}
    </Secao>
  );
}
