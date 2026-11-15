import { TabelaScroll } from '@generated/components/TabelaScroll';
import { useEffect, useState } from 'react';
import { codigoDe, DASH } from '@generated/lib/format';
import { TEMP_CARDS, TEMP_COR, casaDestino, rotuloDestino, type Destino } from '@generated/lib/alocacao';
import { EmptyState } from '@generated/components/ui-bits';
import { Cards, Secao, Th, tabelaCls, theadCls, trCls, useFiltroCards, useOrdenacao } from '@generated/components/alocacao/cards';
import type { AlocCtx } from '@generated/components/alocacao/ctx';
import { DestinoGerentes } from '@generated/components/alocacao/DestinoGerentes';
import { DestinoSheet } from '@generated/components/alocacao/DestinoSheet';
import { COM_PROJ, SEM_PROJ } from '@generated/components/alocacao/EsteiraPactuacao';

type K = 'projeto' | 'gerentes';

const getters: Record<K, (d: Destino) => string | number | null> = {
  projeto: (d) => d.p.name,
  gerentes: (d) => d.projecoes.map((x) => rotuloDestino(x.data)).sort().join(', ') || null,
};

/** Row: only the project (opens the side panel), the manager name(s) and the field to add a manager. */
function Tabela({ itens, ordem, ctx, onAbrir }: { itens: ReturnType<typeof useOrdenacao<Destino, K>>; ordem: string; ctx: AlocCtx; onAbrir: (id: string) => void }) {
  return (
    <TabelaScroll>
      <table className={tabelaCls}>
        <thead className={theadCls}>
          <tr>
            <Th k="projeto" label="Projeto destino" sort={itens.sort} setSort={itens.setSort} />
            <Th k="gerentes" label={ordem} sort={itens.sort} setSort={itens.setSort} />
          </tr>
        </thead>
        <tbody>
          {itens.ordenadas.map((d) => (
            <tr key={d.p.id} data-item-id={d.p.id} className={trCls}>
              <td className="max-w-[420px] px-3 py-2">
                <button type="button" onClick={() => onAbrir(d.p.id)} title="Abrir detalhes do projeto"
                  className="flex min-w-0 flex-col rounded-[var(--radius-sm)] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="font-mono-code text-[11px] text-primary">{codigoDe(d.p) ?? DASH}</span>
                  <span className="truncate text-[13px] font-medium text-foreground hover:underline hover:underline-offset-2">{d.p.name}</span>
                </button>
              </td>
              <td className="min-w-[260px] px-3 py-2"><DestinoGerentes ctx={ctx} d={d} semTags /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </TabelaScroll>
  );
}

export function SubDestinos({ ctx }: { ctx: AlocCtx }) {
  const { modelo, q, reportarContagem } = ctx;
  const { sel, clicar } = useFiltroCards();
  const [aberto, setAberto] = useState<string | null>(null);
  const busca = modelo.semGerente.filter((d) => casaDestino(q, d));
  const porTemp = sel.size ? busca.filter((d) => sel.has(d.temp.valor)) : busca;
  // Same counting rule as the Esteira de Projetos: with projection = at least one projection; Com + Sem = Total = rows listed below.
  const comLista = porTemp.filter((d) => d.projecoes.length > 0);
  const semLista = porTemp.filter((d) => d.projecoes.length === 0);
  const com = useOrdenacao(comLista, getters, { key: 'projeto', dir: 'asc' });
  const sem = useOrdenacao(semLista, getters, { key: 'projeto', dir: 'asc' });
  useEffect(() => { reportarContagem('destinos', porTemp.length); }, [reportarContagem, porTemp.length]);
  const regra = 'Projetos destino listados abaixo, respeitando a busca e o filtro de temperatura. Com projeção de alocação = ao menos uma projeção no app; Sem projeção = nenhuma. Total = Com + Sem.';

  return (
    <div className="flex flex-col gap-4">
      <Cards cols="sm:grid-cols-3" cards={[
        { key: 'i', label: COM_PROJ, value: comLista.length, corVar: '--farol-green', regra },
        { key: 's', label: SEM_PROJ, value: semLista.length, corVar: '--temp-30', regra },
        { key: 't', label: 'Total projetos destino', value: porTemp.length, regra },
      ]} />
      <Cards ativos={sel} onClick={clicar} cols="sm:grid-cols-4 xl:grid-cols-8"
        cards={[
          ...TEMP_CARDS.filter((t) => t !== 'Sem temperatura' || busca.some((d) => d.temp.valor === t))
            .map((t) => ({ key: t as string, label: t as string, value: busca.filter((d) => d.temp.valor === t).length, corVar: TEMP_COR[t] as string | undefined })),
          { key: '__total', label: 'Total', value: busca.length, corVar: undefined },
        ]} />

      <Secao titulo={`Projetos com projeção de alocação (${comLista.length})`}>
        {comLista.length === 0 ? <EmptyState title="Nenhum projeto com projeção" hint="Atribua gerentes na tabela abaixo ou na “Esteira de Projetos”." />
          : <Tabela itens={com} ordem="Gerente(s)" ctx={ctx} onAbrir={setAberto} />}
      </Secao>

      <Secao titulo={`Projetos sem projeção de alocação (${semLista.length})`}>
        {semLista.length === 0 ? <EmptyState title="Todos os destinos têm projeção" hint="Nada pendente de atribuição." />
          : <Tabela itens={sem} ordem="Atribuir" ctx={ctx} onAbrir={setAberto} />}
      </Secao>
      <DestinoSheet ctx={ctx} id={aberto} onClose={() => setAberto(null)} />
    </div>
  );
}
