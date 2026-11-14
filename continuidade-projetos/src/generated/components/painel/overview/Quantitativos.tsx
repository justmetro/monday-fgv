import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@lib/utils';
import { fmtBRL, type Row } from '@generated/lib/painel';
import { MODALIDADES } from '@generated/lib/negocio';
import { OPCOES_COM_SEM, TOM_SIM, type OpcaoOuSem } from '@generated/lib/extras';
import type { TotalOpcao } from '@generated/lib/equipe';

const vazio = (): TotalOpcao => ({ n: 0, custo: 0, porModalidade: { CLT: { n: 0, custo: 0 }, Bolsa: { n: 0, custo: 0 }, 'RPA fixo': { n: 0, custo: 0 }, 'Estágio': { n: 0, custo: 0 } } });

/** Quantas pessoas serão realocadas, mantidas e desligadas, com custo mensal por opção, modalidade e projeto. */
export function Quantitativos({ rows, onOpen }: { rows: Row[]; onOpen: (id: string) => void }) {
  const [verProjetos, setVerProjetos] = useState(true);
  const comEquipe = useMemo(() => rows.filter((r) => (r.equipe?.atual.length ?? 0) > 0), [rows]);
  const tot = useMemo(() => {
    const t = Object.fromEntries(OPCOES_COM_SEM.map((o) => [o, vazio()])) as Record<OpcaoOuSem, TotalOpcao>;
    for (const r of comEquipe) {
      for (const o of OPCOES_COM_SEM) {
        const x = r.resumoSim[o];
        t[o].n += x.n; t[o].custo += x.custo;
        for (const m of MODALIDADES) { t[o].porModalidade[m].n += x.porModalidade[m].n; t[o].porModalidade[m].custo += x.porModalidade[m].custo; }
      }
    }
    return t;
  }, [comEquipe]);
  const simulados = comEquipe.filter((r) => Object.keys(r.sim).length > 0).length;

  return (
    <section className="soft-stack min-w-0 rounded-xl bg-card" aria-labelledby="quant-titulo">
      <div className="border-b border-border px-5 py-4">
        <h3 id="quant-titulo" className="text-base font-semibold tracking-[-0.01em] text-foreground">Quantitativos da simulação</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Realocar, Manter e Desligar por pessoa · {simulados} de {comEquipe.length} projeto(s) com simulação · custo mensal (base × fator)</p>
      </div>

      <div className="grid grid-cols-2 gap-px bg-border lg:grid-cols-4">
        {OPCOES_COM_SEM.map((o) => (
          <div key={o} className="flex min-w-0 flex-col gap-1 bg-card px-5 py-4">
            <span className={cn('inline-flex w-fit items-center rounded-full px-2 text-[11px] font-medium', TOM_SIM[o])}>{o}</span>
            <span className="tnum text-3xl font-normal tracking-[-0.03em] text-foreground">{tot[o].n}<span className="ml-1 text-sm text-muted-foreground">pessoa(s)</span></span>
            <span className="tnum text-sm text-muted-foreground">{fmtBRL(tot[o].custo)}/mês</span>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto border-t border-border">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <caption className="sr-only">Por modalidade</caption>
          <thead className="bg-[hsl(var(--chrome))] text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-5 py-2 text-left font-medium">Por modalidade</th>
              {OPCOES_COM_SEM.map((o) => <th key={o} scope="col" className="px-3 py-2 text-right font-medium">{o}</th>)}
            </tr>
          </thead>
          <tbody>
            {MODALIDADES.map((m) => (
              <tr key={m} className="border-t border-border">
                <th scope="row" className="px-5 py-2 text-left font-normal text-foreground">{m}</th>
                {OPCOES_COM_SEM.map((o) => <Celula key={o} n={tot[o].porModalidade[m].n} custo={tot[o].porModalidade[m].custo} />)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-border">
        <button type="button" onClick={() => setVerProjetos((v) => !v)} aria-expanded={verProjetos} className="flex min-h-11 w-full items-center gap-1.5 px-5 text-left text-sm font-semibold text-foreground hover:bg-[hsl(var(--chrome))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
          <ChevronDown className={cn('size-4 text-muted-foreground transition-transform duration-150', !verProjetos && '-rotate-90')} aria-hidden />
          Por projeto <span className="tnum font-normal text-muted-foreground">{comEquipe.length}</span>
        </button>
        {verProjetos && (
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead className="sticky top-0 bg-[hsl(var(--chrome))] text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-5 py-2 text-left font-medium">Projeto</th>
                  {OPCOES_COM_SEM.map((o) => <th key={o} scope="col" className="px-3 py-2 text-right font-medium">{o}</th>)}
                </tr>
              </thead>
              <tbody>
                {comEquipe.map((r) => (
                  <tr key={r.projeto.id} className="border-t border-border hover:bg-[hsl(var(--chrome))]">
                    <td className="max-w-[340px] px-5 py-2">
                      <button type="button" onClick={() => onOpen(r.projeto.id)} className="line-clamp-2 break-words text-left text-foreground hover:text-primary focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{r.projeto.name}</button>
                    </td>
                    {OPCOES_COM_SEM.map((o) => <Celula key={o} n={r.resumoSim[o].n} custo={r.resumoSim[o].custo} />)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function Celula({ n, custo }: { n: number; custo: number }) {
  return (
    <td className="tnum whitespace-nowrap px-3 py-2 text-right">
      {n ? <><span className="text-foreground">{n}</span><span className="block text-xs text-muted-foreground">{fmtBRL(custo)}</span></> : <span className="text-muted-foreground">—</span>}
    </td>
  );
}
