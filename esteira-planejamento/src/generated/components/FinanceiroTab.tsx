import { TabelaScroll } from '@generated/components/TabelaScroll';
import { NomeLink } from '@generated/components/NomeLink';
import { Fragment, useMemo, useState } from 'react';
import { cn } from '@lib/utils';
import { type Projeto, codigoDe, fmtBRL, fmtPct, DASH } from '@generated/lib/format';
import { type Par, paresDe, semOrcamentoEm, somar, marcadorTexto } from '@generated/lib/finance';
import { Panel, EmptyState, Money } from '@generated/components/ui-bits';
import { NaoAssinado } from '@generated/components/Etiquetas';
import { ResumoCiclo } from '@generated/components/financeiro/ResumoCiclo';
import type { ResAcumulado } from '@generated/lib/resAcumulado';

const PAGE = 60;

function SaldoTxt({ par }: { par: Par }) {
  const marca = marcadorTexto(par.saldoRaw);
  if (marca) return <span className="text-[11px] uppercase tracking-wide text-[hsl(var(--fg-subtle))]">{marca}</span>;
  return <Money value={par.saldo} />;
}
function PctTxt({ par }: { par: Par }) {
  const marca = marcadorTexto(par.pctRaw);
  if (marca) return <span className="text-[11px] uppercase tracking-wide text-[hsl(var(--fg-subtle))]">{marca}</span>;
  return <span className={cn('tnum', (par.pct ?? 0) < 0 && 'font-medium text-[hsl(var(--danger))]')}>{fmtPct(par.pct)}</span>;
}

/** Not shown at all in Financeiro: Pausado (Novo Cadastro arrives already filtered by the "Incluir:" toggles). */
const FORA_DO_FINANCEIRO = ['Pausado'];

export function FinanceiroTab({ items: todos, resAcum, onOpen }: { items: Projeto[]; resAcum: ResAcumulado; onOpen: (p: Projeto) => void }) {
  const items = useMemo(() => todos.filter((p) => !p.statusPlanejamento || !FORA_DO_FINANCEIRO.includes(p.statusPlanejamento)), [todos]);
  const [visiveis, setVisiveis] = useState(PAGE);

  // "SEM ORÇ" in the Total cut goes to a separate "Sem orçamento" group at the end of the table.
  const comOrc = useMemo(() => items.filter((p) => !semOrcamentoEm(p, 'total')), [items]);
  const semOrc = useMemo(() => items.filter((p) => semOrcamentoEm(p, 'total')), [items]);
  // Cycle summary: base "Res. Acumulado" (same filter as the monday dashboard), top filters applied.
  const base = resAcum.items;
  const t = useMemo(() => somar(base), [base]);
  const grupos = useMemo(() => {
    const ass = base.filter((p) => !!p.dataDeAssinatura);
    const nao = base.filter((p) => !p.dataDeAssinatura);
    const ta = somar(ass);
    const tn = somar(nao);
    return [
      { label: 'Assinados', n: ass.length, orc: ta.totalOrc, saldo: ta.totalSaldo },
      { label: 'Em planejamento (não assinados)', n: nao.length, orc: tn.totalOrc, saldo: tn.totalSaldo },
      { label: 'Total', n: base.length, orc: t.totalOrc, saldo: t.totalSaldo, total: true },
    ];
  }, [base, t]);

  if (!items.length && !base.length) {
    return <EmptyState title="Nenhum projeto para consolidar" hint="Os saldos orçado x planejado aparecem aqui quando houver projetos no escopo dos filtros." />;
  }

  return (
    <div className="flex flex-col gap-4">
      <ResumoCiclo res={resAcum} t={t} grupos={grupos} />

      <Panel>
        <TabelaScroll>
          <table className="tnum w-full min-w-[1180px] border-collapse text-[13px]">
            <thead className="bg-[hsl(var(--surface-chrome))] text-xs text-muted-foreground">
              <tr>
                <th rowSpan={2} className="border-b border-border px-3 py-2 text-left font-medium">Projeto</th>
                <th rowSpan={2} className="border-b border-l border-border px-3 py-2 text-right font-medium">Valor do Contrato</th>
                {['Equipe', 'Insumos', 'Total'].map((g) => (
                  <th key={g} colSpan={4} className="border-l border-border px-3 pt-2 text-left font-semibold text-foreground">{g}</th>
                ))}
              </tr>
              <tr className="border-b border-border">
                {[0, 1, 2].flatMap((i) => [
                  <th key={`o${i}`} className="border-l border-border px-3 py-1.5 text-right font-medium">Orçado</th>,
                  <th key={`p${i}`} className="px-3 py-1.5 text-right font-medium">Planejado</th>,
                  <th key={`s${i}`} className="px-3 py-1.5 text-right font-medium">Saldo R$</th>,
                  <th key={`q${i}`} className="px-3 py-1.5 text-right font-medium">%</th>,
                ])}
              </tr>
            </thead>
            <tbody>
              {[...comOrc, ...semOrc].slice(0, visiveis).map((p, i) => {
                const pares = paresDe(p);
                const cab = semOrc.length > 0 && i === comOrc.length;
                return (
                  <Fragment key={p.id}>
                  {cab && (
                    <tr className="border-b border-border bg-[hsl(var(--surface-chrome))]">
                      <td colSpan={14} className="px-3 py-2 text-xs font-semibold text-foreground">Sem orçamento ({semOrc.length}) <span className="font-normal text-muted-foreground">· “SEM ORÇ” no saldo Total</span></td>
                    </tr>
                  )}
                  <tr data-item-id={p.id} onClick={() => onOpen(p)} className="cursor-pointer border-b border-border transition-colors duration-150 last:border-b-0 hover:bg-[hsl(var(--surface-2))]">
                    <td className="max-w-[320px] px-3 py-2 text-left">
                      <button type="button" aria-label={`Abrir detalhes de ${p.name}`} onClick={(ev) => { ev.stopPropagation(); onOpen(p); }} className="font-mono-code block text-left text-[11px] text-primary hover:underline rounded-[var(--radius-sm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        {codigoDe(p) ?? DASH}
                      </button>
                      <NomeLink p={p} className="font-normal" />
                      {!p.dataDeAssinatura && (
                        <div className="mt-1 flex flex-wrap gap-1" onClick={(ev) => ev.stopPropagation()} role="presentation"><NaoAssinado /></div>
                      )}
                    </td>
                    <td className="border-l border-border px-3 py-2 text-right text-foreground">{fmtBRL(p.valorDoContrato)}</td>
                    {pares.map((x) => [
                      <td key={`${x.key}o`} className="border-l border-border px-3 py-2 text-right text-muted-foreground">{fmtBRL(x.orcado)}</td>,
                      <td key={`${x.key}p`} className="px-3 py-2 text-right text-muted-foreground">{fmtBRL(x.planejado)}</td>,
                      <td key={`${x.key}s`} className="whitespace-nowrap px-3 py-2 text-right"><SaldoTxt par={x} /></td>,
                      <td key={`${x.key}q`} className="px-3 py-2 text-right"><PctTxt par={x} /></td>,
                    ])}
                  </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {items.length === 0 && <EmptyState title="Nenhum projeto na tabela" hint="Nenhum projeto assinado no período selecionado com os filtros atuais." />}
        </TabelaScroll>
        {items.length > visiveis && (
          <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground">
            <span className="tnum">Exibindo {visiveis} de {items.length}</span>
            <button type="button" onClick={() => setVisiveis((v) => v + PAGE)} className="h-11 rounded-[var(--radius-md)] border border-input px-3 text-[13px] text-foreground hover:bg-[hsl(var(--surface-3))] md:h-8">
              Mostrar mais
            </button>
          </div>
        )}
      </Panel>
    </div>
  );
}
