import { Fragment, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, Columns3 } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@components/ui/dropdown-menu';
import { Checkbox } from '@components/ui/checkbox';
import { cn } from '@lib/utils';
import { COLUNAS, gravarOcultas, lerOcultas, type ColId } from '@generated/components/painel/table/columns';
import { MobileList } from '@generated/components/painel/table/MobileList';
import { BulkStatusBar } from '@generated/components/painel/table/BulkStatusBar';
import { StatusOpcoesDialog } from '@generated/components/painel/table/StatusOpcoesDialog';
import { GrupoTotais } from '@generated/components/painel/table/GrupoTotais';
import { agruparPorStatus } from '@generated/lib/extras';
import type { Row } from '@generated/lib/painel';
import type { Sort, SortKey } from '@generated/lib/filtros';
import type { Extras, ResultadoExtras } from '@generated/hooks/useSalvarExtras';

export function ProjectsTable({ rows, sort, onSort, onOpen, carregando, dimmed, statusOpcoes, setStatusOpcoes, onSalvar }: {
  rows: Row[]; sort: Sort; onSort: (k: SortKey) => void; onOpen: (id: string) => void; carregando: boolean; dimmed: boolean;
  statusOpcoes: string[]; setStatusOpcoes: (v: string[]) => void; onSalvar: (r: Row, x: Extras) => Promise<ResultadoExtras>;
}) {
  const [ocultas, setOcultas] = useState<ColId[]>([]);
  const [fechados, setFechados] = useState<Set<string>>(new Set());
  const [sel, setSel] = useState<Set<string>>(new Set());
  useEffect(() => { setOcultas(lerOcultas()); }, []);
  // Seleção só com projetos visíveis.
  useEffect(() => { setSel((s) => { const ids = new Set(rows.map((r) => r.projeto.id)); const n = new Set([...s].filter((id) => ids.has(id))); return n.size === s.size ? s : n; }); }, [rows]);

  const grupos = useMemo(() => agruparPorStatus(rows, statusOpcoes), [rows, statusOpcoes]);
  const cols = COLUNAS.filter((c) => !ocultas.includes(c.id));
  const toggleCol = (id: ColId, visivel: boolean) => {
    const next = visivel ? ocultas.filter((x) => x !== id) : [...ocultas, id];
    setOcultas(next); gravarOcultas(next);
  };
  const alternarGrupo = (g: string) => setFechados((s) => { const n = new Set(s); if (n.has(g)) n.delete(g); else n.add(g); return n; });
  const marcar = (ids: string[], v: boolean) => setSel((s) => { const n = new Set(s); for (const id of ids) { if (v) n.add(id); else n.delete(id); } return n; });
  const estado = (ids: string[]) => { const k = ids.filter((id) => sel.has(id)).length; return k === 0 ? false : k === ids.length ? true : 'indeterminate' as const; };
  const selRows = rows.filter((r) => sel.has(r.projeto.id));

  return (
    <section className={cn('soft-stack overflow-hidden rounded-xl bg-card transition-opacity duration-200', dimmed && 'opacity-60')} aria-label="Lista de projetos">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2.5 sm:px-5">
        <span className="tnum text-sm text-muted-foreground">{rows.length} {rows.length === 1 ? 'projeto' : 'projetos'} · {grupos.length} status</span>
        <div className="flex flex-wrap items-center gap-2">
          <StatusOpcoesDialog opcoes={statusOpcoes} onSalvo={setStatusOpcoes} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="hidden h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:inline-flex">
                <Columns3 className="size-4 text-muted-foreground" aria-hidden /> Colunas
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs text-muted-foreground">Mostrar colunas</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {COLUNAS.filter((c) => c.hideable).map((c) => (
                <DropdownMenuCheckboxItem key={c.id} checked={!ocultas.includes(c.id)} onCheckedChange={(v) => toggleCol(c.id, v === true)} onSelect={(e) => e.preventDefault()}>
                  {c.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {sel.size > 0 && <BulkStatusBar rows={selRows} opcoes={statusOpcoes} onSalvar={onSalvar} onLimpar={() => setSel(new Set())} />}

      <div className="hidden max-h-[72vh] overflow-auto lg:block">
        <table className="w-full min-w-[1140px] table-fixed border-collapse">
          <thead className="sticky top-0 z-10 bg-[hsl(var(--chrome))] shadow-[inset_0_-1px_0_hsl(var(--border))]">
            <tr>
              <th scope="col" className="w-11 pl-5"><span className="sr-only">Selecionar</span></th>
              {cols.map((c) => {
                const active = sort.key === c.id;
                const Icon = active ? (sort.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
                return (
                  <th key={c.id} scope="col" className={cn(c.w, 'px-3 py-2 last:pr-5')} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" onClick={() => onSort(c.id)} className={cn('inline-flex items-center gap-1 rounded-sm text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', c.align === 'right' && 'ml-auto flex text-right', active && 'text-foreground')}>
                      {c.label}<Icon className="size-3 shrink-0" aria-hidden />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {grupos.map((g) => {
              const ids = g.rows.map((r) => r.projeto.id);
              const aberto = !fechados.has(g.nome);
              return (
                <Fragment key={g.nome}>
                  <tr className="border-t border-border bg-[hsl(var(--chrome))]">
                    <td className="py-2 pl-5 align-middle">
                      <Checkbox checked={estado(ids)} onCheckedChange={(v) => marcar(ids, v === true)} aria-label={`Selecionar projetos de ${g.nome}`} />
                    </td>
                    <td colSpan={cols.length} className="py-2 pr-5">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <button type="button" onClick={() => alternarGrupo(g.nome)} aria-expanded={aberto} className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-1 text-sm font-semibold text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                          <ChevronDown className={cn('size-4 text-muted-foreground transition-transform duration-150', !aberto && '-rotate-90')} aria-hidden />
                          {g.nome} <span className="tnum font-normal text-muted-foreground">{g.rows.length}</span>
                        </button>
                        <GrupoTotais g={g} />
                      </div>
                    </td>
                  </tr>
                  {aberto && g.rows.map((r) => (
                    <tr key={r.projeto.id} onClick={() => onOpen(r.projeto.id)} className={cn('cursor-pointer border-t border-border align-top transition-colors hover:bg-[hsl(var(--chrome))]', sel.has(r.projeto.id) && 'bg-[hsl(var(--info-soft)/0.45)]')}>
                      <td className="py-3 pl-5" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={sel.has(r.projeto.id)} onCheckedChange={(v) => marcar([r.projeto.id], v === true)} aria-label={`Selecionar ${r.projeto.name}`} />
                      </td>
                      {cols.map((c) => (
                        <td key={c.id} className={cn('px-3 py-3 last:pr-5', c.align === 'right' && 'text-right')}>{c.cell(r, { carregando, onOpen })}</td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="lg:hidden">
        {grupos.map((g) => {
          const ids = g.rows.map((r) => r.projeto.id);
          const aberto = !fechados.has(g.nome);
          return (
            <div key={g.nome} className="border-t border-border first:border-t-0">
              <div className="flex flex-col gap-1.5 bg-[hsl(var(--chrome))] px-4 py-3">
                <div className="flex items-center gap-2">
                  <Checkbox checked={estado(ids)} onCheckedChange={(v) => marcar(ids, v === true)} aria-label={`Selecionar projetos de ${g.nome}`} />
                  <button type="button" onClick={() => alternarGrupo(g.nome)} aria-expanded={aberto} className="inline-flex min-h-10 flex-1 items-center gap-1.5 text-left text-sm font-semibold text-foreground">
                    <ChevronDown className={cn('size-4 text-muted-foreground transition-transform duration-150', !aberto && '-rotate-90')} aria-hidden />
                    {g.nome} <span className="tnum font-normal text-muted-foreground">{g.rows.length}</span>
                  </button>
                </div>
                <GrupoTotais g={g} />
              </div>
              {aberto && <MobileList rows={g.rows} onOpen={onOpen} carregando={carregando} sel={sel} onSel={(id, v) => marcar([id], v)} />}
            </div>
          );
        })}
      </div>
    </section>
  );
}
