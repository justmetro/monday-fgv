import { ExternalLink } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@components/ui/sheet';
import { codigoDe, DASH } from '@generated/lib/format';
import type { ItemConta } from '@generated/lib/indicadores';
import { urlItem } from '@generated/lib/links';
import { StatusPill, EmptyState } from '@generated/components/ui-bits';

const ORDEM_GRUPOS = ['No prazo', 'Fora do prazo', 'Assinados', 'Em planejamento (não assinados)'];

function Linha({ p, valor }: ItemConta) {
  return (
    <li className="flex min-w-0 items-start gap-3 border-b border-border px-5 py-2.5">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-mono-code text-[11px] text-primary">{codigoDe(p) ?? DASH}</span>
        <span className="text-[13px] text-foreground">{p.name}</span>
        <StatusPill label={p.statusPlanejamento} className="mt-0.5 self-start" />
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="tnum text-right text-[13px] text-foreground">{valor}</span>
        <a href={urlItem(p.id)} target="_blank" rel="noreferrer"
          className="inline-flex min-h-11 items-center gap-1 rounded-[var(--radius-sm)] text-[11px] text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-0">
          Abrir no quadro <ExternalLink className="size-3" aria-hidden />
        </a>
      </div>
    </li>
  );
}

/**
 * Side panel with the projects counted in an indicator: code, name, status, value that entered the calculation,
 * link to the item. When the items carry a `grupo` (e.g. No prazo / Fora do prazo) the list is split by it.
 */
export function ListaContaSheet({ titulo, subtitulo, itens, onClose }: { titulo: string | null; subtitulo: string; itens: ItemConta[]; onClose: () => void }) {
  const ordenados = [...itens].sort((a, b) => a.p.name.localeCompare(b.p.name, 'pt-BR'));
  const pos = (g: string) => { const i = ORDEM_GRUPOS.indexOf(g); return i < 0 ? 99 : i; };
  const grupos = [...new Set(ordenados.map((x) => x.grupo ?? ''))].sort((a, b) => pos(a) - pos(b))
    .map((g) => ({ g, xs: ordenados.filter((x) => (x.grupo ?? '') === g) }));
  return (
    <Sheet open={titulo !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto border-border bg-[hsl(var(--surface-chrome))] p-0 shadow-none sm:max-w-xl">
        <SheetHeader className="gap-1 px-5 pb-3 pt-5 pr-12">
          <SheetTitle className="text-lg font-semibold leading-snug text-foreground">{titulo}</SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">{subtitulo} · {itens.length} projeto{itens.length === 1 ? '' : 's'}</SheetDescription>
        </SheetHeader>
        {itens.length === 0 ? <div className="px-5 pb-5"><EmptyState title="Nenhum projeto neste número" hint="Nenhum projeto da base entrou nesta conta." /></div> : (
          <div className="border-t border-border">
            {grupos.map(({ g, xs }) => (
              <section key={g || 'todos'} aria-label={g || undefined}>
                {g && <h3 className="border-b border-border bg-card px-5 py-2 text-xs font-semibold text-foreground">{g} <span className="tnum font-normal text-muted-foreground">({xs.length})</span></h3>}
                <ul className="flex flex-col">{xs.map((x) => <Linha key={x.p.id} {...x} />)}</ul>
              </section>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
