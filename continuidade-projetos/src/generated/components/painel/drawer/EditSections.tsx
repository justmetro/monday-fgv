import { AlertTriangle, Info } from 'lucide-react';
import { Textarea } from '@components/ui/textarea';
import { RascunhoTag } from '@generated/components/painel/Chips';
import { Field, Section, SelectField } from '@generated/components/painel/Fields';
import { PeoplePicker } from '@generated/components/painel/PeoplePicker';
import { DECISOES, calcManterAte, diasEntre, fmtDate, fmtNum } from '@generated/lib/painel';
import type { DraftDecisao } from '@generated/components/painel/drawer/types';

/** Seção "Decisão" (grava no quadro Continuidade – Decisões). Meses de manutenção ficam na Simulação de Cálculo de Custo. */
export function DecisaoSection({ d, setD, termino, dataBase, errors, sujo }: {
  d: DraftDecisao; setD: (v: DraftDecisao) => void; termino: string | null; dataBase: string; errors: Record<string, string>; sujo: boolean;
}) {
  const set = <K extends keyof DraftDecisao>(k: K, v: DraftDecisao[K]) => setD({ ...d, [k]: v });
  const manterAte = calcManterAte(dataBase, d.meses);
  const diff = diasEntre(manterAte, termino);
  return (
    <Section title="Decisão" id="sec-decisao" aside={<span className="flex items-center gap-2 text-xs text-muted-foreground">{sujo && <RascunhoTag />}Grava em Continuidade – Decisões</span>}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Decisão" htmlFor="f-decisao" error={errors.decisao}><SelectField id="f-decisao" value={d.decisao} onChange={(v) => set('decisao', v)} options={DECISOES} /></Field>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-[hsl(var(--info-soft))] px-4 py-3 text-sm text-[hsl(var(--info-ink))]">
            <span className="font-medium">Manter até:</span>
            {manterAte ? (
              <span className="tnum">{fmtDate(manterAte)} <span className="text-xs opacity-80">(decisão em {fmtDate(dataBase)} + {fmtNum(d.meses)} {d.meses === 1 ? 'mês' : 'meses'})</span></span>
            ) : (
              <span className="text-xs">informe os meses de manutenção (Simulação de Cálculo de Custo) para calcular</span>
            )}
          </div>
          {manterAte && diff !== null && diff > 0 && (
            <p className="flex items-start gap-2 rounded-md bg-[hsl(var(--warning-soft))] px-4 py-2.5 text-sm text-[hsl(var(--warning-ink))]">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>Ultrapassa o último produto previsto ({fmtDate(termino)}) em {diff} {diff === 1 ? 'dia' : 'dias'} — verifique renovação/aditivo</span>
            </p>
          )}
          {manterAte && diff !== null && diff < 0 && (
            <p className="flex items-start gap-2 rounded-md bg-[hsl(var(--neutral-soft))] px-4 py-2.5 text-sm text-[hsl(var(--neutral-ink))]">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>Equipe sai {Math.abs(diff)} {Math.abs(diff) === 1 ? 'dia' : 'dias'} antes do último produto previsto</span>
            </p>
          )}
        </div>
        <Field label="Detalhe da decisão" htmlFor="f-detalhe" className="sm:col-span-2">
          <Textarea id="f-detalhe" value={d.detalhe} onChange={(e) => set('detalhe', e.target.value)} rows={3} placeholder="Ex.: Vamos manter a equipe por 3 meses" className="bg-card text-base sm:text-sm" />
        </Field>
        <Field label="Responsável pela decisão" htmlFor="f-resp" className="sm:col-span-2">
          <PeoplePicker id="f-resp" value={d.responsaveis} onChange={(v) => set('responsaveis', v)} />
        </Field>
      </div>
    </Section>
  );
}
