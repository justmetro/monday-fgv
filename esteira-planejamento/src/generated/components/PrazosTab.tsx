import { TabelaScroll } from '@generated/components/TabelaScroll';
import { NomeLink } from '@generated/components/NomeLink';
import { Fragment, useMemo, useState } from 'react';
import { cn } from '@lib/utils';
import { type Projeto, codigoDe, gerenteDe, fmtDate, DASH } from '@generated/lib/format';
import { type Etapa, type Farol, etapasDe, severidade, proximoPrazo } from '@generated/lib/farol';
import { ChevronRight } from 'lucide-react';
import { FarolChip, FAROL_META, Panel, EmptyState, StatusPill, InfoDica, useAberto } from '@generated/components/ui-bits';
import { isInativo } from '@generated/lib/board-options';

type Filtro = 'todos' | 'atrasado' | 'vence';
const PAGE = 60;

const ETAPAS_TXT = 'Contagem de etapas (Planejamento, Registro SGI e Dimensionamento) dos projetos da lista, com o período aplicado.';
const FAROL_REGRA: Record<Farol, string> = {
  atrasado: 'Atrasado: etapa aberta com prazo vencido, ou concluída fora do prazo (Resultado 0% ou conclusão depois do prazo).',
  vence: 'Vence ≤ 7 d: etapa aberta com prazo entre hoje e os próximos 7 dias.',
  noPrazo: 'No prazo: etapa concluída no prazo (Resultado 100% ou conclusão até o prazo).',
  aberto: 'Em aberto: etapa sem conclusão com prazo daqui a mais de 7 dias.',
  inativo: 'Inativo: etapa aberta em projeto Finalizado, Pausado, Despriorizado ou Sem planejamento — nunca gera alerta.',
  semData: 'Sem data: etapa aberta sem prazo calculado no quadro.',
};
const SEG_REGRA: Record<Filtro, string> = {
  todos: 'Todos os projetos da lista, ordenados por criticidade (atrasos primeiro, depois prazo mais próximo).',
  atrasado: 'Projetos ativos com ao menos uma etapa atrasada (projetos inativos não contam).',
  vence: 'Projetos ativos com ao menos uma etapa que vence entre hoje e os próximos 7 dias.',
};

function EtapaCell({ e }: { e: Etapa }) {
  return (
    <td className="px-3 py-2 align-top">
      <div className="flex flex-col gap-1">
        <FarolChip farol={e.farol} text={e.detalhe} />
        <dl className="tnum grid grid-cols-[auto_1fr] gap-x-2 text-[11px] leading-4 text-muted-foreground">
          <dt>Prazo</dt><dd className="text-foreground">{fmtDate(e.prazo)}</dd>
          <dt>Concl.</dt><dd className="text-foreground">{fmtDate(e.conclusao)}</dd>
          <dt>Result.</dt><dd className="text-foreground">{e.resultado?.trim() || DASH}</dd>
          {e.extra && (<><dt>{e.extra.label}</dt><dd className="text-foreground">{e.extra.value?.trim() || DASH}</dd></>)}
        </dl>
      </div>
    </td>
  );
}

export function PrazosTab({ items, onOpen }: { items: Projeto[]; onOpen: (p: Projeto) => void }) {
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [visiveis, setVisiveis] = useState(PAGE);
  const abAss = useAberto('prazos:assinados');
  const abPac = useAberto('prazos:pactuacao');

  const linhas = useMemo(() => {
    return items
      .map((p) => {
        const etapas = etapasDe(p);
        const inativo = isInativo(p.statusPlanejamento);
        return { p, etapas, inativo, sev: severidade(etapas, inativo), prox: proximoPrazo(etapas) };
      })
      .sort((a, b) => b.sev - a.sev || a.prox - b.prox || a.p.name.localeCompare(b.p.name, 'pt-BR'));
  }, [items]);

  const contagem = useMemo(() => {
    const c: Record<Farol, number> = { atrasado: 0, vence: 0, noPrazo: 0, aberto: 0, inativo: 0, semData: 0 };
    for (const l of linhas) for (const e of l.etapas) c[e.farol]++;
    return c;
  }, [linhas]);

  // Shortcuts only consider active projects (inactive ones never raise alerts).
  const casa = (l: (typeof linhas)[number], f: Farol) => !l.inativo && l.etapas.some((e) => e.farol === f);
  const filtradas = linhas.filter((l) => (filtro === 'todos' ? true : casa(l, filtro)));
  const nAtraso = linhas.filter((l) => casa(l, 'atrasado')).length;
  const nVence = linhas.filter((l) => casa(l, 'vence')).length;
  // Two collapsible groups (criticality order kept inside each): signed (Data de Assinatura) and still in negotiation.
  const grupos = [
    { k: 'assinados', titulo: 'Projetos assinados', regra: 'Com Data de Assinatura preenchida.', ab: abAss, linhas: filtradas.filter((l) => !!l.p.dataDeAssinatura) },
    { k: 'pactuacao', titulo: 'Projetos em pactuação', regra: 'Sem Data de Assinatura.', ab: abPac, linhas: filtradas.filter((l) => !l.p.dataDeAssinatura) },
  ];
  // Rows of the open groups only; "Mostrar mais" pages through them (headers always stay visible).
  const abertas = grupos.flatMap((g) => (g.ab.aberto ? g.linhas.map((l) => ({ l, g })) : []));
  const mostradas = new Set(abertas.slice(0, visiveis).map((x) => x.l.p.id));

  if (!items.length) {
    return <EmptyState title="Nenhum projeto para avaliar prazos" hint="Os farois aparecem aqui assim que houver projetos no escopo dos filtros." />;
  }

  const seg = (k: Filtro, label: string, n?: number) => (
    <span className="inline-flex items-center">
    <button
      type="button"
      aria-pressed={filtro === k}
      onClick={() => { setFiltro(k); setVisiveis(PAGE); }}
      className={cn(
        'inline-flex h-11 items-center gap-1.5 rounded-[var(--radius-sm)] px-2.5 text-[13px] transition-colors duration-150 md:h-7',
        filtro === k ? 'bg-[hsl(var(--surface-3))] text-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
      {n !== undefined && <span className="tnum text-xs text-muted-foreground">{n}</span>}
    </button>
    <InfoDica texto={SEG_REGRA[k]} />
    </span>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {(Object.keys(FAROL_META) as Farol[]).map((f) => (
            <span key={f} className="inline-flex items-center gap-1.5">
              <FarolChip farol={f} />
              <span className="tnum text-foreground">{contagem[f]}</span>
              <span>etapas</span>
              <InfoDica texto={`${ETAPAS_TXT} ${FAROL_REGRA[f]}`} />
            </span>
          ))}
        </div>
        <fieldset className="m-0 flex min-w-0 items-center gap-0.5 rounded-[var(--radius-md)] border border-border bg-card p-0.5">
          <legend className="sr-only">Filtrar por farol</legend>
          {seg('todos', 'Todos', linhas.length)}
          {seg('atrasado', 'Com atraso', nAtraso)}
          {seg('vence', 'Vence em 7 dias', nVence)}
        </fieldset>
      </div>

      <Panel>
        <TabelaScroll>
          <table className="w-full min-w-[920px] border-collapse text-left text-[13px]">
            <thead className="sticky top-0 bg-[hsl(var(--surface-chrome))] text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-3 py-2 font-medium">Projeto</th>
                <th className="w-[22%] px-3 py-2 font-medium">Planejamento</th>
                <th className="w-[22%] px-3 py-2 font-medium">Registro SGI</th>
                <th className="w-[22%] px-3 py-2 font-medium">Dimensionamento</th>
              </tr>
            </thead>
            <tbody>
              {grupos.filter((g) => g.linhas.length > 0).map((g) => (
                <Fragment key={g.k}>
                <tr className="border-b border-border bg-[hsl(var(--surface-chrome))]">
                  <td colSpan={4} className="px-3 py-1 text-xs font-semibold text-foreground">
                    <span className="inline-flex items-center gap-1">
                      <button type="button" onClick={g.ab.alternar} aria-expanded={g.ab.aberto}
                        className="-ml-1.5 inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-sm)] px-1.5 text-left hover:bg-[hsl(var(--surface-2))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-7">
                        <ChevronRight className={cn('size-4 shrink-0 text-muted-foreground transition-transform duration-150', g.ab.aberto && 'rotate-90')} aria-hidden />
                        {g.titulo} <span className="tnum font-normal text-muted-foreground">({g.linhas.length})</span>
                      </button>
                      <InfoDica texto={`${g.regra} Ordenados por criticidade; os atalhos “Com atraso” e “Vence em 7 dias” valem para os dois grupos. Clique no título para recolher ou expandir.`} />
                    </span>
                  </td>
                </tr>
                {g.ab.aberto && g.linhas.filter((l) => mostradas.has(l.p.id)).map(({ p, etapas }) => (
                <tr
                  key={p.id}
                  data-item-id={p.id}
                  onClick={() => onOpen(p)}
                  className="cursor-pointer border-b border-border transition-colors duration-150 last:border-b-0 hover:bg-[hsl(var(--surface-2))]"
                >
                  <td className="max-w-[340px] px-3 py-2 align-top">
                    <button type="button" aria-label={`Abrir detalhes de ${p.name}`} onClick={(ev) => { ev.stopPropagation(); onOpen(p); }} className="font-mono-code block text-left text-[11px] text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-[var(--radius-sm)]">
                      {codigoDe(p) ?? DASH}
                    </button>
                    <NomeLink p={p} />
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground" title={gerenteDe(p)}>{gerenteDe(p)}</span>
                    <StatusPill label={p.statusPlanejamento} className="mt-1" />
                  </td>
                  {etapas.map((e) => <EtapaCell key={e.key} e={e} />)}
                </tr>
                ))}
                </Fragment>
              ))}
            </tbody>
          </table>
          {filtradas.length === 0 && (
            <EmptyState title="Nenhum projeto com esse farol" hint="Volte para “Todos” para ver a lista completa ordenada por criticidade." />
          )}
        </TabelaScroll>
        {abertas.length > visiveis && (
          <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground">
            <span className="tnum">Exibindo {visiveis} de {abertas.length}</span>
            <button type="button" onClick={() => setVisiveis((v) => v + PAGE)} className="h-11 rounded-[var(--radius-md)] border border-input px-3 text-[13px] text-foreground hover:bg-[hsl(var(--surface-3))] md:h-8">
              Mostrar mais
            </button>
          </div>
        )}
      </Panel>
    </div>
  );
}
