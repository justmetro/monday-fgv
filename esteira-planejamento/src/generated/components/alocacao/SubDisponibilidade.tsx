import { TabelaScroll } from '@generated/components/TabelaScroll';
import { useCallback, useMemo, useState } from 'react';
import { Columns3 } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger,
} from '@components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@components/ui/popover';
import { cn } from '@lib/utils';
import { codigoDe, fmtDate, DASH } from '@generated/lib/format';
import { CAPS, CAP_COR, CAP_CURTO, NOVO_GERENTE, capRegraTexto, casa, casaGerente, type GerenteAloc } from '@generated/lib/alocacao';
import { NomeLink } from '@generated/components/NomeLink';
import { EmptyState } from '@generated/components/ui-bits';
import { AjudaLinha, EixosEdit } from '@generated/components/alocacao/bits';
import { Comentario } from '@generated/components/alocacao/comentario';
import { Cards, Secao, Th, type Dir, tabelaCls, theadCls, thCls, trCls } from '@generated/components/alocacao/cards';
import { type AlocCtx, CapSel, NomeGerente } from '@generated/components/alocacao/ctx';
import { AbrirFechando } from '@generated/components/AbrirProjeto';
import { BotaoDesativar, ToggleDesativados, ListaDesativados } from '@generated/components/alocacao/BotaoDesativar';
import { RegraCapacidadePainel } from '@generated/components/alocacao/RegraCapacidadePainel';
import type { useRegraCapacidade } from '@generated/hooks/useRegraCapacidade';

type Col = 'capacidade' | 'eixos' | 'ativos' | 'termino' | 'comentario';
const COLS: { k: Col; label: string }[] = [
  { k: 'capacidade', label: 'Capacidade' }, { k: 'eixos', label: 'Eixos' }, { k: 'ativos', label: 'Projetos ativos' },
  { k: 'termino', label: 'Término mais próximo' }, { k: 'comentario', label: 'Comentário' },
];
type SortKey = 'nome' | 'capacidade' | 'eixos' | 'ativos' | 'termino' | 'comentario';
const valor: Record<SortKey, (g: GerenteAloc) => string | number> = {
  nome: (g) => g.g.nome,
  capacidade: (g) => CAPS.indexOf(g.cap.valor),
  eixos: (g) => g.eixos.valor.length,
  ativos: (g) => g.ativos.length,
  termino: (g) => g.termino?.getTime() ?? Number.MAX_SAFE_INTEGER,
  comentario: (g) => g.comentario?.data.texto ?? '\uffff',
};

export function SubDisponibilidade({ ctx, regraState }: { ctx: AlocCtx; regraState: ReturnType<typeof useRegraCapacidade> }) {
  const { modelo, api, q, eixoOpts, regra } = ctx;
  const [cap, setCap] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: Dir }>({ key: 'nome', dir: 'asc' });
  const [verDesativados, setVerDesativados] = useState(false);
  const [visiveis, setVisiveis] = useState<Set<Col>>(new Set(COLS.map((c) => c.k)));
  const busca = modelo.gerentes.filter((g) => casaGerente(q, g));
  const lista = useMemo(() => {
    const f = cap ? busca.filter((g) => g.cap.valor === cap) : busca;
    const get = valor[sort.key];
    const m = sort.dir === 'asc' ? 1 : -1;
    return [...f].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      const c = typeof va === 'string' && typeof vb === 'string' ? va.localeCompare(vb, 'pt-BR') : Number(va) - Number(vb);
      return c * m || a.g.nome.localeCompare(b.g.nome, 'pt-BR');
    });
  }, [busca, cap, sort]);
  const ver = (c: Col) => visiveis.has(c);
  // Single "Novo gerente" line: counts as 1 manager in the totals.
  const nNovo = modelo.novoGerente.projetos;
  const mostraNovo = nNovo > 0 && !cap && casa(q, NOVO_GERENTE);
  const cards = [
    { key: '__total', label: 'Total de gerentes', regra: 'Gerentes ativos no app (cadastrados no Mapa com Atividade GERENTE, não desativados) que casam com a busca; “Novo gerente” conta como 1.', value: busca.length + (nNovo > 0 ? 1 : 0), foot: nNovo > 0 ? `inclui “${NOVO_GERENTE}” (${nNovo} projeto(s))` : undefined },
    ...CAPS.map((c) => ({ key: c, label: c === 'Não' ? 'Sem capacidade próxima' : `Capacidade ${CAP_CURTO[c].toLowerCase()}`, value: busca.filter((g) => g.cap.valor === c).length, corVar: CAP_COR[c], regra: capRegraTexto(regra) })),
  ];

  return (
    <div className="flex flex-col gap-4">
      <AjudaLinha>Clique em um gerente para ver detalhes e editar.</AjudaLinha>
      <Cards cards={cards} ativos={new Set(cap ? [cap] : [])} onClick={(k) => setCap(k === '__total' || k === cap ? null : k)} cols="sm:grid-cols-3 xl:grid-cols-5" />
      <div className="flex flex-wrap justify-end gap-2">
        <RegraCapacidadePainel regraState={regraState} />
        <ToggleDesativados ctx={ctx} on={verDesativados} setOn={setVerDesativados} />
      </div>

      <Secao titulo={`Total de gerentes (${lista.length + (mostraNovo ? 1 : 0)})`} aside={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="inline-flex h-11 items-center gap-1.5 rounded-[var(--radius-md)] border border-input bg-[hsl(var(--surface-2))] px-2.5 text-xs text-muted-foreground hover:text-foreground md:h-8">
              <Columns3 className="size-3.5" aria-hidden /> Colunas
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-[var(--radius-lg)] border-border">
            <DropdownMenuLabel className="text-xs text-muted-foreground">Colunas visíveis</DropdownMenuLabel>
            {COLS.map((c) => (
              <DropdownMenuCheckboxItem key={c.k} checked={ver(c.k)} onSelect={(e) => e.preventDefault()}
                onCheckedChange={(on) => setVisiveis((s) => { const n = new Set(s); if (on) n.add(c.k); else n.delete(c.k); return n; })} className="text-[13px]">
                {c.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      }>
        {lista.length === 0 ? (
          <EmptyState title="Nenhum gerente" hint={q || cap ? 'Ajuste a busca ou a seleção de capacidade.' : 'Nenhum gerente cadastrado com Atividade Atual = GERENTE no Mapa.'} />
        ) : (
          <TabelaScroll>
            <table className={tabelaCls}>
              <thead className={theadCls}>
                <tr>
                  <Th k="nome" label="Gerente" sort={sort} setSort={setSort} />
                  {ver('capacidade') && <Th k="capacidade" label="Capacidade" sort={sort} setSort={setSort} />}
                  {ver('eixos') && <Th k="eixos" label="Eixos" sort={sort} setSort={setSort} />}
                  {ver('ativos') && <Th k="ativos" label="Projetos ativos" sort={sort} setSort={setSort} />}
                  {ver('termino') && <Th k="termino" label="Término mais próximo" sort={sort} setSort={setSort} />}
                  {ver('comentario') && <Th k="comentario" label="Comentário" sort={sort} setSort={setSort} />}
                  <th scope="col" className={thCls}><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {mostraNovo && (
                  <tr className={cn(trCls, 'bg-[hsl(var(--surface-2)/0.45)]')}>
                    <td className="px-3 py-2 font-medium text-foreground">{NOVO_GERENTE}<span className="block text-[11px] font-normal text-[hsl(var(--fg-subtle))]">contratação · conta como 1 gerente</span></td>
                    {ver('capacidade') && <td className="px-3 py-2 text-xs text-muted-foreground">—</td>}
                    {ver('eixos') && <td className="px-3 py-2 text-xs text-muted-foreground">—</td>}
                    {ver('ativos') && <td className="tnum px-3 py-2 text-[13px] text-foreground">{nNovo} projeto(s) com novo gerente</td>}
                    {ver('termino') && <td className="px-3 py-2 text-muted-foreground">—</td>}
                    {ver('comentario') && <td className="px-3 py-2 text-muted-foreground"><span aria-hidden="true">—</span><span className="sr-only">Sem comentário</span></td>}
                    <td className="px-3 py-2"><span className="sr-only">Sem ações</span></td>
                  </tr>
                )}
                {lista.map((g) => (
                  <tr key={g.g.id} className={trCls}>
                    <td className="px-3 py-2">
                      <NomeGerente ctx={ctx} id={g.g.id} nome={g.g.nome} />
                      <button type="button" onClick={() => ctx.abrirGerente(g.g.id)} aria-label={`Ver ${g.ativos.length} ativos e ${g.encerrados.length} encerrados de ${g.g.nome}`}
                        className="tnum block min-h-6 rounded-[var(--radius-sm)] text-left text-[11px] text-[hsl(var(--fg-subtle))] hover:text-foreground hover:underline hover:underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        {g.ativos.length} ativo{g.ativos.length === 1 ? '' : 's'} · {g.encerrados.length} encerrado{g.encerrados.length === 1 ? '' : 's'}
                      </button>
                    </td>
                    {ver('capacidade') && <td className="px-3 py-2"><CapSel ga={g} api={api} regra={regra} /></td>}
                    {ver('eixos') && (
                      <td className="max-w-[300px] px-3 py-2">
                        <EixosEdit valor={g.eixos.valor} calc={g.eixos.calc} ajuste={g.eixos.ajuste} opcoes={eixoOpts}
                          onChange={(v) => void api.ajustar('eixos', g.g.id, '', v)} onReset={() => void api.voltarCalculado('eixos', g.g.id)} />
                      </td>
                    )}
                    {ver('ativos') && <td className="px-3 py-2"><AtivosPop g={g} /></td>}
                    {ver('termino') && <td className="tnum whitespace-nowrap px-3 py-2 text-muted-foreground">{fmtDate(g.termino)}</td>}
                    {ver('comentario') && (
                      <td className="w-56 px-3 py-2">
                        <Comentario doc={g.comentario} rotulo={g.g.nome} onSave={(t) => api.comentar('gerente', g.g.id, '', t)} />
                      </td>
                    )}
                    <td className="px-3 py-2 text-right"><BotaoDesativar ctx={ctx} ga={g} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabelaScroll>
        )}
      </Secao>
      {verDesativados && <ListaDesativados ctx={ctx} />}
    </div>
  );
}

function AtivosPop({ g }: { g: GerenteAloc }) {
  const [open, setOpen] = useState(false);
  const fechar = useCallback(() => setOpen(false), []);
  if (!g.ativos.length) return <span className="text-xs text-[hsl(var(--fg-subtle))]">0</span>;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="tnum inline-flex h-11 items-center gap-1 rounded-[var(--radius-sm)] px-1 text-[13px] font-medium text-foreground underline decoration-dotted underline-offset-4 hover:text-primary md:h-7"
          aria-label={`Ver ${g.ativos.length} projetos ativos de ${g.g.nome}`}>
          {g.ativos.length}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-96 rounded-[var(--radius-lg)] border-border p-0 shadow-none">
        <p className="border-b border-border px-3 py-2 text-xs text-muted-foreground">Projetos ativos · Último Produto Previsto</p>
        <AbrirFechando fechar={fechar}>
        <ul className="max-h-72 divide-y divide-border overflow-y-auto">
          {g.ativos.map((a) => (
            <li key={a.p.id} className="flex items-center gap-2 px-3 py-1.5">
              <span className="min-w-0 flex-1">
                <span className="font-mono-code block text-[11px] text-primary">{codigoDe(a.p) ?? DASH}</span>
                <NomeLink p={a.p} className="text-[13px] font-normal" />
              </span>
              <span className="tnum shrink-0 text-xs text-muted-foreground">{fmtDate(a.data)}</span>
            </li>
          ))}
        </ul>
        </AbrirFechando>
      </PopoverContent>
    </Popover>
  );
}
