import { cn } from '@lib/utils';
import { fmtBRL } from '@generated/lib/format';
import type { Totais } from '@generated/lib/finance';
import { type ResAcumulado, regraResAcumulado } from '@generated/lib/resAcumulado';
import { NumberTicker } from '@generated/components/fx/NumberTicker';
import { InfoDica } from '@generated/components/ui-bits';

const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;
/** Compact BRL for the big numbers (the exact value stays in the title tooltip). */
const fmtC = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(v);
const SOMA = '“SEM ORÇ” e textos contam como zero.';

function Numero({ label, valor, regra }: { label: string; valor: number; regra: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="flex items-center gap-1 text-[11px] text-muted-foreground"><span className="truncate">{label}</span><InfoDica texto={regra} /></span>
      <span className={cn('tnum truncate text-lg font-light', valor < 0 ? 'text-[hsl(var(--danger))]' : 'text-foreground')} title={fmtBRL(valor)}>{fmtC(valor)}</span>
    </div>
  );
}

function Saldo({ label, orc, plan, saldo }: { label: string; orc: number; plan: number; saldo: number }) {
  const regra = `Soma do R$ Saldo ${label} (Orçado − Planejado) dos projetos da base do ciclo; ${SOMA}`;
  return (
    <div className="min-w-0 border-border px-4 py-3 sm:px-5 [&:not(:first-child)]:border-t md:[&:not(:first-child)]:border-t-0 md:[&:not(:first-child)]:border-l">
      <p className="flex items-center gap-1 text-xs text-muted-foreground">Saldo {label} <InfoDica texto={regra} /></p>
      <p className={cn('tnum mt-1 truncate text-2xl font-light tracking-[-0.02em]', saldo < 0 ? 'text-[hsl(var(--danger))]' : 'text-foreground')} title={fmtBRL(saldo)}>
        <NumberTicker value={saldo} format={fmtC} className={saldo < 0 ? undefined : 'fx-num'} />
      </p>
      <ul className="tnum mt-1 text-xs text-muted-foreground">
        <li>Orçado {fmtBRL(orc)}</li>
        <li>Planejado {fmtBRL(plan)}</li>
      </ul>
    </div>
  );
}

export interface GrupoAssinatura { label: string; n: number; orc: number; saldo: number; total?: boolean }

/**
 * Top of Financeiro: contract value of the cycle (base Res. Acumulado), the four-number summary
 * (orçado, planejado and what is left of the contract after each), the signed / not signed list and the saldo cards.
 */
export function ResumoCiclo({ res, t, grupos }: { res: ResAcumulado; t: Totais; grupos: GrupoAssinatura[] }) {
  return (
    <section className="fx-rise relative overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card">
      <div className="grid grid-cols-1 gap-x-8 gap-y-4 border-b border-border px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="min-w-0">
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            Valor total de contratos do ciclo {res.ano}
            <InfoDica texto={`Soma do Valor do Contrato dos projetos da base Res. Acumulado do ciclo. ${regraResAcumulado(res)}`} />
          </p>
          <p className="tnum mt-1 break-words text-4xl font-light leading-none tracking-[-0.02em] text-foreground" title={fmtBRL(t.contrato)}>
            <NumberTicker value={t.contrato} format={fmtC} className="fx-num" />
          </p>
          <p className="mt-1.5 text-[11px] text-[hsl(var(--fg-subtle))]">{plural(res.items.length, 'projeto', 'projetos')} na base Res. Acumulado</p>
        </div>
        <div className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-3 sm:grid-cols-4 lg:col-start-1 lg:row-start-2">
          <Numero label="Total orçado" valor={t.totalOrc} regra={`Soma do Orçado Total dos projetos da base do ciclo; ${SOMA}`} />
          <Numero label="Total planejado" valor={t.totalPlan} regra={`Soma do Planejado Total dos projetos da base do ciclo; ${SOMA}`} />
          <Numero label="Saldo do orçado" valor={t.contrato - t.totalOrc} regra="Valor total de contratos − Total orçado: parte do valor dos contratos ainda não orçada." />
          <Numero label="Saldo do planejado" valor={t.contrato - t.totalPlan} regra="Valor total de contratos − Total planejado: parte do valor dos contratos ainda não planejada." />
        </div>
        <div className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-end">
          <div className="grid grid-cols-[minmax(0,1fr)_2.5rem_5.5rem_5.5rem] gap-x-2 pb-1 text-[11px] text-[hsl(var(--fg-subtle))]" aria-hidden>
            <span /><span className="text-right">Qtd.</span><span className="text-right">Orçado</span><span className="text-right">Saldo</span>
          </div>
          <ul className="tnum text-xs">
            {grupos.map((g) => (
              <li key={g.label} className={cn('grid grid-cols-[minmax(0,1fr)_2.5rem_5.5rem_5.5rem] items-baseline gap-x-2 border-t border-border py-1.5', g.total && 'font-medium')}>
                <span className="min-w-0 truncate text-foreground" title={g.label}>{g.label}</span>
                <span className="text-right text-foreground" aria-label={`${g.n} projetos`}>{g.n}</span>
                <span className="text-right text-muted-foreground" title={fmtBRL(g.orc)}>{fmtC(g.orc)}</span>
                <span className={cn('text-right', g.saldo < 0 ? 'text-[hsl(var(--danger))]' : 'text-foreground')} title={fmtBRL(g.saldo)}>{fmtC(g.saldo)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3">
        <Saldo label="Equipe" orc={t.equipeOrc} plan={t.equipePlan} saldo={t.equipeSaldo} />
        <Saldo label="Insumos" orc={t.insumosOrc} plan={t.insumosPlan} saldo={t.insumosSaldo} />
        <Saldo label="Total" orc={t.totalOrc} plan={t.totalPlan} saldo={t.totalSaldo} />
      </div>
    </section>
  );
}
