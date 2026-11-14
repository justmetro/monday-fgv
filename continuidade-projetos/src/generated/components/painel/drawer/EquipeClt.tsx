import { AlertTriangle, Info } from 'lucide-react';
import { Skeleton } from '@components/ui/skeleton';
import { Checkbox } from '@components/ui/checkbox';
import { Chip, RascunhoTag } from '@generated/components/painel/Chips';
import { Recolhivel, Section } from '@generated/components/painel/Fields';
import { EquipeAjuste } from '@generated/components/painel/drawer/EquipeAjuste';
import { nomePessoa } from '@generated/lib/equipe';
import { fmtBRL, fmtBRL2, fmtDate, fmtNum, type Row } from '@generated/lib/painel';
import { MODALIDADES, SEM_MODALIDADE } from '@generated/lib/negocio';
import { EquipeChips } from '@generated/components/painel/EquipeChips';
import type { PainelData } from '@generated/hooks/usePainelData';

/** Equipe do projeto (uma tabela recolhível por modalidade) com marcação de Equipe base por pessoa. */
export function EquipeClt({ row, data, baseIds, setBaseIds, sujoBase }: {
  row: Row; data: PainelData; baseIds: string[]; setBaseIds: (v: string[]) => void; sujoBase: boolean;
}) {
  const eq = row.equipe;
  const base = new Set(baseIds);
  const alternar = (id: string, v: boolean) => {
    const n = new Set(base);
    if (v) n.add(id); else n.delete(id);
    setBaseIds([...n]);
  };
  const resumo = (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-[hsl(var(--chrome))] px-4 py-3">
      <div className="tnum grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <span><span className="text-muted-foreground">Equipe: </span>{row.clt}</span>
        <span title="Valor Base Plan. × fator de encargos da modalidade">
          <span className="text-muted-foreground">Custo Total: </span>{fmtBRL(row.custoMensal)}<span className="text-xs text-muted-foreground">/mês</span>
        </span>
        <span className="flex items-center gap-1.5"><span className="text-muted-foreground">Equipe Base: </span>{row.base.n || '—'}{sujoBase && <RascunhoTag />}</span>
        <span><span className="text-muted-foreground">Custo Base: </span>{fmtBRL(row.base.custoMensal)}{row.base.custoMensal !== null && <span className="text-xs text-muted-foreground">/mês</span>}</span>
        <span className="sm:col-span-2" title={row.refCusto.date ? `Até ${fmtDate(row.refCusto.date)}` : undefined}>
          <span className="text-muted-foreground">Custo até o fim: </span>{fmtBRL(row.custoAteTermino)}
        </span>
        {row.ajustado && <Chip tone="warning" title={row.ajuste ? `Ajustado por ${row.ajuste.user}` : undefined}>ajustado no app</Chip>}
      </div>
      <EquipeAjuste key={`${row.clt}-${row.custoMensal}`} row={row} data={data} />
    </div>
  );

  return (
    <Section title="Equipe" id="sec-equipe" aside={<span className="text-xs text-muted-foreground">Fonte: Equipes Revisadas (somente leitura)</span>}>
      <p className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Info className="size-3.5 shrink-0" aria-hidden /> Custo = Valor Base Plan. × fator de encargos. Marque “Base” para compor a Equipe Base (grava em Decisões do Vibe ao salvar).
      </p>
      {eq && <div className="mb-3"><EquipeChips cont={eq.porModalidade} semModalidade={eq.semModalidade.length} /></div>}
      {row.alocCarregando ? (
        <div className="flex flex-col gap-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
      ) : data.alocErro && !eq ? (
        <div className="flex items-center justify-between gap-3 rounded-md bg-[hsl(var(--danger-soft))] px-4 py-3 text-sm text-[hsl(var(--danger-ink))]">
          Não foi possível ler o quadro Equipes Revisadas.
          <button type="button" onClick={data.retryAlocacao} className="min-h-9 rounded-md px-3 font-medium hover:underline">Tentar de novo</button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {resumo}
          {row.semAlocacao ? (
            <div role="alert" className="flex items-center gap-2 rounded-md bg-[hsl(var(--warning-soft))] px-4 py-3 text-sm text-[hsl(var(--warning-ink))]">
              <AlertTriangle className="size-4 shrink-0" aria-hidden /> Sem equipe cadastrada
            </div>
          ) : eq && (
            <div className="flex flex-col gap-4">
              {[...MODALIDADES, null].map((m) => {
                const lista = eq.todas.filter((x) => x.modalidade === m);
                if (!lista.length) return null;
                const sub = lista.reduce((s, x) => s + (x.custo ?? 0), 0);
                const nBase = lista.filter((x) => base.has(x.id)).length;
                return (
                  <Recolhivel
                    key={m ?? 'sem'}
                    titulo={m ? <>{m} <span className="tnum font-normal text-muted-foreground">{lista.length}</span>{nBase > 0 && <span className="tnum ml-1 text-xs font-normal text-muted-foreground">· {nBase} base</span>}</> : <Chip tone="neutral" title="Fora dos totais por modalidade">{SEM_MODALIDADE} · {lista.length}</Chip>}
                    resumo={<span className="tnum text-xs text-muted-foreground">{m ? `fator ${fmtNum(lista[0]?.fator ?? 1)} · ${fmtBRL2(sub)}/mês` : 'fora do total'}</span>}
                  >
                    <div className="overflow-x-auto rounded-md border border-border">
                      <table className="w-full min-w-[560px] border-collapse text-sm">
                        <thead className="bg-[hsl(var(--chrome))] text-xs text-muted-foreground">
                          <tr>
                            <th scope="col" className="w-14 px-3 py-2 text-left font-medium">Base</th>
                            {['Nome', 'Papel', 'Cargo'].map((h) => <th key={h} scope="col" className="px-3 py-2 text-left font-medium">{h}</th>)}
                            <th scope="col" className="px-3 py-2 text-right font-medium">Custo mensal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lista.map((x) => (
                            <tr key={x.id} className="border-t border-border align-top">
                              <td className="px-3 py-2">
                                {m ? (
                                  <Checkbox checked={base.has(x.id)} onCheckedChange={(v) => alternar(x.id, v === true)} aria-label={`Equipe base: ${nomePessoa(x)}`} />
                                ) : <span className="text-xs text-muted-foreground">—</span>}
                              </td>
                              <td className="px-3 py-2"><span className={x.nome ? 'text-foreground' : 'italic text-muted-foreground'}>{nomePessoa(x)}</span></td>
                              <td className="px-3 py-2 text-muted-foreground"><span className="line-clamp-2 break-words">{x.papel ?? '—'}</span></td>
                              <td className="px-3 py-2 text-muted-foreground">{x.cargo ?? '—'}</td>
                              <td className="tnum px-3 py-2 text-right" title={`Valor Base Plan. ${fmtBRL2(x.mensal)} × fator ${fmtNum(x.fator)}`}>{fmtBRL2(x.custo)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Recolhivel>
                );
              })}
              <div className="tnum flex flex-wrap justify-between gap-2 rounded-md bg-[hsl(var(--chrome))] px-3 py-2 text-xs font-medium text-foreground">
                <span>Total · {eq.nClt} pessoa(s){row.base.n ? ` · ${row.base.n} na base` : ''}</span>
                <span>{fmtBRL2(eq.custoMensal)}/mês{row.base.custoMensal !== null ? ` · base ${fmtBRL2(row.base.custoMensal)}/mês` : ''}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </Section>
  );
}
