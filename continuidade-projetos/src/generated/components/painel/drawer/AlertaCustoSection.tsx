import { useState } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Checkbox } from '@components/ui/checkbox';
import { cn } from '@lib/utils';
import { RascunhoTag } from '@generated/components/painel/Chips';
import { Field, NumberField, Recolhivel, Section } from '@generated/components/painel/Fields';
import { fmtBRL, fmtBRL2, fmtDate, fmtNum, type Row } from '@generated/lib/painel';
import { nomePessoa } from '@generated/lib/equipe';
import { OPCOES_COM_SEM, OPCOES_SIM, TOM_SIM, opcaoDe, type OpcaoSim, type Simulacao } from '@generated/lib/extras';

/** Simulação de custo: Meses de manutenção + Realocar/Desligar/Manter por pessoa (individual ou em massa). */
export function AlertaCustoSection({ row, meses, setMeses, manterAte, sim, setSim, sujo }: {
  row: Row; meses: number | null; setMeses: (v: number | null) => void; manterAte: string | null;
  sim: Simulacao; setSim: (v: Simulacao) => void; sujo: boolean;
}) {
  const pessoas = row.equipe?.atual ?? [];
  const [sel, setSel] = useState<Set<string>>(new Set());
  const aplicar = (ids: string[], op: OpcaoSim | null) => {
    const n: Simulacao = { ...sim };
    for (const id of ids) { if (op) n[id] = op; else delete n[id]; }
    setSim(n);
  };
  const alternarSel = (id: string, v: boolean) => setSel((s) => { const n = new Set(s); if (v) n.add(id); else n.delete(id); return n; });
  const todosSel = pessoas.length > 0 && sel.size === pessoas.length;
  const tot = row.resumoSim;
  const simulando = tot.Realocar.n + tot.Desligar.n > 0;
  // Permanecem: Manter + sem definição. Sem simulação, vale o custo mensal do projeto (inclui ajuste do app).
  const mensal = simulando ? tot.Manter.custo + tot['Sem definição'].custo : row.custoMensal ?? 0;
  const ficam = tot.Manter.n + tot['Sem definição'].n;
  const total = meses !== null && meses > 0 ? mensal * meses : null;

  return (
    <Section title="Simulação de Cálculo de Custo" id="sec-custo" aside={<span className="flex items-center gap-2 text-xs text-muted-foreground">{sujo && <RascunhoTag />}Grava em Decisões do Vibe ao salvar</span>}>
      <Field label="Meses de manutenção" htmlFor="f-meses" className="mb-4 sm:max-w-xs">
        <NumberField id="f-meses" value={meses} onChange={setMeses} step={1} />
      </Field>
      {total === null ? (
        <p className="rounded-md border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">Informe os Meses de manutenção para calcular o custo de manter a equipe.</p>
      ) : (
        <div role="status" className="flex items-start gap-3 rounded-md bg-[hsl(var(--warning-soft))] px-4 py-3 text-[hsl(var(--warning-ink))]">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="min-w-0">
            <p className="text-base font-medium">
              Manter {simulando ? `${ficam} de ${pessoas.length} pessoas` : 'a equipe'} por {fmtNum(meses)} {meses === 1 ? 'mês' : 'meses'} custa {fmtBRL(total)}
            </p>
            <p className="tnum mt-0.5 text-xs opacity-80">{fmtBRL(mensal)}/mês × {fmtNum(meses)}{manterAte ? ` · até ${fmtDate(manterAte)}` : ''}{simulando ? ' · Manter + sem definição' : ''}</p>
          </div>
        </div>
      )}

      {pessoas.length > 0 && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Total da simulação">
            {OPCOES_COM_SEM.map((o) => (
              <div key={o} className="flex min-w-0 flex-col gap-0.5 rounded-md border border-border bg-card px-3 py-2">
                <span className={cn('inline-flex w-fit items-center rounded-full px-2 text-[11px] font-medium', TOM_SIM[o])}>{o}</span>
                <span className="tnum text-lg text-foreground">{tot[o].n}<span className="ml-1 text-xs text-muted-foreground">pessoa(s)</span></span>
                <span className="tnum text-xs text-muted-foreground">{fmtBRL2(tot[o].custo)}/mês</span>
              </div>
            ))}
          </div>

          <Recolhivel className="mt-4" titulo={<>Pessoas <span className="tnum font-normal text-muted-foreground">{pessoas.length}</span></>}
            resumo={Object.keys(sim).length > 0 ? (
              <button type="button" onClick={() => setSim({})} className="inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-xs text-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <RotateCcw className="size-3.5" aria-hidden /> Limpar simulação
              </button>
            ) : undefined}
          >
            <div className="flex flex-wrap items-center gap-2 rounded-md bg-[hsl(var(--chrome))] px-3 py-2">
              <label className="flex min-h-8 items-center gap-2 text-xs text-foreground">
                <Checkbox checked={todosSel ? true : sel.size ? 'indeterminate' : false} onCheckedChange={(v) => setSel(v === true ? new Set(pessoas.map((x) => x.id)) : new Set())} aria-label="Selecionar todas as pessoas" />
                {sel.size ? `${sel.size} selecionada(s)` : 'Selecionar todas'}
              </label>
              <span className="ml-auto flex flex-wrap gap-1">
                {OPCOES_SIM.map((op) => (
                  <button key={op} type="button" disabled={!sel.size} onClick={() => { aplicar([...sel], op); setSel(new Set()); }}
                    className="min-h-8 rounded-md border border-border bg-card px-2.5 text-xs text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {op}
                  </button>
                ))}
              </span>
            </div>
            <ul className="divide-y divide-border rounded-md border border-border">
              {pessoas.map((x) => {
                const atual = opcaoDe(sim, x.id);
                return (
                  <li key={x.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2 text-sm">
                    <Checkbox checked={sel.has(x.id)} onCheckedChange={(v) => alternarSel(x.id, v === true)} aria-label={`Selecionar ${nomePessoa(x)}`} />
                    <span className={cn('min-w-0 flex-1 break-words text-foreground', !x.nome && 'italic text-muted-foreground')}>
                      {nomePessoa(x)} <span className="text-xs text-muted-foreground">· {x.modalidade}</span>
                    </span>
                    <span className="tnum text-xs text-muted-foreground">{fmtBRL2(x.custo)}</span>
                    <div role="radiogroup" aria-label={`Simulação para ${nomePessoa(x)}`} className="inline-flex rounded-md border border-border p-0.5">
                      {OPCOES_SIM.map((op) => {
                        const ativo = atual === op;
                        return (
                          <button key={op} type="button" role="radio" aria-checked={ativo} onClick={() => aplicar([x.id], ativo ? null : op)}
                            className={cn('min-h-8 rounded px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', ativo ? cn('font-medium', TOM_SIM[op]) : 'text-muted-foreground hover:text-foreground')}>
                            {op}
                          </button>
                        );
                      })}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Recolhivel>
        </>
      )}
    </Section>
  );
}
