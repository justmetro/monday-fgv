import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ScrollArea, ScrollBar } from '@components/ui/scroll-area';
import { cn } from '@lib/utils';
import { codigoDe, tituloDe, fmtDate, DASH } from '@generated/lib/format';
import { TEMP_COR, rotuloDestino, type Destino, type Temp } from '@generated/lib/alocacao';
import { chegadaDe } from '@generated/lib/chegada';
import { DOT } from '@generated/components/alocacao/cores';
import { CheckLinha, type Selecao } from '@generated/components/alocacao/selecao';

export const COM_PROJ = 'Com projeção de alocação';
export const SEM_PROJ = 'Sem projeção de alocação';
export const ASSINADO: Temp = 'Assinado';

/** Fixed columns, always visible (even empty), in this order. */
export const COLUNAS_ESTEIRA: Temp[] = ['Reforço imediato', '15 a 30 dias', '30 a 45 dias', '45 a 60 dias', 'Mudança de gestão', ASSINADO];

function Cartao({ d, onAbrir, s }: { d: Destino; onAbrir: (id: string) => void; s: Selecao }) {
  const alocado = d.projecoes.length > 0;
  const c = chegadaDe(d);
  const marcado = s.sel.has(d.p.id);
  return (
    <li data-item-id={d.p.id}
      className={cn('relative flex w-full min-w-0 flex-col gap-1.5 rounded-[var(--radius-md)] border bg-card px-3 py-2.5 text-left transition-colors duration-150 hover:bg-[hsl(var(--surface-2))]',
        marcado ? 'border-[hsl(var(--primary)/0.6)] bg-[hsl(var(--accent-soft))]' : 'border-border hover:border-[hsl(var(--primary)/0.5)]',
        d.desativado && 'opacity-60')}>
      <div className="flex items-start gap-2">
        <div className="pt-0.5"><CheckLinha s={s} d={d} /></div>
        <button type="button" onClick={() => onAbrir(d.p.id)} className="flex min-w-0 flex-1 flex-col gap-1.5 rounded-[var(--radius-sm)] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="font-mono-code text-[11px] text-muted-foreground">{codigoDe(d.p) ?? DASH}</span>
          <span className="line-clamp-2 text-[13px] font-medium leading-snug text-foreground" title={d.p.name}>{tituloDe(d.p)}</span>
          <span className="flex min-w-0 items-center justify-between gap-2 text-xs">
            <span className={cn('min-w-0 truncate', alocado ? 'text-foreground' : 'text-[hsl(var(--fg-subtle))]')}>
              {alocado ? d.projecoes.map((x) => rotuloDestino(x.data)).join(', ') : SEM_PROJ}
            </span>
            {c.inicio && <span className="tnum shrink-0 text-[11px] text-[hsl(var(--fg-subtle))]" title="Chegada prevista">{fmtDate(c.inicio)}</span>}
          </span>
        </button>
      </div>
    </li>
  );
}

function Coluna({ t, itens, oculta, onAbrir, s }: { t: Temp; itens: Destino[]; oculta: boolean; onAbrir: (id: string) => void; s: Selecao }) {
  const [soSem, setSoSem] = useState(false);
  const com = itens.filter((d) => d.projecoes.length > 0).length;
  const sem = itens.length - com;
  const vis = soSem ? itens.filter((d) => d.projecoes.length === 0) : itens;
  return (
    <section aria-label={t} className="flex h-full min-w-[220px] flex-1 basis-0 flex-col rounded-[var(--radius-lg)] bg-[hsl(var(--surface-2)/0.5)]">
      <header className="flex shrink-0 flex-col gap-1 px-3 pb-2 pt-3">
        <h4 className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
          <span className={cn('size-2 shrink-0 rounded-full', DOT[TEMP_COR[t]])} aria-hidden />
          {t}
          <span className="tnum ml-auto text-xs font-normal text-muted-foreground">{itens.length}</span>
        </h4>
        <div className="tnum flex flex-col items-start text-[11px] text-muted-foreground">
          <span className="min-h-6 leading-6">{COM_PROJ}: {com}</span>
          <button type="button" aria-pressed={soSem} onClick={() => setSoSem((v) => !v)} disabled={sem === 0 && !soSem}
            title={soSem ? 'Mostrar todos da coluna' : 'Mostrar só os projetos sem projeção'}
            className={cn('-ml-1 inline-flex min-h-11 items-center rounded-[var(--radius-sm)] px-1 text-left underline decoration-dotted underline-offset-2 hover:text-foreground disabled:no-underline disabled:opacity-60 md:min-h-6',
              soSem && 'bg-[hsl(var(--accent-soft))] text-foreground')}>
            {SEM_PROJ}: {sem}
          </button>
        </div>
      </header>
      <ScrollArea type="hover" className="min-h-0 flex-1 [&>[data-slot=scroll-area-viewport]>div]:!block">
      <ul className="flex flex-col gap-2 px-2 pb-3">
        {vis.length === 0 ? <li className="px-1 py-2 text-xs text-[hsl(var(--fg-subtle))]">{oculta ? 'Assinados ocultos' : soSem && itens.length > 0 ? 'Nenhum projeto sem projeção.' : 'Nenhum projeto'}</li>
          : vis.map((d) => <Cartao key={d.p.id} d={d} onAbrir={onAbrir} s={s} />)}
      </ul>
      </ScrollArea>
    </section>
  );
}

const VIEWPORT = '[data-slot=scroll-area-viewport]';
const seta = 'absolute top-1/2 z-10 flex size-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-[hsl(var(--surface-2))] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** Esteira de Projetos: six fixed columns by temperature; "Assinado" is empty ("Assinados ocultos") unless shown.
 *  Height follows the screen so the horizontal bar is always visible; columns share the width (min ~220px) and scroll inside. */
export function EsteiraPactuacao({ lista, mostrarAssinados, onAbrir, s }: { lista: Destino[]; mostrarAssinados: boolean; onAbrir: (id: string) => void; s: Selecao }) {
  const raiz = useRef<HTMLDivElement>(null);
  const [esq, setEsq] = useState(false);
  const [dir, setDir] = useState(false);
  const viewport = useCallback(() => raiz.current?.querySelector<HTMLElement>(':scope > ' + VIEWPORT) ?? null, []);
  const medir = useCallback(() => {
    const v = viewport();
    if (!v) return;
    setEsq(v.scrollLeft > 4);
    setDir(v.scrollLeft + v.clientWidth < v.scrollWidth - 4);
  }, [viewport]);
  useEffect(() => {
    const v = viewport();
    if (!v) return undefined;
    medir();
    v.addEventListener('scroll', medir, { passive: true });
    const ro = new ResizeObserver(medir);
    ro.observe(v);
    v.querySelectorAll(':scope > div > div').forEach((el) => ro.observe(el));
    return () => { v.removeEventListener('scroll', medir); ro.disconnect(); };
  }, [viewport, medir, lista.length]);
  const rolar = (sentido: 1 | -1) => {
    const v = viewport();
    const col = v?.querySelector<HTMLElement>('section');
    if (v && col) v.scrollBy({ left: sentido * (col.offsetWidth + 12), behavior: 'smooth' });
  };
  return (
    <div className="relative">
      <ScrollArea ref={raiz} type="always" className="h-[calc(100dvh-20rem)] min-h-[26rem] w-full [&>[data-slot=scroll-area-viewport]>div]:!block [&>[data-slot=scroll-area-viewport]>div]:h-full">
        <div className="flex h-full gap-3 pb-3">
          {COLUNAS_ESTEIRA.map((t) => (
            <Coluna key={t} t={t} itens={lista.filter((d) => d.temp.valor === t)} oculta={t === ASSINADO && !mostrarAssinados} onAbrir={onAbrir} s={s} />
          ))}
        </div>
        <ScrollBar orientation="horizontal" className="h-2 p-0 [&:hover>[data-slot=scroll-area-thumb]]:!bg-[hsl(var(--muted-foreground)/0.5)]" />
      </ScrollArea>
      {esq && <div className="pointer-events-none absolute inset-y-0 left-0 z-[5] w-10 bg-gradient-to-r from-background to-transparent" aria-hidden />}
      {dir && <div className="pointer-events-none absolute inset-y-0 right-0 z-[5] w-10 bg-gradient-to-l from-background to-transparent" aria-hidden />}
      {esq && <button type="button" onClick={() => rolar(-1)} aria-label="Rolar uma coluna para a esquerda" className={cn(seta, 'left-1')}><ChevronLeft className="size-4" aria-hidden /></button>}
      {dir && <button type="button" onClick={() => rolar(1)} aria-label="Rolar uma coluna para a direita" className={cn(seta, 'right-1')}><ChevronRight className="size-4" aria-hidden /></button>}
    </div>
  );
}
