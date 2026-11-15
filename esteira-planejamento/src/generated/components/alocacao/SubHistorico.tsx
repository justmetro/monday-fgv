import { TabelaScroll } from '@generated/components/TabelaScroll';
import { NumberTicker } from '@generated/components/fx/NumberTicker';
import { useMemo, useState } from 'react';
import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '@lib/utils';
import { fmtDate, toDate } from '@generated/lib/format';
import { normNome } from '@generated/lib/nomes';
import { casa, type Doc } from '@generated/lib/alocacao';
import type { AlocHistorico } from '@generated/models';
import { EmptyState } from '@generated/components/ui-bits';
import { MultiSelect } from '@generated/components/MultiSelect';
import { Secao, Th, btnNeutro, definirTodos, tabelaCls, theadCls, thCls, trCls, useOrdenacao } from '@generated/components/alocacao/cards';
import type { AlocCtx } from '@generated/components/alocacao/ctx';
import { HistoricoForm } from '@generated/components/alocacao/HistoricoForm';
import { naoConfirmado } from '@generated/hooks/useAlocacao';

export interface LinhaHist {
  key: string;
  gerente: string;
  projeto: string;
  eixo: string;
  inicio: Date | null;
  fim: Date | null;
  origem: 'Mapa' | 'Validação' | 'Manual';
  doc?: Doc<AlocHistorico>;
}

const GRUPO = 'historico-gerente';

/** Histórico de projetos: Mapa (read-only) + validated allocations + manual records (app), one block per manager. */
export function SubHistorico({ ctx }: { ctx: AlocCtx }) {
  const { mapa, dados, q, modelo } = ctx;
  const [sel, setSel] = useState<string[]>([]);
  const [editando, setEditando] = useState<Doc<AlocHistorico> | 'novo' | null>(null);
  const porId = modelo.porId;

  const linhas = useMemo(() => {
    const out: LinhaHist[] = [];
    const vistos = new Set<string>();
    // 1) Validated allocations (fed only by the Validação step).
    for (const x of dados.projecoes) {
      if (x.data.status !== 'Validada' || x.data.destinoTipo !== 'gerente') continue;
      const p = porId.get(x.data.projetoId);
      vistos.add(`${normNome(x.data.gerenteNome)}|${x.data.projetoId}`);
      out.push({
        key: `v-${x.id}`, gerente: x.data.gerenteNome, projeto: p?.name ?? x.data.projetoNome, eixo: (p?.eixo ?? []).join(', '),
        inicio: toDate(x.data.validadoEm), fim: toDate(p?.ltimoProdutoPrevisto), origem: 'Validação',
      });
    }
    // 2) Mapa de Gerentes (read-only): managed projects and "Saída do Projeto".
    for (const g of mapa) {
      for (const a of g.alocacoes) {
        const pid = a.projetoIds[0];
        if (pid && vistos.has(`${g.nomeNorm}|${pid}`)) continue;
        const p = pid ? porId.get(pid) : undefined;
        out.push({
          key: `m-${a.id}`, gerente: g.nome, projeto: p?.name ?? a.projetoNomes[0] ?? a.nome, eixo: (p?.eixo ?? []).join(', '),
          inicio: toDate(a.inicio ?? p?.alocaoGerente ?? null), fim: toDate(a.saida ?? a.fim), origem: 'Mapa',
        });
      }
    }
    // 3) Manual records (old projects) saved in the app.
    for (const h of dados.historico) {
      out.push({
        key: `h-${h.id}`, gerente: h.data.gerenteNome, projeto: h.data.projetoNome, eixo: h.data.eixo,
        inicio: toDate(h.data.inicio || null), fim: toDate(h.data.fim || null), origem: 'Manual', doc: h,
      });
    }
    return out;
  }, [mapa, dados.projecoes, dados.historico, porId]);

  // Picker options: managers with records + every manager of the model (to add records).
  const nomes = useMemo(() => [...new Set([...linhas.map((l) => l.gerente), ...modelo.gerentes.map((g) => g.g.nome), ...modelo.desativados.map((g) => g.g.nome)])]
    .filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR')), [linhas, modelo.gerentes, modelo.desativados]);
  const selNorm = useMemo(() => new Set(sel.map(normNome)), [sel]);
  const filtradas = linhas.filter((l) => (!selNorm.size || selNorm.has(normNome(l.gerente))) && casa(q, l.gerente, l.projeto));
  // One block per manager with at least one record (alphabetical).
  const blocos = useMemo(() => {
    const m = new Map<string, { nome: string; linhas: LinhaHist[] }>();
    for (const l of filtradas) {
      const k = normNome(l.gerente);
      if (!k) continue;
      const b = m.get(k) ?? { nome: l.gerente, linhas: [] };
      b.linhas.push(l);
      m.set(k, b);
    }
    return [...m.entries()].sort((a, b) => a[1].nome.localeCompare(b[1].nome, 'pt-BR'));
  }, [filtradas]);
  const gerentePadrao = sel.length === 1 ? sel[0] ?? '' : '';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-muted-foreground">Gerente</span>
          <MultiSelect label={sel.length ? 'Gerentes' : 'Todos os gerentes'} options={nomes} value={sel} onChange={setSel} />
        </div>
        <div className="rounded-[var(--radius-lg)] border border-border bg-card px-4 py-2.5">
          <p className="text-xs text-muted-foreground">Registros no filtro atual</p>
          <p className="tnum text-3xl font-light leading-none tracking-[-0.02em] text-foreground"><NumberTicker value={filtradas.length} className="fx-num" /></p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" onClick={() => definirTodos(GRUPO, false)} className={btnNeutro}><ChevronsDownUp className="size-3.5" aria-hidden /> Recolher todos</button>
          <button type="button" onClick={() => definirTodos(GRUPO, true)} className={btnNeutro}><ChevronsUpDown className="size-3.5" aria-hidden /> Expandir todos</button>
          <button type="button" onClick={() => setEditando('novo')} className={btnNeutro}>Adicionar registro</button>
        </div>
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">Histórico de projetos</h3>
        <span className="text-xs text-muted-foreground">Mapa (somente leitura) · validações · registros manuais</span>
      </div>
      {blocos.length === 0 ? (
        <EmptyState title="Nenhum registro" hint="Ajuste o filtro de gerente ou a busca, adicione registros antigos ou valide alocações para alimentar o histórico." />
      ) : (
        blocos.map(([k, b]) => <BlocoGerente key={k} chave={k} nome={b.nome} linhas={b.linhas} ctx={ctx} onEditar={setEditando} />)
      )}

      <HistoricoForm ctx={ctx} nomes={nomes} gerentePadrao={gerentePadrao} editando={editando} onClose={() => setEditando(null)} />
    </div>
  );
}

function BlocoGerente({ chave, nome, linhas, ctx, onEditar }: {
  chave: string; nome: string; linhas: LinhaHist[]; ctx: AlocCtx; onEditar: (d: Doc<AlocHistorico>) => void;
}) {
  const { ordenadas, sort, setSort } = useOrdenacao(linhas, {
    projeto: (l: LinhaHist) => l.projeto, eixo: (l: LinhaHist) => l.eixo || null,
    inicio: (l: LinhaHist) => l.inicio?.getTime() ?? null, fim: (l: LinhaHist) => l.fim?.getTime() ?? null, origem: (l: LinhaHist) => l.origem,
  }, { key: 'inicio', dir: 'desc' });
  return (
    <Secao grupo={GRUPO} id={`hist-${chave}`} titulo={`${nome} (${linhas.length})`}>
      <TabelaScroll>
        <table className={cn(tabelaCls, 'table-fixed')}>
          <colgroup><col /><col className="w-48" /><col className="w-28" /><col className="w-28" /><col className="w-28" /><col className="w-36" /></colgroup>
          <thead className={theadCls}>
            <tr>
              <Th k="projeto" label="Projeto" sort={sort} setSort={setSort} />
              <Th k="eixo" label="Eixo" sort={sort} setSort={setSort} />
              <Th k="inicio" label="Início" sort={sort} setSort={setSort} className="text-right" />
              <Th k="fim" label="Fim" sort={sort} setSort={setSort} className="text-right" />
              <Th k="origem" label="Origem" sort={sort} setSort={setSort} />
              <th scope="col" className={cn(thCls, 'text-right')}><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody>
            {ordenadas.map((l) => (
              <tr key={l.key} className={trCls}>
                <td className="break-words px-3 py-2 text-left text-foreground">{l.projeto}</td>
                <td className="break-words px-3 py-2 text-left text-xs text-muted-foreground">{l.eixo || '—'}</td>
                <td className="tnum whitespace-nowrap px-3 py-2 text-right text-muted-foreground">{fmtDate(l.inicio)}</td>
                <td className="tnum whitespace-nowrap px-3 py-2 text-right text-muted-foreground">{fmtDate(l.fim)}</td>
                <td className="px-3 py-2 text-left text-xs text-muted-foreground">{l.origem}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  {l.doc && naoConfirmado(l.doc.id) && <span className="text-[11px] text-[hsl(var(--fg-subtle))]">Salvando…</span>}
                  {l.doc && !naoConfirmado(l.doc.id) && (
                    <>
                      <button type="button" onClick={() => l.doc && onEditar(l.doc)} className="h-11 px-1.5 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground md:h-7">Editar</button>
                      <button type="button" onClick={() => void (async () => {
                        const d = l.doc;
                        if (d && (await ctx.perguntar({ titulo: 'Excluir registro?', texto: `“${l.projeto}” (${l.gerente}) será removido do histórico.`, ok: 'Excluir' }))) await ctx.api.removerHist(d.id);
                      })()} className="h-11 px-1.5 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground md:h-7">Excluir</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TabelaScroll>
    </Secao>
  );
}
